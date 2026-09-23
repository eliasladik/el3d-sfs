// Rezervace cívky pro právě probíhající tisk - informativní zámek pro tým,
// aby dva lidé nesáhli na stejný kus. Tlačítka jsou vykreslována v inventory.js.

async function reserveSpool(id) {
    const note = prompt('Poznámka k rezervaci (nepovinné, např. "Tiskárna 2 - zakázka Novák"):') || '';
    const response = await fetch(`${API_URL}/spools/${id}/reserve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note })
    });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return alert(data.message || 'Rezervaci se nepodařilo uložit.'); }
    const spoolsRes = await fetch(`${API_URL}/spools`); mockSpools = await spoolsRes.json(); renderSpools();
}

async function releaseSpool(id) {
    const response = await fetch(`${API_URL}/spools/${id}/release`, { method: 'POST' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return alert(data.message || 'Rezervaci se nepodařilo uvolnit.'); }
    const spoolsRes = await fetch(`${API_URL}/spools`); mockSpools = await spoolsRes.json(); renderSpools();
}
