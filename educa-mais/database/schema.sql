-- EDUCA+ | Banco PostgreSQL para Supabase
-- Execute o arquivo inteiro no SQL Editor do seu projeto Supabase.
-- Cada registro de negócio pertence a um único professor (teacher_id = auth.uid()).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Professor(a)',
  low_attendance_threshold integer not null default 75 check (low_attendance_threshold between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  school_year text not null,
  shift text not null check (shift in ('Manhã','Tarde','Noite','Integral')),
  created_at timestamptz not null default now(),
  unique (id, teacher_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id, teacher_id),
  unique (teacher_id, name)
);

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  unique (id, teacher_id),
  unique (class_id, subject_id),
  unique (id, class_id, subject_id, teacher_id),
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade,
  foreign key (subject_id, teacher_id) references public.subjects(id, teacher_id) on delete cascade
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 160),
  registration_code text not null check (length(trim(registration_code)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (id, teacher_id),
  unique (teacher_id, registration_code)
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null,
  student_id uuid not null,
  enrollment_date date not null default current_date,
  unique (class_id, student_id),
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade,
  foreign key (student_id, teacher_id) references public.students(id, teacher_id) on delete cascade
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_subject_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  lesson_date date not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  unique (class_id, subject_id, lesson_date),
  foreign key (class_subject_id, class_id, subject_id, teacher_id)
    references public.class_subjects(id, class_id, subject_id, teacher_id) on delete cascade,
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade,
  foreign key (subject_id, teacher_id) references public.subjects(id, teacher_id) on delete cascade
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  student_id uuid not null,
  status text not null check (status in ('present','absent','late','excused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id),
  foreign key (session_id, teacher_id) references public.attendance_sessions(id, teacher_id) on delete cascade,
  foreign key (student_id, teacher_id) references public.students(id, teacher_id) on delete cascade
);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_subject_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  lesson_date date not null,
  content text not null check (length(trim(content)) > 0),
  activities text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (class_subject_id, class_id, subject_id, teacher_id)
    references public.class_subjects(id, class_id, subject_id, teacher_id) on delete cascade,
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade,
  foreign key (subject_id, teacher_id) references public.subjects(id, teacher_id) on delete cascade
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_subject_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 140),
  assessment_date date not null,
  max_score numeric(5,2) not null default 10 check (max_score > 0 and max_score <= 1000),
  minimum_score numeric(5,2) not null default 6,
  constraint assessments_minimum_score_check check (minimum_score >= 0 and minimum_score <= max_score),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  foreign key (class_subject_id, class_id, subject_id, teacher_id)
    references public.class_subjects(id, class_id, subject_id, teacher_id) on delete cascade,
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade,
  foreign key (subject_id, teacher_id) references public.subjects(id, teacher_id) on delete cascade
);

-- Mantém a coluna disponível caso o schema seja atualizado em um banco já criado.
alter table public.assessments
  add column if not exists minimum_score numeric(5,2) not null default 6;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessments_minimum_score_check'
      and conrelid = 'public.assessments'::regclass
  ) then
    alter table public.assessments
      add constraint assessments_minimum_score_check
      check (minimum_score >= 0 and minimum_score <= max_score);
  end if;
end $$;

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null,
  student_id uuid not null,
  score numeric(6,2) not null check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id),
  foreign key (assessment_id, teacher_id) references public.assessments(id, teacher_id) on delete cascade,
  foreign key (student_id, teacher_id) references public.students(id, teacher_id) on delete cascade
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid,
  title text not null check (length(trim(title)) between 1 and 140),
  event_type text not null default 'event' check (event_type in ('class','assessment','meeting','event','deadline')),
  event_date date not null,
  details text not null default '',
  created_at timestamptz not null default now(),
  foreign key (class_id, teacher_id) references public.classes(id, teacher_id) on delete cascade
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- Perfil criado automaticamente para cada usuário criado no painel Auth do Supabase.
create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'Professor(a)'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_teacher();

-- Índices usados nas consultas de listas, chamadas e relatórios.
create index if not exists idx_classes_teacher on public.classes(teacher_id, name);
create index if not exists idx_students_teacher on public.students(teacher_id, full_name);
create index if not exists idx_enrollments_class on public.enrollments(teacher_id, class_id);
create index if not exists idx_attendance_sessions_class_date on public.attendance_sessions(teacher_id, class_id, lesson_date desc);
create index if not exists idx_attendance_records_session on public.attendance_records(teacher_id, session_id);
create index if not exists idx_diary_date on public.diary_entries(teacher_id, lesson_date desc);
create index if not exists idx_assessments_date on public.assessments(teacher_id, assessment_date desc);
create index if not exists idx_calendar_date on public.calendar_events(teacher_id, event_date);
create index if not exists idx_activity_logs_created on public.activity_logs(teacher_id, created_at desc);

-- RLS: usuários autenticados só podem acessar registros vinculados ao próprio UUID.
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.diary_entries enable row level security;
alter table public.assessments enable row level security;
alter table public.grades enable row level security;
alter table public.calendar_events enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Policies de propriedade para todas as tabelas com teacher_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'classes','subjects','class_subjects','students','enrollments',
    'attendance_sessions','attendance_records','diary_entries','assessments',
    'grades','calendar_events','activity_logs'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()))',
      table_name || '_owner_all', table_name
    );
  end loop;
end $$;

-- Permissões mínimas para o cliente Supabase. RLS continua sendo obrigatória.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.classes, public.subjects, public.class_subjects,
  public.students, public.enrollments, public.attendance_sessions,
  public.attendance_records, public.diary_entries, public.assessments,
  public.grades, public.calendar_events, public.activity_logs
  to authenticated;

-- IMPORTANTE: não crie policy para anon e não coloque service_role no frontend.
