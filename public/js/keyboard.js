// Klávesové zkratky: / hledání, N nová cívka, Esc zavře otevřené okno, ? nápověda

function isTypingContext() {
    const el = document.activeElement;
    return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
}

function closeAnyOpenModal() {
    if (!document.getElementById('scanner-modal').classList.contains('hidden')) { closeScanner(); return true; }
    if (!document.getElementById('spool-modal').classList.contains('hidden')) { closeModal(); return true; }
    if (!document.getElementById('qr-modal').classList.contains('hidden')) { closeQrModal(); return true; }
    if (!document.getElementById('shortcuts-modal').classList.contains('hidden')) { toggleShortcutsHelp(); return true; }
    return false;
}

function toggleShortcutsHelp() {
    document.getElementById('shortcuts-modal').classList.toggle('hidden');
}

document.addEventListener('keydown', (event) => {
    const appVisible = !document.getElementById('app-content').classList.contains('hidden');
    if (!appVisible) return; // zkratky dávají smysl jen po přihlášení

    if (event.key === 'Escape') { closeAnyOpenModal(); return; }
    if (isTypingContext()) return; // nezasahovat, když se zrovna píše do pole

    if (event.key === '/') {
        event.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput && !searchInput.closest('#search-container').classList.contains('hidden')) searchInput.focus();
        return;
    }
    if (event.key === 'n' || event.key === 'N') {
        if (currentFilter !== 'SETTINGS' && document.getElementById('btn-add-main') && !document.getElementById('btn-add-main').classList.contains('hidden')) openAddModal();
        return;
    }
    if (event.key === '?') { toggleShortcutsHelp(); return; }
});
