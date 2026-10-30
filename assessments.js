import { requireSupabase } from '../services/supabase.js';
import { getClassSubjectRows, getStudentsForClass } from '../services/data.js';
import { escapeHtml, formatDate, todayISO, openModal, closeModal, toast, errorMessage, logActivity, emptyState } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

export async function renderAssessments(root, ctx) {
  const db = requireSupabase();
  const [links, result] = await Promise.all([
    getClassSubjectRows(),
    db.from('assessments').select('*,classes(name),subjects(name)').order('assessment_date', { ascending: false }),
  ]);
  if (result.error) throw result.error;
  const assessments = result.data || [];
  const gradeResult = await db.from('grades').select('assessment_id,score');
  if (gradeResult.error) throw gradeResult.error;
  const gradeStats = new Map();
  (gradeResult.data || []).forEach((g) => {
    const stat = gradeStats.get(g.assessment_id) || { count: 0, total: 0, scores: [] };
    stat.count += 1; stat.total += Number(g.score); stat.scores.push(Number(g.score));
    gradeStats.set(g.assessment_id, stat);
  });
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">AVALIAÇÃO DA APRENDIZAGEM</p><h1>Avaliações e notas</h1><p>Planeje avaliações e lance resultados individuais dos estudantes.</p></div><button class="button button-primary" id="add-assessment">${icon('plus')} Nova avaliação</button></div>
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Avaliação</th><th>Turma / componente</th><th>Data</th><th>Valor máximo</th><th>Média da turma</th><th>Abaixo da média</th><th></th></tr></thead><tbody id="assessment-body">${assessments.map((a)=>assessmentRow(a,gradeStats)).join('')}</tbody></table></div><div id="assessments-empty">${assessments.length ? '' : emptyState('Nenhuma avaliação cadastrada','Crie uma avaliação para começar a lançar notas.')}</div></section>`;
  root.querySelector('#add-assessment').addEventListener('click', () => openAssessmentForm());
  root.querySelector('#assessment-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const item = assessments.find((a) => a.id === button.dataset.id); if (!item) return;
    if (button.dataset.action === 'edit') openAssessmentForm(item);
    if (button.dataset.action === 'grades') openGradeForm(item);
    if (button.dataset.action === 'delete') {
      if (!confirm(`Excluir a avaliação “${item.title}” e suas notas?`)) return;
      try { const { error } = await db.from('assessments').delete().eq('id', item.id); if (error) throw error; await logActivity(db, ctx.user.id, 'delete', 'assessment', `Avaliação ${item.title} excluída`); toast('Avaliação excluída.'); await ctx.navigate('assessments'); }
      catch (error) { toast(errorMessage(error), 'error'); }
    }
  });

  function assessmentRow(a, statsMap) {
    const maximum = Number(a.max_score);
    const stats = statsMap.get(a.id) || { count: 0, total: 0, scores: [] };
    const average = stats.count ? stats.total / stats.count : null;
    const below = stats.scores.filter((score) => score < Number(a.minimum_score ?? 6)).length;
    return `<tr><td><strong>${escapeHtml(a.title)}</strong></td><td>${escapeHtml(a.classes?.name || '')}<small class="muted">${escapeHtml(a.subjects?.name || '')}</small></td><td>${formatDate(a.assessment_date)}</td><td>${maximum.toLocaleString('pt-BR')}</td><td>${average === null ? '—' : average.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2})}</td><td><span class="${below ? 'frequency-low' : 'frequency-value'}">${below}</span><small class="muted">mínimo ${Number(a.minimum_score ?? 6).toLocaleString('pt-BR')}</small></td><td><div class="row-actions"><button class="text-button" data-action="grades" data-id="${a.id}">Lançar notas</button><button class="icon-button" title="Editar" data-action="edit" data-id="${a.id}">✎</button><button class="icon-button danger-text" title="Excluir" data-action="delete" data-id="${a.id}">×</button></div></td></tr>`;
  }

  function openAssessmentForm(item = null) {
    openModal(item ? 'Editar avaliação' : 'Cadastrar avaliação', `
      <form id="assessment-form" class="form-grid">
        <label class="field field-wide">Turma e componente<select name="link_id" required><option value="">Selecione</option>${links.map((l)=>`<option value="${l.id}" ${l.id === item?.class_subject_id ? 'selected' : ''}>${escapeHtml(l.classes?.name || '')} · ${escapeHtml(l.subjects?.name || '')}</option>`).join('')}</select></label>
        <label class="field field-wide">Título<input name="title" required maxlength="140" value="${escapeHtml(item?.title || '')}" placeholder="Ex.: Avaliação do primeiro trimestre"></label>
        <label class="field">Data<input name="assessment_date" type="date" required value="${item?.assessment_date || todayISO()}"></label>
        <label class="field">Valor máximo<input id="assessment-max" name="max_score" type="number" min="0.01" max="1000" step="0.01" required value="${item?.max_score ?? 10}"></label>
        <label class="field">Média mínima<input id="assessment-minimum" name="minimum_score" type="number" min="0" max="1000" step="0.01" required value="${item?.minimum_score ?? Math.min(6, Number(item?.max_score ?? 10))}"></label>
        <div class="form-actions field-wide"><button class="button button-quiet" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">Salvar avaliação</button></div>
      </form>`);
    const maximumInput = document.getElementById('assessment-max');
    const minimumInput = document.getElementById('assessment-minimum');
    maximumInput.addEventListener('change', () => { minimumInput.max = maximumInput.value; if (Number(minimumInput.value) > Number(maximumInput.value)) minimumInput.value = maximumInput.value; });
    document.getElementById('assessment-form').addEventListener('submit', async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget); const link = links.find((l) => l.id === form.get('link_id'));
      if (!link) return toast('Selecione um componente válido.', 'warning');
      const payload = { teacher_id: ctx.user.id, class_subject_id: link.id, class_id: link.class_id, subject_id: link.subject_id, title: String(form.get('title')).trim(), assessment_date: form.get('assessment_date'), max_score: Number(form.get('max_score')), minimum_score: Number(form.get('minimum_score')) };
      if (payload.minimum_score < 0 || payload.minimum_score > payload.max_score) return toast('A média mínima deve estar entre zero e o valor máximo.', 'warning');
      try { const response = item ? await db.from('assessments').update(payload).eq('id', item.id) : await db.from('assessments').insert(payload); if (response.error) throw response.error; await logActivity(db, ctx.user.id, item ? 'update' : 'create', 'assessment', `Avaliação ${payload.title} salva`); closeModal(); toast('Avaliação salva.'); await ctx.navigate('assessments'); }
      catch (error) { toast(errorMessage(error), 'error'); }
    });
  }

  async function openGradeForm(assessment) {
    try {
      const students = await getStudentsForClass(assessment.class_id);
      if (!students.length) return toast('Esta turma ainda não possui estudantes vinculados.', 'warning');
      const { data: grades, error } = await db.from('grades').select('student_id,score').eq('assessment_id', assessment.id);
      if (error) throw error;
      const current = new Map((grades || []).map((g) => [g.student_id, g.score]));
      const minimum = Number(assessment.minimum_score ?? 6);
      openModal(`Notas · ${assessment.title}`, `
        <p class="form-note">Valor máximo: <strong>${Number(assessment.max_score).toLocaleString('pt-BR')}</strong>. Média mínima: <strong>${minimum.toLocaleString('pt-BR')}</strong>. Deixe em branco quem ainda não recebeu nota.</p>
        <form id="grades-form"><div class="grade-list">${students.map((student)=>`<label class="grade-row"><span><strong>${escapeHtml(student.full_name)}</strong><small>${escapeHtml(student.registration_code)} · <span data-grade-hint="${student.id}">${current.has(student.id) ? (Number(current.get(student.id)) < minimum ? 'Abaixo da média' : 'Na média') : 'Sem nota'}</span></small></span><input type="number" name="grade-${student.id}" min="0" max="${Number(assessment.max_score)}" step="0.01" value="${current.has(student.id) ? current.get(student.id) : ''}" placeholder="—" aria-label="Nota de ${escapeHtml(student.full_name)}"></label>`).join('')}</div><div class="form-actions"><button type="button" class="button button-quiet" data-close-modal>Cancelar</button><button type="submit" class="button button-primary">Salvar notas</button></div></form>`);
      students.forEach((student) => {
        const input = document.querySelector(`[name="grade-${student.id}"]`);
        const hint = document.querySelector(`[data-grade-hint="${student.id}"]`);
        input?.addEventListener('input', () => {
          const raw = input.value.trim();
          hint.textContent = !raw ? 'Sem nota' : (Number(raw) < minimum ? 'Abaixo da média' : 'Na média');
          hint.className = raw && Number(raw) < minimum ? 'frequency-low' : 'frequency-value';
        });
      });
      document.getElementById('grades-form').addEventListener('submit', async (event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget); const rows = [];
        for (const student of students) {
          const raw = String(form.get(`grade-${student.id}`) ?? '').trim();
          if (!raw) continue;
          const score = Number(raw);
          if (!Number.isFinite(score) || score < 0 || score > Number(assessment.max_score)) return toast(`Confira a nota de ${student.full_name}.`, 'warning');
          rows.push({ teacher_id: ctx.user.id, assessment_id: assessment.id, student_id: student.id, score, updated_at: new Date().toISOString() });
        }
        try {
          if (rows.length) { const { error: saveError } = await db.from('grades').upsert(rows, { onConflict: 'assessment_id,student_id' }); if (saveError) throw saveError; }
          for (const student of students) {
            const raw = String(form.get(`grade-${student.id}`) ?? '').trim();
            if (!raw && current.has(student.id)) {
              const { error: deleteError } = await db.from('grades').delete().eq('assessment_id', assessment.id).eq('student_id', student.id);
              if (deleteError) throw deleteError;
            }
          }
          await logActivity(db, ctx.user.id, 'update', 'grades', `Notas da avaliação ${assessment.title} atualizadas`); closeModal(); toast('Notas salvas.'); await ctx.navigate('assessments');
        } catch (error) { toast(errorMessage(error), 'error'); }
      });
    } catch (error) { toast(errorMessage(error), 'error'); }
  }
}
