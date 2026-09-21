const express = require('express');
const { run } = require('../db');
const { requireAuth } = require('../session');
const { validWeight } = require('../utils/validators');

const router = express.Router();

router.post('/update', requireAuth, async (req, res, next) => {
    try {
        const config = req.body.config || {};
        const materialTypes = Array.isArray(config.materialTypes)
            ? [...new Set(config.materialTypes.map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z0-9 +.-]{1,32}$/.test(value)))].slice(0, 20)
            : [];
        const saved = {
            materialTypes: materialTypes.length ? materialTypes : ['PLA'],
            lowStockLimit: validWeight(config.lowStockLimit) ? config.lowStockLimit : 150,
            defaultExpandMode: config.defaultExpandMode === 'expanded' ? 'expanded' : 'collapsed'
        };
        await run('UPDATE config SET value = ? WHERE username = ?', [JSON.stringify(saved), req.user]);
        res.json(saved);
    } catch (err) { next(err); }
});

module.exports = router;
