import { getProfile } from './services/data.js';
import { signOut } from './services/auth.js';
import { toast, errorMessage, initials } from './utils/helpers.js';
import { icon } from './utils/icons.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderClasses } from './modules/classes.js';
import { renderStudents } from './modules/students.js';
import { renderAttendance } from './modules/attendance.js';
import { renderDiary } from './modules/diary.js';
import { renderAssessments } from './modules/assessments.js';
import { renderReports } from './modules/reports.js';
import { renderCalendar } from './modules/calendar.js';
import { renderHistory } from './modules/history.js';
import { renderSettings } from './modules/settings.js';

const pages = {
  dashboard: { label: 'Painel', icon: 'grid', render: renderDashboard },
  classes: { label: 'Turmas', icon: 'book', render: renderClasses },
  students: { label: 'Estudantes', icon: 'users', render: renderStudents },
  attendance: { label: 'Chamada escolar', icon: 'check', render: renderAttendance },
  diary: { label: 'Diário de classe', icon: 'bookOpen', render: renderDiary },
  assessments: { label: 'Avaliações e notas', icon: 'file', render: renderAssessments },
  reports: { label: 'Relatórios', icon: 'chart', render: renderReports },
  calendar: { label: 'Calendário', icon: 'calendar', render: renderCalendar },
  history: { label: 'Histórico', icon: 'file', render: renderHistory },
  settings: { label: 'Configurações', icon: 'settings', render: renderSettings },
};

export async function mountApplication(root, user) {
  let profile = await getProfile(user.id);
  let currentPage = 'dashboard';
  let pageParams = {};

  const context = {
    user,
    get profile() { return profile; },
    set profile(value) { profile = value; },
    navigate,
    refreshShell,
  };

  function navButton(key, page) {
    return `<button class="nav-item ${key === currentPage ? 'active' : ''}" data-page="${key}" type="button">${icon(page.icon)}<span>${page.label}</span></button>`;
  }

  function renderShell() {
    root.innerHTML = `
      <div class="app-layout">
        <div class="sidebar-scrim" id="sidebar-scrim"></div>
        <aside class="sidebar" id="app-sidebar">
          <a class="brand-lockup" href="#inicio" aria-label="EDUCA+ início"><span class="brand-mark">E<span>+</span></span><span class="brand-copy"><strong>EDUCA<span>+</span></strong><small>GESTÃO ESCOLAR</small></span></a>
          <div class="sidebar-label">ESPAÇO DO PROFESSOR</div>
          <nav class="main-nav" aria-label="Navegação principal">${Object.entries(pages).slice(0,8).map(([key,page])=>navButton(key,page)).join('')}</nav>
          <div class="sidebar-label sidebar-label-secondary">SISTEMA</div>
          <nav class="main-nav">${Object.entries(pages).slice(8).map(([key,page])=>navButton(key,page)).join('')}</nav>
          <div class="sidebar-bottom"><div class="help-card"><span class="help-mark">i</span><div><strong>Precisa de ajuda?</strong><small>Consulte o guia do projeto.</small></div></div><div class="sidebar-user"><span class="avatar">${initials(profile.full_name)}</span><div class="sidebar-user-info"><strong id="sidebar-user-name">${escapeHtmlSafe(profile.full_name)}</strong><small>Professor(a)</small></div><button class="icon-button logout-button" id="logout-button" title="Sair da conta">${icon('logout')}</button></div></div>
        </aside>
        <main class="main-area">
          <header class="topbar"><div class="topbar-left"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="Abrir menu">${icon('menu')}</button><div class="breadcrumbs"><span>EDUCA+</span><span class="breadcrumb-divider">/</span><strong id="current-page-name">Painel</strong></div></div><div class="topbar-right"><span class="current-date">${new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long'}).format(new Date())}</span><button class="icon-button" id="theme-toggle" title="Alternar tema">${icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun')}</button><button class="topbar-user" id="profile-shortcut"><span class="avatar avatar-small">${initials(profile.full_name)}</span><span>${escapeHtmlSafe(profile.full_name.split(' ')[0])}</span></button></div></header>
          <div class="page-content" id="page-content"><div class="loading-state"><span class="loader"></span><p>Carregando informações...</p></div></div>
        </main>
      </div>
      <div id="toast-region" class="toast-region" aria-live="polite"></div><div id="modal-root"></div>`;
    root.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
    root.querySelector('#logout-button').addEventListener('click', async () => {
      try { await signOut(); window.location.reload(); } catch (error) { toast(errorMessage(error), 'error'); }
    });
    root.querySelector('#profile-shortcut').addEventListener('click', () => navigate('settings'));
    root.querySelector('#theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next; localStorage.setItem('educa-theme', next);
      root.querySelector('#theme-toggle').innerHTML = icon(next === 'light' ? 'moon' : 'sun');
    });
    const sidebar = root.querySelector('#app-sidebar');
    const closeSidebar = () => { sidebar.classList.remove('sidebar-open'); root.querySelector('#sidebar-scrim').classList.remove('visible'); };
    root.querySelector('#mobile-menu').addEventListener('click', () => { sidebar.classList.toggle('sidebar-open'); root.querySelector('#sidebar-scrim').classList.toggle('visible'); });
    root.querySelector('#sidebar-scrim').addEventListener('click', closeSidebar);
    root.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', closeSidebar));
  }

  async function refreshShell() {
    const name = profile.full_name || 'Professor(a)';
    const sidebarName = root.querySelector('#sidebar-user-name');
    if (sidebarName) sidebarName.textContent = name;
    const topName = root.querySelector('#profile-shortcut span:last-child');
    if (topName) topName.textContent = name.split(' ')[0];
    const avatar = root.querySelector('#profile-shortcut .avatar');
    if (avatar) avatar.textContent = initials(name);
  }

  async function navigate(page, params = {}) {
    if (!pages[page]) page = 'dashboard';
    currentPage = page; pageParams = params;
    root.querySelectorAll('[data-page]').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
    const title = root.querySelector('#current-page-name');
    if (title) title.textContent = pages[page].label;
    const container = root.querySelector('#page-content');
    if (!container) return;
    container.innerHTML = '<div class="loading-state"><span class="loader"></span><p>Consultando o banco de dados...</p></div>';
    try { await pages[page].render(container, context, pageParams); }
    catch (error) {
      console.error(error);
      container.innerHTML = `<section class="panel error-panel"><h2>Não foi possível carregar esta área</h2><p>${escapeHtmlSafe(error.message || 'Erro desconhecido')}</p><button id="retry-page" class="button button-secondary">Tentar novamente</button></section>`;
      container.querySelector('#retry-page')?.addEventListener('click', () => navigate(page, pageParams));
    }
  }

  renderShell();
  await navigate('dashboard');
}

function escapeHtmlSafe(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
