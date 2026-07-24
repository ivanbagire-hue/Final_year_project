// Renders the sidebar HTML into #sidebar-container
function renderSidebar(pageTitle) {
  const u = getCurrentUser();
  const isAdmin = u && u.role === 'Administrator';
  const isManager = u && (u.role === 'Administrator' || u.role === 'Manager');

  document.getElementById('sidebar-container').innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">🍞</div>
        <div><span>Manics Group</span><small>Partnership System</small></div>
      </div>
      <nav>
        <div class="nav-section">Main</div>
        <a href="dashboard.html"><span class="icon">📊</span> Dashboard</a>
        <a href="partners.html"><span class="icon">🤝</span> Partners</a>
        <a href="deals.html"><span class="icon">💼</span> Deals</a>
        <a href="contracts.html"><span class="icon">📄</span> Contracts</a>
        <a href="communications.html"><span class="icon">💬</span> Communications</a>
        <div class="nav-section">Analytics</div>
        <a href="reports.html"><span class="icon">📈</span> Reports</a>
        ${isManager ? `<div class="nav-section">Admin</div><a href="users.html"><span class="icon">👥</span> Users</a>` : ''}
        <div class="nav-section">Account</div>
        <a href="profile.html"><span class="icon">👤</span> Profile</a>
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user-info"></div>
        <button onclick="logout()" class="btn btn-outline btn-sm" style="width:100%;margin-top:10px;color:#fff;border-color:rgba(255,255,255,0.3);">
          🚪 Logout
        </button>
      </div>
    </aside>`;

  document.getElementById('page-title').textContent = pageTitle;
  renderSidebarUser();
  setActiveNav();
  initMobileSidebar();
}
