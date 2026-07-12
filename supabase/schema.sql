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

create index if not exists leads_lead_score_idx on leads (lead_score desc nulls last);
create index if not exists leads_follow_up_idx on leads (follow_up_at) where follow_up_at is not null;
create index if not exists leads_crm_status_idx on leads (crm_status);

-- NOT: Bu sistem yalnizca sunucu tarafindan (service_role key ile) erisiliyor.
-- service_role anahtari RLS'i bypass eder. Tabloyu public'e acmiyoruz.
-- Ileride tarayicidan dogrudan erisim istersen RLS politikalari eklenmeli.
alter table leads enable row level security;
