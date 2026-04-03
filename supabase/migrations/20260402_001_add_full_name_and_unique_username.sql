-- Add account identity fields used at signup.
alter table public.users
  add column if not exists full_name text,
  add column if not exists username text;

-- Keep usernames normalized and safe.
alter table public.users
  drop constraint if exists users_username_format_check;

alter table public.users
  add constraint users_username_format_check
  check (
    username is null
    or username ~ '^[a-z0-9_]{3,30}$'
  );

-- Enforce case-insensitive uniqueness for usernames.
create unique index if not exists users_username_unique
  on public.users (lower(username))
  where username is not null;
