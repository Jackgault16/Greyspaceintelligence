-- 2026-03-01: Brief Documents for Briefing Room
-- Adds first-class briefing documents while preserving existing event brief tables.

create extension if not exists pgcrypto;

create table if not exists public.brief_documents (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    brief_type text not null check (brief_type in ('scheduled', 'regional', 'special')),
    brief_subtype text not null,
    status text not null default 'ongoing' check (status in ('ongoing', 'developing', 'resolved')),
    confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
    impact_level text not null default 'noise' check (impact_level in ('strategic', 'operational', 'tactical', 'noise')),
    risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
    priority_level text not null default 'medium' check (priority_level in ('low', 'medium', 'high')),
    region text,
    category text,
    tags text[] not null default '{}',
    summary text not null default '',
    why_it_matters text not null default '',
    details text not null default '',
    key_points text[] not null default '{}',
    indicators text[] not null default '{}',
    sources text[] not null default '{}',
    canonical_url text,
    publish_to text[] not null default '{briefing_room}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.brief_document_items (
    id uuid primary key default gen_random_uuid(),
    brief_document_id uuid not null references public.brief_documents(id) on delete cascade,
    event_table text not null default 'briefing_room',
    event_id text not null,
    created_at timestamptz not null default now(),
    unique (brief_document_id, event_table, event_id)
);

create table if not exists public.brief_templates (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    brief_type text not null check (brief_type in ('scheduled', 'regional', 'special')),
    brief_subtype text not null,
    description text not null default '',
    template_summary text not null default '',
    template_body text not null default '',
    default_tags text[] not null default '{}',
    default_key_points text[] not null default '{}',
    default_indicators text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_brief_documents_updated_at on public.brief_documents(updated_at desc);
create index if not exists idx_brief_documents_type_subtype on public.brief_documents(brief_type, brief_subtype);
create index if not exists idx_brief_documents_region on public.brief_documents(region);
create index if not exists idx_brief_documents_category on public.brief_documents(category);
create index if not exists idx_brief_documents_publish_to_gin on public.brief_documents using gin (publish_to);
create index if not exists idx_brief_documents_tags_gin on public.brief_documents using gin (tags);
create index if not exists idx_brief_document_items_brief_id on public.brief_document_items(brief_document_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_brief_documents_updated_at on public.brief_documents;
create trigger trg_brief_documents_updated_at
before update on public.brief_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_brief_templates_updated_at on public.brief_templates;
create trigger trg_brief_templates_updated_at
before update on public.brief_templates
for each row execute function public.set_updated_at();

alter table public.brief_documents enable row level security;
alter table public.brief_document_items enable row level security;
alter table public.brief_templates enable row level security;

drop policy if exists "brief_documents_public_read" on public.brief_documents;
create policy "brief_documents_public_read"
on public.brief_documents
for select
to anon, authenticated
using (true);

drop policy if exists "brief_documents_auth_write" on public.brief_documents;
create policy "brief_documents_auth_write"
on public.brief_documents
for all
to authenticated
using (true)
with check (true);

drop policy if exists "brief_document_items_public_read" on public.brief_document_items;
create policy "brief_document_items_public_read"
on public.brief_document_items
for select
to anon, authenticated
using (true);

drop policy if exists "brief_document_items_auth_write" on public.brief_document_items;
create policy "brief_document_items_auth_write"
on public.brief_document_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "brief_templates_public_read" on public.brief_templates;
create policy "brief_templates_public_read"
on public.brief_templates
for select
to anon, authenticated
using (true);

drop policy if exists "brief_templates_auth_write" on public.brief_templates;
create policy "brief_templates_auth_write"
on public.brief_templates
for all
to authenticated
using (true)
with check (true);
