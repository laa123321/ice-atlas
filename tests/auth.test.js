// 使用独立的随机 MongoDB 测试库；完成后只删除该测试库，不触碰 ice_atlas。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { once } = require('node:events');
const { createApplication } = require('../src/app');
const { ensureLocalMongo } = require('../src/local-mongo');

test('真实 MongoDB：注册、登录、会话与游客权限', { timeout: 90000 }, async t => {
  const uri = 'mongodb://127.0.0.1:27017';
  const stopMongo = await ensureLocalMongo(uri);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  const dbName = `ice_atlas_test_${Date.now()}_${process.pid}`;
  const secret = 'integration-test-session-secret-at-least-thirty-two-characters';
  let server;
  let base;
  let cookie = '';
  const password = 'Skating-test-2026!';
  const account = { nickname: '冰上测试员', email: 'Skater@Example.test', password };
  async function boot() {
    const { app } = await createApplication({ client, dbName, secret, enableSeasonSync: false });
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function request(endpoint, { method = 'GET', body, guest = false, headers = {} } = {}) {
    const response = await fetch(base + endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Ice-Atlas': '1', Origin: base, ...(!guest && cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookie = response.headers.get('set-cookie');
    if (!guest && setCookie) cookie = setCookie.split(';')[0];
    const data = await response.json();
    return { response, data, setCookie };
  }
  try {
    await client.connect(); await boot();
    await t.test('游客可读、不可发表', async () => {
      assert.equal((await request('/api/auth/me')).data.user, null);
      assert.equal((await request('/api/forum/posts')).response.status, 200);
      assert.deepEqual((await request('/api/forum/access')).data, { canRead: true, canPost: false, canReply: false });
      assert.equal((await request('/api/forum/posts', { method: 'POST', body: { title: '标题', content: '内容' } })).response.status, 401);
    });
    await t.test('后端校验、NoSQL 对象输入、跨站提交', async () => {
      for (const body of [{ ...account, password: '123' }, { ...account, email: { $ne: null } }, { ...account, nickname: '<script>' }, { ...account, password: 'x'.repeat(129) }]) {
        assert.equal((await request('/api/auth/register', { method: 'POST', body })).response.status, 400);
      }
      assert.equal((await request('/api/auth/register', { method: 'POST', body: account, headers: { Origin: 'https://other.example' } })).response.status, 403);
      assert.equal((await request('/api/auth/register', { method: 'POST', body: account, headers: { 'X-Ice-Atlas': '' } })).response.status, 403);
    });
    await t.test('注册后自动登录；只保存密码哈希；会话 Cookie', async () => {
      const { response, data, setCookie } = await request('/api/auth/register', { method: 'POST', body: account });
      assert.equal(response.status, 201); assert.equal(data.user.nickname, account.nickname);
      assert.equal(data.user.email, 'skater@example.test'); assert.equal(data.user.passwordHash, undefined);
      assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Lax/i);
      const stored = await client.db(dbName).collection('users').findOne({ email: 'skater@example.test' });
      assert.match(stored.passwordHash, /^scrypt\$/); assert.ok(!stored.passwordHash.includes(password)); assert.equal(stored.password, undefined);
      assert.equal((await request('/api/auth/me')).data.user.nickname, account.nickname);
      assert.equal((await request('/api/forum/access')).data.canPost, true);
      assert.equal((await request('/api/forum/posts', { method: 'POST', body: { title: '花滑讨论', content: '测试真实数据库持久化。' } })).response.status, 201);
    });
    await t.test('重复邮箱不覆盖已有账号，并发注册只成功一次', async () => {
      assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...account, email: ' SKATER@example.test ' } })).response.status, 409);
      const parallel = await Promise.all([1, 2].map(() => request('/api/auth/register', { method: 'POST', body: { ...account, email: 'concurrent@example.test' }, guest: true })));
      assert.deepEqual(parallel.map(r => r.response.status).sort(), [201, 409]);
    });
    await t.test('重建服务后原 Cookie 仍然有效', async () => {
      await new Promise(resolve => server.close(resolve)); await boot();
      assert.equal((await request('/api/auth/me')).data.user.nickname, account.nickname);
      assert.equal((await request('/api/forum/posts')).data.posts.length, require('../data/forum-seed.json').length + 1);
    });
    await t.test('退出后旧会话失效，错误密码不能登录', async () => {
      const oldCookie = cookie;
      assert.equal((await request('/api/auth/logout', { method: 'POST', body: {} })).response.status, 200);
      assert.equal((await request('/api/auth/me', { headers: { Cookie: oldCookie } })).data.user, null);
      assert.equal((await request('/api/forum/access')).data.canPost, false);
      assert.equal((await request('/api/auth/login', { method: 'POST', body: { ...account, password: 'Wrong-test-password!' } })).response.status, 401);
      assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'missing@example.test', password } })).response.status, 401);
      assert.equal((await request('/api/auth/me')).data.user, null);
    });
    await t.test('正确密码登录，接口不泄露用户密码；篡改 Cookie 无效', async () => {
      assert.equal((await request('/api/auth/login', { method: 'POST', body: account })).response.status, 200);
      assert.equal((await request('/api/auth/me')).data.user.nickname, account.nickname);
      assert.equal((await request('/api/auth/me', { headers: { Cookie: cookie + 'tampered' } })).data.user, null);
    });
    await t.test('连续错误登录会被限流', async () => {
      let status;
      for (let i = 0; i < 30; i++) {
        status = (await request('/api/auth/login', { method: 'POST', body: { email: 'bad', password: 'bad' }, guest: true })).response.status;
        if (status === 429) break;
      }
      assert.equal(status, 429);
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (!/^ice_atlas_test_\d+_\d+$/.test(dbName)) throw new Error('Refuse to clean unexpected database');
    await client.db(dbName).dropDatabase();
    await client.close(); await stopMongo();
  }
});
