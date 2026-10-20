-- One-time setup for the MCQ question bank and papers.
-- In Supabase: open "SQL Editor" -> "New query" -> paste ALL of this -> press "Run".
-- It is safe to run twice.

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

-- Only the portal's server can read or change these tables.
alter table public.mcq_questions enable row level security;
alter table public.mcq_papers enable row level security;
