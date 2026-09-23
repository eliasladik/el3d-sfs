const path = require('path');
const express = require('express');
const { loadLocalEnv } = require('./env');

loadLocalEnv(path.join(__dirname, '..'));

const packageJson = require('../package.json');
const { initializeDatabase } = require('./schema');

const app = express();
const PORT = Number(process.env.PORT) || 5001;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store' });
    next();
});
app.use(express.json({ limit: '100kb' }));

app.use('/api', require('./routes/misc')(packageJson));
app.use('/api', require('./routes/auth'));
app.use('/api/spools', require('./routes/spools'));
app.use('/api/events', require('./routes/events'));
app.use('/api/config', require('./routes/config'));
app.use('/api/team', require('./routes/team'));

// Servíruje pouze obsah public/ (frontend) - zdrojový kód backendu ani databáze
// tak už nejsou přístupné přes HTTP, na rozdíl od původní verze serverující __dirname.
app.use(express.static(PUBLIC_DIR, { index: 'index.html', dotfiles: 'deny' }));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Nastala chyba serveru.' });
});

initializeDatabase()
    .then(() => app.listen(PORT, () => console.log(`EL3D SFS běží na http://localhost:${PORT}`)))
    .catch(err => { console.error('Nepodařilo se inicializovat databázi:', err); process.exit(1); });
