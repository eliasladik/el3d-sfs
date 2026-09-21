const fs = require('fs');
const path = require('path');

// Načte proměnné z .env souboru v kořeni projektu, pokud existuje.
// Nikdy nepřepisuje proměnné už nastavené v prostředí (např. z PM2 / systemd).
function loadLocalEnv(rootDir) {
    const envPath = path.join(rootDir, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const separator = line.indexOf('=');
        if (separator < 1 || line.trimStart().startsWith('#')) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

module.exports = { loadLocalEnv };
