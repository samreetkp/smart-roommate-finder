-- Store first/last name separately (in addition to full_name used by profiles).
alter table public.users
  add column if not exists first_name text,
  add column if not exists last_name text;

