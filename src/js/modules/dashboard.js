import { requireSupabase } from '../services/supabase.js';
import { statCard, formatDate, percent, escapeHtml, emptyState, toast, errorMessage } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

let frequencyChart;

export async function renderDashboard(root, ctx) {
  const db = requireSupabase();
  const [classesResult, studentsResult, sessionsResult, sessionsCountResult, recordsResult, eventsResult, activitiesResult] = await Promise.all([
    db.from('classes').select('id', { count: 'exact', head: true }),
    db.from('students').select('id', { count: 'exact', head: true }),
    db.from('attendance_sessions').select('id,lesson_date,class_id,classes(name)').order('lesson_date', { ascending: false }).limit(8),
    db.from('attendance_sessions').select('id', { count: 'exact', head: true }),
    db.from('attendance_records').select('student_id,status,created_at,students(full_name)'),
    db.from('calendar_events').select('id,title,event_date,event_type,classes(name)').gte('event_date', new Date().toISOString().slice(0,10)).order('event_date').limit(5),
    db.from('activity_logs').select('id,description,created_at,entity_type').order('created_at', { ascending: false }).limit(5),
  ]);
  for (const result of [classesResult,studentsResult,sessionsResult,sessionsCountResult,recordsResult,eventsResult,activitiesResult]) if (result.error) throw result.error;
  const records = recordsResult.data || [];
  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const overall = percent(attended, records.length);
  const perStudent = new Map();
  records.forEach((record) => {
    const row = perStudent.get(record.student_id) || { name: record.students?.full_name || 'Estudante', total: 0, attended: 0 };
    row.total += 1; if (record.status === 'present' || record.status === 'late') row.attended += 1;
    perStudent.set(record.student_id, row);
  });
  const lowStudents = [...perStudent.values()].filter((row) => row.total > 0 && percent(row.attended,row.total) < Number(ctx.profile.low_attendance_threshold || 75));
  const sessions = sessionsResult.data || [];
  root.innerHTML = `
    <div class="dashboard-welcome"><div><p class="eyebrow">VISÃO GERAL</p><h1>Olá, ${escapeHtml((ctx.profile.full_name || 'Professor').split(' ')[0])}.</h1><p>Este é o resumo atualizado dos seus registros acadêmicos.</p></div><button class="button button-primary" id="quick-attendance">${icon('check')} Fazer chamada</button></div>
    <section class="stats-grid">
      ${statCard('Turmas cadastradas',classesResult.count ?? 0,'Organização atual','▦')}
      ${statCard('Estudantes',studentsResult.count ?? 0,'Cadastros ativos','◎')}
      ${statCard('Chamadas registradas',sessionsCountResult.count ?? 0,'Histórico completo','✓')}
      ${statCard('Frequência geral',`${overall}%`,`${records.length} registros individuais`,'%','stat-highlight')}
    </section>
    <section class="dashboard-grid">
      <article class="panel chart-panel"><div class="section-heading"><div><h2>Distribuição de frequência</h2><p>Registros de presença, atraso e ausência.</p></div><span class="pill pill-neutral">Dados reais</span></div><div class="chart-wrap"><canvas id="attendance-chart" aria-label="Gráfico de frequência"></canvas></div></article>
      <article class="panel alert-panel"><div class="section-heading"><div><h2>Pontos de atenção</h2><p>Alertas conforme limite configurado.</p></div><span class="alert-count">${lowStudents.length}</span></div>${lowStudents.length ? `<div class="alert-list">${lowStudents.slice(0,5).map((s)=>`<div class="alert-item"><span class="alert-marker"></span><div><strong>${escapeHtml(s.name)}</strong><small>${percent(s.attended,s.total)}% de frequência · ${s.total} aulas</small></div></div>`).join('')}</div>` : `<div class="quiet-message">Nenhum estudante abaixo do limite de ${Number(ctx.profile.low_attendance_threshold || 75)}% nos registros consultados.</div>`}</article>
    </section>
    <section class="dashboard-grid bottom-grid">
      <article class="panel"><div class="section-heading"><div><h2>Últimas chamadas</h2><p>Registros de frequência mais recentes.</p></div><button class="text-button" id="see-history">Ver histórico</button></div><div class="compact-list">${sessions.length ? sessions.slice(0,5).map((s)=>`<div class="compact-row"><span class="compact-icon">${icon('check')}</span><div><strong>${escapeHtml(s.classes?.name || 'Turma')}</strong><small>${formatDate(s.lesson_date)}</small></div><span class="pill pill-success">Registrada</span></div>`).join('') : emptyState('Nenhuma chamada','As chamadas salvas aparecerão aqui.')}</div></article>
      <article class="panel"><div class="section-heading"><div><h2>Próximos eventos</h2><p>Agenda escolar.</p></div><button class="text-button" id="see-calendar">Abrir calendário</button></div><div class="compact-list">${(eventsResult.data || []).length ? eventsResult.data.map((e)=>`<div class="compact-row"><span class="event-day">${new Date(`${e.event_date}T12:00:00`).getDate()}</span><div><strong>${escapeHtml(e.title)}</strong><small>${formatDate(e.event_date)}${e.classes?.name ? ` · ${escapeHtml(e.classes.name)}` : ''}</small></div></div>`).join('') : emptyState('Agenda sem eventos','Cadastre avaliações, reuniões ou lembretes.')}</div></article>
    </section>
    <section class="panel recent-panel"><div class="section-heading"><div><h2>Atividade recente</h2><p>Últimas operações feitas na plataforma.</p></div><button class="text-button" id="see-activities">Ver todas</button></div><div class="activity-strip">${(activitiesResult.data || []).length ? activitiesResult.data.map((item)=>`<div><span class="activity-strip-dot"></span><p>${escapeHtml(item.description)}</p><small>${formatDate(item.created_at,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>`).join('') : '<p class="muted">Nenhuma atividade registrada até o momento.</p>'}</div></section>`;
  root.querySelector('#quick-attendance').addEventListener('click', () => ctx.navigate('attendance'));
  root.querySelector('#see-history').addEventListener('click', () => ctx.navigate('history'));
  root.querySelector('#see-calendar').addEventListener('click', () => ctx.navigate('calendar'));
  root.querySelector('#see-activities').addEventListener('click', () => ctx.navigate('history'));

  const counts = [
    records.filter((r)=>r.status === 'present').length,
    records.filter((r)=>r.status === 'late').length,
    records.filter((r)=>r.status === 'absent').length,
    records.filter((r)=>r.status === 'excused').length,
  ];
  const canvas = root.querySelector('#attendance-chart');
  if (frequencyChart) frequencyChart.destroy();
  frequencyChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels: ['Presentes','Atrasados','Ausentes','Justificados'], datasets: [{ data: counts, backgroundColor: ['#57b99f','#e7b65a','#d96c73','#7299bd'], borderWidth: 0, hoverOffset: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 18, color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(), font: { family: 'Inter, sans-serif', size: 11 } } } } },
  });
}
