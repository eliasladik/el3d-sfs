const crypto = require('crypto');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const sessions = new Map();

function parseCookie(header = '') {
    return Object.fromEntries(header.split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(item => item.length === 2));
}

function setSession(res, username, remember) {
    const id = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + (remember ? SESSION_TTL_MS : 1000 * 60 * 60 * 8);
    sessions.set(id, { username, expiresAt });
    const maxAge = remember ? `; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` : '';
    res.setHeader('Set-Cookie', `sfs_session=${id}; HttpOnly; SameSite=Strict; Path=/${maxAge}`);
}

function clearSession(req, res) {
    const id = parseCookie(req.headers.cookie).sfs_session;
    if (id) sessions.delete(id);
    res.setHeader('Set-Cookie', 'sfs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}

function requireAuth(req, res, next) {
    const id = parseCookie(req.headers.cookie).sfs_session;
    const session = sessions.get(id);
    if (!session || session.expiresAt < Date.now()) {
        if (id) sessions.delete(id);
        return res.status(401).json({ message: 'Přihlášení vypršelo. Přihlas se znovu.' });
    }
    req.user = session.username;
    next();
}

module.exports = { sessions, parseCookie, setSession, clearSession, requireAuth, SESSION_TTL_MS };
