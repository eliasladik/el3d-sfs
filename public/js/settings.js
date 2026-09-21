// Panel nastavení: materiály, limity, profil, export, historie

function showSettings() { currentFilter = 'SETTINGS'; updateFilterButtonStyles(); document.getElementById('spools-grid').classList.add('hidden'); document.getElementById('btn-add-main').classList.add('hidden'); document.getElementById('search-container').classList.add('hidden'); document.getElementById('settings-panel').classList.remove('hidden'); document.getElementById('set-profile-email').value = currentEmail.endsWith('@legacy.local') ? '' : currentEmail; renderMaterialsManagerList(); loadInventoryEvents(); }
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
