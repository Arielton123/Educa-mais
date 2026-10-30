import { requireSupabase } from '../services/supabase.js';
import { getClasses } from '../services/data.js';
import { escapeHtml, formatDate, todayISO, percent, toast, errorMessage, emptyState, optionList } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function renderReports(root, ctx, params = {}) {
  const db = requireSupabase();
  const classes = await getClasses();
  let selectedStudent = null;
  let initialClassId = params.classId || '';
  if (params.studentId) {
    const [{ data: student, error: studentError }, { data: enrollment, error: enrollmentError }] = await Promise.all([
      db.from('students').select('id,full_name,registration_code').eq('id', params.studentId).single(),
      db.from('enrollments').select('class_id').eq('student_id', params.studentId).maybeSingle(),
    ]);
    if (studentError) throw studentError;
    if (enrollmentError) throw enrollmentError;
    selectedStudent = student;
    if (!initialClassId && enrollment?.class_id) initialClassId = enrollment.class_id;
  }
  const currentYear = new Date().getFullYear();
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">DADOS E INDICADORES</p><h1>${selectedStudent ? `Frequência · ${escapeHtml(selectedStudent.full_name)}` : 'Relatórios'}</h1><p>${selectedStudent ? `Matrícula ${escapeHtml(selectedStudent.registration_code)} · histórico individual de frequência.` : 'Consulte a frequência e gere documentos a partir dos registros salvos.'}</p></div><button class="button button-secondary" id="export-report">${icon('file')} Exportar PDF</button></div>
    <section class="panel"><div class="filter-grid"><label class="field">Turma<select id="report-class"><option value="">Todas as turmas</option>${optionList(classes, initialClassId)}</select></label><label class="field">Data inicial<input id="report-start" type="date" value="${currentYear}-01-01"></label><label class="field">Data final<input id="report-end" type="date" value="${todayISO()}"></label><div class="field field-end"><button class="button button-primary" id="generate-report">Gerar relatório</button></div></div></section>
    <section class="report-summary" id="report-summary"></section>
    <section class="panel"><div class="section-heading"><div><h2>Frequência por estudante</h2><p>Presenças e atrasos são contabilizados como participação; faltas justificadas permanecem no total de aulas.</p></div></div><div class="table-wrap"><table><thead><tr><th>Estudante</th><th>Turma</th><th>Aulas registradas</th><th>Presenças</th><th>Ausências</th><th>Frequência</th></tr></thead><tbody id="report-body"></tbody></table></div><div id="report-empty"></div></section>`;
  let reportRows = [];
  root.querySelector('#generate-report').addEventListener('click', generate);
  root.querySelector('#export-report').addEventListener('click', exportPdf);
  await generate();

  async function generate() {
    const classId = root.querySelector('#report-class').value;
    const start = root.querySelector('#report-start').value;
    const end = root.querySelector('#report-end').value;
    if (!start || !end || start > end) return toast('Informe um intervalo de datas válido.', 'warning');
    try {
      let sessionQuery = db.from('attendance_sessions').select('id,class_id,lesson_date,classes(name)').gte('lesson_date', start).lte('lesson_date', end);
      if (classId) sessionQuery = sessionQuery.eq('class_id', classId);
      const { data: sessions, error: sessionError } = await sessionQuery.order('lesson_date', { ascending: false });
      if (sessionError) throw sessionError;
      const sessionIds = (sessions || []).map((s) => s.id);
      if (!sessionIds.length) {
        reportRows = [];
        root.querySelector('#report-body').innerHTML = '';
        root.querySelector('#report-summary').innerHTML = `<div class="report-stat"><span>Aulas registradas</span><strong>0</strong></div><div class="report-stat"><span>Registros individuais</span><strong>0</strong></div><div class="report-stat"><span>Frequência geral</span><strong>—</strong></div>`;
        root.querySelector('#report-empty').innerHTML = emptyState('Sem dados no período','Não foram encontradas chamadas para os filtros selecionados.');
        return;
      }
      const { data: records, error: recordError } = await db.from('attendance_records')
        .select('session_id,student_id,status,students(full_name,registration_code)').in('session_id', sessionIds);
      if (recordError) throw recordError;
      const sessionMap = new Map(sessions.map((s) => [s.id, s]));
      const studentMap = new Map();
      (records || []).forEach((record) => {
        const key = record.student_id;
        const current = studentMap.get(key) || { student: record.students, className: sessionMap.get(record.session_id)?.classes?.name || 'Turma', lessons: 0, present: 0, absent: 0, late: 0, excused: 0 };
        current.lessons += 1;
        current[record.status] += 1;
        studentMap.set(key, current);
      });
      reportRows = [...studentMap.entries()].map(([studentId, item]) => ({ studentId, ...item, attendance: percent(item.present + item.late, item.lessons) }))
        .filter((item) => !params.studentId || item.studentId === params.studentId)
        .sort((a,b) => a.student.full_name.localeCompare(b.student.full_name, 'pt-BR'));
      const totalRecords = reportRows.reduce((sum, row) => sum + row.lessons, 0);
      const totalPresent = reportRows.reduce((sum, row) => sum + row.present + row.late, 0);
      root.querySelector('#report-summary').innerHTML = `<div class="report-stat"><span>Aulas registradas</span><strong>${sessions.length}</strong></div><div class="report-stat"><span>Registros individuais</span><strong>${totalRecords}</strong></div><div class="report-stat"><span>Frequência geral</span><strong>${percent(totalPresent,totalRecords)}%</strong></div>`;
      root.querySelector('#report-body').innerHTML = reportRows.map((row) => `<tr><td><strong>${escapeHtml(row.student?.full_name || 'Estudante')}</strong><small class="muted">${escapeHtml(row.student?.registration_code || '')}</small></td><td>${escapeHtml(row.className)}</td><td>${row.lessons}</td><td>${row.present + row.late}</td><td>${row.absent + row.excused}</td><td><span class="frequency-value ${row.attendance < 75 ? 'frequency-low' : ''}">${row.attendance}%</span></td></tr>`).join('');
      root.querySelector('#report-empty').innerHTML = reportRows.length ? '' : emptyState('Sem registros de frequência','As chamadas encontradas não possuem registros individuais.');
      ctx.reportMeta = { start, end, className: classId ? classes.find((c)=>c.id === classId)?.name : 'Todas as turmas', sessionCount: sessions.length, studentName: selectedStudent?.full_name || null };
    } catch (error) { toast(errorMessage(error), 'error'); }
  }

  function exportPdf() {
    if (!reportRows.length) return toast('Gere um relatório com dados antes de exportar.', 'warning');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFontSize(19); doc.text(selectedStudent ? `EDUCA+ | Frequência de ${selectedStudent.full_name}` : 'EDUCA+ | Relatório de frequência', 14, 17);
      doc.setFontSize(10); doc.text(`Turma: ${ctx.reportMeta?.className || 'Todas'}   Período: ${formatDate(ctx.reportMeta?.start)} a ${formatDate(ctx.reportMeta?.end)}`, 14, 25);
      doc.text(`Emitido em ${formatDate(todayISO())}`, 14, 31);
      autoTable(doc, {
        startY: 38,
        head: [['Estudante', 'Matrícula', 'Turma', 'Aulas', 'Presenças', 'Ausências', 'Frequência']],
        body: reportRows.map((row) => [row.student?.full_name || '', row.student?.registration_code || '', row.className, row.lessons, row.present + row.late, row.absent + row.excused, `${row.attendance}%`]),
        styles: { fontSize: 8, cellPadding: 2.5 }, headStyles: { fillColor: [22, 43, 62] },
      });
      doc.save(`educa-mais-frequencia-${todayISO()}.pdf`);
    } catch (error) { toast(`Falha ao gerar PDF: ${error.message}`, 'error'); }
  }
}
