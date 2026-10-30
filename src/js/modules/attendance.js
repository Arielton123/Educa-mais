import { requireSupabase } from '../services/supabase.js';
import { getClasses, getClassSubjectRows, getStudentsForClass } from '../services/data.js';
import { escapeHtml, formatDate, todayISO, STATUS_LABELS, toast, errorMessage, logActivity, openModal, closeModal, emptyState } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

export async function renderAttendance(root, ctx) {
  const db = requireSupabase();
  const [classes, classSubjects] = await Promise.all([getClasses(), getClassSubjectRows()]);
  let roster = [];
  let activeSession = null;
  let currentStatuses = new Map();
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">REGISTRO DE FREQUÊNCIA</p><h1>Chamada escolar</h1><p>Registre a frequência e revise os lançamentos antes de salvar.</p></div><span class="pill pill-success">Registro online</span></div>
    <section class="panel attendance-config"><div class="section-heading"><div><h2>Dados da aula</h2><p>Selecione a turma, o componente curricular e a data.</p></div></div>
      <div class="form-grid form-grid-four">
        <label class="field">Turma<select id="att-class"><option value="">Selecione</option>${classes.map((c)=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select></label>
        <label class="field">Componente<select id="att-subject" disabled><option value="">Selecione a turma primeiro</option></select></label>
        <label class="field">Data da aula<input id="att-date" type="date" value="${todayISO()}" required></label>
        <div class="field field-end"><button class="button button-secondary" id="load-roster" type="button">Carregar chamada</button></div>
      </div>
    </section>
    <section class="panel attendance-workspace" id="attendance-workspace">
      ${emptyState('Chamada não iniciada','Selecione os dados da aula e clique em “Carregar chamada”.')}
    </section>`;

  const classSelect = root.querySelector('#att-class');
  const subjectSelect = root.querySelector('#att-subject');
  classSelect.addEventListener('change', () => {
    const links = classSubjects.filter((row) => row.class_id === classSelect.value);
    subjectSelect.disabled = !links.length;
    subjectSelect.innerHTML = links.length ? `<option value="">Selecione</option>${links.map((link)=>`<option value="${link.id}" data-subject-id="${link.subject_id}">${escapeHtml(link.subjects?.name || 'Componente')}</option>`).join('')}` : '<option value="">Cadastre um componente para esta turma</option>';
  });
  root.querySelector('#load-roster').addEventListener('click', loadRoster);

  async function loadRoster() {
    const classId = classSelect.value;
    const linkId = subjectSelect.value;
    const link = classSubjects.find((row) => row.id === linkId);
    const lessonDate = root.querySelector('#att-date').value;
    if (!classId || !link || !lessonDate) return toast('Selecione turma, componente e data.', 'warning');
    try {
      roster = await getStudentsForClass(classId);
      currentStatuses = new Map(roster.map((student) => [student.id, 'present']));
      const { data: session, error: sessionError } = await db.from('attendance_sessions').select('*')
        .eq('class_id', classId).eq('subject_id', link.subject_id).eq('lesson_date', lessonDate).maybeSingle();
      if (sessionError) throw sessionError;
      activeSession = session;
      if (session) {
        const { data: records, error: recordsError } = await db.from('attendance_records').select('student_id,status').eq('session_id', session.id);
        if (recordsError) throw recordsError;
        (records || []).forEach((record) => currentStatuses.set(record.student_id, record.status));
      }
      renderRoster(link, lessonDate);
    } catch (error) { toast(errorMessage(error), 'error'); }
  }

  function renderRoster(link, lessonDate) {
    const workspace = root.querySelector('#attendance-workspace');
    if (!roster.length) {
      workspace.innerHTML = emptyState('Turma sem estudantes','Cadastre e vincule estudantes antes de iniciar a chamada.');
      return;
    }
    workspace.innerHTML = `
      <div class="section-heading attendance-heading"><div><div class="eyebrow">${activeSession ? 'CHAMADA EXISTENTE · EDIÇÃO' : 'NOVA CHAMADA'}</div><h2>${escapeHtml(classes.find((c)=>c.id === classSelect.value)?.name || '')}</h2><p>${escapeHtml(link.subjects?.name || '')} · ${formatDate(lessonDate)}</p></div><div class="attendance-actions"><button class="button button-quiet" id="all-present" type="button">Marcar todos presentes</button><button class="button button-primary" id="save-attendance" type="button">Salvar chamada</button></div></div>
      <div class="attendance-summary" id="attendance-summary"></div>
      <div class="table-wrap"><table class="attendance-table"><thead><tr><th>Estudante</th><th>Matrícula</th><th>Situação</th></tr></thead><tbody>${roster.map((student)=>`<tr><td><strong>${escapeHtml(student.full_name)}</strong></td><td>${escapeHtml(student.registration_code)}</td><td><select class="status-select" data-student-id="${student.id}">${statusOptions}</select></td></tr>`).join('')}</tbody></table></div>
      <label class="field attendance-note">Observações da aula<textarea id="attendance-notes" rows="2" maxlength="800" placeholder="Observações opcionais...">${escapeHtml(activeSession?.notes || '')}</textarea></label>
      <p class="muted small-text">A chamada é salva na nuvem. Uma combinação de turma, componente e data corresponde a uma única chamada; ao carregá-la novamente, você poderá editar os registros.</p>`;
    workspace.querySelectorAll('.status-select').forEach((select) => {
      select.value = currentStatuses.get(select.dataset.studentId) || 'present';
      select.addEventListener('change', () => { currentStatuses.set(select.dataset.studentId, select.value); updateCounts(); });
    });
    workspace.querySelector('#all-present').addEventListener('click', () => {
      currentStatuses = new Map(roster.map((student) => [student.id, 'present']));
      workspace.querySelectorAll('.status-select').forEach((select) => { select.value = 'present'; });
      updateCounts();
    });
    workspace.querySelector('#save-attendance').addEventListener('click', saveAttendance);
    updateCounts();
  }

  function updateCounts() {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    currentStatuses.forEach((status) => { counts[status] = (counts[status] || 0) + 1; });
    const target = root.querySelector('#attendance-summary');
    if (target) target.innerHTML = Object.entries(counts).map(([key, value]) => `<div class="attendance-count count-${key}"><strong>${value}</strong><span>${STATUS_LABELS[key]}</span></div>`).join('');
  }

  async function saveAttendance() {
    const classId = classSelect.value;
    const linkId = subjectSelect.value;
    const link = classSubjects.find((row) => row.id === linkId);
    const date = root.querySelector('#att-date').value;
    const button = root.querySelector('#save-attendance');
    button.disabled = true; button.textContent = 'Salvando...';
    const wasExisting = Boolean(activeSession);
    try {
      let sessionId = activeSession?.id;
      const sessionValues = {
        teacher_id: ctx.user.id, class_subject_id: link.id, class_id: classId,
        subject_id: link.subject_id, lesson_date: date,
        notes: root.querySelector('#attendance-notes').value.trim(),
      };
      if (activeSession) {
        const { error } = await db.from('attendance_sessions').update({ notes: sessionValues.notes, updated_at: new Date().toISOString() }).eq('id', activeSession.id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from('attendance_sessions').insert(sessionValues).select('id').single();
        if (error) throw error; sessionId = data.id;
      }
      const rows = roster.map((student) => ({ teacher_id: ctx.user.id, session_id: sessionId, student_id: student.id, status: currentStatuses.get(student.id) || 'present', updated_at: new Date().toISOString() }));
      const { error: recordsError } = await db.from('attendance_records').upsert(rows, { onConflict: 'session_id,student_id' });
      if (recordsError) throw recordsError;
      activeSession = { ...(activeSession || {}), id: sessionId, notes: sessionValues.notes };
      await logActivity(db, ctx.user.id, wasExisting ? 'update' : 'create', 'attendance', `Chamada registrada em ${formatDate(date)}`);
      toast('Chamada salva com sucesso.');
      renderRoster(link, date);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      const currentButton = root.querySelector('#save-attendance');
      if (currentButton) { currentButton.disabled = false; currentButton.textContent = 'Salvar chamada'; }
    }
  }
}
