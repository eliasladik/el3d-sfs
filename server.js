const crypto = require('crypto');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const mailer = require('./mailer');
const QRCode = require('qrcode');

function loadLocalEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const separator = line.indexOf('=');
        if (separator < 1 || line.trimStart().startsWith('#')) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (process.env[key] === undefined) process.env[key] = value;
    }
}
loadLocalEnv();

const app = express();
const packageJson = require('./package.json');
const PORT = Number(process.env.PORT) || 5001;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const scrypt = promisify(crypto.scrypt);
const sessions = new Map();
const requestBuckets = new Map();

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' });
    next();
});
app.use(express.json({ limit: '100kb' }));

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const db = new sqlite3.Database(path.join(dbDir, 'database.sqlite'));
const run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
const get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function validUsername(value) { return /^[a-z0-9_-]{3,32}$/.test(value); }
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && value.length <= 128; }
function validWeight(value) { return Number.isInteger(value) && value >= 0 && value <= 100000; }
function parseCookie(header = '') { return Object.fromEntries(header.split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(item => item.length === 2)); }
async function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64); return `${salt}:${hash.toString('hex')}`; }
async function verifyPassword(password, stored) {
    const [salt, expected] = String(stored || '').split(':');
    if (!salt || !expected) return false;
    const actual = await scrypt(password, salt, 64);
    return crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function setSession(res, username, remember) {
    const id = crypto.randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + (remember ? SESSION_TTL_MS : 1000 * 60 * 60 * 8);
    sessions.set(id, { username, expiresAt });
    const maxAge = remember ? `; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}` : '';
    res.setHeader('Set-Cookie', `sfs_session=${id}; HttpOnly; SameSite=Strict; Path=/${maxAge}`);
}
function clearSession(req, res) { const id = parseCookie(req.headers.cookie).sfs_session; if (id) sessions.delete(id); res.setHeader('Set-Cookie', 'sfs_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); }
function requireAuth(req, res, next) {
    const id = parseCookie(req.headers.cookie).sfs_session;
    const session = sessions.get(id);
    if (!session || session.expiresAt < Date.now()) { if (id) sessions.delete(id); return res.status(401).json({ message: 'Přihlášení vypršelo. Přihlas se znovu.' }); }
    req.user = session.username;
    next();
}
function limit(max, windowMs) {
    return (req, res, next) => {
        const key = `${req.ip}:${req.path}`; const now = Date.now(); const bucket = requestBuckets.get(key) || { count: 0, start: now };
        if (now - bucket.start > windowMs) Object.assign(bucket, { count: 0, start: now });
        bucket.count += 1; requestBuckets.set(key, bucket);
        if (bucket.count > max) return res.status(429).json({ message: 'Příliš mnoho pokusů. Zkus to za chvíli.' });
        next();
    };
}
function publicConfig(value) {
    const config = JSON.parse(value || '{}');
    return { materialTypes: Array.isArray(config.materialTypes) ? config.materialTypes : ['PLA', 'PETG', 'PCCF', 'NYLON'], lowStockLimit: Number.isInteger(config.lowStockLimit) ? config.lowStockLimit : 150, defaultExpandMode: config.defaultExpandMode === 'expanded' ? 'expanded' : 'collapsed' };
}
function validateSpool(spool) {
    return spool && typeof spool.brand === 'string' && spool.brand.trim().length > 0 && spool.brand.length <= 80 && typeof spool.material_type === 'string' && spool.material_type.trim().length > 0 && spool.material_type.length <= 32 && typeof spool.color_name === 'string' && spool.color_name.trim().length > 0 && spool.color_name.length <= 80 && /^#[0-9a-fA-F]{6}$/.test(spool.color_hex) && validWeight(spool.total_capacity) && spool.total_capacity > 0 && validWeight(spool.remaining_weight_g) && spool.remaining_weight_g <= spool.total_capacity;
}
async function audit(owner, spoolId, action, delta, note = '') { await run('INSERT INTO inventory_events (owner, spool_id, action, weight_delta_g, note) VALUES (?, ?, ?, ?, ?)', [owner, spoolId, action, delta, note]); }

async function initializeDatabase() {
    await run('CREATE TABLE IF NOT EXISTS spools (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT, material_type TEXT, color_name TEXT, color_hex TEXT, total_capacity INTEGER, remaining_weight_g INTEGER, owner TEXT)');
    await run('CREATE TABLE IF NOT EXISTS config (username TEXT PRIMARY KEY, value TEXT)');
    await run('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await run('CREATE TABLE IF NOT EXISTS inventory_events (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, spool_id INTEGER, action TEXT NOT NULL, weight_delta_g INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await run('CREATE INDEX IF NOT EXISTS idx_spools_owner ON spools(owner)');
    await run('CREATE INDEX IF NOT EXISTS idx_events_owner_created ON inventory_events(owner, created_at DESC)');
    const legacyUsers = await all('SELECT username, value FROM config');
    for (const row of legacyUsers) {
        let legacy; try { legacy = JSON.parse(row.value); } catch { continue; }
        const existing = await get('SELECT username FROM users WHERE username = ?', [row.username]);
        if (!existing && legacy.systemPassword) {
            // Older installations did not store an e-mail address. Keep their login working
            // with a non-deliverable placeholder; they can register an address later.
            const email = legacy.email ? normalizeEmail(legacy.email) : `${row.username}@legacy.local`;
            await run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [row.username, email, await hashPassword(legacy.systemPassword)]);
        }
        if (legacy.systemPassword || legacy.email) { delete legacy.systemPassword; delete legacy.email; await run('UPDATE config SET value = ? WHERE username = ?', [JSON.stringify(publicConfig(JSON.stringify(legacy))), row.username]); }
    }
}

app.get('/api/version', (req, res) => res.json({ version: packageJson.version || '1.0.0' }));
app.post('/api/signup', limit(5, 15 * 60 * 1000), async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username); const email = normalizeEmail(req.body.email); const password = req.body.password;
        if (!validUsername(username) || !/^\S+@\S+\.\S+$/.test(email) || !validPassword(password)) return res.status(400).json({ message: 'Zadej platné jméno, e-mail a heslo alespoň o 10 znacích.' });
        await run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, await hashPassword(password)]);
        await run('INSERT INTO config (username, value) VALUES (?, ?)', [username, JSON.stringify(publicConfig('{}'))]);
        setSession(res, username, true); res.status(201).json({ success: true, config: publicConfig('{}') });
    } catch (err) { if (String(err.message).includes('UNIQUE')) return res.status(400).json({ message: 'Toto jméno nebo e-mail už existuje.' }); next(err); }
});
app.post('/api/auth', limit(10, 15 * 60 * 1000), async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username); const user = await get('SELECT username, email, password_hash FROM users WHERE username = ?', [username]);
        if (!user || !await verifyPassword(req.body.password || '', user.password_hash)) return res.status(401).json({ message: 'Nesprávné uživatelské jméno nebo heslo.' });
        const config = await get('SELECT value FROM config WHERE username = ?', [username]); setSession(res, username, Boolean(req.body.remember)); res.json({ success: true, email: user.email, config: publicConfig(config && config.value) });
    } catch (err) { next(err); }
});
app.post('/api/logout', (req, res) => { clearSession(req, res); res.sendStatus(204); });
app.get('/api/session', requireAuth, async (req, res, next) => { try { const config = await get('SELECT value FROM config WHERE username = ?', [req.user]); const user = await get('SELECT email FROM users WHERE username = ?', [req.user]); res.json({ username: req.user, email: user.email, config: publicConfig(config && config.value) }); } catch (err) { next(err); } });
app.get('/api/spools', requireAuth, async (req, res, next) => { try { res.json(await all('SELECT * FROM spools WHERE owner = ? ORDER BY id DESC', [req.user])); } catch (err) { next(err); } });
app.post('/api/spools', requireAuth, async (req, res, next) => {
    try {
        const spools = req.body.spools;
        if (!Array.isArray(spools) || spools.length < 1 || spools.length > 50 || !spools.every(validateSpool)) return res.status(400).json({ message: 'Neplatná data cívky.' });
        await run('BEGIN');
        for (const spool of spools) { const result = await run('INSERT INTO spools (brand, material_type, color_name, color_hex, total_capacity, remaining_weight_g, owner) VALUES (?, ?, ?, ?, ?, ?, ?)', [spool.brand.trim(), spool.material_type.trim().toUpperCase(), spool.color_name.trim(), spool.color_hex, spool.total_capacity, spool.remaining_weight_g, req.user]); await audit(req.user, result.lastID, 'created', spool.remaining_weight_g, 'Přidána cívka'); }
        await run('COMMIT'); res.sendStatus(201);
    } catch (err) { await run('ROLLBACK').catch(() => {}); next(err); }
});
app.put('/api/spools/:id', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id); const weight = req.body.remaining_weight_g;
        if (!Number.isInteger(id) || !validWeight(weight)) return res.status(400).json({ message: 'Neplatná hmotnost.' });
        const spool = await get('SELECT remaining_weight_g, total_capacity FROM spools WHERE id = ? AND owner = ?', [id, req.user]);
        if (!spool) return res.sendStatus(404); if (weight > spool.total_capacity) return res.status(400).json({ message: 'Zbývající hmotnost nemůže překročit kapacitu.' });
        await run('UPDATE spools SET remaining_weight_g = ? WHERE id = ? AND owner = ?', [weight, id, req.user]); await audit(req.user, id, weight < spool.remaining_weight_g ? 'deducted' : 'corrected', weight - spool.remaining_weight_g, req.body.note || 'Ruční úprava'); res.sendStatus(204);
    } catch (err) { next(err); }
});
app.delete('/api/spools/:id', requireAuth, async (req, res, next) => {
    try { const id = Number(req.params.id); const spool = await get('SELECT remaining_weight_g FROM spools WHERE id = ? AND owner = ?', [id, req.user]); if (!spool) return res.sendStatus(404); await run('DELETE FROM spools WHERE id = ? AND owner = ?', [id, req.user]); await audit(req.user, id, 'deleted', -spool.remaining_weight_g, 'Cívka smazána'); res.sendStatus(204); } catch (err) { next(err); }
});
app.get('/api/spools/:id/qr', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const spool = await get('SELECT id FROM spools WHERE id = ? AND owner = ?', [id, req.user]);
        if (!spool) return res.sendStatus(404);
        const payload = `EL3D-SFS:${id}`;
        const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#0f172a', light: '#ffffff' } });
        res.json({ payload, dataUrl });
    } catch (err) { next(err); }
});
app.get('/api/events', requireAuth, async (req, res, next) => { try { res.json(await all('SELECT id, spool_id, action, weight_delta_g, note, created_at FROM inventory_events WHERE owner = ? ORDER BY id DESC LIMIT 50', [req.user])); } catch (err) { next(err); } });
app.post('/api/config/update', requireAuth, async (req, res, next) => {
    try {
        const config = req.body.config || {}; const materialTypes = Array.isArray(config.materialTypes) ? [...new Set(config.materialTypes.map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z0-9 +.-]{1,32}$/.test(value)))].slice(0, 20) : [];
        const saved = { materialTypes: materialTypes.length ? materialTypes : ['PLA'], lowStockLimit: validWeight(config.lowStockLimit) ? config.lowStockLimit : 150, defaultExpandMode: config.defaultExpandMode === 'expanded' ? 'expanded' : 'collapsed' };
        await run('UPDATE config SET value = ? WHERE username = ?', [JSON.stringify(saved), req.user]); res.json(saved);
    } catch (err) { next(err); }
});
app.post('/api/password', requireAuth, async (req, res, next) => { try { if (!validPassword(req.body.password)) return res.status(400).json({ message: 'Heslo musí mít alespoň 10 znaků.' }); await run('UPDATE users SET password_hash = ? WHERE username = ?', [await hashPassword(req.body.password), req.user]); res.sendStatus(204); } catch (err) { next(err); } });
app.put('/api/profile/email', requireAuth, async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!/^\S+@\S+\.\S+$/.test(email) || email.endsWith('@legacy.local')) return res.status(400).json({ message: 'Zadej platnou e-mailovou adresu.' });
        await run('UPDATE users SET email = ? WHERE username = ?', [email, req.user]);
        res.sendStatus(204);
    } catch (err) { if (String(err.message).includes('UNIQUE')) return res.status(400).json({ message: 'Tento e-mail již používá jiný účet.' }); next(err); }
});
app.post('/api/forgot-password', limit(3, 60 * 60 * 1000), async (req, res, next) => {
    try { const email = normalizeEmail(req.body.email); const user = await get('SELECT username, email FROM users WHERE email = ?', [email]); if (user && mailer.isConfigured()) { const password = crypto.randomBytes(9).toString('base64url'); await mailer.sendResetEmail(user.email, user.username, password); await run('UPDATE users SET password_hash = ? WHERE username = ?', [await hashPassword(password), user.username]); } res.json({ success: true, message: 'Pokud e-mail existuje, poslali jsme instrukce pro přihlášení.' }); } catch (err) { next(err); }
});

app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'deny' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ message: 'Nastala chyba serveru.' }); });
initializeDatabase().then(() => app.listen(PORT, () => console.log(`EL3D SFS běží na http://localhost:${PORT}`))).catch(err => { console.error('Nepodařilo se inicializovat databázi:', err); process.exit(1); });
