function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function validUsername(value) { return /^[a-z0-9_-]{3,32}$/.test(value); }
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && value.length <= 128; }
function validWeight(value) { return Number.isInteger(value) && value >= 0 && value <= 100000; }

function publicConfig(value) {
    const config = JSON.parse(value || '{}');
    return {
        materialTypes: Array.isArray(config.materialTypes) ? config.materialTypes : ['PLA', 'PETG', 'PCCF', 'NYLON'],
        lowStockLimit: Number.isInteger(config.lowStockLimit) ? config.lowStockLimit : 150,
        defaultExpandMode: config.defaultExpandMode === 'expanded' ? 'expanded' : 'collapsed'
    };
}

function validateSpool(spool) {
    return spool
        && typeof spool.brand === 'string' && spool.brand.trim().length > 0 && spool.brand.length <= 80
        && typeof spool.material_type === 'string' && spool.material_type.trim().length > 0 && spool.material_type.length <= 32
        && typeof spool.color_name === 'string' && spool.color_name.trim().length > 0 && spool.color_name.length <= 80
        && /^#[0-9a-fA-F]{6}$/.test(spool.color_hex)
        && validWeight(spool.total_capacity) && spool.total_capacity > 0
        && validWeight(spool.remaining_weight_g) && spool.remaining_weight_g <= spool.total_capacity;
}

module.exports = { normalizeUsername, normalizeEmail, validUsername, validPassword, validWeight, publicConfig, validateSpool };
