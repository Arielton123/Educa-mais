export const STATUS_LABELS = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Atrasado',
  excused: 'Falta justificada',
};

export const STATUS_COLORS = {
  present: 'success',
  absent: 'danger',
  late: 'warning',
  excused: 'info',
};

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function formatDate(value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function percent(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

export function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'P';
}

export function toast(message, type = 'success') {
  const host = document.getElementById('toast-region');
  if (!host) return;
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  host.append(item);
  window.setTimeout(() => item.remove(), 4200);
}

export function openModal(title, body, options = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" data-close-modal>
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header">
          <div><p class="eyebrow">EDUCA+ · FORMULÁRIO</p><h2 id="modal-title">${escapeHtml(title)}</h2></div>
          <button class="icon-button" type="button" aria-label="Fechar" data-close-modal><span aria-hidden="true">×</span></button>
        </header>
        <div class="modal-content">${body}</div>
      </section>
    </div>`;
  root.querySelector('.modal')?.addEventListener('click', (event) => event.stopPropagation());
  root.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModal));
  const focusable = root.querySelector('input,select,textarea,button');
  focusable?.focus();
  options.onOpen?.(root);
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

export function emptyState(title, description, action = '') {
  return `<div class="empty-state"><div class="empty-symbol">＋</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${action}</div>`;
}

export function errorMessage(error) {
  const message = error?.message || 'Não foi possível concluir a operação.';
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.';
  if (/duplicate key|already exists/i.test(message)) return 'Já existe um registro com esses dados.';
  if (/row-level security|permission denied/i.test(message)) return 'A operação não foi autorizada. Confira sua sessão e as políticas do banco.';
  return message;
}

export async function logActivity(db, teacherId, action, entityType, description) {
  const { error } = await db.from('activity_logs').insert({
    teacher_id: teacherId, action, entity_type: entityType, description,
  });
  if (error) console.warn('Não foi possível registrar a atividade:', error.message);
}

export function optionList(items, selected = '', labelKey = 'name', valueKey = 'id') {
  return items.map((item) => `<option value="${escapeHtml(item[valueKey])}" ${String(item[valueKey]) === String(selected) ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>`).join('');
}

export function statCard(label, value, hint, icon, accent = '') {
  return `<article class="stat-card ${accent}"><div class="stat-top"><span>${escapeHtml(label)}</span><span class="stat-icon">${icon}</span></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint)}</small></article>`;
}
