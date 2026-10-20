-- ONE-TIME DATABASE SETUP for the school portal
-- (MCQ question bank, Substitute Cover and the Activity Log)
-- In Supabase: SQL Editor -> New query -> paste ALL of this -> press Run.
-- Safe to run more than once.

create table if not exists public.mcq_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  class_id text,
  subject_id text,
  topic text,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A','B','C','D'))
);

create table if not exists public.mcq_papers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by text,
  title text not null,
  class_id text,
  subject_id text,
  instructions text,
  duration_minutes integer,
  marks_per_question numeric not null default 1,
  questions jsonb not null
);

create table if not exists public.teacher_cover (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  teacher_id text not null,
  class_id text not null,
  start_date date not null,
  end_date date not null,
  note text,
  created_by text
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id text,
  action text not null,
  summary text not null,
  details jsonb
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- Only the portal's server can read or change these tables.
alter table public.mcq_questions enable row level security;
alter table public.mcq_papers enable row level security;
alter table public.teacher_cover enable row level security;
alter table public.audit_log enable row level security;
