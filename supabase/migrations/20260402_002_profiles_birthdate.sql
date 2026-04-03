-- Store date of birth; age is kept in sync for search/display (also derivable from birthdate).
alter table public.profiles
  add column if not exists birthdate date;

comment on column public.profiles.birthdate is 'User date of birth; age column should reflect years since birthdate.';

alter table public.profiles
  drop constraint if exists profiles_birthdate_valid_range;

alter table public.profiles
  add constraint profiles_birthdate_valid_range
  check (
    birthdate is null
    or (
      birthdate <= current_date
      and birthdate >= (current_date - interval '120 years')::date
      and birthdate <= (current_date - interval '18 years')::date
    )
  );
