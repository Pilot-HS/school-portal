-- One-time setup for "Substitute Cover" (temporary class access for a teacher).
-- In Supabase: SQL Editor -> New query -> paste ALL of this -> Run. Safe to run twice.

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

alter table public.teacher_cover enable row level security;
