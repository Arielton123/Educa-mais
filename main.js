import '../css/style.css';
import { supabase, isSupabaseConfigured } from './services/supabase.js';
import { signIn, sendPasswordRecovery } from './services/auth.js';
import { mountApplication } from './app.js';
import { toast, errorMessage, escapeHtml } from './utils/helpers.js';
import { icon } from './utils/icons.js';

const root = document.getElementById('app');
const storedTheme = localStorage.getItem('educa-theme');
document.documentElement.dataset.theme = storedTheme === 'light' ? 'light' : 'dark';

if (!isSupabaseConfigured) {
  renderSetup();
} else {
  boot();
}

async function boot() {
  root.innerHTML = '<div class="boot-screen"><span class="brand-mark">E+</span><span>Verificando sessão...</span></div>';
  const recoveryRequested = window.location.hash.includes('type=recovery');
  const { data, error } = await supabase.auth.getSession();
  if (error) { renderLogin(error.message); return; }
  if (data.session && recoveryRequested) renderPasswordRecovery();
  else if (data.session) await startApp(data.session.user);
  else renderLogin();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') renderLogin();
    if (event === 'PASSWORD_RECOVERY') renderPasswordRecovery();
  });
}

async function startApp(user) {
  try { await mountApplication(root, user); }
  catch (error) { console.error(error); renderLogin(error.message || 'Não foi possível carregar o perfil.'); }
}

function renderLogin(message = '') {
  root.innerHTML = `
    <main class="auth-layout">
      <section class="auth-aside"><div class="auth-brand"><span class="brand-mark">E<span>+</span></span><span><strong>EDUCA<span>+</span></strong><small>PLATAFORMA INTELIGENTE DE GESTÃO ESCOLAR</small></span></div><div class="auth-aside-copy"><p class="eyebrow">GESTÃO ESCOLAR EM UM SÓ LUGAR</p><h1>Mais clareza para acompanhar cada etapa da aprendizagem.</h1><p>Organize turmas, registre frequência e acompanhe informações acadêmicas em um ambiente seguro e integrado.</p><div class="auth-feature-list"><span>${icon('check')} Chamada escolar e frequência</span><span>${icon('bookOpen')} Diário e avaliações</span><span>${icon('chart')} Indicadores e relatórios</span></div></div><div class="auth-aside-footer">EDUCA+ · Projeto independente de gestão escolar</div></section>
      <section class="auth-form-area"><div class="auth-form-card"><div class="auth-mobile-brand"><span class="brand-mark">E<span>+</span></span><strong>EDUCA+</strong></div><p class="eyebrow">ÁREA RESTRITA</p><h2>Acesse sua conta</h2><p class="auth-subtitle">Entre com as credenciais da sua conta de professor.</p>${message ? `<div class="inline-alert">${escapeHtml(message)}</div>` : ''}
        <form id="login-form" class="auth-form"><label class="field">E-mail<input type="email" name="email" autocomplete="username" placeholder="seuemail@exemplo.com" required></label><label class="field">Senha<div class="password-field"><input id="login-password" type="password" name="password" autocomplete="current-password" placeholder="Digite sua senha" required><button type="button" id="toggle-password" aria-label="Mostrar senha">◉</button></div></label><div class="auth-form-meta"><button type="button" class="text-button" id="forgot-password">Esqueci minha senha</button></div><button class="button button-primary button-full" type="submit">Entrar na plataforma</button><p id="login-feedback" class="form-feedback" role="status"></p></form>
        <p class="auth-security-note">${icon('check')} Acesso protegido por autenticação Supabase.</p><p class="auth-no-account">O cadastro de professores é controlado pelo administrador do projeto.</p></div></section>
    </main><div id="toast-region" class="toast-region" aria-live="polite"></div>`;
  root.querySelector('#toggle-password').addEventListener('click', () => {
    const input = root.querySelector('#login-password'); input.type = input.type === 'password' ? 'text' : 'password';
  });
  root.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const feedback = root.querySelector('#login-feedback');
    const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Autenticando...'; feedback.textContent = '';
    try { const result = await signIn(String(form.get('email')).trim(), String(form.get('password'))); await startApp(result.user); }
    catch (error) { feedback.textContent = errorMessage(error); }
    finally { if (root.querySelector('#login-form button[type="submit"]')) { button.disabled = false; button.textContent = 'Entrar na plataforma'; } }
  });
  root.querySelector('#forgot-password').addEventListener('click', async () => {
    const email = root.querySelector('[name="email"]').value.trim();
    if (!email) return toast('Digite seu e-mail para receber o link de recuperação.', 'warning');
    try { await sendPasswordRecovery(email); toast('Se a conta existir, você receberá um link de recuperação.'); }
    catch (error) { toast(errorMessage(error), 'error'); }
  });
}

function renderSetup() {
  root.innerHTML = `
    <main class="setup-screen"><section class="setup-card"><div class="auth-mobile-brand"><span class="brand-mark">E<span>+</span></span><strong>EDUCA+</strong></div><p class="eyebrow">CONFIGURAÇÃO INICIAL</p><h1>Conecte seu banco de dados</h1><p>O frontend foi carregado, mas faltam as credenciais públicas do seu projeto Supabase. Nenhum dado será salvo localmente como substituto do banco.</p><ol class="setup-steps"><li>Crie um projeto no <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">painel do Supabase</a>.</li><li>Abra <strong>Project Settings → API</strong> e copie a Project URL e a chave publicável (anon).</li><li>Na pasta do projeto, duplique <code>.env.example</code> e renomeie a cópia para <code>.env</code>.</li><li>Preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Não use a chave <code>service_role</code>.</li><li>Execute <code>database/schema.sql</code> no SQL Editor do Supabase e reinicie o servidor com <code>npm run dev</code>.</li></ol><div class="setup-note">Depois que o site for publicado, configure os mesmos valores como Secrets do GitHub Actions. Veja o README.md para o passo a passo completo.</div></section></main>`;
}

function renderPasswordRecovery() {
  root.innerHTML = `<main class="recovery-screen"><section class="auth-form-card"><p class="eyebrow">SEGURANÇA DA CONTA</p><h2>Defina uma nova senha</h2><p class="auth-subtitle">Use pelo menos oito caracteres.</p><form id="recovery-form" class="auth-form"><label class="field">Nova senha<input type="password" name="password" minlength="8" required></label><label class="field">Confirmar senha<input type="password" name="confirm" minlength="8" required></label><button class="button button-primary button-full" type="submit">Salvar nova senha</button></form></section></main><div id="toast-region" class="toast-region" aria-live="polite"></div>`;
  root.querySelector('#recovery-form').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get('password'));
    if (password !== form.get('confirm')) return toast('As senhas não correspondem.', 'warning');
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; toast('Senha atualizada. Faça login novamente.'); await supabase.auth.signOut(); }
    catch (error) { toast(errorMessage(error), 'error'); }
  });
}
