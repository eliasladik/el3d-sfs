const { run } = require('./db');

async function audit(owner, spoolId, action, delta, note = '') {
    await run('INSERT INTO inventory_events (owner, spool_id, action, weight_delta_g, note) VALUES (?, ?, ?, ?, ?)', [owner, spoolId, action, delta, note]);
}

module.exports = { audit };
