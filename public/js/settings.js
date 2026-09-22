// Panel nastavení: materiály, limity, profil, export, historie

function showSettings() { currentFilter = 'SETTINGS'; updateFilterButtonStyles(); document.getElementById('spools-grid').classList.add('hidden'); document.getElementById('btn-add-main').classList.add('hidden'); document.getElementById('search-container').classList.add('hidden'); document.getElementById('settings-panel').classList.remove('hidden'); document.getElementById('set-profile-email').value = currentEmail.endsWith('@legacy.local') ? '' : currentEmail; renderMaterialsManagerList(); loadInventoryEvents(); loadConsumptionStats(30); }
async function saveProfileEmail() {
    const email = document.getElementById('set-profile-email').value.trim();
    const response = await fetch(`${API_URL}/profile/email`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!response.ok) { const data = await response.json(); return alert(data.message || 'E-mail se nepodařilo uložit.'); }
    currentEmail = email;
    alert('E-mail pro obnovu hesla byl uložen.');
}
async function loadInventoryEvents() {
    const container = document.getElementById('inventory-events');
    container.textContent = 'Načítám historii…';
    try {
        const response = await fetch(`${API_URL}/events`);
        if (!response.ok) throw new Error('Historie není dostupná');
        const events = await response.json();
        container.replaceChildren();
        if (!events.length) { container.textContent = 'Zatím nebyl zaznamenán žádný pohyb.'; container.classList.add('p-3'); return; }
        container.classList.remove('p-3');
        const labels = { created: 'Přidána cívka', deducted: 'Odpis materiálu', corrected: 'Korekce hmotnosti', deleted: 'Cívka smazána' };
        events.forEach(event => {
            const row = document.createElement('div'); row.className = 'flex justify-between gap-3 px-3 py-2.5';
            const description = document.createElement('span'); description.textContent = `${labels[event.action] || event.action}${event.spool_id ? ` · #${event.spool_id}` : ''}${event.note ? ` — ${event.note}` : ''}`;
            const meta = document.createElement('span'); meta.className = 'shrink-0 text-slate-500'; meta.textContent = `${event.weight_delta_g > 0 ? '+' : ''}${event.weight_delta_g} g · ${new Date(`${event.created_at}Z`).toLocaleString('cs-CZ')}`;
            row.append(description, meta); container.append(row);
        });
    } catch (error) { container.textContent = 'Historii se nepodařilo načíst.'; }
}
function renderMaterialsManagerList() { const listContainer = document.getElementById('materials-list-manager'); listContainer.innerHTML = ''; materialTypes.forEach(type => { listContainer.innerHTML += `<span class="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-xs font-semibold px-2.5 py-1 rounded-md text-slate-300">${type}<button onclick="removeMaterialType('${type}')" class="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"><i data-lucide="x" class="w-3 h-3"></i></button></span>`; }); lucide.createIcons(); }
async function addNewMaterialType() { const input = document.getElementById('new-material-input'); const value = input.value.trim().toUpperCase(); if (value && !materialTypes.includes(value)) { materialTypes.push(value); input.value = ''; await persistConfig(); renderFilterButtons(); updateModalSelectOptions(); renderMaterialsManagerList(); } }
async function removeMaterialType(type) { if(confirm(`Opravdu smazat typ ${type}?`)) { materialTypes = materialTypes.filter(m => m !== type); await persistConfig(); renderFilterButtons(); updateModalSelectOptions(); renderMaterialsManagerList(); } }
async function saveLimit() { lowStockLimit = parseInt(document.getElementById('set-low-limit').value) || 150; await persistConfig(); alert("Limit uložen."); renderSpools(); }
async function saveExpandMode(mode) { defaultExpandMode = mode; await persistConfig(); alert("Zobrazení upraveno."); }
function exportWarehouseData() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ spools: mockSpools, materials: materialTypes, limit: lowStockLimit })); const anchor = document.createElement('a'); anchor.setAttribute("href", dataStr); anchor.setAttribute("download", "el3d_sfs_backup.json"); document.body.appendChild(anchor); anchor.click(); anchor.remove(); }

// Export skladu do CSV (středník jako oddělovač - český Excel bere čárku jako
// desetinnou tečku, takže by jinak rozbil sloupce). BOM na začátku zajistí správnou
// diakritiku při otevření v Excelu.
function exportWarehouseDataCSV() {
    const header = ['ID', 'Výrobce', 'Materiál', 'Barva', 'Barva HEX', 'Kapacita (g)', 'Zbývá (g)'];
    const rows = mockSpools.map(s => [s.id, s.brand, s.material_type, s.color_name, s.color_hex, s.total_capacity, s.remaining_weight_g]);
    const escapeCsv = (value) => { const str = String(value); return /[";\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str; };
    const csvContent = [header, ...rows].map(row => row.map(escapeCsv).join(';')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'el3d_sfs_sklad.csv';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    URL.revokeObjectURL(url);
}

// Souhrn spotřeby materiálu za zvolené období - využívá nový backend endpoint
// /api/events/stats, který agreguje již existující audit log.
async function loadConsumptionStats(days = 30) {
    const rangeButtons = document.querySelectorAll('#stats-range-buttons button');
    rangeButtons.forEach(btn => {
        const isActive = Number(btn.dataset.days) === days;
        btn.className = isActive
            ? 'px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer bg-slate-800 text-white border border-slate-700'
            : 'px-2.5 py-1 text-[11px] font-semibold rounded-md cursor-pointer bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700';
    });
    const container = document.getElementById('consumption-stats');
    if (!container) return;
    container.replaceChildren();
    container.textContent = 'Načítám…';
    try {
        const response = await fetch(`${API_URL}/events/stats?days=${days}`);
        if (!response.ok) throw new Error('Statistiky nejsou dostupné');
        const data = await response.json();
        container.replaceChildren();
        if (!data.byMaterial.length) { container.textContent = 'Za toto období nebyl zaznamenán žádný odpis.'; return; }
        const maxConsumed = Math.max(...data.byMaterial.map(row => row.consumed_g));
        data.byMaterial.forEach(row => {
            const pct = maxConsumed > 0 ? Math.round((row.consumed_g / maxConsumed) * 100) : 0;
            const wrap = document.createElement('div');
            const labelRow = document.createElement('div'); labelRow.className = 'flex justify-between mb-1';
            const label = document.createElement('span'); label.className = 'text-slate-300 font-medium'; label.textContent = row.material;
            const value = document.createElement('span'); value.textContent = `${(row.consumed_g / 1000).toFixed(2)} kg`;
            labelRow.append(label, value);
            const barTrack = document.createElement('div'); barTrack.className = 'w-full bg-slate-900 h-1.5 rounded-full overflow-hidden';
            const bar = document.createElement('div'); bar.className = 'h-full bg-red-600 rounded-full'; bar.style.width = `${pct}%`;
            barTrack.append(bar);
            wrap.append(labelRow, barTrack);
            container.append(wrap);
        });
        const totalLine = document.createElement('div');
        totalLine.className = 'pt-2 mt-2 border-t border-slate-850 text-slate-500 flex justify-between';
        const totalLabel = document.createElement('span'); totalLabel.textContent = `Celkem za ${days} dní`;
        const totalValue = document.createElement('strong'); totalValue.className = 'text-slate-300'; totalValue.textContent = `${(data.totalConsumed / 1000).toFixed(2)} kg`;
        totalLine.append(totalLabel, totalValue);
        container.append(totalLine);
    } catch (error) { container.textContent = 'Statistiky se nepodařilo načíst.'; }
}
