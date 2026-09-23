const express = require('express');
const { run, get, all } = require('../db');
const { requireAuth, requireAdmin } = require('../session');
const { normalizeUsername, normalizeEmail, validUsername, validPassword } = require('../utils/validators');
const { hashPassword } = require('../utils/password');

const router = express.Router();

// Info o týmu: vlastní role a seznam všech, kdo sdílejí tento sklad (admin + členové).
router.get('/', requireAuth, async (req, res, next) => {
    try {
        const members = await all(
            `SELECT username, email, role, created_at FROM users
             WHERE username = ? OR owner_username = ?
             ORDER BY (role = 'admin') DESC, created_at ASC`,
            [req.workspaceOwner, req.workspaceOwner]
        );
        res.json({ role: req.role, workspaceOwner: req.workspaceOwner, members });
    } catch (err) { next(err); }
});

// Pozvání nového člena do sdíleného skladu - vytvoří mu vlastní přihlašovací účet,
// ale data (cívky, historie, nastavení) sdílí s adminem, který ho pozval. Jen admin.
router.post('/members', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const username = normalizeUsername(req.body.username);
        const email = normalizeEmail(req.body.email);
        const password = req.body.password;
        const role = req.body.role === 'admin' ? 'admin' : 'member';
        if (!validUsername(username) || !/^\S+@\S+\.\S+$/.test(email) || !validPassword(password)) {
            return res.status(400).json({ message: 'Zadej platné jméno, e-mail a heslo alespoň o 10 znacích.' });
        }
        await run(
            'INSERT INTO users (username, email, password_hash, role, owner_username) VALUES (?, ?, ?, ?, ?)',
            [username, email, await hashPassword(password), role, req.workspaceOwner]
        );
        res.status(201).json({ success: true, username, role });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) return res.status(400).json({ message: 'Toto jméno nebo e-mail už existuje.' });
        next(err);
    }
});

// Odebrání člena ze sdíleného skladu - jen admin, nelze odebrat sám sebe ani nikoho
// mimo vlastní tým.
router.delete('/members/:username', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const username = normalizeUsername(req.params.username);
        if (username === req.user) return res.status(400).json({ message: 'Sám sebe nemůžeš odebrat.' });
        const target = await get('SELECT username FROM users WHERE username = ? AND owner_username = ?', [username, req.workspaceOwner]);
        if (!target) return res.sendStatus(404);
        await run('DELETE FROM users WHERE username = ?', [username]);
        res.sendStatus(204);
    } catch (err) { next(err); }
});

module.exports = router;
