// Přihlášení, registrace, odhlášení a správa hesla

async function loadSystemVersion() {
    try {
        const res = await fetch(`${API_URL}/version`);
        const data = await res.json();

        const loginBadge = document.getElementById('system-version-badge');
        if (loginBadge) loginBadge.innerText = `v${data.version}`;

        const footerBadge = document.getElementById('system-version-footer');
        if (footerBadge) footerBadge.innerText = `v${data.version}`;

    } catch (e) {
        console.error("Nepodařilo se načíst verzi z backendu.");
    }
}

function switchAuthMode(mode) {
    const loginBox = document.getElementById('auth-login-box');
    const signupBox = document.getElementById('auth-signup-box');
    const loginErr = document.getElementById('login-error');
    const signupErr = document.getElementById('signup-error');
    const signupOk = document.getElementById('signup-success');

    if (loginErr) loginErr.classList.add('hidden');
    if (signupErr) signupErr.classList.add('hidden');
    if (signupOk) signupOk.classList.add('hidden');

    if (mode === 'signup') {
        loginBox.classList.add('hidden'); signupBox.classList.remove('hidden');
    } else {
        signupBox.classList.add('hidden'); loginBox.classList.remove('hidden');
    }
}

async function handleForgotPassword() {
    const email = prompt("Zadej svou registrovanou e-mailovou adresu:");
    if (!email) return;

    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim() })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(data.message);
        } else {
            alert(data.message || "E-mail se nepodařilo ověřit.");
        }
    } catch (err) {
        console.error("Chyba fetch komunikace:", err);
        alert("Chyba spojení se serverem při obnově hesla.");
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const user = document.getElementById('signup-username').value.trim().toLowerCase();
    const email = document.getElementById('signup-email').value.trim();
    const pass = document.getElementById('signup-password').value;
    const passConfirm = document.getElementById('signup-password-confirm').value;
    const errorBox = document.getElementById('signup-error');
    const successBox = document.getElementById('signup-success');

    errorBox.classList.add('hidden'); successBox.classList.add('hidden');

    if (pass.length < 10) { errorBox.innerText = "Heslo musí mít alespoň 10 znaků."; errorBox.classList.remove('hidden'); return; }
    if (pass !== passConfirm) { errorBox.innerText = "Zadaná hesla v registraci se neshodují!"; errorBox.classList.remove('hidden'); return; }

    try {
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            successBox.innerText = "Účet vytvořen! Přesouvám na přihlášení...";
            successBox.classList.remove('hidden');
            document.getElementById('signup-username').value = '';
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-password').value = '';
            document.getElementById('signup-password-confirm').value = '';
            setTimeout(() => { switchAuthMode('login'); document.getElementById('login-username').value = user; }, 1200);
        } else { errorBox.innerText = data.message || "Uživatel nebo e-mail už existuje!"; errorBox.classList.remove('hidden'); }
    } catch (err) { errorBox.innerText = "Nelze se spojit se serverem."; errorBox.classList.remove('hidden'); }
}

async function changeSystemPassword() {
    const newPass = document.getElementById('set-new-password').value.trim();
    const newPassConfirm = document.getElementById('set-new-password-confirm').value.trim();

    if (newPass.length < 10) { alert("Heslo musí mít minimálně 10 znaků."); return; }
    if (newPass !== newPassConfirm) { alert("Zadaná nová hesla se neshodují! Zkontroluj překlepy."); return; }

    const response = await fetch(`${API_URL}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPass }) });
    if (!response.ok) { alert("Heslo se nepodařilo uložit."); return; }
    document.getElementById('set-new-password').value = '';
    document.getElementById('set-new-password-confirm').value = '';
    alert("Heslo k tvojemu profilu bylo úspěšně změněno."); renderSpools();
}

async function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const errorBox = document.getElementById('login-error');
    if(!user) return;
    try {
        const authRes = await fetch(`${API_URL}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass, remember: document.getElementById('login-remember').checked }) });
        const data = await authRes.json();
        if (data.success) {
            errorBox.classList.add('hidden'); currentUser = user;
            localStorage.setItem('sfs_current_user', currentUser);
            currentEmail = data.email;
            localStorage.setItem('sfs_session_active', 'true');
            materialTypes = data.config.materialTypes; lowStockLimit = data.config.lowStockLimit; defaultExpandMode = data.config.defaultExpandMode;
            stopParticleAnimation(); document.getElementById('login-page').classList.add('opacity-0');
            setTimeout(() => { document.getElementById('login-page').classList.add('hidden'); document.getElementById('app-content').classList.remove('hidden', 'opacity-0'); loadDataFromServer().then(() => { if (pendingSpoolId !== null) { focusSpoolById(pendingSpoolId); pendingSpoolId = null; } }); }, 300);
        } else { errorBox.innerText = data.message || "Nesprávné heslo!"; errorBox.classList.remove('hidden'); }
    } catch (err) { errorBox.innerText = "Nelze se spojit se serverem."; errorBox.classList.remove('hidden'); }
}

function handleLogout() {
    fetch(`${API_URL}/logout`, { method: 'POST' }).catch(() => {});
    localStorage.removeItem('sfs_session_active'); localStorage.removeItem('sfs_current_user'); currentUser = ''; currentEmail = '';
    if(document.getElementById('login-remember')) document.getElementById('login-remember').checked = false;
    if(document.getElementById('login-username')) document.getElementById('login-username').value = '';
    if(document.getElementById('login-password')) document.getElementById('login-password').value = '';
    document.getElementById('app-content').classList.add('opacity-0');
    setTimeout(() => { document.getElementById('app-content').classList.add('hidden'); document.getElementById('login-page').classList.remove('hidden', 'opacity-0'); switchAuthMode('login'); lucide.createIcons(); startParticleAnimation(); }, 300);
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            input.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
    }
}
