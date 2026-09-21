const nodemailer = require('nodemailer');

function isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function sendResetEmail(toEmail, username, newPassword) {
    if (!isConfigured()) return Promise.reject(new Error('SMTP není nastavené. Doplň SMTP_* proměnné prostředí.'));
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE !== 'false',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return transporter.sendMail({
        from: process.env.SMTP_FROM || `"EL3D Smart Filament System" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: 'Obnova hesla k EL3D SFS',
        text: `Ahoj ${username}, tvoje nové jednorázové heslo je: ${newPassword}\nPo přihlášení si ho ihned změň.`
    });
}

module.exports = { isConfigured, sendResetEmail };
