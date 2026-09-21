const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
    const [salt, expected] = String(stored || '').split(':');
    if (!salt || !expected) return false;
    const actual = await scrypt(password, salt, 64);
    return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
