create table if not exists public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text not null unique,
  status text default 'pendiente',
  paid boolean default false,
  confirmed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists inscriptions_created_at_idx on public.inscriptions (created_at desc);
