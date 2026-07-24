'use strict';

const cache = {
  users: [],
  partners: [],
  deals: [],
  contracts: [],
  communications: [],
  activities: [],
  reports: []
};
let currentUser = null;
const writeQueues = {};

async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers,
    ...options
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401 && !document.body.classList.contains('auth-page')) {
      window.location.href = 'index.html';
    }
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

const DB = {
  get(key) {
    return (cache[key] || []).map(item => ({ ...item }));
  },
  async set(key, value) {
    if (!(key in cache)) throw new Error(`Unknown collection: ${key}`);
    const previous = cache[key];
    cache[key] = value;
    const write = async () => {
      try {
        const result = await apiFetch(`/api/collections/${key}`, {
          method: 'PUT',
          body: JSON.stringify({ data: value })
        });
        cache[key] = result.data;
        return result.data;
      } catch (error) {
        cache[key] = previous;
        toast(error.message, 'error');
        throw error;
      }
    };
    writeQueues[key] = (writeQueues[key] || Promise.resolve()).then(write, write);
    return writeQueues[key];
  },
  getObj(key) {
    return key === 'current_user' ? currentUser : null;
  },
  setObj(key, value) {
    if (key === 'current_user') currentUser = value;
  },
  setLocal(key, value) {
    if (key in cache) cache[key] = value;
  }
};

function getCurrentUser() {
  return currentUser;
}

function canWrite(resource) {
  const role = currentUser?.role;
  const permissions = {
    users: ['Administrator'],
    partners: ['Administrator', 'Manager'],
    deals: ['Administrator', 'Manager'],
    contracts: ['Administrator', 'Manager'],
    communications: ['Administrator', 'Manager', 'Employee'],
    reports: ['Administrator', 'Manager']
  };
  return (permissions[resource] || []).includes(role);
}

function requireAuth() {
  if (!currentUser) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
  } finally {
    currentUser = null;
    window.location.href = 'index.html';
  }
}

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar nav a').forEach(anchor => {
    anchor.classList.toggle('active', anchor.getAttribute('href') === page);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderSidebarUser() {
  const user = getCurrentUser();
  if (!user) return;
  const element = document.getElementById('sidebar-user-info');
  if (element) {
    element.innerHTML = `
      <div class="avatar">${escapeHtml(user.fullname.charAt(0))}</div>
      <div class="info"><strong>${escapeHtml(user.fullname)}</strong><small>${escapeHtml(user.role)}</small></div>`;
  }
}

function toast(message, type = 'success') {
  let element = document.getElementById('toast');
  if (!element) {
    element = document.createElement('div');
    element.id = 'toast';
    document.body.appendChild(element);
  }
  element.textContent = message;
  element.className = `show ${type}`;
  clearTimeout(element._timer);
  element._timer = setTimeout(() => { element.className = ''; }, 3500);
}

function openModal(id) {
  const overlay = document.getElementById(id);
  overlay?.classList.add('open');
  overlay?.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function nextId(items) {
  return items.length ? Math.max(...items.map(item => Number(item.id) || 0)) + 1 : 1;
}

function fmtDate(value) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

const ZAR_TO_RWF = 65;
const RWF_TO_ZAR = 1 / ZAR_TO_RWF;

function fmtRWF(amount) {
  if (!amount && amount !== 0) return '—';
  return `RWF ${Math.round(amount).toLocaleString()}`;
}

function toZAR(rwfAmount) {
  return Math.round(rwfAmount * RWF_TO_ZAR);
}

function fmtZAR(rwfAmount) {
  return `R ${toZAR(rwfAmount).toLocaleString()}`;
}

function initDarkMode() {
  if (localStorage.getItem('mg_dark') === '1') document.body.classList.add('dark');
  const button = document.getElementById('dark-toggle');
  if (button) button.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('mg_dark', document.body.classList.contains('dark') ? '1' : '0');
  });
}

function initMobileSidebar() {
  const button = document.getElementById('menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (button && sidebar) button.addEventListener('click', () => sidebar.classList.toggle('open'));
}

async function logActivity(text, icon = '📌') {
  const activities = [...DB.get('activities')];
  activities.unshift({
    id: nextId(activities),
    text,
    icon,
    created_at: new Date().toISOString(),
    time: 'Just now'
  });
  if (activities.length > 100) activities.length = 100;
  try {
    await DB.set('activities', activities);
  } catch {
    // The main mutation already displays a useful error.
  }
}

async function bootstrap() {
  initDarkMode();
  try {
    if (document.querySelector('.layout')) {
      const result = await apiFetch('/api/bootstrap');
      currentUser = result.user;
      Object.assign(cache, result.data);
    } else {
      const result = await apiFetch('/api/session');
      currentUser = result.user;
    }
    document.dispatchEvent(new CustomEvent('appready'));
  } catch (error) {
    if (document.querySelector('.layout') && !String(error.message).includes('Authentication')) {
      toast(error.message, 'error');
    } else {
      document.dispatchEvent(new CustomEvent('appready'));
    }
  }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(element => element.classList.remove('open'));
});

document.addEventListener('DOMContentLoaded', bootstrap);
