const express = require('express');
const crypto = require('crypto');
const { run, get } = require('../db');
const { limit } = require('../rateLimit');
const { setSession, clearSession, requireAuth } = require('../session');
const { hashPassword, verifyPassword } = require('../utils/password');
const { normalizeUsername, normalizeEmail, validUsername, validPassword, publicConfig } = require('../utils/validators');
const mailer = require('../mailer');

const router = express.Router();

router.post('/signup', limit(5, 15 * 60 * 1000), async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;
        if (!validUsername(username) || !/^\S+@\S+\.\S+$/.test(email) || !validPassword(password)) return res.status(400).json({ message: 'Zadej platné jméno, e-mail a heslo alespoň o 10 znacích.' });
        await run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, await hashPassword(password)]);
        await run('INSERT INTO config (username, value) VALUES (?, ?)', [username, JSON.stringify(publicConfig('{}'))]);
        setSession(res, username, true);
        res.status(201).json({ success: true, role: 'admin', config: publicConfig('{}') });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) return res.status(400).json({ message: 'Toto jméno nebo e-mail už existuje.' });
        next(err);
    }
});

router.post('/auth', limit(10, 15 * 60 * 1000), async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username);
        const user = await get('SELECT username, email, password_hash, role, owner_username FROM users WHERE username = ?', [username]);
        if (!user || !await verifyPassword(req.body.password || '', user.password_hash)) return res.status(401).json({ message: 'Nesprávné uživatelské jméno nebo heslo.' });
        const workspaceOwner = user.owner_username || username;
        const config = await get('SELECT value FROM config WHERE username = ?', [workspaceOwner]);
        setSession(res, username, Boolean(req.body.remember));
        res.json({ success: true, email: user.email, role: user.role || 'admin', config: publicConfig(config && config.value) });
    } catch (err) { next(err); }
});

router.post('/logout', (req, res) => { clearSession(req, res); res.sendStatus(204); });

router.get('/session', requireAuth, async (req, res, next) => {
    try {
        const config = await get('SELECT value FROM config WHERE username = ?', [req.workspaceOwner]);
        const user = await get('SELECT email FROM users WHERE username = ?', [req.user]);
        res.json({ username: req.user, email: user.email, role: req.role, config: publicConfig(config && config.value) });
    } catch (err) { next(err); }
});

router.post('/password', requireAuth, async (req, res, next) => {
    try {
        if (!validPassword(req.body.password)) return res.status(400).json({ message: 'Heslo musí mít alespoň 10 znaků.' });
        await run('UPDATE users SET password_hash = ? WHERE username = ?', [await hashPassword(req.body.password), req.user]);
        res.sendStatus(204);
    } catch (err) { next(err); }
});

router.put('/profile/email', requireAuth, async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        if (!/^\S+@\S+\.\S+$/.test(email) || email.endsWith('@legacy.local')) return res.status(400).json({ message: 'Zadej platnou e-mailovou adresu.' });
        await run('UPDATE users SET email = ? WHERE username = ?', [email, req.user]);
        res.sendStatus(204);
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) return res.status(400).json({ message: 'Tento e-mail již používá jiný účet.' });
        next(err);
    }
});

router.post('/forgot-password', limit(3, 60 * 60 * 1000), async (req, res, next) => {
    try {
        const email = normalizeEmail(req.body.email);
        const user = await get('SELECT username, email FROM users WHERE email = ?', [email]);
        if (user && mailer.isConfigured()) {
            const password = crypto.randomBytes(9).toString('base64url');
            await mailer.sendResetEmail(user.email, user.username, password);
            await run('UPDATE users SET password_hash = ? WHERE username = ?', [await hashPassword(password), user.username]);
        }
        res.json({ success: true, message: 'Pokud e-mail existuje, poslali jsme instrukce pro přihlášení.' });
    } catch (err) { next(err); }
});

module.exports = router;
