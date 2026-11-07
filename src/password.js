const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, options);
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [algorithm, n, r, p, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const derived = await scrypt(password, salt, 64, options);
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}
module.exports = { hashPassword, verifyPassword };
