// ── DATA STORE (localStorage) ──────────────────────────────────────────────
const DB = {
  get: k => JSON.parse(localStorage.getItem('mg_' + k) || '[]'),
  set: (k, v) => localStorage.setItem('mg_' + k, JSON.stringify(v)),
  getObj: k => JSON.parse(localStorage.getItem('mg_' + k) || 'null'),
  setObj: (k, v) => localStorage.setItem('mg_' + k, JSON.stringify(v))
};

// ── SEED DEFAULT DATA ───────────────────────────────────────────────────────
const DATA_VERSION = 'v2_rwf';
function seedData() {
  if (DB.getObj('seeded') === DATA_VERSION) return;

  DB.set('users', [
    { id: 1, fullname: 'Admin User', email: 'admin@manicsgroup.co.za', password: 'admin123', role: 'Administrator', created_at: '2024-01-10', active: true },
    { id: 2, fullname: 'Sarah Manager', email: 'sarah@manicsgroup.co.za', password: 'manager123', role: 'Manager', created_at: '2024-02-15', active: true },
    { id: 3, fullname: 'John Employee', email: 'john@manicsgroup.co.za', password: 'emp123', role: 'Employee', created_at: '2024-03-01', active: true }
  ]);

  DB.set('partners', [
    { id: 1, company_name: 'BakePro Supplies', contact_person: 'Alice Dlamini', email: 'alice@bakepro.co.za', phone: '+27 11 234 5678', address: 'Johannesburg, GP', industry: 'Baking', status: 'Active', created_at: '2024-01-20' },
    { id: 2, company_name: 'FlourMill Kenya', contact_person: 'James Mwangi', email: 'james@flourmill.ke', phone: '+254 700 123456', address: 'Nairobi, Kenya', industry: 'Milling', status: 'Active', created_at: '2024-02-10' },
    { id: 3, company_name: 'Namibia Foods Ltd', contact_person: 'Maria Shikongo', email: 'maria@namibiafoods.na', phone: '+264 61 987654', address: 'Windhoek, Namibia', industry: 'Food & Beverage', status: 'Prospect', created_at: '2024-03-05' },
    { id: 4, company_name: 'DairyFresh SA', contact_person: 'Peter Nkosi', email: 'peter@dairyfresh.co.za', phone: '+27 21 345 6789', address: 'Cape Town, WC', industry: 'Dairy', status: 'Inactive', created_at: '2024-04-01' }
  ]);

  DB.set('deals', [
    { id: 1, partner_id: 1, deal_name: 'Baking Premix Supply Q3', amount: 16250000, status: 'Approved', start_date: '2024-07-01', end_date: '2024-09-30', description: 'Quarterly supply of baking premixes and emulsifiers.', created_at: '2024-06-15' },
    { id: 2, partner_id: 2, deal_name: 'Flour Fortification Export', amount: 11700000, status: 'Negotiation', start_date: '2024-08-01', end_date: '2025-01-31', description: 'Export of vitamin premixes for wheat flour fortification to Kenya.', created_at: '2024-07-01' },
    { id: 3, partner_id: 3, deal_name: 'Namibia Market Entry', amount: 6175000, status: 'New', start_date: '2024-09-01', end_date: '2024-12-31', description: 'Initial market entry deal for Bakersfest brand in Namibia.', created_at: '2024-08-10' },
    { id: 4, partner_id: 1, deal_name: 'Food Colorants Annual Contract', amount: 20800000, status: 'Completed', start_date: '2023-01-01', end_date: '2023-12-31', description: 'Annual supply of food colorants and flavors.', created_at: '2022-12-01' },
    { id: 5, partner_id: 4, deal_name: 'Dairy Stabilizers Pilot', amount: 2925000, status: 'Rejected', start_date: '2024-05-01', end_date: '2024-06-30', description: 'Pilot supply of stabilizers for dairy products.', created_at: '2024-04-20' }
  ]);

  DB.set('contracts', [
    { id: 1, deal_id: 1, contract_name: 'BakePro Q3 Supply Agreement', contract_number: 'MG-2024-001', start_date: '2024-07-01', end_date: '2024-09-30', status: 'Active', file: null, created_at: '2024-06-20' },
    { id: 2, deal_id: 2, contract_name: 'Kenya Fortification Export MOU', contract_number: 'MG-2024-002', start_date: '2024-08-01', end_date: '2025-01-31', status: 'Active', file: null, created_at: '2024-07-15' },
    { id: 3, deal_id: 4, contract_name: 'Food Colorants 2023 Contract', contract_number: 'MG-2023-001', start_date: '2023-01-01', end_date: '2023-12-31', status: 'Expired', file: null, created_at: '2022-12-15' }
  ]);

  DB.set('communications', [
    { id: 1, partner_id: 1, subject: 'Q3 Delivery Schedule Review', message: 'Discussed delivery timelines and logistics for Q3 premix supply.', meeting_date: '2024-07-10', type: 'Meeting', participants: 'Admin User, Alice Dlamini', created_by: 'Admin User', created_at: '2024-07-10' },
    { id: 2, partner_id: 2, subject: 'Export Documentation Follow-up', message: 'Sent required export documentation and compliance certificates.', meeting_date: null, type: 'Email', participants: 'Sarah Manager, James Mwangi', created_by: 'Sarah Manager', created_at: '2024-07-20' },
    { id: 3, partner_id: 3, subject: 'Namibia Market Introduction Call', message: 'Introductory call to discuss Bakersfest brand positioning in Namibia.', meeting_date: '2024-08-15', type: 'Meeting', participants: 'Admin User, Maria Shikongo', created_by: 'Admin User', created_at: '2024-08-15' }
  ]);

  DB.set('activities', [
    { id: 1, text: 'New partner BakePro Supplies added', time: '2 hours ago', icon: '🤝' },
    { id: 2, text: 'Deal "Flour Fortification Export" moved to Negotiation', time: '5 hours ago', icon: '📋' },
    { id: 3, text: 'Contract MG-2024-002 created', time: '1 day ago', icon: '📄' },
    { id: 4, text: 'Meeting scheduled with Namibia Foods Ltd', time: '2 days ago', icon: '📅' },
    { id: 5, text: 'Report generated: Monthly Summary July 2024', time: '3 days ago', icon: '📊' }
  ]);

  DB.setObj('seeded', DATA_VERSION);
}

