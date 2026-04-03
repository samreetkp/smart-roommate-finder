-- Store full onboarding questionnaire + mini-games for compatibility matching.
alter table public.profiles
  add column if not exists onboarding_answers jsonb,
  add column if not exists mini_games jsonb,
  add column if not exists questionnaire_updated_at timestamptz;

comment on column public.profiles.onboarding_answers is 'Full onboarding questionnaire answers (OnboardingAnswerMap JSON).';
comment on column public.profiles.mini_games is 'Mini-game data used for lifestyle / conflict vectors.';
comment on column public.profiles.questionnaire_updated_at is 'Last time questionnaire JSON was saved.';
