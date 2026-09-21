const { run, all, get } = require('./db');
const { hashPassword } = require('./utils/password');
const { normalizeEmail, publicConfig } = require('./utils/validators');

async function initializeDatabase() {
    await run('CREATE TABLE IF NOT EXISTS spools (id INTEGER PRIMARY KEY AUTOINCREMENT, brand TEXT, material_type TEXT, color_name TEXT, color_hex TEXT, total_capacity INTEGER, remaining_weight_g INTEGER, owner TEXT)');
    await run('CREATE TABLE IF NOT EXISTS config (username TEXT PRIMARY KEY, value TEXT)');
    await run('CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await run('CREATE TABLE IF NOT EXISTS inventory_events (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, spool_id INTEGER, action TEXT NOT NULL, weight_delta_g INTEGER NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await run('CREATE INDEX IF NOT EXISTS idx_spools_owner ON spools(owner)');
    await run('CREATE INDEX IF NOT EXISTS idx_events_owner_created ON inventory_events(owner, created_at DESC)');

    const legacyUsers = await all('SELECT username, value FROM config');
    for (const row of legacyUsers) {
        let legacy;
        try { legacy = JSON.parse(row.value); } catch { continue; }
        const existing = await get('SELECT username FROM users WHERE username = ?', [row.username]);
        if (!existing && legacy.systemPassword) {
            // Starší instalace neukládaly e-mailovou adresu. Přihlášení necháme
            // fungovat s neodesílatelným placeholderem; adresu si mohou doplnit později.
            const email = legacy.email ? normalizeEmail(legacy.email) : `${row.username}@legacy.local`;
            await run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [row.username, email, await hashPassword(legacy.systemPassword)]);
        }
        if (legacy.systemPassword || legacy.email) {
            delete legacy.systemPassword;
            delete legacy.email;
            await run('UPDATE config SET value = ? WHERE username = ?', [JSON.stringify(publicConfig(JSON.stringify(legacy))), row.username]);
        }
    }
}

module.exports = { initializeDatabase };