// ── AUTH ────────────────────────────────────────────────────────────────────
function getCurrentUser() { return DB.getObj('current_user'); }

function requireAuth() {
  if (!getCurrentUser()) { window.location.href = 'index.html'; }
}

function logout() {
  localStorage.removeItem('mg_current_user');
  window.location.href = 'index.html';
}

// ── SIDEBAR ACTIVE LINK ─────────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

// ── SIDEBAR USER INFO ───────────────────────────────────────────────────────
function renderSidebarUser() {
  const u = getCurrentUser();
  if (!u) return;
  const el = document.getElementById('sidebar-user-info');
  if (el) {
    el.innerHTML = `
      <div class="avatar">${u.fullname.charAt(0)}</div>
      <div class="info"><strong>${u.fullname}</strong><small>${u.role}</small></div>`;
  }
}

// ── TOAST ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.className = '', 3000);
}

// ── MODAL ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ── ID GENERATOR ────────────────────────────────────────────────────────────
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

// ── FORMAT DATE ─────────────────────────────────────────────────────────────
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); }

// ── CURRENCY ─────────────────────────────────────────────────────────────────
// 1 ZAR ≈ 65 RWF (approximate fixed rate — update as needed)
const ZAR_TO_RWF = 65;
const RWF_TO_ZAR = 1 / ZAR_TO_RWF;

function fmtRWF(amount) {
  if (!amount && amount !== 0) return '—';
  return 'RWF ' + Math.round(amount).toLocaleString();
}

function toZAR(rwfAmount) {
  return Math.round(rwfAmount * RWF_TO_ZAR);
}

function fmtZAR(rwfAmount) {
  return 'R ' + toZAR(rwfAmount).toLocaleString();
}

// ── DARK MODE ───────────────────────────────────────────────────────────────
function initDarkMode() {
  if (localStorage.getItem('mg_dark') === '1') document.body.classList.add('dark');
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('mg_dark', document.body.classList.contains('dark') ? '1' : '0');
  });
}

// ── MOBILE SIDEBAR ──────────────────────────────────────────────────────────
function initMobileSidebar() {
  const btn = document.getElementById('menu-toggle');
  const sb = document.querySelector('.sidebar');
  if (btn && sb) btn.addEventListener('click', () => sb.classList.toggle('open'));
}

// ── LOG ACTIVITY ────────────────────────────────────────────────────────────
function logActivity(text, icon = '📌') {
  const acts = DB.get('activities');
  acts.unshift({ id: nextId(acts), text, time: 'Just now', icon });
  if (acts.length > 20) acts.pop();
  DB.set('activities', acts);
}

// ── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  seedData();
  initDarkMode();
  // Only run layout functions on inner pages (not login)
  if (document.querySelector('.layout')) {
    initMobileSidebar();
    setActiveNav();
    renderSidebarUser();
  }
});
