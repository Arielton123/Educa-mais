import { requireSupabase } from '../services/supabase.js';
import { getClassSubjectRows } from '../services/data.js';
import { escapeHtml, formatDate, todayISO, openModal, closeModal, toast, errorMessage, logActivity, emptyState, optionList } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

export async function renderDiary(root, ctx) {
  const db = requireSupabase();
  const [links, result] = await Promise.all([
    getClassSubjectRows(),
    db.from('diary_entries').select('*,classes(name),subjects(name)').order('lesson_date', { ascending: false }),
  ]);
  if (result.error) throw result.error;
  const entries = result.data || [];
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">REGISTRO PEDAGÓGICO</p><h1>Diário de classe</h1><p>Registre os conteúdos ministrados e as atividades realizadas.</p></div><button class="button button-primary" id="add-diary">${icon('plus')} Registrar aula</button></div>
    <section class="panel"><div class="toolbar"><div class="search-field">${icon('search')}<input id="diary-search" type="search" placeholder="Pesquisar por turma, componente ou conteúdo..."></div><input id="diary-date" class="select-control" type="month" aria-label="Filtrar por mês"></div>
    <div class="timeline-list" id="diary-list"></div><div id="diary-empty"></div></section>`;
  const list = root.querySelector('#diary-list');
  const draw = () => {
    const term = root.querySelector('#diary-search').value.toLocaleLowerCase('pt-BR');
    const month = root.querySelector('#diary-date').value;
    const filtered = entries.filter((entry) => `${entry.classes?.name || ''} ${entry.subjects?.name || ''} ${entry.content} ${entry.activities}`.toLocaleLowerCase('pt-BR').includes(term) && (!month || entry.lesson_date.startsWith(month)));
    list.innerHTML = filtered.map((entry) => `<article class="timeline-item"><div class="timeline-date"><strong>${new Date(`${entry.lesson_date}T12:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(`${entry.lesson_date}T12:00:00`)).replace('.','')}</span></div><div class="timeline-card"><div class="timeline-card-top"><div><span class="pill pill-neutral">${escapeHtml(entry.classes?.name || 'Turma')}</span><span class="muted">${escapeHtml(entry.subjects?.name || 'Componente')}</span></div><div class="row-actions"><button class="icon-button" title="Editar" data-action="edit" data-id="${entry.id}">✎</button><button class="icon-button danger-text" title="Excluir" data-action="delete" data-id="${entry.id}">×</button></div></div><h3>${escapeHtml(entry.content)}</h3>${entry.activities ? `<p>${escapeHtml(entry.activities)}</p>` : ''}<small class="muted">${formatDate(entry.lesson_date)}</small></div></article>`).join('');
    root.querySelector('#diary-empty').innerHTML = filtered.length ? '' : emptyState(entries.length ? 'Nenhum registro encontrado' : 'Diário ainda vazio', 'Registre o conteúdo da aula para construir seu histórico pedagógico.');
  };
  draw(); root.querySelector('#diary-search').addEventListener('input', draw); root.querySelector('#diary-date').addEventListener('change', draw);
  root.querySelector('#add-diary').addEventListener('click', () => openForm());
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const item = entries.find((entry) => entry.id === button.dataset.id); if (!item) return;
    if (button.dataset.action === 'edit') openForm(item);
    if (button.dataset.action === 'delete') {
      if (!confirm('Excluir este registro do diário?')) return;
      try {
        const { error } = await db.from('diary_entries').delete().eq('id', item.id); if (error) throw error;
        await logActivity(db, ctx.user.id, 'delete', 'diary', 'Registro do diário excluído'); toast('Registro excluído.'); await ctx.navigate('diary');
      } catch (error) { toast(errorMessage(error), 'error'); }
    }
  });

  function openForm(item = null) {
    openModal(item ? 'Editar registro de aula' : 'Novo registro de aula', `
      <form id="diary-form" class="form-grid">
        <label class="field field-wide">Turma e componente<select name="link_id" required><option value="">Selecione</option>${links.map((link)=>`<option value="${link.id}" ${link.id === item?.class_subject_id ? 'selected' : ''}>${escapeHtml(link.classes?.name || '')} · ${escapeHtml(link.subjects?.name || '')}</option>`).join('')}</select></label>
        <label class="field">Data da aula<input name="lesson_date" type="date" required value="${item?.lesson_date || todayISO()}"></label>
        <label class="field field-wide">Conteúdo ministrado<textarea name="content" required rows="3" maxlength="3000">${escapeHtml(item?.content || '')}</textarea></label>
        <label class="field field-wide">Atividades realizadas<textarea name="activities" rows="3" maxlength="3000">${escapeHtml(item?.activities || '')}</textarea></label>
        <div class="form-actions field-wide"><button class="button button-quiet" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">Salvar registro</button></div>
      </form>`);
    document.getElementById('diary-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const link = links.find((row) => row.id === form.get('link_id'));
      if (!link) return toast('Selecione um componente válido.', 'warning');
      const payload = { teacher_id: ctx.user.id, class_subject_id: link.id, class_id: link.class_id, subject_id: link.subject_id, lesson_date: form.get('lesson_date'), content: String(form.get('content')).trim(), activities: String(form.get('activities')).trim() };
      try {
        const result = item ? await db.from('diary_entries').update(payload).eq('id', item.id) : await db.from('diary_entries').insert(payload);
        if (result.error) throw result.error;
        await logActivity(db, ctx.user.id, item ? 'update' : 'create', 'diary', 'Registro de aula salvo'); closeModal(); toast('Registro salvo.'); await ctx.navigate('diary');
      } catch (error) { toast(errorMessage(error), 'error'); }
    });
  }
}
