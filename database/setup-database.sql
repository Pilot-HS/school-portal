-- ONE-TIME DATABASE SETUP for the school portal
-- (MCQ, Substitute Cover, Activity Log, Holidays, Settings, "Late" attendance, Editable website)
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

-- Holidays (whole school when class_id is empty, otherwise one class)
create table if not exists public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  holiday_date date not null,
  reason text not null,
  class_id text,
  created_by text
);
create unique index if not exists school_holidays_unique on public.school_holidays (holiday_date, coalesce(class_id, 'all'));

-- Small school-wide settings (attendance lock days, low-attendance limit)
create table if not exists public.portal_settings (
  key text primary key,
  value text not null
);

-- ===== Editable school website =====
create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null,
  parent_id uuid references public.site_pages(id) on delete cascade,
  title text not null,
  menu_label text,
  position integer not null default 0,
  show_in_menu boolean not null default true,
  is_home boolean not null default false,
  seo_description text,
  draft jsonb not null default '[]'::jsonb,
  published jsonb not null default '[]'::jsonb,
  has_unpublished boolean not null default false,
  published_at timestamptz,
  updated_by text
);
create unique index if not exists site_pages_slug_unique on public.site_pages (coalesce(parent_id::text, 'root'), slug);

create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_id uuid not null references public.site_pages(id) on delete cascade,
  created_by text,
  content jsonb not null,
  note text
);
create index if not exists site_versions_page_idx on public.site_versions (page_id, created_at desc);

create table if not exists public.site_settings (
  key text primary key,
  draft jsonb,
  published jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null,
  url text not null,
  alt text,
  size integer,
  uploaded_by text
);

-- People allowed to edit the website besides the admins (teachers, students, parents)
create table if not exists public.site_editors (
  user_id text primary key,
  created_at timestamptz not null default now(),
  can_publish boolean not null default false,
  expires_at timestamptz,
  granted_by text,
  note text
);

-- A public place for the website's pictures
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do nothing;

-- Only the portal's server can read or change these tables.
alter table public.mcq_questions enable row level security;
alter table public.mcq_papers enable row level security;
alter table public.teacher_cover enable row level security;
alter table public.audit_log enable row level security;
alter table public.school_holidays enable row level security;
alter table public.portal_settings enable row level security;
alter table public.site_pages enable row level security;
alter table public.site_versions enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_media enable row level security;
alter table public.site_editors enable row level security;

-- Allow the new "late" attendance status.
-- (Removes an old rule that only allowed present/absent/leave, if there is one.)
do $$
declare
  r record;
  enum_name text;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.attendance'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.attendance drop constraint %I', r.conname);
  end loop;

  select ty.typname into enum_name
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_type ty on ty.oid = a.atttypid
  where c.relname = 'attendance'
    and c.relnamespace = 'public'::regnamespace
    and a.attname = 'status'
    and ty.typtype = 'e';

  if enum_name is not null then
    execute format('alter type public.%I add value if not exists %L', enum_name, 'late');
  end if;
end $$;
