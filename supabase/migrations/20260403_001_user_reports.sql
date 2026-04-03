-- Reports from users (e.g. swipe deck). Admins review via service role / dashboard.
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  reported_user_id uuid references public.users(id) on delete set null,
  subject_display_name text not null,
  subject_external_key text,
  reason text not null,
  details text,
  source text not null default 'swipe_deck',
  created_at timestamptz not null default now(),
  constraint user_reports_reason_check check (
    reason in (
      'harassment',
      'fake_profile',
      'scam',
      'inappropriate_content',
      'spam',
      'other'
    )
  ),
  constraint user_reports_no_self_report check (
    reported_user_id is null or reporter_id <> reported_user_id
  )
);

create index if not exists idx_user_reports_created on public.user_reports (created_at desc);
create index if not exists idx_user_reports_reporter on public.user_reports (reporter_id);

alter table public.user_reports enable row level security;

drop policy if exists "user_reports_insert_as_reporter" on public.user_reports;
create policy "user_reports_insert_as_reporter" on public.user_reports
for insert with check (auth.uid() = reporter_id);

drop policy if exists "user_reports_select_own" on public.user_reports;
create policy "user_reports_select_own" on public.user_reports
for select using (auth.uid() = reporter_id);
