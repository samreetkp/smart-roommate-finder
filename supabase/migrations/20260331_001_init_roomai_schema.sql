-- RoomAi initial schema for Supabase/Postgres
-- Safe to run in Supabase SQL editor or as a migration file.

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_user_status') then
    create type app_user_status as enum ('active', 'paused', 'banned');
  end if;
  if not exists (select 1 from pg_type where typname = 'swipe_action') then
    create type swipe_action as enum ('like', 'pass', 'superlike');
  end if;
  if not exists (select 1 from pg_type where typname = 'match_status') then
    create type match_status as enum ('active', 'unmatched', 'blocked');
  end if;
end $$;

-- Keep all app tables in public for Supabase defaults.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  status app_user_status not null default 'active',
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text not null,
  age int check (age >= 18 and age <= 120),
  gender text,
  bio text,
  city text,
  budget_min int check (budget_min >= 0),
  budget_max int check (budget_max >= budget_min),
  move_in_date date,
  pets_ok boolean not null default false,
  smoking_ok boolean not null default false,
  work_style text check (work_style in ('remote', 'office', 'hybrid')),
  sleep_schedule text check (sleep_schedule in ('early_bird', 'night_owl', 'flexible')),
  cleanliness_level int check (cleanliness_level between 1 and 10),
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  position int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('behavior', 'preference', 'values', 'conflict_style')),
  question_text text not null,
  answer_type text not null check (answer_type in ('scale', 'single_choice', 'multi_choice', 'boolean')),
  options_json jsonb not null default '[]'::jsonb,
  weight_default numeric(5,2) not null default 1.00,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  answer_json jsonb not null,
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_type text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score_json jsonb not null default '{}'::jsonb
);

