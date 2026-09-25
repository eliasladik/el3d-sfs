// Rezervace cívky pro právě probíhající tisk - výběr tiskárny ze seznamu
// (spravuje se v Nastavení) + název zakázky/projektu. Tlačítka jsou vykreslována
// v inventory.js, samotný formulář je v samostatném modálu (#reserve-modal).

function openReserveModal(id) {
    reservingSpoolId = id;
    const select = document.getElementById('reserve-printer-select');
    select.innerHTML = printers.length
        ? printers.map(p => `<option value="${p}">${p}</option>`).join('') + '<option value="">Bez konkrétní tiskárny</option>'
        : '<option value="">Bez konkrétní tiskárny (žádné tiskárny v Nastavení)</option>';
    document.getElementById('reserve-project-input').value = '';
    document.getElementById('reserve-modal').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeReserveModal() {
    reservingSpoolId = null;
    document.getElementById('reserve-modal').classList.add('hidden');
}

async function confirmReservation(event) {
    event.preventDefault();
    if (reservingSpoolId === null) return;
    const printer = document.getElementById('reserve-printer-select').value;
    const project = document.getElementById('reserve-project-input').value.trim();
    const note = [printer, project].filter(Boolean).join(' — ');

    const response = await fetch(`${API_URL}/spools/${reservingSpoolId}/reserve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note })
    });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return alert(data.message || 'Rezervaci se nepodařilo uložit.'); }
    closeReserveModal();
    const spoolsRes = await fetch(`${API_URL}/spools`); mockSpools = await spoolsRes.json(); renderSpools();
}

async function releaseSpool(id) {
    const response = await fetch(`${API_URL}/spools/${id}/release`, { method: 'POST' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return alert(data.message || 'Rezervaci se nepodařilo uvolnit.'); }
    const spoolsRes = await fetch(`${API_URL}/spools`); mockSpools = await spoolsRes.json(); renderSpools();
}
