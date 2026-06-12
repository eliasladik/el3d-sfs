// Konfigurace API adresy - Port 5001 je bezpečný pro macOS (AirPlay neblokuje)
const API_URL = "http://" + window.location.hostname + ":5001/api"; 

// Proměnná, která drží jméno aktuálně přihlášeného tiskaře
let currentUser = localStorage.getItem('sfs_current_user') || ''; 

let materialTypes = [];
let lowStockLimit = 150;
let systemPassword = '';
let defaultExpandMode = 'collapsed';
let mockSpools = [];

let currentFilter = 'ALL';
let searchQuery = '';
let expandedCards = {};
let particleAnimationId = null;

// Načtení dat upravené pro konkrétního uživatele
async function loadDataFromServer() {
    if (!currentUser) return handleLogout();
    try {
        const spoolsRes = await fetch(`${API_URL}/spools?user=${currentUser}`);
        mockSpools = await spoolsRes.json();
        initApp();
    } catch (err) { console.error("Chyba DB serveru:", err); }
}

async function persistConfig() {
    try {
        const payload = {
            user: currentUser,
            config: { materialTypes, lowStockLimit, systemPassword, defaultExpandMode }
        };
        await fetch(`${API_URL}/config/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) { console.error(err); }
}

function triggerWebNotification(spool) {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toastId = 'toast-' + Date.now();
    const isZero = spool.remaining_weight_g === 0;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `pointer-events-auto w-full bg-slate-900 border ${isZero ? 'border-red-600 shadow-red-950/20' : 'border-amber-500 shadow-amber-950/10'} p-4 rounded-xl shadow-xl flex gap-3 items-start animate-slideInRight`;
    toast.innerHTML = `
        <div class="p-1.5 rounded-lg ${isZero ? 'bg-red-950/40 text-red-500' : 'bg-amber-950/40 text-amber-500'} mt-0.5"><i data-lucide="${isZero ? 'alert-triangle' : 'bell'}" class="w-4 h-4"></i></div>
        <div class="flex-1">
            <h5 class="text-xs font-bold text-white tracking-tight uppercase">${isZero ? 'Materiál vyčerpán' : 'Nízký stav zásob'}</h5>
            <p class="text-xs text-slate-400 mt-1 leading-normal">Cívka <strong class="text-slate-200">#${spool.id}</strong> (${spool.brand} ${spool.material_type}) ${isZero ? 'je na nule.' : 'klesla na ' + spool.remaining_weight_g + 'g.'}</p>
        </div>
        <button onclick="document.getElementById('${toastId}').remove()" class="text-slate-500 hover:text-white transition-colors cursor-pointer"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    `;
    container.appendChild(toast); lucide.createIcons();
    setTimeout(() => { const el = document.getElementById(toastId); if(el) { el.classList.add('opacity-0', 'transition-opacity', 'duration-300'); setTimeout(() => el.remove(), 300); } }, 5000);
}

function startParticleAnimation() {
    const canvas = document.getElementById('login-particles'); if(!canvas) return; const ctx = canvas.getContext('2d');
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize); resize();
    const particles = []; const particleCount = Math.min(80, Math.floor((canvas.width * canvas.height) / 22000));
    for (let i = 0; i < particleCount; i++) { particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, radius: Math.random() * 1.5 + 1 }); }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, idx) => {
            p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > canvas.width) p.vx *= -1; if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'; ctx.fill();
            for (let j = idx + 1; j < particles.length; j++) { const p2 = particles[j]; const dist = Math.hypot(p.x - p2.x, p.y - p2.y); if (dist < 130) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(220, 38, 38, ${0.12 * (1 - dist / 130)})`; ctx.lineWidth = 0.6; ctx.stroke(); } }
        });
        particleAnimationId = requestAnimationFrame(animate);
    }
    animate();
}
function stopParticleAnimation() { if (particleAnimationId) { cancelAnimationFrame(particleAnimationId); particleAnimationId = null; } }

