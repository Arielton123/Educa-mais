# EDUCA+ — Plataforma Inteligente de Gestão Escolar

Aplicação web independente para organização de turmas, estudantes, chamadas, diário de classe, avaliações, calendário e relatórios. O sistema utiliza Supabase para autenticação e persistência dos dados; o GitHub Pages hospeda apenas os arquivos estáticos do frontend.

> **Importante:** EDUCA+ é um projeto independente e não possui integração com o ISE, SOE-Auth ou sistemas da Secretaria da Educação. Use dados fictícios durante testes e apresentações. Não cadastre dados pessoais reais de estudantes neste projeto de demonstração.

## Funcionalidades implementadas

- Login por e-mail e senha com Supabase Auth; recuperação de senha e atualização de senha.
- Perfil do professor, limite configurável de alerta de frequência e tema claro/escuro.
- Cadastro, edição, pesquisa e exclusão de turmas e componentes curriculares.
- Cadastro, edição, pesquisa, vinculação e exclusão de estudantes.
- Chamada por turma, componente e data; marcação em massa de presentes; situações de presente, ausente, atrasado e falta justificada; edição de chamadas existentes e contadores dinâmicos.
- Diário de classe com conteúdo ministrado e atividades.
- Avaliações com média mínima configurável, cálculo da média da turma e identificação de notas abaixo do mínimo; lançamento/edição de notas individuais respeitando o valor máximo.
- Indicadores de frequência, relatório por período e exportação PDF.
- Calendário de eventos, alertas de baixa frequência e histórico de operações.
- Layout adaptável a computadores, tablets e celulares, com animações suaves e suporte a preferência por movimento reduzido.

## Tecnologias e versões-base

- HTML5, CSS3 e JavaScript com módulos ES.
- Vite `^6.0.5` (build e servidor de desenvolvimento).
- `@supabase/supabase-js` `^2.57.4` (Auth e PostgreSQL via Data API).
- Chart.js `^4.5.0` (gráfico do painel).
- jsPDF `^3.0.2` e jsPDF-AutoTable `^5.0.2` (relatórios PDF).
- Node.js 20 ou superior.

As versões com `^` permitem atualizações compatíveis dentro da versão principal. Para reproduzir exatamente uma instalação, mantenha o `package-lock.json` gerado pelo npm.

## 1. Criar o projeto Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie um projeto.
2. Guarde a senha do banco em local seguro. Ela não é usada no frontend.
3. No painel, abra **Project Settings → API** (ou a seção de API Keys, conforme a interface atual).
4. Copie a **Project URL** e a chave **publishable/anon**. A chave publicável pode estar identificada como `anon` em projetos/contas com a interface anterior.
5. **Nunca copie a chave `service_role` para este projeto, para o GitHub ou para arquivos `VITE_*`.**

## 2. Criar as tabelas e políticas de segurança

1. No painel Supabase, abra **SQL Editor**.
2. Escolha **New query**.
3. Abra o arquivo `database/schema.sql` deste repositório, copie todo o conteúdo e cole no editor SQL.
4. Clique em **Run** e confira se o editor terminou sem erros.
5. Em **Authentication → Providers → Email**, mantenha o provedor de e-mail habilitado. Não habilite cadastro público (sign ups) para este projeto de demonstração.

O SQL cria as tabelas, relacionamentos, índices, perfil automático no cadastro de usuário e políticas RLS. As tabelas com dados escolares usam `teacher_id` e as políticas autorizam apenas o UUID da conta autenticada. Chaves estrangeiras compostas também impedem vincular registros de professores diferentes.

## 3. Criar a conta do professor

O cadastro público pelo site não está habilitado intencionalmente. Para criar uma conta controlada:

1. No Supabase, abra **Authentication → Users**.
2. Clique em **Add user** / **Create new user**.
3. Informe um e-mail que você controla e uma senha inicial. Se houver a opção, confirme o e-mail para o usuário de teste.
4. Nos metadados do usuário, caso a interface permita, informe `full_name` com o nome de exibição. Caso contrário, o perfil começará com a parte do e-mail anterior ao `@` e poderá ser alterado nas Configurações do EDUCA+.
5. O trigger `on_auth_user_created` cria o perfil automaticamente.

Para uma apresentação escolar, crie apenas contas de teste e utilize nomes/matrículas fictícios.

## 4. Configurar e executar no computador

