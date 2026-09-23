// Světlý/tmavý režim. Appka je postavená na natvrdo napsaných Tailwind třídách
// (bg-slate-950 apod.), ne na dark:/light: variantách, protože běží přes Tailwind
// Play CDN bez build kroku. Přepínání proto řeší CSS override vrstva ve style.css
// nad atributem data-theme na <html> - tenhle soubor jen ten atribut přepíná
// a ukládá volbu do localStorage, aby se pamatovala i po zavření appky.

function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
}

function toggleTheme() {
    if (isLightTheme()) {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('sfs_theme', 'dark'); } catch (e) { /* soukromý režim prohlížeče */ }
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        try { localStorage.setItem('sfs_theme', 'light'); } catch (e) { /* soukromý režim prohlížeče */ }
    }
    updateThemeToggleIcon();
}

function updateThemeToggleIcon() {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', isLightTheme() ? 'moon' : 'sun');
    if (window.lucide) lucide.createIcons();
}
