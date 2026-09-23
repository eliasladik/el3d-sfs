const express = require('express');
const QRCode = require('qrcode');
const { run, get, all } = require('../db');
const { requireAuth, requireAdmin } = require('../session');
const { validWeight, validateSpool } = require('../utils/validators');
const { audit } = require('../audit');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
    try { res.json(await all('SELECT * FROM spools WHERE owner = ? ORDER BY id DESC', [req.workspaceOwner])); } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
    try {
        const spools = req.body.spools;
        if (!Array.isArray(spools) || spools.length < 1 || spools.length > 50 || !spools.every(validateSpool)) return res.status(400).json({ message: 'Neplatná data cívky.' });
        await run('BEGIN');
        for (const spool of spools) {
            const result = await run('INSERT INTO spools (brand, material_type, color_name, color_hex, total_capacity, remaining_weight_g, owner) VALUES (?, ?, ?, ?, ?, ?, ?)', [spool.brand.trim(), spool.material_type.trim().toUpperCase(), spool.color_name.trim(), spool.color_hex, spool.total_capacity, spool.remaining_weight_g, req.workspaceOwner]);
            await audit(req.workspaceOwner, req.user, result.lastID, 'created', spool.remaining_weight_g, 'Přidána cívka');
        }
        await run('COMMIT');
        res.sendStatus(201);
    } catch (err) { await run('ROLLBACK').catch(() => {}); next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const weight = req.body.remaining_weight_g;
        if (!Number.isInteger(id) || !validWeight(weight)) return res.status(400).json({ message: 'Neplatná hmotnost.' });
        const spool = await get('SELECT remaining_weight_g, total_capacity FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        if (!spool) return res.sendStatus(404);
        if (weight > spool.total_capacity) return res.status(400).json({ message: 'Zbývající hmotnost nemůže překročit kapacitu.' });
        await run('UPDATE spools SET remaining_weight_g = ? WHERE id = ? AND owner = ?', [weight, id, req.workspaceOwner]);
        await audit(req.workspaceOwner, req.user, id, weight < spool.remaining_weight_g ? 'deducted' : 'corrected', weight - spool.remaining_weight_g, req.body.note || 'Ruční úprava');
        res.sendStatus(204);
    } catch (err) { next(err); }
});

// Mazání cívky je nevratné a přijde o historii - vyhrazeno administrátorovi týmu.
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const spool = await get('SELECT remaining_weight_g FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        if (!spool) return res.sendStatus(404);
        await run('DELETE FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        await audit(req.workspaceOwner, req.user, id, 'deleted', -spool.remaining_weight_g, 'Cívka smazána');
        res.sendStatus(204);
    } catch (err) { next(err); }
});

router.get('/:id/qr', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const spool = await get('SELECT id FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        if (!spool) return res.sendStatus(404);
        // Plná URL (ne jen interní kód), aby QR štítek fungoval i po naskenování
        // běžným fotoaparátem telefonu mimo appku - otevře prohlížeč rovnou na dané cívce.
        const payload = `${req.protocol}://${req.get('host')}/?spool=${id}`;
        const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 512, color: { dark: '#0f172a', light: '#ffffff' } });
        res.json({ payload, dataUrl });
    } catch (err) { next(err); }
});

// Rezervace cívky pro právě probíhající tisk - informativní zámek, aby si v týmu
// nesáhli dva lidé na stejný kus najednou. Smí kdokoliv z týmu.
router.post('/:id/reserve', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const note = String(req.body.note || '').trim().slice(0, 200);
        const spool = await get('SELECT reserved_by FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        if (!spool) return res.sendStatus(404);
        if (spool.reserved_by && spool.reserved_by !== req.user) {
            return res.status(409).json({ message: `Cívku už si rezervoval uživatel ${spool.reserved_by}.` });
        }
        await run('UPDATE spools SET reserved_by = ?, reserved_note = ?, reserved_at = CURRENT_TIMESTAMP WHERE id = ? AND owner = ?', [req.user, note, id, req.workspaceOwner]);
        await audit(req.workspaceOwner, req.user, id, 'reserved', 0, note || 'Rezervováno pro tisk');
        res.sendStatus(204);
    } catch (err) { next(err); }
});

// Uvolnění rezervace - smí ten, kdo rezervoval, nebo admin týmu (např. když člen
// zapomene uvolnit a odejde).
router.post('/:id/release', requireAuth, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const spool = await get('SELECT reserved_by FROM spools WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        if (!spool) return res.sendStatus(404);
        if (!spool.reserved_by) return res.sendStatus(204);
        if (spool.reserved_by !== req.user && req.role !== 'admin') {
            return res.status(403).json({ message: 'Rezervaci může uvolnit jen ten, kdo ji vytvořil, nebo admin týmu.' });
        }
        await run('UPDATE spools SET reserved_by = NULL, reserved_note = NULL, reserved_at = NULL WHERE id = ? AND owner = ?', [id, req.workspaceOwner]);
        await audit(req.workspaceOwner, req.user, id, 'released', 0, 'Rezervace uvolněna');
        res.sendStatus(204);
    } catch (err) { next(err); }
});

module.exports = router;
