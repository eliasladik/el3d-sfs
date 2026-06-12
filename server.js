const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const packageJson = require('./package.json');

const app = express();
app.use(cors());
app.use(express.json());

// Cesta k databázi v aktuální složce projektu
const dbDir = path.join(__dirname, 'database');
const dbPath = path.join(dbDir, 'database.sqlite');

// Automaticky vytvoří složku pro databázi, pokud neexistuje
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

// Připojení k SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Chyba připojení k SQLite:', err.message);
    else console.log('Připojeno k SQLite databázi.');
});

// Inicializace databázových tabulek
db.serialize(() => {
    // Tabulka cívek – obsahuje sloupec 'owner' pro rozlišení uživatelů
    db.run(`CREATE TABLE IF NOT EXISTS spools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand TEXT,
        material_type TEXT,
        color_name TEXT,
        color_hex TEXT,
        total_capacity INTEGER,
        remaining_weight_g INTEGER,
        owner TEXT
    )`);

    // Tabulka konfigurací a hesel pro jednotlivé uživatele
    db.run(`CREATE TABLE IF NOT EXISTS config (
        username TEXT PRIMARY KEY,
        value TEXT
    )`);
});

// ===================================================
// 1. API PRO SPRÁVU CÍVEK (FILTROVANÉ PODLE UŽIVATELE)
// ===================================================

// Načtení cívek pouze pro přihlášeného uživatele
app.get('/api/spools', (req, res) => {
    const username = req.query.user;
    if (!username) return res.status(400).json({ error: "Chybi parametr 'user'" });

    db.all("SELECT * FROM spools WHERE owner = ?", [username], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Naskladnění nových cívek (podpora hromadného přidání přes "Počet kusů")
app.post('/api/spools', (req, res) => {
    const { spools, user } = req.body;
    if (!user || !spools || !Array.isArray(spools)) return res.sendStatus(400);

    const stmt = db.prepare("INSERT INTO spools (brand, material_type, color_name, color_hex, total_capacity, remaining_weight_g, owner) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    db.serialize(() => {
        spools.forEach(s => {
            stmt.run(s.brand, s.material_type, s.color_name, s.color_hex, s.total_capacity, s.remaining_weight_g, user);
        });
        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.sendStatus(201);
        });
    });
});

// Manuální odpis gramů z cívky
app.put('/api/spools/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { remaining_weight_g, user } = req.body;

    db.run(`UPDATE spools SET remaining_weight_g = ? WHERE id = ? AND owner = ?`, [remaining_weight_g, id, user], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.sendStatus(200);
    });
});

// Smazání cívky z regálu
app.delete('/api/spools/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const username = req.query.user;

    db.run("DELETE FROM spools WHERE id = ? AND owner = ?", [id, username], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.sendStatus(200);
    });
});

// ===================================================
// 2. API PRO AUTENTIZACI A REGISTRACI (MULTI-USER)
// ===================================================

app.post('/api/auth', (req, res) => {
    const { username, password } = req.body;
    if (!username) return res.sendStatus(400);
    
    db.get("SELECT value FROM config WHERE username = ?", [username], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Pokud uživatel v databázi neexistuje, automaticky ho zaregistrujeme s výchozím nastavením
        if (!row) {
            const newUserConfig = { 
                materialTypes: ['PLA', 'PETG', 'PCCF', 'NYLON'], 
                lowStockLimit: 150, 
                systemPassword: password, 
                defaultExpandMode: 'collapsed' 
            };
            
            db.run("INSERT INTO config (username, value) VALUES (?, ?)", [username, JSON.stringify(newUserConfig)], (insErr) => {
                if (insErr) return res.status(500).json({ error: insErr.message });
                return res.json({ success: true, config: newUserConfig });
            });
        } else {
            // Uživatel existuje -> ověříme heslo
            const userConfig = JSON.parse(row.value);
            // Podmínka (password === '') slouží pro auto-login při zapamatovaném uživateli
            if (password === '' || userConfig.systemPassword === password) {
                res.json({ success: true, config: userConfig });
            } else {
                res.json({ success: false, message: "Nesprávné heslo pro tohoto uživatele!" });
            }
        }
    });
});

// Uložení upraveného nastavení (přidání/smazání materiálu, změna limitu, změna hesla)
app.post('/api/config/update', (req, res) => {
    const { user, config } = req.body;
    db.run("UPDATE config SET value = ? WHERE username = ?", [JSON.stringify(config), user], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.sendStatus(200);
    });
});

// ===================================================
// 3. SPUŠTĚNÍ SERVERU NA PORTU 5001 (BEZPEČNÉ PRO MAC)
// ===================================================
// API pro získání aktuální verze aplikace
app.get('/api/version', (req, res) => {
    res.json({ version: packageJson.version });
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Smart Filament System API (SQLite Multi-User) bezi na portu ${PORT}`);
});