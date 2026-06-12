const nodemailer = require('nodemailer');

// KONFIGURACE SMTP SEZNAM.CZ
const transporter = nodemailer.createTransport({
    host: 'smtp.seznam.cz',
    port: 465,
    secure: true, 
    auth: {
        user: 'el3d-sfs@seznam.cz',       // SEM NAPIŠ SVOJ EMAIL
        pass: 'Horky57001,.'       // SEM NAPIŠ HESLO K EMAILU
    }
});

/**
 * Funkce pro odeslání HTML e-mailu s novým heslem
 * @param {string} toEmail - Příjemce
 * @param {string} username - Uživatelské jméno tiskaře
 * @param {string} newPassword - Vygenerované heslo
 */
function sendResetEmail(toEmail, username, newPassword) {
    return new Promise((resolve, reject) => {
        const mailOptions = {
            from: '"EL3D Smart Filament System" <el3d-sfs@seznam.cz>', // MUSÍ BÝT STEJNÝ JAKO V AUTH
            to: toEmail,
            subject: 'Obnova hesla k tiskovému skladu SFS',
            html: `
                <div style="font-family: sans-serif; background-color: #0b0e14; color: #f0f3f8; padding: 24px; border-radius: 12px; max-w: 500px;">
                    <h2 style="color: #ff4a4a; margin-bottom: 4px; text-transform: uppercase; font-style: italic;">EL3D SFS</h2>
                    <p style="font-size: 12px; color: #6c7a9c; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">Smart Filament System</p>
                    <hr style="border-color: #2c3a57; margin: 20px 0;">
                    <p>Ahoj tiskaři,</p>
                    <p>Na základě tvé žádosti v přihlašovací bráně ti systém vygeneroval nové přístupové heslo k tvému regálu.</p>
                    <div style="background-color: #182030; border: 1px solid #2c3a57; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 11px; text-transform: uppercase; color: #6c7a9c; display: block; margin-bottom: 4px;">Tvoje uživatelské jméno:</span>
                        <strong style="font-size: 16px; color: #ffffff; font-family: monospace;">${username}</strong>
                        <span style="font-size: 11px; text-transform: uppercase; color: #6c7a9c; display: block; margin-top: 14px; margin-bottom: 4px;">Nové vygenerované heslo:</span>
                        <strong style="font-size: 22px; color: #ff4a4a; font-family: monospace; letter-spacing: 2px;">${newPassword}</strong>
                    </div>
                    <p style="font-size: 12px; color: #6c7a9c;">Po přihlášení doporučujeme heslo okamžitě změnit v sekci Nastavení aplikace.</p>
                    <hr style="border-color: #2c3a57; margin: 20px 0;">
                    <p style="font-size: 10px; color: #475569; text-align: center;">&copy; 2026 EL3D SFS. Tato zpráva byla vygenerována automaticky.</p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) return reject(err);
            resolve(info);
        });
    });
}

// Exportujeme funkci ven, aby ji server mohol načíst přes require
module.exports = { sendResetEmail };