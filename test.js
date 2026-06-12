const nodemailer = require('nodemailer');

// 1. Nastavení pošťáka (stejně jako v mailer.js)
const transporter = nodemailer.createTransport({
    host: 'smtp.seznam.cz',
    port: 465,
    secure: true, 
    auth: {
        user: 'el3d-sfs@seznam.cz',       
        pass: 'Horky57001,.'       
    }
});

// 2. Příprava testovací zprávy
const mailOptions = {
    from: '"EL3D Testovací Skript" <el3d-sfs@seznam.cz>',
    to: 'SEM_NAPIŠ_SVŮJ_OSOBNÍ_EMAIL@seznam.cz', // <-- Tady doplň svůj osobní mail pro test!
    subject: '🔥 SFS SMTP Skript funguje!',
    text: 'Ahoj Ladislave, pokud čteš tento mail, tak Node.js dokáže úspěšně komunikovat se SMTP serverem Seznamu!'
};

console.log("🚀 Startuji izolovaný test odesílání e-mailu...");

// 3. Pokus o odeslání
transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("\n❌ TEST SELHAL! Seznam odmítl mail odeslat.");
        console.error("--------------------------------------------------");
        console.error(error); // Vypíše přesný důvod (špatné heslo / blokace)
        console.error("--------------------------------------------------");
    } else {
        console.log("\n✅ ÚSPĚCH! Skript předal mail Seznamu.");
        console.log("ID zprávy:", info.messageId);
        console.log("Odpověď serveru:", info.response);
        console.log("\n👉 Teď hned zkontroluj svou schránku (včetně složky SPAM)!");
    }
});