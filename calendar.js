import { requireSupabase } from '../services/supabase.js';
import { getClasses } from '../services/data.js';
import { escapeHtml, formatDate, todayISO, openModal, closeModal, toast, errorMessage, logActivity, emptyState, optionList } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const eventLabels = { class: 'Aula', assessment: 'Avaliação', meeting: 'Reunião', event: 'Evento', deadline: 'Prazo' };

export async function renderCalendar(root, ctx) {
  const db = requireSupabase();
  const [classes, result] = await Promise.all([
    getClasses(), db.from('calendar_events').select('*,classes(name)').order('event_date', { ascending: true }),
  ]);
  if (result.error) throw result.error;
  const events = result.data || [];
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">AGENDA DO PROFESSOR</p><h1>Calendário escolar</h1><p>Organize aulas, avaliações, reuniões e prazos importantes.</p></div><button class="button button-primary" id="add-event">${icon('plus')} Novo evento</button></div>
    <section class="panel"><div class="toolbar"><div><h2>Próximos compromissos</h2><p class="muted">Eventos ordenados por data.</p></div><select id="calendar-filter" class="select-control"><option value="">Todos os tipos</option>${Object.entries(eventLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
    <div class="event-list" id="event-list"></div><div id="event-empty"></div></section>`;
  const list = root.querySelector('#event-list');
  const draw = () => {
    const filter = root.querySelector('#calendar-filter').value;
    const filtered = events.filter((e) => !filter || e.event_type === filter);
    list.innerHTML = filtered.map((event) => `<article class="event-row"><div class="event-date"><strong>${new Date(`${event.event_date}T12:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(`${event.event_date}T12:00:00`)).replace('.','')}</span></div><div class="event-info"><span class="pill pill-neutral">${eventLabels[event.event_type] || 'Evento'}</span><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.details || 'Sem detalhes adicionais')}</p><small class="muted">${formatDate(event.event_date)}${event.classes?.name ? ` · ${escapeHtml(event.classes.name)}` : ''}</small></div><div class="row-actions"><button class="icon-button" title="Editar" data-action="edit" data-id="${event.id}">✎</button><button class="icon-button danger-text" title="Excluir" data-action="delete" data-id="${event.id}">×</button></div></article>`).join('');
    root.querySelector('#event-empty').innerHTML = filtered.length ? '' : emptyState('Agenda vazia','Adicione um evento para começar a organizar seu calendário.');
  };
  draw(); root.querySelector('#calendar-filter').addEventListener('change', draw); root.querySelector('#add-event').addEventListener('click', () => openForm());
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const item = events.find((row) => row.id === button.dataset.id); if (!item) return;
    if (button.dataset.action === 'edit') openForm(item);
    if (button.dataset.action === 'delete') {
      if (!confirm(`Excluir o evento “${item.title}”?`)) return;
      try { const { error } = await db.from('calendar_events').delete().eq('id', item.id); if (error) throw error; await logActivity(db, ctx.user.id, 'delete', 'calendar', `Evento ${item.title} excluído`); toast('Evento excluído.'); await ctx.navigate('calendar'); }
      catch (error) { toast(errorMessage(error), 'error'); }
    }
  });
  function openForm(item = null) {
    openModal(item ? 'Editar evento' : 'Novo evento', `
      <form id="event-form" class="form-grid">
        <label class="field field-wide">Título<input name="title" required maxlength="140" value="${escapeHtml(item?.title || '')}"></label>
        <label class="field">Tipo<select name="event_type">${Object.entries(eventLabels).map(([v,l])=>`<option value="${v}" ${item?.event_type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field">Data<input name="event_date" type="date" required value="${item?.event_date || todayISO()}"></label>
        <label class="field field-wide">Turma (opcional)<select name="class_id"><option value="">Todas as turmas</option>${optionList(classes, item?.class_id || '')}</select></label>
        <label class="field field-wide">Detalhes<textarea name="details" rows="3" maxlength="1200">${escapeHtml(item?.details || '')}</textarea></label>
        <div class="form-actions field-wide"><button class="button button-quiet" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">Salvar evento</button></div>
      </form>`);
    document.getElementById('event-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const classId = String(form.get('class_id') || '') || null;
      const payload = { teacher_id: ctx.user.id, title: String(form.get('title')).trim(), event_type: form.get('event_type'), event_date: form.get('event_date'), class_id: classId, details: String(form.get('details')).trim() };
      try { const response = item ? await db.from('calendar_events').update(payload).eq('id', item.id) : await db.from('calendar_events').insert(payload); if (response.error) throw response.error; await logActivity(db, ctx.user.id, item ? 'update' : 'create', 'calendar', `Evento ${payload.title} salvo`); closeModal(); toast('Evento salvo.'); await ctx.navigate('calendar'); }
      catch (error) { toast(errorMessage(error), 'error'); }
    });
  }
}
