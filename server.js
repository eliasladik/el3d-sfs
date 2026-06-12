const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const mailer = require('./mailer');

// TAŽENÍ VERZE ČISTĚ PŘES REQUIRE Z PACKAGE.JSON
const packageJson = require('./package.json');
const appVersion = packageJson.version || '1.0.0';

const app = express();
app.use(cors());
app.use(express.json());

process.on('uncaughtException', (err) => {
    console.error('⚠️ Globální ochrana: Zachycena kritická chyba:', err);
});

const dbDir = path.join(__dirname, 'database');
const dbPath = path.join(dbDir, 'database.sqlite');

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Chyba připojení k SQLite:', err.message);
    else console.log(`Připojeno k SQLite databázi. Verze SFS: v${appVersion}`);
});

db.serialize(() => {
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

    db.run(`CREATE TABLE IF NOT EXISTS config (
        username TEXT PRIMARY KEY,
        value TEXT
    )`);
});

// ENDPOINT PRO STRÁNKU (FRONTEND)
app.get('/api/version', (req, res) => {
    res.json({ version: appVersion });
});

app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;
    const cleanUser = username ? username.trim().toLowerCase() : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (!cleanUser || !cleanEmail || !password) {
        return res.status(400).json({ success: false, message: "Všechna pole jsou povinná!" });
    }

    db.all("SELECT username, value FROM config", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        const nameExists = rows.some(r => r.username === cleanUser);
        if (nameExists) return res.status(400).json({ success: false, message: "Tento uživatel už má svůj regál obsazený!" });

        const emailExists = rows.some(r => {
            try { return JSON.parse(r.value).email === cleanEmail; } catch(e) { return false; }
        });
        if (emailExists) return res.status(400).json({ success: false, message: "Tento e-mail už je zaregistrovaný!" });

        const defaultConfig = { 
            email: cleanEmail,
            materialTypes: ['PLA', 'PETG', 'PCCF', 'NYLON'], 
            lowStockLimit: 150, 
            systemPassword: password, 
            defaultExpandMode: 'collapsed' 
        };

        db.run("INSERT INTO config (username, value) VALUES (?, ?)", [cleanUser, JSON.stringify(defaultConfig)], (insErr) => {
            if (insErr) return res.status(500).json({ success: false, error: insErr.message });
            return res.json({ success: true, message: "Účet úspěšně vytvořen!" });
        });
    });
});

app.post('/api/auth', (req, res) => {
    const { username, password } = req.body;
    const cleanUser = username ? username.trim().toLowerCase() : '';
    if (!cleanUser) return res.status(400).json({ success: false, message: "Chybí jméno" });
    
    db.get("SELECT value FROM config WHERE username = ?", [cleanUser], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ success: false, message: "Uživatel neexistuje. Zaregistruj se!" });
        
        const userConfig = JSON.parse(row.value);
        if (password === '' || userConfig.systemPassword === password) {
            res.json({ success: true, config: userConfig });
        } else {
            res.json({ success: false, message: "Nesprávné heslo!" });
        }
    });
});

app.get('/api/spools', (req, res) => {
    const username = req.query.user;
    if (!username) return res.json([]);
    db.all("SELECT * FROM spools WHERE owner = ?", [username], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.post('/api/spools', (req, res) => {
    const { spools, user } = req.body;
    if (!user || !spools || !Array.isArray(spools)) return res.sendStatus(400);
    const stmt = db.prepare("INSERT INTO spools (brand, material_type, color_name, color_hex, total_capacity, remaining_weight_g, owner) VALUES (?, ?, ?, ?, ?, ?, ?)");
    db.serialize(() => {
        spools.forEach(s => { stmt.run(s.brand, s.material_type, s.color_name, s.color_hex, s.total_capacity, s.remaining_weight_g, user); });
        stmt.finalize((err) => { if (err) return res.status(500).json({ error: err.message }); res.sendStatus(201); });
    });
});

app.put('/api/spools/:id', (req, res) => {
    const id = parseInt(req.params.id); const { remaining_weight_g, user = '' } = req.body;
    db.run(`UPDATE spools SET remaining_weight_g = ? WHERE id = ? AND owner = ?`, [remaining_weight_g, id, user], function(err) {
        if (err) return res.status(500).json({ error: err.message }); res.sendStatus(200);
    });
});

app.delete('/api/spools/:id', (req, res) => {
    const id = parseInt(req.params.id); const username = req.query.user;
    db.run("DELETE FROM spools WHERE id = ? AND owner = ?", [id, username], function(err) {
        if (err) return res.status(500).json({ error: err.message }); res.sendStatus(200);
    });
});

app.post('/api/config/update', (req, res) => {
    const { user, config } = req.body;
    db.run("UPDATE config SET value = ? WHERE username = ?", [JSON.stringify(config), user], function(err) {
        if (err) return res.status(500).json({ error: err.message }); res.sendStatus(200);
    });
});

/// ===================================================
// RESET HESLA VYUŽÍVAJÍCÍ IMPORTOVANÝ MAILER (OPRAVENO)
// ===================================================
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (!cleanEmail) return res.status(400).json({ success: false, message: "E-mail je povinný!" });

    db.all("SELECT username, value FROM config", [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        let targetUser = null;
        let userConfig = null;

        for (const row of rows) {
            try {
                const cfg = JSON.parse(row.value);
                // OPRAVA: Očištění obou e-mailů od mezer a převod na malá písmena pro 100% shodu
                if (cfg.email && cfg.email.trim().toLowerCase() === cleanEmail) {
                    targetUser = row.username;
                    userConfig = cfg;
                    break;
                }
            } catch (e) {}
        }

        if (!targetUser) {
            return res.status(404).json({ success: false, message: "Tento e-mail v systému EL3D neregistrujeme!" });
        }

        // Generování nového hesla
        const newPassword = Math.random().toString(36).substring(2, 8).toUpperCase();
        userConfig.systemPassword = newPassword;

        // OPRAVA: Odstraněno klíčové slovo async z callbacku, které blokovalo provádění uvnitř SQLite
        db.run("UPDATE config SET value = ? WHERE username = ?", [JSON.stringify(userConfig), targetUser], (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });

            // Volání maileru pomocí standardního .then() / .catch(), aby callback správně předal data
            mailer.sendResetEmail(cleanEmail, targetUser, newPassword)
                .then(() => {
                    console.log(`📧 Resetovací mail úspěšně odeslán pro: ${targetUser}`);
                    res.json({ success: true, message: "Nové heslo bylo odesláno na tvůj e-mail!" });
                })
                .catch((mailErr) => {
                    console.error("❌ Kritická chyba v mailer.js / SMTP serveru:", mailErr);
                    res.status(500).json({ success: false, message: "Heslo se změnilo, ale mail neodešel. Zkontroluj přihlášení Seznamu." });
                });
        });
    });
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`Smart Filament System API (SQLite Multi-User) bezi na portu ${PORT}`);
});