Instale [Node.js](https://nodejs.org/) versão 20 ou superior. Abra o terminal dentro da pasta `educa-mais` e execute:

```bash
npm install
```

Duplique o arquivo `.env.example`, renomeie a cópia para `.env` e preencha os valores:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICAVEL
VITE_BASE_PATH=/educa-mais/
```

A `VITE_SUPABASE_ANON_KEY` deve ser a chave publicável/anon. Não use `service_role`.

Inicie o projeto:

```bash
npm run dev
```

Abra no navegador o endereço local apresentado pelo Vite (normalmente `http://localhost:5173/`). O modo de desenvolvimento utiliza caminho-base `/`; a configuração de produção utiliza `/educa-mais/` por padrão.

## 5. Publicar no GitHub Pages

### Criar o repositório

1. No GitHub, crie um repositório chamado exatamente `educa-mais` (ou altere `VITE_BASE_PATH` no workflow se escolher outro nome).
2. Envie todos os arquivos desta pasta para a branch `main`, incluindo a pasta `.github/workflows`.
3. Não envie o arquivo `.env`. Ele é ignorado pelo `.gitignore`.

### Cadastrar as credenciais de build

1. No repositório, abra **Settings → Secrets and variables → Actions**.
2. Clique em **New repository secret**.
3. Crie `VITE_SUPABASE_URL` com a Project URL do Supabase.
4. Crie `VITE_SUPABASE_ANON_KEY` com a chave publicável/anon do Supabase.
5. Não crie secret com a chave `service_role`.

### Habilitar Pages

1. Abra **Settings → Pages**.
2. Em **Build and deployment**, escolha **GitHub Actions** como Source.
3. Vá até **Actions** e acompanhe o workflow **Publicar EDUCA+ no GitHub Pages**. Ele instala as dependências com `npm install`, executa `npm run build` e publica a pasta `dist`.
4. Ao concluir, o endereço será semelhante a `https://SEU-USUARIO.github.io/educa-mais/`.

O workflow usa `VITE_BASE_PATH=/educa-mais/`. Se o repositório tiver outro nome, altere esse valor em `.github/workflows/deploy.yml` e em `VITE_BASE_PATH` no ambiente de desenvolvimento/produção.

### URLs de autenticação

No painel Supabase, abra **Authentication → URL Configuration** e configure:

- **Site URL:** endereço final do GitHub Pages, por exemplo `https://SEU-USUARIO.github.io/educa-mais/`.
- **Redirect URLs:** inclua o endereço de produção acima e `http://localhost:5173/` para desenvolvimento.

A URL exata do seu repositório deve ser usada; não copie literalmente os exemplos com `SEU-USUARIO`.

## 6. Como atualizar o site

Edite os arquivos localmente, teste com `npm run dev`, faça commit e envie para `main`. O GitHub Actions executará o build e publicará a nova versão automaticamente. Alterações em tabelas devem ser feitas no SQL Editor do Supabase e documentadas em novos arquivos de migração, preservando os dados já existentes.

## Estrutura do projeto

```text
educa-mais/
├── .github/workflows/deploy.yml
├── database/schema.sql
├── public/favicon.svg
├── src/
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       ├── main.js
│       ├── modules/
│       │   ├── attendance.js
│       │   ├── assessments.js
│       │   ├── calendar.js
│       │   ├── classes.js
│       │   ├── dashboard.js
│       │   ├── diary.js
│       │   ├── history.js
│       │   ├── reports.js
│       │   ├── settings.js
│       │   └── students.js
│       ├── services/
│       │   ├── auth.js
│       │   ├── data.js
│       │   └── supabase.js
│       └── utils/
│           ├── helpers.js
│           └── icons.js
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── README.md
└── vite.config.js
```

## Regras de frequência utilizadas no painel e relatório

- **Presente:** conta como participação.
- **Atrasado:** conta como participação.
- **Ausente:** não conta como participação.
- **Falta justificada:** não conta como participação e permanece no total de registros considerados.

Percentual exibido = `(presentes + atrasados) / registros de frequência × 100`. O alerta de baixa frequência compara esse resultado ao limite configurado no perfil. Confirme as regras oficiais da instituição antes de utilizar esses indicadores para decisões escolares.

## Limitações conhecidas desta primeira versão

- Não há integração com Escola RS, ISE, SOE-Auth ou sistemas governamentais.
- Não há cadastro aberto de professores; a criação de contas é feita por um administrador do projeto no painel Supabase.
- A chamada requer conexão com a internet. Não foi implementada fila offline/sincronização posterior.
- O calendário é uma lista cronológica de eventos, não uma grade mensal com arrastar e soltar.
- Os relatórios PDF concentram-se na frequência. O histórico de notas é consultado na tela de avaliações.
- O sistema deve passar por testes com contas e dados fictícios no seu próprio projeto Supabase antes de ser usado em qualquer contexto real.

## Referências técnicas

- [Escola RS — Professor (referência funcional)](https://servicos.rs.gov.br/servico/4241/escola-rs-professor)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/installing)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vite — Deploy estático e GitHub Pages](https://vite.dev/guide/static-deploy.html)
- [GitHub Pages](https://docs.github.com/pt/pages)
