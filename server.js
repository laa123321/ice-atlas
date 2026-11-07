require('dotenv').config({ quiet: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { createApplication } = require('./src/app');
const { ensureLocalMongo } = require('./src/local-mongo');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const stopMongo = await ensureLocalMongo(uri);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await fs.mkdir(path.join(__dirname, '.data'), { recursive: true });
    let secret = process.env.SESSION_SECRET;
    if (!secret) {
      const filename = path.join(__dirname, '.data', 'session-secret');
      try { secret = await fs.readFile(filename, 'utf8'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        secret = randomBytes(48).toString('hex');
        await fs.writeFile(filename, secret, { flag: 'wx', mode: 0o600 });
      }
    }
    if (secret.trim().length < 32) throw new Error('SESSION_SECRET 至少需要 32 个字符');
    const { app, season, rankings } = await createApplication({ client, dbName: process.env.MONGODB_DB || 'ice_atlas', secret });
    const server = app.listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => {
      console.log(`冰上图鉴已启动：http://127.0.0.1:${server.address().port}`);
      console.log('MongoDB 已连接，注册与登录功能可用。');
    });
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      server.close(); season.stop(); rankings.stop(); await client.close(); await stopMongo(); process.exit(0);
    };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    server.on('error', async error => {
      console.error(error.code === 'EADDRINUSE' ? '端口已占用：请在旧终端按 Ctrl+C 后重新 npm start。' : '网站服务启动失败。');
      season.stop(); rankings.stop(); await client.close(); await stopMongo(); process.exitCode = 1;
    });
  } catch (error) {
    await client.close(); await stopMongo();
    console.error(error.name === 'MongoServerSelectionError' ? '无法连接 MongoDB，请确认数据库正在运行，或检查 .env 中的 MONGODB_URI。' : error.message);
    process.exitCode = 1;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
