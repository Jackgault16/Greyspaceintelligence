create extension if not exists pgcrypto;

create table if not exists public.countries (
  iso2 text primary key,
  iso3 text unique,
  name text not null,
  capital text,
  region text,
  centroid double precision[],
  bbox double precision[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.country_profiles (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null references public.countries(iso2) on delete cascade,
  category text not null check (category in ('political','military','economic','social','greyspace')),
  metrics jsonb not null default '{}'::jsonb,
  narrative text,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (iso2, category)
);

create table if not exists public.country_pois (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null references public.countries(iso2) on delete cascade,
  category text not null check (category in ('political','military','economic','social','greyspace')),
  poi_type text,
  name text,
  latitude double precision not null,
  longitude double precision not null,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  notes text,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_country_profiles_iso2_category on public.country_profiles (iso2, category);
create index if not exists idx_country_pois_iso2_category on public.country_pois (iso2, category);

do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace
  ) then
    create function public.set_updated_at()
    returns trigger
    language plpgsql
    as $f$
    begin
      new.updated_at = now();
      return new;
    end;
    $f$;
  end if;
end
$$;

drop trigger if exists trg_countries_updated_at on public.countries;
create trigger trg_countries_updated_at before update on public.countries
for each row execute function public.set_updated_at();

drop trigger if exists trg_country_profiles_updated_at on public.country_profiles;
create trigger trg_country_profiles_updated_at before update on public.country_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_country_pois_updated_at on public.country_pois;
create trigger trg_country_pois_updated_at before update on public.country_pois
for each row execute function public.set_updated_at();

alter table public.countries enable row level security;
alter table public.country_profiles enable row level security;
alter table public.country_pois enable row level security;

drop policy if exists "countries_public_read" on public.countries;
create policy "countries_public_read" on public.countries for select using (true);

drop policy if exists "country_profiles_public_read" on public.country_profiles;
create policy "country_profiles_public_read" on public.country_profiles for select using (true);

drop policy if exists "country_pois_public_read" on public.country_pois;
create policy "country_pois_public_read" on public.country_pois for select using (true);

drop policy if exists "countries_admin_write" on public.countries;
create policy "countries_admin_write" on public.countries for all
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "country_profiles_admin_write" on public.country_profiles;
create policy "country_profiles_admin_write" on public.country_profiles for all
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "country_pois_admin_write" on public.country_pois;
create policy "country_pois_admin_write" on public.country_pois for all
using ((auth.jwt() ->> 'role') = 'admin')
with check ((auth.jwt() ->> 'role') = 'admin');