create table if not exists public.trait_vectors (
  user_id uuid primary key references public.users(id) on delete cascade,
  cleanliness_trait numeric(5,2),
  social_energy_trait numeric(5,2),
  conflict_style_trait numeric(5,2),
  noise_tolerance_trait numeric(5,2),
  routine_flexibility_trait numeric(5,2),
  reliability_trait numeric(5,2),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  preferred_city text,
  budget_min int check (budget_min >= 0),
  budget_max int check (budget_max >= budget_min),
  preferred_sleep_schedule text check (preferred_sleep_schedule in ('early_bird', 'night_owl', 'flexible')),
  preferred_cleanliness_min int check (preferred_cleanliness_min between 1 and 10),
  pets_required boolean,
  smoking_allowed boolean,
  dealbreakers_json jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.compatibility_scores (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users(id) on delete cascade,
  user_b_id uuid not null references public.users(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  breakdown_json jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  unique (user_a_id, user_b_id),
  check (user_a_id <> user_b_id)
);

create table if not exists public.recommendation_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  candidate_user_id uuid not null references public.users(id) on delete cascade,
  compatibility_score numeric(5,2) not null check (compatibility_score between 0 and 100),
  rank int not null check (rank > 0),
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (user_id, candidate_user_id),
  check (user_id <> candidate_user_id)
);

create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  action swipe_action not null,
  created_at timestamptz not null default now(),
  unique (from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_1_id uuid not null references public.users(id) on delete cascade,
  user_2_id uuid not null references public.users(id) on delete cascade,
  matched_at timestamptz not null default now(),
  status match_status not null default 'active',
  canonical_user_low uuid generated always as (least(user_1_id, user_2_id)) stored,
  canonical_user_high uuid generated always as (greatest(user_1_id, user_2_id)) stored,
  check (user_1_id <> user_2_id),
  unique (canonical_user_low, canonical_user_high)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.outcome_feedback (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  rating int check (rating between 1 and 5),
  lived_together boolean,
  feedback_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (match_id, from_user_id)
);

-- Indexes
create index if not exists idx_profiles_city on public.profiles(city);
create index if not exists idx_profiles_visible on public.profiles(is_visible);
create index if not exists idx_swipes_from_created on public.swipes(from_user_id, created_at desc);
create index if not exists idx_swipes_to_action on public.swipes(to_user_id, action);
create index if not exists idx_compatibility_a_score on public.compatibility_scores(user_a_id, score desc);
create index if not exists idx_recommendation_user_rank on public.recommendation_feed(user_id, rank);
create index if not exists idx_messages_conv_sent on public.messages(conversation_id, sent_at);

-- Trigger function for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_trait_vectors_updated_at on public.trait_vectors;
create trigger trg_trait_vectors_updated_at
before update on public.trait_vectors
for each row execute function public.set_updated_at();

drop trigger if exists trg_match_preferences_updated_at on public.match_preferences;
create trigger trg_match_preferences_updated_at
before update on public.match_preferences
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.user_answers enable row level security;
alter table public.game_sessions enable row level security;
alter table public.trait_vectors enable row level security;
alter table public.match_preferences enable row level security;
alter table public.recommendation_feed enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.outcome_feedback enable row level security;

-- Users table policies
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users
for select using (auth.uid() = id);

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
for insert with check (auth.uid() = id);

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
for update using (auth.uid() = id) with check (auth.uid() = id);

-- Profiles are public for discovery if visible.
drop policy if exists "profiles_public_visible_select" on public.profiles;
create policy "profiles_public_visible_select" on public.profiles
for select using (is_visible = true or auth.uid() = user_id);

drop policy if exists "profiles_owner_write" on public.profiles;
create policy "profiles_owner_write" on public.profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Owner-only tables
drop policy if exists "profile_photos_owner_all" on public.profile_photos;
create policy "profile_photos_owner_all" on public.profile_photos
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_answers_owner_all" on public.user_answers;
create policy "user_answers_owner_all" on public.user_answers
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "game_sessions_owner_all" on public.game_sessions;
create policy "game_sessions_owner_all" on public.game_sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "trait_vectors_owner_all" on public.trait_vectors;
create policy "trait_vectors_owner_all" on public.trait_vectors
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "match_preferences_owner_all" on public.match_preferences;
create policy "match_preferences_owner_all" on public.match_preferences
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recommendation_feed_owner_select" on public.recommendation_feed;
create policy "recommendation_feed_owner_select" on public.recommendation_feed
for select using (auth.uid() = user_id);

drop policy if exists "swipes_owner_all" on public.swipes;
create policy "swipes_owner_all" on public.swipes
for all using (auth.uid() = from_user_id) with check (auth.uid() = from_user_id);

drop policy if exists "matches_participant_select" on public.matches;
create policy "matches_participant_select" on public.matches
for select using (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "matches_participant_update" on public.matches;
create policy "matches_participant_update" on public.matches
for update using (auth.uid() = user_1_id or auth.uid() = user_2_id)
with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

drop policy if exists "conversations_match_participant_select" on public.conversations;
create policy "conversations_match_participant_select" on public.conversations
for select using (
  exists (
    select 1
    from public.matches m
    where m.id = conversations.match_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

drop policy if exists "messages_conversation_participant_select" on public.messages;
create policy "messages_conversation_participant_select" on public.messages
for select using (
  exists (
    select 1
    from public.conversations c
    join public.matches m on m.id = c.match_id
    where c.id = messages.conversation_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

drop policy if exists "messages_conversation_participant_insert" on public.messages;
create policy "messages_conversation_participant_insert" on public.messages
for insert with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    join public.matches m on m.id = c.match_id
    where c.id = messages.conversation_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

drop policy if exists "outcome_feedback_owner_all" on public.outcome_feedback;
create policy "outcome_feedback_owner_all" on public.outcome_feedback
for all using (auth.uid() = from_user_id) with check (auth.uid() = from_user_id);

-- Read-only for app seed/config tables through service role only by default.
alter table public.question_bank enable row level security;
drop policy if exists "question_bank_public_read" on public.question_bank;
create policy "question_bank_public_read" on public.question_bank
for select using (active = true);

