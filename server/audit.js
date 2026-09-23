const { run } = require('./db');

async function audit(owner, actor, spoolId, action, delta, note = '') {
    await run('INSERT INTO inventory_events (owner, actor, spool_id, action, weight_delta_g, note) VALUES (?, ?, ?, ?, ?, ?)', [owner, actor, spoolId, action, delta, note]);
}

module.exports = { audit };
