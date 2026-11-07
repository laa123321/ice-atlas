const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { MongoClient } = require('mongodb');
async function ping(uri) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 700 });
  try { await client.connect(); await client.db('admin').command({ ping: 1 }); return true; }
  catch { return false; } finally { await client.close(); }
}
async function ensureLocalMongo(uri) {
  if (await ping(uri)) return async () => {};
  if (!['mongodb://127.0.0.1:27017', 'mongodb://localhost:27017'].includes(uri.replace(/\/$/, ''))) return async () => {};
  const found = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['mongod'], { encoding: 'utf8', windowsHide: true });
  const executable = process.env.MONGOD_PATH || found.stdout?.trim().split(/\r?\n/)[0];
  if (!executable) throw new Error('未找到 mongod。请启动 MongoDB，或在 .env 设置 MONGOD_PATH。');
  const directory = path.join(__dirname, '..', '.data', 'mongodb');
  await fs.mkdir(directory, { recursive: true });
  console.log('正在启动本机 MongoDB，数据库文件保存在项目 .data/mongodb 中。');
  const child = spawn(executable, ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', '27017', '--logpath', path.join(directory, 'mongodb.log'), '--logappend'], { windowsHide: true, stdio: 'ignore' });
  let failure;
  child.on('error', error => { failure = error; });
  const killChild = () => { if (child.exitCode === null) child.kill(); };
  process.once('exit', killChild);
  const stop = async () => {
    process.removeListener('exit', killChild);
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
    }
  };
  for (let attempt = 0; attempt < 25; attempt++) {
    if (await ping(uri)) return stop;
    if (failure || child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  await stop(); throw new Error('MongoDB 启动失败，请查看 .data/mongodb/mongodb.log。');
}
module.exports = { ensureLocalMongo };
