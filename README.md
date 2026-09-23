#  EL3D SFS — Smart Filament System

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Backend-43853D?logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-UI-38B2AC?logo=tailwind-css&logoColor=white)

**EL3D SFS (Smart Filament System)** je moderní, multi-uživatelská webová aplikace pro správu, evidenci a odepisování materiálu pro 3D tiskárny. 

Systém je navržen s důrazem na čistý "dark motorsport" design, bleskovou odezvu a lokální nasazení (např. na Raspberry Pi) přímo v dílně. Eliminuje nutnost používat nepřehledné excelové tabulky a automatizuje přehled o stavu skladu.

---

## ✨ Hlavní funkce

- 🔐 **Zabezpečené účty:** Hesla jsou hashovaná, API používá serverovou session.
- 👥 **Role a sdílený sklad (týmy):** Administrátor může pozvat další členy ("tiskaře") do sdíleného skladu. Členové vidí a odepisují ze stejných cívek jako admin, ale nemohou mazat cívky, měnit materiály/limity ani spravovat tým - to zůstává jen administrátorovi.
- 🔒 **Rezervace cívky pro tisk:** Kdokoliv z týmu může cívku označit jako "právě používanou" (s volitelnou poznámkou), aby si dva lidé nesáhli na stejný kus. Rezervaci uvolní ten, kdo ji vytvořil, nebo admin.
- 🗄️ **Lokální SQLite Databáze:** Rychlé a spolehlivé ukládání dat do jednoho souboru (`database.sqlite`), žádné složité nastavování SQL serverů.
- 📊 **Telemetrie Skladu:** Výpočet kapacity regálu, celkové váhy, vizuální progress-bary a přehled spotřeby materiálu za zvolené období.
- 🎨 **Tmavý i světlý režim:** Přepínatelné jedním klikem, volba se pamatuje.
- ⌨️ **Klávesové zkratky:** `/` hledání, `N` nová cívka, `Esc` zavření okna, `?` nápověda.
- 📱 **Mobile Ready:** Plně responzivní design optimalizovaný pro ovládání z mobilního telefonu přímo u 3D tiskárny.
- 📷 **QR štítky:** Každý kus cívky má QR štítek s přímým odkazem - naskenování běžným fotoaparátem otevře appku rovnou na dané cívce a zvýrazní ji.
- ⚙️ **Dynamická konfigurace:** Správa vlastních materiálů (PLA, PETG, PCCF, NYLON...), hlídání kritického stavu (Low Stock Limit) a bezpečné odhlašování.
- 🧾 **Auditní historie:** Každé přidání, odpis, korekce, rezervace a smazání cívky se zaznamená do historie skladu i s tím, kdo pohyb provedl.

---

## 🛠️ Použité technologie

