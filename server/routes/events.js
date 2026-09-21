const express = require('express');
const { all } = require('../db');
const { requireAuth } = require('../session');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
    try {
        res.json(await all('SELECT id, spool_id, action, weight_delta_g, note, created_at FROM inventory_events WHERE owner = ? ORDER BY id DESC LIMIT 50', [req.user]));
    } catch (err) { next(err); }
});

module.exports = router;
