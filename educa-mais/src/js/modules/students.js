import { requireSupabase } from '../services/supabase.js';
import { getClasses, getStudentClassMap } from '../services/data.js';
import { escapeHtml, openModal, closeModal, toast, errorMessage, logActivity, emptyState, optionList } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

export async function renderStudents(root, ctx, params = {}) {
  const db = requireSupabase();
  const [{ data: students, error }, classes, classMap] = await Promise.all([
    db.from('students').select('*').order('full_name'), getClasses(), getStudentClassMap(),
  ]);
  if (error) throw error;
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">CADASTRO E ACOMPANHAMENTO</p><h1>Estudantes</h1><p>Gerencie o cadastro e a vinculação dos estudantes às turmas.</p></div><button class="button button-primary" id="add-student">${icon('plus')} Novo estudante</button></div>
    <section class="panel"><div class="toolbar"><div class="search-field">${icon('search')}<input id="student-search" type="search" placeholder="Pesquisar por nome ou matrícula..."></div><select id="student-class-filter" class="select-control"><option value="">Todas as turmas</option>${optionList(classes, params.classId || '')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Estudante</th><th>Matrícula</th><th>Turma</th><th>Cadastro</th><th></th></tr></thead><tbody id="students-body"></tbody></table></div><div id="students-empty"></div></section>`;
  const body = root.querySelector('#students-body');
  const search = root.querySelector('#student-search');
  const filter = root.querySelector('#student-class-filter');
  const draw = () => {
    const term = search.value.toLocaleLowerCase('pt-BR');
    const rows = students.filter((s) => (`${s.full_name} ${s.registration_code}`).toLocaleLowerCase('pt-BR').includes(term) && (!filter.value || classMap.get(s.id)?.id === filter.value));
    body.innerHTML = rows.map((s) => `<tr><td><div class="person-cell"><span class="avatar avatar-small">${escapeHtml(s.full_name.split(/\s+/).slice(0,2).map((n)=>n[0]).join('').toUpperCase())}</span><div><strong>${escapeHtml(s.full_name)}</strong><small class="muted">ID ${escapeHtml(s.id.slice(0,8))}</small></div></div></td><td>${escapeHtml(s.registration_code)}</td><td>${escapeHtml(classMap.get(s.id)?.name || 'Sem turma')}</td><td>${new Date(s.created_at).toLocaleDateString('pt-BR')}</td><td><div class="row-actions"><button class="text-button" data-action="history" data-id="${s.id}">Frequência</button><button class="icon-button" title="Editar" data-action="edit" data-id="${s.id}">✎</button><button class="icon-button danger-text" title="Excluir" data-action="delete" data-id="${s.id}">×</button></div></td></tr>`).join('');
    root.querySelector('#students-empty').innerHTML = rows.length ? '' : emptyState(students.length ? 'Nenhum estudante encontrado' : 'Nenhum estudante cadastrado', 'Cadastre estudantes fictícios para testar o sistema.');
  };
  draw(); search.addEventListener('input', draw); filter.addEventListener('change', draw);
  root.querySelector('#add-student').addEventListener('click', () => openStudentForm());
  body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const item = students.find((s) => s.id === button.dataset.id); if (!item) return;
    if (button.dataset.action === 'edit') openStudentForm(item);
    if (button.dataset.action === 'history') {
      await ctx.navigate('reports', { studentId: item.id });
    }
    if (button.dataset.action === 'delete') {
      if (!window.confirm(`Excluir ${item.full_name}? Os registros de matrícula e frequência vinculados a esse estudante também serão removidos.`)) return;
      try {
        const { error: deleteError } = await db.from('students').delete().eq('id', item.id);
        if (deleteError) throw deleteError;
        await logActivity(db, ctx.user.id, 'delete', 'student', `Estudante ${item.full_name} excluído`);
        toast('Estudante excluído.'); await ctx.navigate('students');
      } catch (err) { toast(errorMessage(err), 'error'); }
    }
  });

  function openStudentForm(item = null) {
    openModal(item ? 'Editar estudante' : 'Cadastrar estudante', `
      <form id="student-form" class="form-grid">
        <label class="field field-wide">Nome completo<input name="full_name" required maxlength="160" value="${escapeHtml(item?.full_name || '')}"></label>
        <label class="field">Matrícula fictícia<input name="registration_code" required maxlength="40" value="${escapeHtml(item?.registration_code || '')}" placeholder="Ex.: EDU-2026-001"></label>
        <label class="field">Turma<select name="class_id" required><option value="">Selecione a turma</option>${optionList(classes, classMap.get(item?.id)?.id || '')}</select></label>
        <p class="form-note field-wide">Use somente dados fictícios neste ambiente de demonstração. A matrícula deve ser única na sua conta.</p>
        <div class="form-actions field-wide"><button class="button button-quiet" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">${item ? 'Salvar alterações' : 'Cadastrar estudante'}</button></div>
      </form>`);
    document.getElementById('student-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const values = { full_name: String(form.get('full_name')).trim(), registration_code: String(form.get('registration_code')).trim() };
      const classId = String(form.get('class_id'));
      try {
        let studentId = item?.id;
        if (item) {
          const { error: updateError } = await db.from('students').update(values).eq('id', item.id);
          if (updateError) throw updateError;
        } else {
          const { data, error: insertError } = await db.from('students').insert({ ...values, teacher_id: ctx.user.id }).select('id').single();
          if (insertError) throw insertError; studentId = data.id;
        }
        const oldClass = item ? classMap.get(item.id)?.id : null;
        if (oldClass !== classId) {
          const { error: enrollmentError } = await db.from('enrollments').upsert({ teacher_id: ctx.user.id, class_id: classId, student_id: studentId }, { onConflict: 'class_id,student_id' });
          if (enrollmentError) throw enrollmentError;
          if (oldClass) {
            const { error: removeError } = await db.from('enrollments').delete().eq('class_id', oldClass).eq('student_id', studentId);
            if (removeError) throw removeError;
          }
        }
        await logActivity(db, ctx.user.id, item ? 'update' : 'create', 'student', `Estudante ${values.full_name} ${item ? 'atualizado' : 'cadastrado'}`);
        closeModal(); toast(item ? 'Cadastro atualizado.' : 'Estudante cadastrado.'); await ctx.navigate('students');
      } catch (err) { toast(errorMessage(err), 'error'); }
    });
  }
}
