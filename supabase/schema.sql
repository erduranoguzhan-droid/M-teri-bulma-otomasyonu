-- Vertex Lead Gen - Supabase sema
-- Kurulum: Supabase projesi > SQL Editor > bu dosyayi yapistir > Run.

create table if not exists leads (
  id uuid primary key,
  stage text not null,
  crm_status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,

  -- Sorgu/siralama icin analizden yukseltilen alan
  lead_score int,

  -- Outreach / takip
  contacted_at timestamptz,
  contact_channel text,
  follow_up_at timestamptz,
  deal_value bigint,

  -- Tekrar eklemeyi onlemek icin (website veya isim|telefon)
  dedupe_key text unique not null,

  -- Ic ice veriler JSONB olarak
  raw jsonb not null,
  enrichment jsonb,
  analysis jsonb,
  outreach jsonb
);

-- Ic ice veriler JSONB olarak (firma-bazli AI intelligence)
-- Bu iki sutun mevcut leads tablosuna additive eklenir (sektor modu etkilenmez).

-- Mevcut tablolara sonradan eklenen sutunlar (idempotent).
alter table leads add column if not exists deal_value bigint;
alter table leads add column if not exists scan_mode text;
alter table leads add column if not exists intelligence jsonb;
-- Bir lead'i hangi tarama uretti (Tarama Gecmisi icin).
alter table leads add column if not exists scan_id uuid;

create index if not exists leads_lead_score_idx on leads (lead_score desc nulls last);
create index if not exists leads_follow_up_idx on leads (follow_up_at) where follow_up_at is not null;
create index if not exists leads_crm_status_idx on leads (crm_status);
create index if not exists leads_scan_idx on leads (scan_id);

-- ---------------------------------------------------------------------------
-- TARAMA GECMISI (scans + scan_logs) — her tarama kalici kayit.
-- ---------------------------------------------------------------------------
create table if not exists scans (
  id uuid primary key,
  name text not null,
  mode text not null,               -- 'sector' | 'company'
  status text not null,             -- 'running' | 'completed' | 'cancelled' | 'error'
  city text,
  districts text,                   -- virgulle
  categories text,                  -- virgulle
  query_total int not null default 0,
  found_count int not null default 0,
  lead_count int not null default 0,
  avg_score int,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_s int,
  params jsonb,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists scans_started_idx on scans (started_at desc);
create index if not exists scans_status_idx on scans (status);

create table if not exists scan_logs (
  id bigint generated always as identity primary key,
  scan_id uuid not null references scans(id) on delete cascade,
  ts timestamptz not null default now(),
  level text not null default 'info',   -- 'info' | 'success' | 'warn' | 'error'
  phase text,
  message text not null,
  meta jsonb
);
create index if not exists scan_logs_scan_idx on scan_logs (scan_id, ts);

-- ---------------------------------------------------------------------------
-- CRM: aktivite/gorev/not/mesaj (lead_id -> leads.id). Faz 6'da UI baglanir.
-- ---------------------------------------------------------------------------
create table if not exists activities (
  id bigint generated always as identity primary key,
  lead_id uuid not null,
  type text not null,               -- 'status' | 'contact' | 'note' | 'task' | 'system'
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_lead_idx on activities (lead_id, created_at desc);

create table if not exists tasks (
  id uuid primary key,
  lead_id uuid not null,
  title text not null,
  due_at timestamptz,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_lead_idx on tasks (lead_id);
create index if not exists tasks_due_idx on tasks (due_at) where done = false;

create table if not exists notes (
  id uuid primary key,
  lead_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists notes_lead_idx on notes (lead_id, created_at desc);

create table if not exists messages (
  id uuid primary key,
  lead_id uuid not null,
  channel text not null,            -- 'whatsapp' | 'email'
  body text,
  sent_at timestamptz not null default now()
);
create index if not exists messages_lead_idx on messages (lead_id, sent_at desc);

-- NOT: Bu sistem yalnizca sunucu tarafindan (service_role key ile) erisiliyor.
-- service_role anahtari RLS'i bypass eder. Tablolari public'e acmiyoruz.
-- Ileride tarayicidan dogrudan erisim istersen RLS politikalari eklenmeli.
alter table leads enable row level security;
alter table scans enable row level security;
alter table scan_logs enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table notes enable row level security;
alter table messages enable row level security;