**Frontend:**
- HTML5 & CSS3
- Vanilla JavaScript (ES6+)
- [Tailwind CSS v4](https://tailwindcss.com/) (načítáno přes CDN)
- [Lucide Icons](https://lucide.dev/) (vektorové ikony)

**Backend:**
- [Node.js](https://nodejs.org/)
- [Express.js](https://expressjs.com/) (REST API)
- [SQLite3](https://www.sqlite.org/) (lokální souborová databáze)
- [CORS](https://expressjs.com/en/resources/middleware/cors.html)

---

## 🚀 Instalace a lokální spuštění

Aplikace běží jako jeden server na portu `5001`; ten bezpečně servíruje frontend i API. Port `5001` je zvolen úmyslně pro bezkolizní běh na systémech macOS (obchází systémový AirPlay Receiver).

### 1. Požadavky
- Nainstalovaný [Node.js](https://nodejs.org/) (verze 20 a novější).
- Pro reset hesla volitelně SMTP účet. Zkopíruj `.env.example` jako `.env` a doplň vlastní údaje; `.env` se nikdy neukládá do Gitu.

### 2. Spuštění Backend serveru
Otevřete terminál ve složce s projektem a nainstalujte závislosti:
```bash
npm install
```
Následně spusťte server:
```bash
npm start
```
*(Úspěšné spuštění ohlásí v terminálu: `EL3D SFS běží na http://localhost:5001`)*

### 3. Otevření aplikace
Otevři [http://localhost:5001](http://localhost:5001). Live Server už není potřeba.

---

## 📁 Struktura projektu

```
el3d-sfs/
├── server/                  # Backend (Node.js/Express)
│   ├── index.js             # Bootstrap - nastavení middleware, montáž rout, start
│   ├── db.js                # SQLite připojení a run/get/all helpery
│   ├── schema.js            # Inicializace tabulek + migrace starších instalací
│   ├── session.js           # Cookie session (login stav)
│   ├── rateLimit.js         # Ochrana proti brute-force na login/signup
│   ├── audit.js             # Zápis do historie pohybu (inventory_events)
│   ├── env.js               # Načtení .env souboru
│   ├── mailer.js            # Odeslání e-mailu při obnově hesla (SMTP)
│   ├── utils/               # Validace a hashování hesel
│   └── routes/              # REST API endpointy (auth, spools, events, config, team, misc)
├── public/                  # Frontend (staté soubory servirované Expressem)
│   ├── index.html
│   ├── style.css
│   └── js/                  # app.js rozdělený na logické moduly (state, auth, inventory, team, reservation, theme, keyboard, ...)
├── database/                # SQLite soubor (mimo Git, generuje se automaticky)
├── ecosystem.config.js      # Konfigurace pro PM2 (produkční běh na Raspberry Pi)
└── package.json
```

> Backend servíruje **pouze** obsah `public/` - zdrojový kód serveru ani SQLite databáze
> už nejsou přes HTTP přístupné (na rozdíl od starších verzí, které servirovaly celý kořen projektu).

---

## 🐍 Produkční nasazení na Raspberry Pi (PM2)

Tento postup předpokládá Raspberry Pi OS (64-bit) s přístupem po SSH a uživatelem s `sudo` právy.

### 1. Příprava Raspberry Pi
Připoj se po SSH:
```bash
ssh pi@<IP_ADRESA_RASPBERRY>
```
Nainstaluj Node.js (LTS větev, přes NodeSource - výchozí Raspbian repo bývá zastaralé):
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # ověř verzi (očekáváno 20+)
```
Nainstaluj PM2 globálně:
```bash
sudo npm install -g pm2
```

### 2. Stáhnutí a příprava aplikace
```bash
cd ~
git clone <URL_TVOJEHO_REPOZITÁŘE> el3d-sfs
cd el3d-sfs
npm install --omit=dev
```
Vytvoř `.env` s produkčními hodnotami (port, SMTP pro reset hesla):
```bash
nano .env
```
```ini
PORT=5001
SMTP_HOST=smtp.example.cz
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=tvuj@email.cz
SMTP_PASS=heslo-k-emailu
```
Vytvoř složku pro logy PM2 (`ecosystem.config.js` do ní zapisuje):
```bash
mkdir -p logs
```

### 3. Spuštění pod PM2
```bash
npm run pm2:start
pm2 status            # ověří, že běží (status "online")
npm run pm2:logs      # živý log, ukonči Ctrl+C (proces běží dál)
```
Ověř funkčnost z prohlížeče na `http://<IP_ADRESA_RASPBERRY>:5001` nebo přes healthcheck:
```bash
curl http://localhost:5001/api/health
# {"status":"ok","uptime":12.34}
```

### 4. Automatický start po restartu Raspberry Pi
```bash
pm2 save              # uloží aktuálně běžící procesy
pm2 startup           # vypíše příkaz na míru pro tvůj systém
# zkopíruj a spusť příkaz, který pm2 startup vypísal (začíná `sudo env PATH=...`)
```
Od této chvíle PM2 nastartuje aplikaci automaticky i po výpadku proudu či rebootu.

### 5. Auto-restart při pádu
`ecosystem.config.js` má nastavené:
- `autorestart: true` - PM2 restartuje proces při jakékoliv nezachycené chybě/pádu.
- `min_uptime: '15s'` + `max_restarts: 10` - pokud proces padá opakovaně hned po startu (např. špatná konfigurace), PM2 po 10 pokusech přestane restartovat, aby negeneroval nekonečnou smyčku - stav uvidíš jako `errored` v `pm2 status`.
- `max_memory_restart: '300M'` - restart při neočekávaném nárůstu paměti (ochrana před memory leakem na Pi s omezenou RAM).
- Endpoint `GET /api/health` lze použít pro externí monitoring (např. UptimeRobot, cron skript s `curl`, nebo reverzní proxy healthcheck).

### 6. Aktualizace aplikace (nová verze z Gitu)
```bash
cd ~/el3d-sfs
git pull
npm install --omit=dev
npm run pm2:restart
```

### 7. Užitečné PM2 příkazy
| Příkaz | Význam |
|---|---|
| `npm run pm2:start` | Spustí aplikaci pod PM2 |
| `npm run pm2:stop` | Zastaví aplikaci |
| `npm run pm2:restart` | Restartuje aplikaci (např. po aktualizaci kódu) |
| `npm run pm2:logs` | Zobrazí živý log |
| `pm2 status` | Přehled běžících procesů a jejich stavu |
| `pm2 monit` | Interaktivní monitoring CPU/paměti |

### 8. (Volitelně) Přístup na standardním portu 80 přes Nginx
PM2 aplikace běží na portu 5001. Pro přístup bez uvádění portu (`http://<IP>` místo `http://<IP>:5001`) lze předsadit Nginx jako reverzní proxy:
```bash
sudo apt-get install -y nginx
```
```nginx
# /etc/nginx/sites-available/el3d-sfs
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/el3d-sfs /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 📱 Připojení z mobilního telefonu v lokální síti
Pro ovládání systému z mobilu během práce u tiskárny:
1. Zjisti lokální IP adresu zařízení, na němž běží server (např. `192.168.1.150`).
2. Na mobilním zařízení připojeném na stejné Wi‑Fi otevři `http://<VAŠE_IP_ADRESA>:5001`.

---

## 🗺️ Plánovaný rozvoj (Roadmap)
- [x] Nasazení na produkční prostředí přes Raspberry Pi a PM2.
- [x] Generování a skenování QR kódů pro rychlé dohledání cívky.
- [x] Historie odpisů a tiskový "Audit Log".
- [x] Role a sdílený sklad pro tým (admin/člen).
- [x] Rezervace cívky pro právě probíhající tisk.
- [x] Tmavý/světlý režim a klávesové zkratky.
- [ ] Inteligentní parsing G-code / 3MF pro automatické odepisování přesné váhy ze Sliceru.
- [ ] Cena materiálu a přehled nákladů na tisk.

---

**Vyvinuto pro potřeby 3D tisku | EL3D — Ladislav Eliáš © 2026**
