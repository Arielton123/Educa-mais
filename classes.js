import { requireSupabase } from '../services/supabase.js';
import { getClasses, getClassSubjectRows } from '../services/data.js';
import { escapeHtml, openModal, closeModal, toast, errorMessage, logActivity, emptyState } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

export async function renderClasses(root, ctx) {
  const db = requireSupabase();
  const [classes, links] = await Promise.all([getClasses(), getClassSubjectRows()]);
  const subjectNames = new Map();
  links.forEach((item) => subjectNames.set(item.class_id, [...(subjectNames.get(item.class_id) || []), item.subjects?.name].filter(Boolean)));

  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">ORGANIZAÇÃO ACADÊMICA</p><h1>Turmas</h1><p>Cadastre e organize suas turmas e componentes curriculares.</p></div><button class="button button-primary" id="add-class">${icon('plus')} Nova turma</button></div>
    <section class="panel"><div class="toolbar"><div class="search-field">${icon('search')}<input id="class-search" type="search" placeholder="Pesquisar turma..." aria-label="Pesquisar turma"></div><select id="class-shift" class="select-control"><option value="">Todos os turnos</option><option>Manhã</option><option>Tarde</option><option>Noite</option><option>Integral</option></select></div>
      <div class="table-wrap"><table><thead><tr><th>Turma</th><th>Ano escolar</th><th>Turno</th><th>Componentes</th><th></th></tr></thead><tbody id="classes-body">${classes.map((item) => classRow(item, subjectNames.get(item.id) || [])).join('')}</tbody></table></div>
      <div id="classes-empty">${classes.length ? '' : emptyState('Nenhuma turma cadastrada','Cadastre a primeira turma para começar a organizar os estudantes.')} </div>
    </section>`;

  const search = root.querySelector('#class-search');
  const shift = root.querySelector('#class-shift');
  const body = root.querySelector('#classes-body');
  const refreshRows = () => {
    const term = search.value.toLocaleLowerCase('pt-BR');
    const filtered = classes.filter((item) => `${item.name} ${item.school_year}`.toLocaleLowerCase('pt-BR').includes(term) && (!shift.value || item.shift === shift.value));
    body.innerHTML = filtered.map((item) => classRow(item, subjectNames.get(item.id) || [])).join('');
    root.querySelector('#classes-empty').innerHTML = filtered.length ? '' : emptyState('Nenhum resultado','Tente alterar os termos ou filtros da pesquisa.');
  };
  search.addEventListener('input', refreshRows);
  shift.addEventListener('change', refreshRows);

  root.querySelector('#add-class').addEventListener('click', () => openClassForm());
  body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = classes.find((item) => item.id === button.dataset.id);
    if (!row) return;
    if (button.dataset.action === 'edit') openClassForm(row);
    if (button.dataset.action === 'delete') {
      if (!window.confirm(`Excluir a turma ${row.name}? Os vínculos, chamadas e registros associados também serão excluídos.`)) return;
      try {
        const { error } = await db.from('classes').delete().eq('id', row.id);
        if (error) throw error;
        await logActivity(db, ctx.user.id, 'delete', 'class', `Turma ${row.name} excluída`);
        toast('Turma excluída.');
        await ctx.navigate('classes');
      } catch (error) { toast(errorMessage(error), 'error'); }
    }
    if (button.dataset.action === 'details') {
      await ctx.navigate('students', { classId: row.id });
    }
  });

  function classRow(item, subjects) {
    return `<tr><td><div class="table-primary">${escapeHtml(item.name)}</div><small class="muted">Criada em ${new Date(item.created_at).toLocaleDateString('pt-BR')}</small></td><td>${escapeHtml(item.school_year)}</td><td><span class="pill pill-neutral">${escapeHtml(item.shift)}</span></td><td>${subjects.length ? subjects.map(escapeHtml).join(', ') : '<span class="muted">Sem componente</span>'}</td><td><div class="row-actions"><button class="text-button" data-action="details" data-id="${item.id}">Ver estudantes</button><button class="icon-button" title="Editar" data-action="edit" data-id="${item.id}">✎</button><button class="icon-button danger-text" title="Excluir" data-action="delete" data-id="${item.id}">×</button></div></td></tr>`;
  }

  function openClassForm(item = null) {
    openModal(item ? 'Editar turma' : 'Nova turma', `
      <form id="class-form" class="form-grid">
        <label class="field field-wide">Nome da turma<input name="name" required maxlength="100" value="${escapeHtml(item?.name || '')}" placeholder="Ex.: 2º ano — Turma 221"></label>
        <label class="field">Ano escolar<input name="school_year" required value="${escapeHtml(item?.school_year || '')}" placeholder="Ex.: 2º ano do Ensino Médio"></label>
        <label class="field">Turno<select name="shift" required><option value="">Selecione</option>${['Manhã','Tarde','Noite','Integral'].map((v) => `<option ${item?.shift === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field field-wide">Componente curricular principal<input name="subject" maxlength="100" value="${escapeHtml(subjectNames.get(item?.id)?.[0] || '')}" placeholder="Ex.: Física"></label>
        <div class="form-actions field-wide"><button type="button" class="button button-quiet" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">${item ? 'Salvar alterações' : 'Cadastrar turma'}</button></div>
      </form>`);
    document.getElementById('class-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const values = { name: String(form.get('name')).trim(), school_year: String(form.get('school_year')).trim(), shift: form.get('shift') };
      const subjectName = String(form.get('subject') || '').trim();
      try {
        let classId = item?.id;
        if (item) {
          const { error } = await db.from('classes').update(values).eq('id', item.id);
          if (error) throw error;
        } else {
          const { data, error } = await db.from('classes').insert({ ...values, teacher_id: ctx.user.id }).select('id').single();
          if (error) throw error;
          classId = data.id;
        }
        if (subjectName) {
          let subject = await db.from('subjects').select('id').eq('name', subjectName).maybeSingle();
          if (subject.error) throw subject.error;
          if (!subject.data) {
            subject = await db.from('subjects').insert({ teacher_id: ctx.user.id, name: subjectName }).select('id').single();
            if (subject.error) throw subject.error;
          }
          const link = await db.from('class_subjects').upsert({ teacher_id: ctx.user.id, class_id: classId, subject_id: subject.data.id }, { onConflict: 'class_id,subject_id' });
          if (link.error) throw link.error;
        }
        await logActivity(db, ctx.user.id, item ? 'update' : 'create', 'class', `Turma ${values.name} ${item ? 'atualizada' : 'criada'}`);
        closeModal(); toast(item ? 'Turma atualizada.' : 'Turma cadastrada.'); await ctx.navigate('classes');
      } catch (error) { toast(errorMessage(error), 'error'); }
    });
  }
}
