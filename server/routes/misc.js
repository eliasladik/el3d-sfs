const express = require('express');

module.exports = function createMiscRouter(packageJson) {
    const router = express.Router();
    router.get('/version', (req, res) => res.json({ version: packageJson.version || '1.0.0' }));
    // Lehký healthcheck bez nutnosti přihlášení - využívá PM2/reverzní proxy/monitoring
    // k ověření, že proces žije a odpovídá.
    router.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
    return router;
};