// HLAVNÍ SPOUŠTĚČ PO NAČTENÍ STRÁNKY
window.addEventListener('DOMContentLoaded', async () => { // <-- Tady přibylo slovo 'async'
    
    // --- NOVÉ: Automatické načtení verze z backendu ---
    try {
        const versionRes = await fetch(`${API_URL}/version`);
        const versionData = await versionRes.json();
        const appVersion = `v${versionData.version}`;
        document.querySelectorAll('.app-version-display').forEach(el => el.innerText = appVersion);
    } catch (err) {
        console.error("Nepodařilo se načíst verzi aplikace:", err);
    }
    // ---------------------------------------------------

    // Inicializace přepínání oka u hesla
    initPasswordToggle();

    const sessionActive = localStorage.getItem('sfs_session_active');
    if (sessionActive === 'true' && currentUser) {
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden', 'opacity-0');
        fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser, password: '' })
        }).then(res => res.json()).then(data => {
            materialTypes = data.config.materialTypes;
            lowStockLimit = data.config.lowStockLimit;
            systemPassword = data.config.systemPassword;
            defaultExpandMode = data.config.defaultExpandMode;
            loadDataFromServer();
        });
    } else { lucide.createIcons(); startParticleAnimation(); }
});
// PŘIDÁNO: Funkce pro oživení ikonky oka u zadávání hesla
function initPasswordToggle() {
    const passwordInput = document.getElementById('login-password');
    const icon = document.getElementById('password-toggle-icon');
    
    // Najdeme tlačítko, které obaluje ikonku oka
    if (passwordInput && icon) {
        const toggleBtn = icon.parentElement;
        toggleBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.setAttribute('data-lucide', 'eye-off');
            } else {
                passwordInput.type = 'password';
                icon.setAttribute('data-lucide', 'eye');
            }
            // Znovu vygenerujeme ikony Lucide, aby se projevila změna (eye <-> eye-off)
            lucide.createIcons();
        });
    }
}

// PŘIHLAŠOVACÍ LOGIKA S PODPOROU VÍCE UŽIVATELŮ
async function handleLogin(e) {
    e.preventDefault(); 
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');

    if(!user || !pass) return;

    try {
        const authRes = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await authRes.json();

        if (data.success) {
            errorBox.classList.add('hidden');
            currentUser = user;
            localStorage.setItem('sfs_current_user', currentUser);
            
            if (document.getElementById('login-remember').checked) {
                localStorage.setItem('sfs_session_active', 'true');
            }

            materialTypes = data.config.materialTypes;
            lowStockLimit = data.config.lowStockLimit;
            systemPassword = data.config.systemPassword;
            defaultExpandMode = data.config.defaultExpandMode;

            stopParticleAnimation(); 
            document.getElementById('login-page').classList.add('opacity-0');
            setTimeout(() => {
                document.getElementById('login-page').classList.add('hidden');
                document.getElementById('app-content').classList.remove('hidden', 'opacity-0'); 
                loadDataFromServer(); 
            }, 300);
        } else {
            errorBox.innerText = data.message || "Chyba přihlášení!";
            errorBox.classList.remove('hidden');
        }
    } catch (err) { errorBox.innerText = "Nelze se spojit se serverem."; errorBox.classList.remove('hidden'); }
}

function handleLogout() {
    localStorage.removeItem('sfs_session_active');
    localStorage.removeItem('sfs_current_user');
    currentUser = ''; document.getElementById('login-remember').checked = false;
    document.getElementById('login-username').value = ''; document.getElementById('login-password').value = '';
    document.getElementById('app-content').classList.add('opacity-0');
    setTimeout(() => { document.getElementById('app-content').classList.add('hidden'); document.getElementById('login-page').classList.remove('hidden', 'opacity-0'); lucide.createIcons(); startParticleAnimation(); }, 300);
}

