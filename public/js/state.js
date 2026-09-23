// Globální stav aplikace a konfigurace API
const API_URL = '/api';

let currentUser = localStorage.getItem('sfs_current_user') || '';
let currentEmail = '';
let materialTypes = [];
let lowStockLimit = 150;
let defaultExpandMode = 'collapsed';
let mockSpools = [];
let currentFilter = 'ALL';
let searchQuery = '';
let expandedCards = {};
let particleAnimationId = null;
let scannerStream = null;
let scannerAnimationId = null;
let pendingSpoolId = null; // ID cívky z QR odkazu (?spool=), na kterou se má skočit po načtení skladu
let lowStockOnly = false; // přepínač filtru "jen nízký stav"
let currentRole = 'admin'; // role přihlášeného uživatele v rámci sdíleného skladu ('admin' | 'member')
let teamMembers = []; // seznam členů týmu (načteno v Nastavení)
