create table if not exists public.brief_document_pins (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.brief_documents(id) on delete cascade,

  label text,
  latitude double precision not null,
  longitude double precision not null,

  region text,
  category text,
  risk_level text check (risk_level in ('low','medium','high')),

  event_id uuid,

  created_at timestamptz not null default now()
);

create index if not exists idx_brief_document_pins_brief
  on public.brief_document_pins (brief_id);

alter table public.brief_document_pins enable row level security;

drop policy if exists "brief_document_pins_public_read" on public.brief_document_pins;
create policy "brief_document_pins_public_read"
on public.brief_document_pins
for select
using (true);

drop policy if exists "brief_document_pins_admin_write" on public.brief_document_pins;
create policy "brief_document_pins_admin_write"
on public.brief_document_pins
for all
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');
