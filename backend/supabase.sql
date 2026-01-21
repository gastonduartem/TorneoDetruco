create table if not exists public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  paid boolean default false,
  created_at timestamptz default now()
);

create index if not exists inscriptions_created_at_idx on public.inscriptions (created_at desc);
