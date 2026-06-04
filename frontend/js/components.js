/**
 * UI Components — Toast, Modal, Skeleton, Theme
 */

// ─── Toast Notifications ─────────────────────────
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (!document.querySelector('.toast-container')) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.querySelector('.toast-container');
    }
  }

  show(message, type = 'info', duration = 4000) {
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  success(msg) { this.show(msg, 'success'); }
  error(msg) { this.show(msg, 'error'); }
  warning(msg) { this.show(msg, 'warning'); }
  info(msg) { this.show(msg, 'info'); }
}

const toast = new ToastManager();

// ─── Theme Management ────────────────────────────
class ThemeManager {
  constructor() {
    this.init();
  }

  init() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  get current() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
}

const theme = new ThemeManager();

// ─── Skeleton Loaders ────────────────────────────
function showSkeleton(container, count = 3, type = 'card') {
  let html = '';
  for (let i = 0; i < count; i++) {
    if (type === 'card') {
      html += `<div class="card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text" style="width:80%"></div><div class="skeleton skeleton-text" style="width:60%"></div></div>`;
    } else if (type === 'stat') {
      html += `<div class="stat-card"><div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-title" style="width:40%"></div><div class="skeleton skeleton-text" style="width:60%"></div></div>`;
    } else if (type === 'row') {
      html += `<div style="display:flex;gap:1rem;padding:1rem;"><div class="skeleton" style="width:40px;height:40px;border-radius:50%"></div><div style="flex:1"><div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-text" style="width:40%"></div></div></div>`;
    }
  }
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = html;
}

// ─── Sidebar Builder ─────────────────────────────
function buildSidebar(role, activePage) {
  const candidateNav = [
    { section: 'Main', items: [
      { icon: '📊', label: 'Dashboard', href: '/candidate-dashboard', id: 'candidate-dashboard' },
      { icon: '📄', label: 'Resume Analysis', href: '/resume-analysis', id: 'resume-analysis' },
    ]},
    { section: 'Assessments', items: [
      { icon: '📝', label: 'Aptitude Tests', href: '/aptitude-test', id: 'aptitude-test' },
      { icon: '💻', label: 'Coding Challenges', href: '/coding-challenge', id: 'coding-challenge' },
      { icon: '🎤', label: 'Mock Interview', href: '/mock-interview', id: 'mock-interview' },
    ]},
    { section: 'Progress', items: [
      { icon: '🏆', label: 'Leaderboard', href: '/leaderboard', id: 'leaderboard' },
      { icon: '📈', label: 'Reports', href: '/reports', id: 'reports' },
      { icon: '👤', label: 'Profile', href: '/profile', id: 'profile' },
    ]},
  ];

  const recruiterNav = [
    { section: 'Main', items: [
      { icon: '📊', label: 'Dashboard', href: '/recruiter-dashboard', id: 'recruiter-dashboard' },
      { icon: '👥', label: 'Candidates', href: '/recruiter-dashboard#candidates', id: 'candidates' },
    ]},
    { section: 'Management', items: [
      { icon: '📝', label: 'Assessments', href: '/recruiter-dashboard#assessments', id: 'assessments' },
      { icon: '❓', label: 'Questions', href: '/recruiter-dashboard#questions', id: 'questions' },
      { icon: '💻', label: 'Coding Problems', href: '/recruiter-dashboard#coding', id: 'coding' },
    ]},
    { section: 'Analytics', items: [
      { icon: '🏆', label: 'Leaderboard', href: '/leaderboard', id: 'leaderboard' },
      { icon: '📈', label: 'Reports', href: '/reports', id: 'reports' },
      { icon: '👤', label: 'Profile', href: '/profile', id: 'profile' },
    ]},
  ];

  const adminNav = [
    { section: 'Main', items: [
      { icon: '📊', label: 'Dashboard', href: '/admin-dashboard', id: 'admin-dashboard' },
      { icon: '👥', label: 'Users', href: '/admin-dashboard#users', id: 'users' },
    ]},
    { section: 'Management', items: [
      { icon: '📝', label: 'Assessments', href: '/admin-dashboard#assessments', id: 'assessments' },
      { icon: '❓', label: 'Questions', href: '/admin-dashboard#questions', id: 'questions' },
      { icon: '💻', label: 'Coding Problems', href: '/admin-dashboard#coding', id: 'coding' },
    ]},
    { section: 'System', items: [
      { icon: '📋', label: 'Activity Logs', href: '/admin-dashboard#activity', id: 'activity' },
      { icon: '🔧', label: 'System Logs', href: '/admin-dashboard#system', id: 'system' },
      { icon: '👤', label: 'Profile', href: '/profile', id: 'profile' },
    ]},
  ];

  const navConfig = role === 'admin' ? adminNav : role === 'recruiter' ? recruiterNav : candidateNav;

  let navHTML = '';
  for (const section of navConfig) {
    navHTML += `<div class="sidebar-section-title">${section.section}</div>`;
    for (const item of section.items) {
      const isActive = activePage === item.id;
      navHTML += `<a href="${item.href}" class="nav-link ${isActive ? 'active' : ''}" data-page="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>`;
    }
  }

  return `
    <div class="sidebar-header">
      <div class="sidebar-logo">AI</div>
      <div>
        <div class="sidebar-brand">AI Interview</div>
        <small style="color:var(--text-tertiary);font-size:0.7rem">${role.charAt(0).toUpperCase() + role.slice(1)} Panel</small>
      </div>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-footer">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button class="theme-toggle" onclick="theme.toggle()" title="Toggle theme"></button>
        <button class="btn btn-ghost btn-sm" onclick="logout()" title="Logout">🚪 Logout</button>
      </div>
    </div>
  `;
}

// ─── Page Init Helper ────────────────────────────
function initDashboardPage(pageId) {
  const user = api.getUser();
  if (!user) { window.location.href = '/login'; return null; }

  // Build sidebar
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.innerHTML = buildSidebar(user.role, pageId);
  }

  // Mobile menu
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const overlay = document.querySelector('.sidebar-overlay');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay?.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Set user info in header
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = `${user.firstName} ${user.lastName}`;

  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) avatarEl.textContent = user.firstName[0];

  return user;
}

// ─── Logout Function ─────────────────────────────
async function logout() {
  const refreshToken = api.getRefreshToken();
  await api.post('/auth/logout', { refreshToken });
  api.clearTokens();
  window.location.href = '/login';
}

// ─── Utility Functions ───────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(dateStr) {
  const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getDifficultyBadge(difficulty) {
  return `<span class="badge badge-${difficulty}">${difficulty}</span>`;
}

function getScoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--primary-400)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--error)';
}

function createProgressBar(value, max = 100) {
  const pct = Math.min(100, (value / max) * 100);
  return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${getScoreColor(pct)}"></div></div>`;
}
