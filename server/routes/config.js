const express = require('express');
const { run } = require('../db');
const { requireAuth, requireAdmin } = require('../session');
const { validWeight } = require('../utils/validators');

const router = express.Router();

// Materiály, limit nízkého stavu a výchozí zobrazení jsou nastavení celého sdíleného
// skladu (týmu), proto je může měnit jen admin.
router.post('/update', requireAuth, requireAdmin, async (req, res, next) => {
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
        await run('UPDATE config SET value = ? WHERE username = ?', [JSON.stringify(saved), req.workspaceOwner]);
        res.json(saved);
    } catch (err) { next(err); }
});

module.exports = router;
