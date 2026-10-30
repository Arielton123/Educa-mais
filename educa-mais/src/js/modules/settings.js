import { requireSupabase } from '../services/supabase.js';
import { updatePassword } from '../services/auth.js';
import { escapeHtml, toast, errorMessage } from '../utils/helpers.js';
import { icon } from '../utils/icons.js';

export async function renderSettings(root, ctx) {
  const db = requireSupabase();
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', ctx.user.id).single();
  if (error) throw error;
  const theme = document.documentElement.dataset.theme || 'dark';
  root.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">PREFERÊNCIAS DA CONTA</p><h1>Configurações</h1><p>Personalize seus dados e parâmetros de acompanhamento.</p></div></div>
    <div class="settings-grid">
      <section class="panel"><div class="section-heading"><div><h2>Perfil do professor</h2><p>Informações exibidas no cabeçalho do sistema.</p></div></div>
        <form id="profile-form" class="form-grid"><label class="field field-wide">Nome completo<input name="full_name" required maxlength="120" value="${escapeHtml(profile.full_name)}"></label><label class="field field-wide">E-mail da conta<input value="${escapeHtml(ctx.user.email || '')}" disabled></label><div class="form-actions field-wide"><button class="button button-primary" type="submit">Salvar perfil</button></div></form>
      </section>
      <section class="panel"><div class="section-heading"><div><h2>Alertas de frequência</h2><p>Estudantes abaixo desse percentual serão destacados nos indicadores.</p></div></div><form id="threshold-form" class="form-grid"><label class="field">Limite mínimo de frequência (%)<input type="number" name="threshold" min="0" max="100" step="1" required value="${profile.low_attendance_threshold}"></label><div class="form-actions"><button class="button button-primary" type="submit">Salvar limite</button></div></form><p class="form-note">O limite é um alerta organizacional configurável. Confira as regras aplicáveis à sua instituição antes de tomar decisões acadêmicas.</p></section>
      <section class="panel"><div class="section-heading"><div><h2>Aparência</h2><p>Escolha o tema da interface.</p></div></div><div class="theme-options"><button class="theme-choice ${theme === 'dark' ? 'active' : ''}" data-theme-choice="dark">${icon('moon')} <span><strong>Modo escuro</strong><small>Fundo grafite e detalhes em verde-água.</small></span></button><button class="theme-choice ${theme === 'light' ? 'active' : ''}" data-theme-choice="light">${icon('sun')} <span><strong>Modo claro</strong><small>Superfícies claras e contraste suave.</small></span></button></div></section>
      <section class="panel"><div class="section-heading"><div><h2>Segurança</h2><p>Atualize a senha da conta autenticada.</p></div></div><form id="password-form" class="form-grid"><label class="field field-wide">Nova senha<input type="password" name="password" minlength="8" autocomplete="new-password" required></label><label class="field field-wide">Confirmar nova senha<input type="password" name="confirm" minlength="8" autocomplete="new-password" required></label><div class="form-actions field-wide"><button class="button button-secondary" type="submit">Atualizar senha</button></div></form></section>
    </div>
    <section class="panel connection-panel"><div><h2>Conexão e dados</h2><p>O EDUCA+ utiliza Supabase para autenticação e persistência. Seus registros pertencem à sua conta.</p></div><span class="pill pill-success">Conectado</span></section>`;

  root.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const name = String(new FormData(event.currentTarget).get('full_name')).trim();
    try { const { error: saveError } = await db.from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('id', ctx.user.id); if (saveError) throw saveError; ctx.profile.full_name = name; toast('Perfil atualizado.'); await ctx.refreshShell(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
  root.querySelector('#threshold-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const threshold = Number(new FormData(event.currentTarget).get('threshold'));
    try { const { error: saveError } = await db.from('profiles').update({ low_attendance_threshold: threshold, updated_at: new Date().toISOString() }).eq('id', ctx.user.id); if (saveError) throw saveError; ctx.profile.low_attendance_threshold = threshold; toast('Limite de frequência atualizado.'); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
  root.querySelectorAll('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.themeChoice; document.documentElement.dataset.theme = selected; localStorage.setItem('educa-theme', selected);
    root.querySelectorAll('[data-theme-choice]').forEach((item) => item.classList.toggle('active', item === button));
  }));
  root.querySelector('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get('password')); const confirm = String(form.get('confirm'));
    if (password !== confirm) return toast('As senhas não correspondem.', 'warning');
    try { await updatePassword(password); event.currentTarget.reset(); }
    catch (err) { toast(errorMessage(err), 'error'); }
  });
}