function initApp() {
    document.getElementById('user-display-badge').innerText = `TISKAŘ: ${currentUser.toUpperCase()}`;
    document.getElementById('set-expand-mode').value = defaultExpandMode;
    document.getElementById('set-low-limit').value = lowStockLimit;
    renderFilterButtons(); updateModalSelectOptions(); updateFormDatalists();
    if(defaultExpandMode === 'expanded') { mockSpools.forEach(spool => { expandedCards[`${spool.brand}-${spool.material_type}-${spool.color_name}`.toLowerCase()] = true; }); }
    renderSpools();
}

function updateFormDatalists() {
    document.getElementById('brands-list').innerHTML = [...new Set(mockSpools.map(s => s.brand))].map(b => `<option value="${b}">`).join('');
    document.getElementById('colors-list').innerHTML = [...new Set(mockSpools.map(s => s.color_name))].map(c => `<option value="${c}">`).join('');
}

function renderFilterButtons() {
    const container = document.getElementById('filter-buttons-container');
    container.innerHTML = `<button id="btn-filter-all" onclick="filterMaterial('ALL')" class="px-3 py-1.5 text-sm font-medium rounded-lg transition cursor-pointer">Vše</button>`;
    materialTypes.forEach(type => { container.innerHTML += `<button id="btn-filter-${type.toLowerCase()}" onclick="filterMaterial('${type}')" class="px-3 py-1.5 text-sm font-medium rounded-lg transition cursor-pointer">${type}</button>`; });
    container.innerHTML += `<button id="btn-settings" onclick="showSettings()" class="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700 transition cursor-pointer ml-1"><i data-lucide="settings" class="w-4 h-4"></i></button>`;
    updateFilterButtonStyles(); lucide.createIcons();
}

function updateFilterButtonStyles() {
    document.getElementById('btn-filter-all').className = "px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 transition cursor-pointer";
    materialTypes.forEach(type => { const btn = document.getElementById(`btn-filter-${type.toLowerCase()}`); if (btn) btn.className = "px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 transition cursor-pointer"; });
    document.getElementById('btn-settings').className = "p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700 transition cursor-pointer ml-1";
    if (currentFilter === 'SETTINGS') { document.getElementById('btn-settings').className = "p-1.5 rounded-lg bg-slate-800 text-white border border-slate-700 transition cursor-pointer ml-1"; }
    else { const activeId = currentFilter === 'ALL' ? 'btn-filter-all' : `btn-filter-${currentFilter.toLowerCase()}`; const activeBtn = document.getElementById(activeId); if (activeBtn) activeBtn.className = "px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-800 text-white border border-slate-700 transition cursor-pointer"; }
}

function updateModalSelectOptions() { const select = document.getElementById('form-type'); select.innerHTML = ''; materialTypes.forEach(type => { select.innerHTML += `<option value="${type}">${type}</option>`; }); }
function handleSearch(val) { searchQuery = val.toLowerCase().trim(); renderSpools(); }

