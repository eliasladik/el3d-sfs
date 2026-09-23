const express = require('express');
const { all } = require('../db');
const { requireAuth } = require('../session');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
    try {
        res.json(await all('SELECT id, spool_id, action, weight_delta_g, note, actor, created_at FROM inventory_events WHERE owner = ? ORDER BY id DESC LIMIT 50', [req.workspaceOwner]));
    } catch (err) { next(err); }
});

// Souhrn spotřeby materiálu za posledních N dní, spočítaný z již existujícího audit
// logu (inventory_events). Spotřeba = součet záporných váhových změn (odpisy).
router.get('/stats', requireAuth, async (req, res, next) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
        const byMaterial = await all(
            `SELECT COALESCE(s.material_type, 'Neznámý materiál') AS material,
                    SUM(CASE WHEN e.weight_delta_g < 0 THEN -e.weight_delta_g ELSE 0 END) AS consumed_g
             FROM inventory_events e
             LEFT JOIN spools s ON s.id = e.spool_id AND s.owner = e.owner
             WHERE e.owner = ? AND e.created_at >= datetime('now', ?)
             GROUP BY material
             HAVING consumed_g > 0
             ORDER BY consumed_g DESC`,
            [req.workspaceOwner, `-${days} days`]
        );
        const totalConsumed = byMaterial.reduce((sum, row) => sum + row.consumed_g, 0);
        res.json({ days, totalConsumed, byMaterial });
    } catch (err) { next(err); }
});

module.exports = router;
