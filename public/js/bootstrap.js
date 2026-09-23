// Vstupní bod - spustí se po načtení DOM

window.addEventListener('DOMContentLoaded', () => {
    loadSystemVersion();
    updateThemeToggleIcon();

    // Pokud stránku otevřel odkaz z naskenovaného QR štítku (?spool=ID),
    // zapamatujeme si ID a odkaz z adresního řádku hned vyčistíme.
    const rawSpoolParam = new URLSearchParams(window.location.search).get('spool');
    if (rawSpoolParam && /^\d+$/.test(rawSpoolParam)) {
        pendingSpoolId = Number(rawSpoolParam);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('spool');
        window.history.replaceState({}, '', cleanUrl);
    }

    const sessionActive = localStorage.getItem('sfs_session_active');
    if (sessionActive === 'true' && currentUser) {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden', 'opacity-0');
        fetch(`${API_URL}/session`).then(res => {
            if (!res.ok) throw new Error('Session expired');
            return res.json();
        }).then(data => {
            currentUser = data.username;
            currentEmail = data.email;
            currentRole = data.role || 'admin';
            materialTypes = data.config.materialTypes; lowStockLimit = data.config.lowStockLimit; defaultExpandMode = data.config.defaultExpandMode;
            applyRoleUI();
            return loadDataFromServer();
        }).then(() => {
            if (pendingSpoolId !== null) { focusSpoolById(pendingSpoolId); pendingSpoolId = null; }
        }).catch(handleLogout);
    } else {
        lucide.createIcons(); startParticleAnimation();
        // pendingSpoolId zůstává uložen - dořeší se po přihlášení, viz handleLogin v auth.js
    }
});
