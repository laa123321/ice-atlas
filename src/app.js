const express = require('express');
const session = require('express-session');
const storeModule = require('connect-mongo');
const MongoStore = storeModule.default || storeModule;
const { rateLimit } = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const path = require('node:path');
const { hashPassword, verifyPassword } = require('./password');
const { createSeasonService } = require('./season');
const { createRankingsService } = require('./rankings');
const {createForumRouter}=require('./forum');
const cookieName = 'ice_atlas.sid';
const sessionAge = 7 * 24 * 60 * 60 * 1000;
const asUser = user => ({ id: user._id.toString(), nickname: user.nickname, email: user.email });
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));

async function createApplication({ client, dbName, secret, enableSeasonSync = true }) {
  const db = client.db(dbName);
  const users = db.collection('users');
  const season = await createSeasonService({ db, enabled: enableSeasonSync });
  const rankings = await createRankingsService({ db, enabled: enableSeasonSync });
  await users.createIndex({ email: 1 }, { unique: true });
  const store = MongoStore.create({ client, dbName, collectionName: 'sessions', ttl: sessionAge / 1000 });
  store.on('error', () => console.error('登录会话存储暂时不可用。'));
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      let badOrigin = false;
      try { if (origin) badOrigin = new URL(origin).origin !== `${req.protocol}://${req.get('host')}`; }
      catch { badOrigin = true; }
      if (badOrigin || req.get('sec-fetch-site') === 'cross-site' || req.get('X-Ice-Atlas') !== '1') return res.status(403).json({ message: '请求来源无效，请刷新页面后重试。' });
      if (!req.is('application/json')) return res.status(415).json({ message: '请使用 JSON 格式提交。' });
    }
    next();
  });
  app.use('/api', express.json({ limit: '8kb', strict: true }));
  app.use('/api', session({
    name: cookieName, secret, store, resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: sessionAge, path: '/' }
  }));
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-8', legacyHeaders: false, skipSuccessfulRequests: true, message: { message: '尝试次数过多，请在 15 分钟后重试。' } });
  const dummyHash = await hashPassword('ice-atlas-invalid-account-placeholder');
  async function currentUser(req) {
    if (!req.session.userId || !ObjectId.isValid(req.session.userId)) return null;
    return users.findOne({ _id: new ObjectId(req.session.userId) }, { projection: { passwordHash: 0 } });
  }
  async function signIn(req, user) {
    await regenerateSession(req); req.session.userId = user._id.toString(); await saveSession(req);
  }
  function credentials(body) {
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') return null;
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.password.length < 8 || body.password.length > 128) return null;
    return { email, password: body.password };
  }
  app.get('/api/health', async (req, res) => { await db.command({ ping: 1 }); res.json({ ok: true }); });
  app.get('/api/season', async (req, res) => { res.json(await season.read()); });
  app.get('/api/rankings', async (req,res)=>{
    const group=req.query.group||'senior';
    if(!['senior','junior'].includes(group))return res.status(400).json({message:'请选择成年或青年女单榜单。'});
    res.json(await rankings.read(group));
  });
  const rankingLimiter=rateLimit({windowMs:60000,limit:2,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'刚刚已检查过，请稍后再同步。'}});
  app.post('/api/rankings/sync',rankingLimiter,async(req,res)=>{
    await rankings.sync();res.json({senior:await rankings.read('senior'),junior:await rankings.read('junior')});
  });
  app.get('/api/auth/me', async (req, res) => { const user = await currentUser(req); res.json({ user: user ? asUser(user) : null }); });
  app.post('/api/auth/register', authLimiter, async (req, res) => {
    const input = credentials(req.body);
    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname.trim() : '';
    if (!input || nickname.length < 2 || nickname.length > 20 || /[<>\x00-\x1f\x7f]/.test(nickname)) return res.status(400).json({ message: '请填写有效邮箱、2–20 字昵称和 8–128 位密码，昵称不能含尖括号或控制字符。' });
    const user = { email: input.email, nickname, passwordHash: await hashPassword(input.password), createdAt: new Date() };
    try { user._id = (await users.insertOne(user)).insertedId; }
    catch (error) { if (error.code === 11000) return res.status(409).json({ message: '该邮箱已注册，请直接登录。' }); throw error; }
    await signIn(req, user);
    res.status(201).json({ user: asUser(user), message: '注册成功，已自动登录。' });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = credentials(req.body);
    if (!input) return res.status(400).json({ message: '请填写有效邮箱和 8–128 位密码。' });
    const user = await users.findOne({ email: input.email });
    const matches = await verifyPassword(input.password, user?.passwordHash || dummyHash);
    if (!user || !matches) return res.status(401).json({ message: '邮箱或密码不正确。' });
    await signIn(req, user); res.json({ user: asUser(user), message: '登录成功。' });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    res.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.json({ message: '已退出登录。' });
  });
  app.use('/api/forum',await createForumRouter(db,currentUser));
  app.use('/api', (req, res) => res.status(404).json({ message: '接口不存在。' }));
  app.use((req, res) => res.status(404).type('text').send('页面不存在。'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ message: '提交内容过长。' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: '提交的数据格式不正确。' });
    console.error('请求处理失败：' + error.name); res.status(503).json({ message: '服务暂时不可用，请稍后重试。' });
  });
  return { app, store, season, rankings };
}
module.exports = { createApplication };
