import { requireSupabase } from '../services/supabase.js';
import { escapeHtml, formatDate, emptyState, toast, errorMessage } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

const actionLabels = { create: 'Criado', update: 'Atualizado', delete: 'Excluído' };

export async function renderHistory(root) {
  const db = requireSupabase();
  const { data, error } = await db.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  const logs = data || [];
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">RASTREABILIDADE</p><h1>Histórico de atividades</h1><p>Consulte as principais operações registradas na sua conta.</p></div><span class="pill pill-neutral">${logs.length} registros recentes</span></div>
    <section class="panel"><div class="toolbar"><div><h2>Atividades recentes</h2><p class="muted">Exibindo até 100 operações mais recentes.</p></div></div>
    <div class="activity-list">${logs.map((log)=>`<article class="activity-row"><span class="activity-dot"></span><div class="activity-content"><strong>${escapeHtml(log.description)}</strong><p>${escapeHtml(actionLabels[log.action] || log.action)} · ${escapeHtml(log.entity_type)}</p><small class="muted">${formatDate(log.created_at, {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div></article>`).join('')}</div>
    ${logs.length ? '' : emptyState('Nenhuma atividade registrada','As ações realizadas no EDUCA+ aparecerão aqui.')}</section>`;
}
