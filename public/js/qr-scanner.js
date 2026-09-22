// QR štítky a skenování kamerou

async function openQrLabel(id, pieceNumber) {
    const spool = mockSpools.find(item => item.id === id);
    if (!spool) return;
    try {
        const response = await fetch(`${API_URL}/spools/${id}/qr`);
        if (!response.ok) throw new Error('QR nedostupné');
        const qr = await response.json();
        document.getElementById('qr-label-name').textContent = spool.brand;
        document.getElementById('qr-label-meta').textContent = `${spool.material_type} · ${spool.color_name} · Kus ${pieceNumber} · ID #${id}`;
        document.getElementById('qr-image').src = qr.dataUrl;
        document.getElementById('qr-payload').textContent = `Odkaz: ${qr.payload}`;
        document.getElementById('qr-modal').classList.remove('hidden');
        lucide.createIcons();
    } catch (error) { alert('QR štítek se nepodařilo vytvořit.'); }
}
function closeQrModal() { document.getElementById('qr-modal').classList.add('hidden'); }
async function openScanner() {
    const modal = document.getElementById('scanner-modal'); const video = document.getElementById('scanner-video'); const status = document.getElementById('scanner-status');
    modal.classList.remove('hidden'); lucide.createIcons();
    if (!('BarcodeDetector' in window)) { status.textContent = 'Tento prohlížeč nepodporuje přímé skenování. Zadej kód ze štítku ručně.'; return; }
    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        video.srcObject = scannerStream;
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const detect = async () => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const codes = await detector.detect(video);
                if (codes.length && handleQrPayload(codes[0].rawValue)) return;
            }
            scannerAnimationId = requestAnimationFrame(detect);
        };
        detect();
    } catch (error) { status.textContent = 'Fotoaparát se nepodařilo otevřít. Povol jeho použití nebo vlož kód ručně.'; }
}
function closeScanner() {
    if (scannerAnimationId) cancelAnimationFrame(scannerAnimationId);
    scannerAnimationId = null;
    if (scannerStream) scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
    document.getElementById('scanner-video').srcObject = null;
    document.getElementById('scanner-modal').classList.add('hidden');
}
function submitManualQr(event) { event.preventDefault(); handleQrPayload(document.getElementById('manual-qr-input').value); }

// Rozpozná ID cívky z: plné URL (?spool=123), starého formátu (EL3D-SFS:123),
// prostého čísla, nebo libovolného textu obsahujícího číslo (např. zkopírované "ID #8"
// ze štítku). Vrací null, pokud nejde rozpoznat nic.
function extractSpoolId(raw) {
    const value = String(raw).trim();
    if (/^\d+$/.test(value)) return Number(value);
    const legacyMatch = /^EL3D-SFS:(\d+)$/.exec(value);
    if (legacyMatch) return Number(legacyMatch[1]);
    try {
        const url = new URL(value);
        const param = url.searchParams.get('spool');
        if (param && /^\d+$/.test(param)) return Number(param);
    } catch { /* není to URL, ignorovat */ }
    // Fallback: vytáhni první číslo z textu (funguje pro "ID #8", "#8", "kus 8" apod.)
    const digitsMatch = value.match(/(\d+)/);
    if (digitsMatch) return Number(digitsMatch[1]);
    return null;
}

// Najde cívku podle ID, rozbalí její kartu, odscrolluje a barevně zvýrazní přímo
// konkrétní kus ve stacku (ne celou kartu), ať je hned vidět, který odepisovat.
// Používá se jak po naskenování QR, tak po otevření odkazu ?spool=ID (viz bootstrap.js).
function focusSpoolById(id) {
    const spool = mockSpools.find(item => item.id === id);
    if (!spool) return false;
    currentFilter = 'ALL'; searchQuery = ''; lowStockOnly = false;
    const searchInput = document.getElementById('search-input'); if (searchInput) searchInput.value = '';
    updateFilterButtonStyles();
    const key = `${spool.brand}-${spool.material_type}-${spool.color_name}`.toLowerCase();
    expandedCards[key] = true;
    renderSpools();
    const row = document.getElementById(`spool-row-${id}`);
    if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('ring-2', 'ring-red-500', 'bg-red-950/40');
        setTimeout(() => row.classList.remove('ring-2', 'ring-red-500', 'bg-red-950/40'), 3000);
    } else {
        const card = document.querySelector(`[data-spool-ids~="${id}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return true;
}

function handleQrPayload(payload) {
    const id = extractSpoolId(payload);
    if (id === null) { document.getElementById('scanner-status').textContent = 'Toto není QR kód EL3D SFS.'; return false; }
    const found = focusSpoolById(id);
    if (!found) { document.getElementById('scanner-status').textContent = 'Cívka není v tvém regálu.'; return false; }
    closeScanner();
    return true;
}