function renderSpools() {
    document.getElementById('settings-panel').classList.add('hidden'); document.getElementById('spools-grid').classList.remove('hidden'); document.getElementById('btn-add-main').classList.remove('hidden'); document.getElementById('search-container').classList.remove('hidden');
    const grid = document.getElementById('spools-grid'); grid.innerHTML = ''; const stackedGroups = {};
    
    mockSpools.forEach(spool => {
        if (currentFilter !== 'ALL' && spool.material_type !== currentFilter) return; if (searchQuery && !spool.brand.toLowerCase().includes(searchQuery) && !spool.color_name.toLowerCase().includes(searchQuery)) return;
        const key = `${spool.brand}-${spool.material_type}-${spool.color_name}`.toLowerCase();
        if (!stackedGroups[key]) stackedGroups[key] = { brand: spool.brand, material_type: spool.material_type, color_name: spool.color_name, color_hex: spool.color_hex, items: [] };
        stackedGroups[key].items.push(spool);
    });

    const keys = Object.keys(stackedGroups);
    if (keys.length === 0) { grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 bg-slate-900/20 border border-dashed border-slate-800 rounded-xl">Tvůj regál je prázdný. Přidej první cívky.</div>`; updateStats(0); return; }
    keys.sort().forEach(key => {
        const group = stackedGroups[key]; const totalRemaining = group.items.reduce((sum, item) => sum + item.remaining_weight_g, 0);
        const totalMax = group.items.reduce((sum, item) => sum + item.total_capacity, 0); const totalPct = totalMax > 0 ? Math.round((totalRemaining / totalMax) * 100) : 0;
        const piecesCount = group.items.length; const isExpanded = expandedCards[key] || false;
        const hasLowSpool = group.items.some(item => item.remaining_weight_g > 0 && item.remaining_weight_g < lowStockLimit); const isFullyEmpty = totalRemaining === 0;
        let progressColor = 'bg-red-600'; if (totalPct > 50) progressColor = 'bg-emerald-500'; else if (totalPct > 20) progressColor = 'bg-amber-500';
        const card = document.createElement('div');
        card.className = `bg-slate-900 border ${isFullyEmpty ? 'border-slate-850 opacity-40 grayscale' : hasLowSpool ? 'border-red-900/40 ring-1 ring-red-950/20' : isExpanded ? 'border-slate-700 ring-1 ring-slate-800' : 'border-slate-800'} rounded-xl p-5 flex flex-col justify-between shadow-sm cursor-pointer select-none transition-all duration-200 hover:scale-[1.01]`;
        card.setAttribute('onclick', `toggleCard('${key}')`);
        let stackHtml = '';
        group.items.forEach((spool, idx) => {
            const itemPct = Math.round((spool.remaining_weight_g / spool.total_capacity) * 100);
            const isItemLow = spool.remaining_weight_g > 0 && spool.remaining_weight_g < lowStockLimit; const isItemEmpty = spool.remaining_weight_g === 0;
            let warningIndicator = isItemEmpty ? `<span class="text-[10px] font-bold text-red-500 bg-red-950/30 px-1.5 py-0.5 rounded border border-red-900/30 ml-2">PRÁZDNÁ</span>` : isItemLow ? `<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500 inline ml-1.5 animate-pulse-urgent"></i>` : '';
            stackHtml += `
                <div class="bg-slate-950 border ${isItemEmpty ? 'border-slate-900' : isItemLow ? 'border-red-950 bg-red-950/5' : 'border-slate-850'} p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs animate-fadeIn">
                    <div class="flex flex-col gap-1 flex-1">
                        <div class="flex justify-between font-mono text-slate-400"><span class="${isItemEmpty ? 'line-through text-slate-600' : 'text-slate-400'}">Kus: #${idx + 1} ${warningIndicator}</span><span class="${isItemEmpty ? 'text-slate-600' : isItemLow ? 'text-amber-500 font-bold' : 'text-slate-200'} font-sans font-medium">${isItemEmpty ? '0g' : spool.remaining_weight_g + 'g / ' + spool.total_capacity + 'g'}</span></div>
                        <div class="w-full bg-slate-900 h-1 rounded-full overflow-hidden"><div class="h-full ${isItemEmpty ? 'bg-slate-800' : isItemLow ? 'bg-amber-500' : 'bg-slate-500'}" style="width: ${itemPct}%"></div></div>
                    </div>
                    <div class="flex gap-1 pl-2" onclick="event.stopPropagation();">
                        <button onclick="manualDeduct(${spool.id})" ${isItemEmpty ? 'disabled class="p-1.5 text-slate-800 cursor-not-allowed"' : 'class="p-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 rounded cursor-pointer transition-colors"'}><i data-lucide="minus-square" class="w-3.5 h-3.5"></i></button>
                        <button onclick="deleteSpool(${spool.id})" class="p-1.5 bg-slate-900 hover:bg-red-950/40 border border-slate-800 text-slate-500 hover:text-red-400 rounded cursor-pointer transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            `;
        });

        let mainBadgeHtml = isFullyEmpty ? `<span class="text-[10px] text-slate-500 bg-slate-950 border border-slate-850 font-bold px-2 py-0.5 rounded">PRÁZDNÁ</span>` : hasLowSpool ? `<div class="flex items-center gap-1 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded animate-pulse-urgent"><i data-lucide="alert-triangle" class="w-3 h-3 text-amber-500"></i><span class="text-[10px] text-amber-500 font-bold">${piecesCount} ks</span></div>` : `<span class="text-[10px] text-red-400 bg-red-950/30 border border-red-900/30 font-bold px-2 py-0.5 rounded">${piecesCount} ks</span>`;
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3"><span class="text-[10px] font-bold tracking-wider uppercase text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">${group.material_type}</span><div class="flex items-center gap-2">${mainBadgeHtml}<i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-red-500' : ''}"></i></div></div>
                <h4 class="text-lg font-bold text-white tracking-tight ${isFullyEmpty ? 'line-through text-slate-500' : ''}">${group.brand}</h4>
                <p class="text-sm text-slate-400 flex items-center gap-2 mt-0.5 mb-4"><span class="w-2.5 h-2.5 rounded-full border border-slate-800 inline-block" style="background-color: ${isFullyEmpty ? '#334155' : group.color_hex}"></span><span class="${isFullyEmpty ? 'text-slate-600 italic' : ''}">${group.color_name}</span></p>
                <div class="bg-slate-950/60 p-3 rounded-lg border border-slate-850/60">
                    <div class="flex justify-between text-xs font-medium mb-1.5 text-slate-400"><span>Celkem zásob: <strong class="${isFullyEmpty ? 'text-slate-600' : 'text-white'} font-semibold">${totalRemaining}g</strong></span><span class="${hasLowSpool && !isFullyEmpty ? 'text-amber-500 font-bold' : 'text-slate-300'}">${totalPct}%</span></div>
                    <div class="w-full bg-slate-950 rounded-full h-1.5 border border-slate-900 overflow-hidden"><div class="h-full rounded-full ${isFullyEmpty ? 'bg-slate-800' : progressColor} transition-all duration-300" style="width: ${totalPct}%"></div></div>
                </div>
                <div class="${isExpanded ? 'block' : 'hidden'} space-y-2 mt-4 pt-4 border-t border-slate-800 max-h-[260px] overflow-y-auto pr-1"><div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Jednotlivé kusy:</div>${stackHtml}</div>
            </div>
        `; grid.appendChild(card);
    });
    lucide.createIcons(); updateStats(keys.length);
}

function openAddModal() { document.getElementById('spool-form').reset(); document.getElementById('spool-modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('spool-modal').classList.add('hidden'); }

async function handleFormSubmit(e) {
    e.preventDefault(); 
    const brand = document.getElementById('form-brand').value.trim(); 
    const type = document.getElementById('form-type').value;
    const colorName = document.getElementById('form-color-name').value.trim(); 
    const totalWeight = parseInt(document.getElementById('form-weight').value);
    let colorHex = document.getElementById('form-color-hex').value.trim(); 
    if (!colorHex.startsWith('#')) colorHex = '#' + colorHex;

    const count = parseInt(document.getElementById('form-count').value); 
    const tempBatch = [];
    for (let i = 0; i < count; i++) {
        tempBatch.push({ brand, material_type: type, color_name: colorName, color_hex: colorHex, total_capacity: totalWeight, remaining_weight_g: totalWeight });
    }
    
    await fetch(`${API_URL}/spools`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ spools: tempBatch, user: currentUser }) 
    });

    closeModal();
    const spoolsRes = await fetch(`${API_URL}/spools?user=${currentUser}`); 
    mockSpools = await spoolsRes.json();
    updateFormDatalists(); renderSpools();
}

function showSettings() {
    currentFilter = 'SETTINGS'; updateFilterButtonStyles();
    document.getElementById('spools-grid').classList.add('hidden'); document.getElementById('btn-add-main').classList.add('hidden');
    document.getElementById('search-container').classList.add('hidden'); document.getElementById('settings-panel').classList.remove('hidden');
    renderMaterialsManagerList();
}

function renderMaterialsManagerList() {
    const listContainer = document.getElementById('materials-list-manager'); listContainer.innerHTML = '';
    materialTypes.forEach(type => { listContainer.innerHTML += `<span class="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 text-xs font-semibold px-2.5 py-1 rounded-md text-slate-300">${type}<button onclick="removeMaterialType('${type}')" class="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"><i data-lucide="x" class="w-3 h-3"></i></button></span>`; });
    lucide.createIcons();
}

async function addNewMaterialType() { const input = document.getElementById('new-material-input'); const value = input.value.trim().toUpperCase(); if (value && !materialTypes.includes(value)) { materialTypes.push(value); input.value = ''; await persistConfig(); renderFilterButtons(); updateModalSelectOptions(); renderMaterialsManagerList(); } }
async function removeMaterialType(type) { if(confirm(`Opravdu smazat typ ${type}?`)) { materialTypes = materialTypes.filter(m => m !== type); await persistConfig(); renderFilterButtons(); updateModalSelectOptions(); renderMaterialsManagerList(); } }
async function saveLimit() { lowStockLimit = parseInt(document.getElementById('set-low-limit').value) || 150; await persistConfig(); alert("Limit uložen."); renderSpools(); }
async function saveExpandMode(mode) { defaultExpandMode = mode; await persistConfig(); alert("Zobrazení upraveno."); }
async function changeSystemPassword() { const newPass = document.getElementById('set-new-password').value.trim(); if(newPass.length < 3) { alert("Slabé heslo!"); return; } systemPassword = newPass; await persistConfig(); document.getElementById('set-new-password').value = ''; alert("Heslo změněno."); }

function exportWarehouseData() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ spools: mockSpools, materials: materialTypes, limit: lowStockLimit })); const anchor = document.createElement('a'); anchor.setAttribute("href", dataStr); anchor.setAttribute("download", "el3d_sfs_backup.json"); document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
function filterMaterial(type) { currentFilter = type; updateFilterButtonStyles(); renderSpools(); }
function toggleCard(key) { expandedCards[key] = !expandedCards[key]; renderSpools(); }

function updateStats(uniqueCount) {
    document.getElementById('stat-total-spools').innerText = mockSpools.length;
    const totalRemaining = mockSpools.reduce((acc, curr) => acc + curr.remaining_weight_g, 0); const totalCapacity = mockSpools.reduce((acc, curr) => acc + curr.total_capacity, 0);
    document.getElementById('stat-total-weight').innerText = (totalRemaining / 1000).toFixed(1) + ' kg'; document.getElementById('stat-unique-types').innerText = uniqueCount;
    const globalPct = totalCapacity > 0 ? Math.round((totalRemaining / totalCapacity) * 100) : 0;
    const globalBar = document.getElementById('global-storage-bar'); globalBar.style.width = `${globalPct}%`; document.getElementById('global-storage-pct').innerText = `${globalPct}%`;
    if(globalPct > 40) globalBar.className = "h-full bg-emerald-500 transition-all duration-500"; else if(globalPct > 15) globalBar.className = "h-full bg-amber-500 transition-all duration-500"; else globalBar.className = "h-full bg-red-600 transition-all duration-500";
}

async function manualDeduct(id) {
    const amount = prompt("Kolik gramů plastu odepsat?");
    if (amount && !isNaN(amount)) {
        const spool = mockSpools.find(s => s.id === id);
        if (spool) { 
            const oldWeight = spool.remaining_weight_g; spool.remaining_weight_g = Math.max(0, spool.remaining_weight_g - parseInt(amount)); 
            await fetch(`${API_URL}/spools/${id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ remaining_weight_g: spool.remaining_weight_g, user: currentUser }) 
            });
            renderSpools(); if (spool.remaining_weight_g < lowStockLimit && oldWeight >= lowStockLimit) { triggerWebNotification(spool); }
        }
    }
}

async function deleteSpool(id) { if(confirm("Smazat?")) { await fetch(`${API_URL}/get/spools/${id}?user=${currentUser}`, { method: 'DELETE' }); mockSpools = mockSpools.filter(s => s.id !== id); updateFormDatalists(); renderSpools(); } }