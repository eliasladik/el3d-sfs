const crypto = require('crypto');
const { get } = require('./db');

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

// Přihlášení + doplnění role a "workspace ownera" (sdíleného skladu). Admin je
// workspace ownerem sám sobě; pozvaný člen má owner_username nastavený na jméno
// administrátora, jehož sklad sdílí (spools/config/historie se pak čtou pod tímto
// jménem, ne pod jménem přihlášeného člena).
async function requireAuth(req, res, next) {
    const id = parseCookie(req.headers.cookie).sfs_session;
    const session = sessions.get(id);
    if (!session || session.expiresAt < Date.now()) {
        if (id) sessions.delete(id);
        return res.status(401).json({ message: 'Přihlášení vypršelo. Přihlas se znovu.' });
    }
    req.user = session.username;
    try {
        const userRow = await get('SELECT role, owner_username FROM users WHERE username = ?', [req.user]);
        if (!userRow) {
            sessions.delete(id);
            return res.status(401).json({ message: 'Účet již neexistuje. Přihlas se znovu.' });
        }
        req.role = userRow.role || 'admin';
        req.workspaceOwner = userRow.owner_username || req.user;
        next();
    } catch (err) { next(err); }
}

// Pro akce vyhrazené jen administrátorovi týmu (mazaní cívek, správa materiálů/limitů,
// pozvání/odebrání členů). Používat až po requireAuth.
function requireAdmin(req, res, next) {
    if (req.role !== 'admin') return res.status(403).json({ message: 'Tuto akci může provést jen administrátor týmu.' });
    next();
}

module.exports = { sessions, parseCookie, setSession, clearSession, requireAuth, requireAdmin, SESSION_TTL_MS };
