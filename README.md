# 🏎️ EL3D SFS — Smart Filament System

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Backend-43853D?logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-UI-38B2AC?logo=tailwind-css&logoColor=white)

**EL3D SFS (Smart Filament System)** je moderní, multi-uživatelská webová aplikace pro správu, evidenci a odepisování materiálu pro 3D tiskárny. 

Systém je navržen s důrazem na čistý "dark motorsport" design, bleskovou odezvu a lokální nasazení (např. na Raspberry Pi) přímo v dílně. Eliminuje nutnost používat nepřehledné excelové tabulky a automatizuje přehled o stavu skladu.

---

## ✨ Hlavní funkce

- 🔐 **Multi-User Architektura:** Nezávislé účty a regály pro různé tiskaře v jedné dílně.
- 🗄️ **Lokální SQLite Databáze:** Rychlé a spolehlivé ukládání dat do jednoho souboru (`database.sqlite`), žádné složité nastavování SQL serverů.
- 📊 **Telemetrie Skladu:** Výpočet kapacity regálu, celkové váhy a vizuální progress-bary pro každou cívku.
- 🎨 **Dark / Motorsport UI:** Moderní uživatelské rozhraní postavené na Tailwind CSS s podporou dynamických notifikací a částicových animací.
- 📱 **Mobile Ready:** Plně responzivní design optimalizovaný pro ovládání z mobilního telefonu přímo u 3D tiskárny.
- ⚙️ **Dynamická konfigurace:** Správa vlastních materiálů (PLA, PETG, PCCF, NYLON...), hlídání kritického stavu (Low Stock Limit) a bezpečné odhlašování.

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

Aplikace je rozdělena na backend (který komunikuje s databází na portu `5001`) a frontend (statické soubory). Port `5001` je zvolen úmyslně pro bezkolizní běh na systémech macOS (obchází systémový AirPlay Receiver).

### 1. Požadavky
- Nainstalovaný [Node.js](https://nodejs.org/) (verze 18 a novější).
- Libovolný lokální webový server pro frontend (např. *Live Server* rozšíření ve VS Code).

### 2. Spuštění Backend serveru
Otevřete terminál ve složce s projektem a nainstalujte závislosti:
```bash
npm install
```
Následně spusťte server:
```bash
node server.js
```
*(Úspěšné spuštění ohlásí v terminálu: `Smart Filament System API (SQLite Multi-User) bezi na portu 5001`)*

### 3. Spuštění Frontendu
Pomocí rozšíření **Live Server** ve VS Code otevřete soubor `index.html`. Frontend se automaticky připojí k backendu.

---

## 📱 Připojení z mobilního telefonu v lokální síti
Pro ovládání systému z mobilu během práce u tiskárny:
1. Ujistěte se, že nastavení vašeho Live Serveru naslouchá na `0.0.0.0` (viz nastavení VS Code: `Live Server Settings: Host`).
2. Zjistěte si lokální IP adresu vašeho počítače (např. `192.168.1.150`).
3. Na mobilním zařízení připojeném na stejné Wi-Fi zadejte do prohlížeče: `http://<VAŠE_IP_ADRESA>:5500/index.html`

---

## 🗺️ Plánovaný rozvoj (Roadmap)
- [ ] Nasazení na produkční prostředí přes Raspberry Pi a PM2.
- [ ] Generování a skenování QR kódů pro rychlé dohledání cívky.
- [ ] Inteligentní parsing G-code / 3MF pro automatické odepisování přesné váhy ze Sliceru.
- [ ] Historie odpisů a tiskový "Audit Log".

---

**Vyvinuto pro potřeby 3D tisku | EL3D — Ladislav Eliáš © 2026**