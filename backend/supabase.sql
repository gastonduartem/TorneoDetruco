create table if not exists public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  paid boolean default false,
  created_at timestamptz default now()
);

create index if not exists inscriptions_created_at_idx on public.inscriptions (created_at desc);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  stage text default 'idle',
  current_head_index int default 0,
  pending_member_id uuid,
  group_count int,
  created_at timestamptz default now()
);

create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  inscription_id uuid references public.inscriptions(id) on delete set null,
  name text not null,
  phone text not null,
  created_at timestamptz default now()
);

create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  seed_index int not null,
  head_participant_id uuid references public.tournament_participants(id),
  second_participant_id uuid references public.tournament_participants(id),
  name text,
  created_at timestamptz default now()
);

create table if not exists public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  group_index int not null,
  name text not null
);

create table if not exists public.tournament_group_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  group_id uuid references public.tournament_groups(id) on delete cascade,
  team_id uuid references public.tournament_teams(id) on delete cascade,
  slot_index int not null
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  group_id uuid references public.tournament_groups(id) on delete cascade,
  round_index int not null,
  match_index int not null,
  home_team_id uuid references public.tournament_teams(id),
  away_team_id uuid references public.tournament_teams(id),
  home_score int,
  away_score int
);

create table if not exists public.tournament_bracket_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  round_index int not null,
  match_index int not null,
  bracket_type text default 'main',
  home_team_id uuid references public.tournament_teams(id),
  away_team_id uuid references public.tournament_teams(id),
  home_score int,
  away_score int,
  winner_team_id uuid references public.tournament_teams(id)
);

create index if not exists tournament_teams_idx on public.tournament_teams (tournament_id, seed_index);
create index if not exists tournament_groups_idx on public.tournament_groups (tournament_id, group_index);
create index if not exists tournament_matches_idx on public.tournament_matches (tournament_id, group_id, round_index);
create index if not exists tournament_bracket_idx on public.tournament_bracket_matches (tournament_id, round_index);
