// Role a správa týmu (sdílený sklad)

// Skryje/zobrazí prvky označené třídou "admin-only" podle role přihlášeného uživatele.
// Toto je jen UX vrstva - skutečné vynucení je na backendu (403 při pokusu obejít).
function applyRoleUI() {
    document.body.classList.toggle('role-member', currentRole !== 'admin');
}

async function loadTeam() {
    const listContainer = document.getElementById('team-members-list');
    if (!listContainer) return;
    listContainer.textContent = 'Načítám tým…';
    try {
        const response = await fetch(`${API_URL}/team`);
        if (!response.ok) throw new Error('Tým se nepodařilo načíst');
        const data = await response.json();
        teamMembers = data.members;
        listContainer.replaceChildren();
        const roleLabels = { admin: 'Admin', member: 'Člen' };
        teamMembers.forEach(member => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2 px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg';

            const info = document.createElement('div'); info.className = 'flex items-center gap-2 min-w-0';
            const name = document.createElement('span'); name.className = 'text-slate-200 font-medium truncate'; name.textContent = member.username;
            const badge = document.createElement('span');
            badge.className = member.role === 'admin'
                ? 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-900/40 shrink-0'
                : 'text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0';
            badge.textContent = roleLabels[member.role] || member.role;
            info.append(name, badge);

            row.append(info);

            if (member.username !== currentUser) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'admin-only text-slate-500 hover:text-red-400 transition-colors cursor-pointer shrink-0';
                removeBtn.innerHTML = '<i data-lucide="user-minus" class="w-4 h-4"></i>';
                removeBtn.onclick = () => removeMember(member.username);
                row.append(removeBtn);
            }

            listContainer.append(row);
        });
        lucide.createIcons();
    } catch (error) { listContainer.textContent = 'Tým se nepodařilo načíst.'; }
}

async function inviteMember(event) {
    event.preventDefault();
    const username = document.getElementById('invite-username').value.trim().toLowerCase();
    const email = document.getElementById('invite-email').value.trim();
    const password = document.getElementById('invite-password').value;
    const role = document.getElementById('invite-role').value;
    const errorBox = document.getElementById('invite-error');
    errorBox.classList.add('hidden');

    try {
        const response = await fetch(`${API_URL}/team/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role })
        });
        const data = await response.json();
        if (!response.ok) { errorBox.textContent = data.message || 'Člena se nepodařilo pozvat.'; errorBox.classList.remove('hidden'); return; }
        document.getElementById('invite-username').value = '';
        document.getElementById('invite-email').value = '';
        document.getElementById('invite-password').value = '';
        loadTeam();
    } catch (error) { errorBox.textContent = 'Nelze se spojit se serverem.'; errorBox.classList.remove('hidden'); }
}

async function removeMember(username) {
    if (!confirm(`Odebrat uživatele ${username} z týmu? Ztratí přístup ke sdílenému skladu.`)) return;
    const response = await fetch(`${API_URL}/team/members/${encodeURIComponent(username)}`, { method: 'DELETE' });
    if (!response.ok) { const data = await response.json().catch(() => ({})); return alert(data.message || 'Člena se nepodařilo odebrat.'); }
    loadTeam();
}
