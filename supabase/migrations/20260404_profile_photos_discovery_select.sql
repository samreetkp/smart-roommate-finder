-- Allow reading profile photo rows for discoverable (visible) profiles, not only own rows.
drop policy if exists "profile_photos_owner_all" on public.profile_photos;

create policy "profile_photos_select_own_or_visible" on public.profile_photos
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.user_id = profile_photos.user_id
      and p.is_visible = true
  )
);

create policy "profile_photos_owner_insert" on public.profile_photos
for insert with check (auth.uid() = user_id);

create policy "profile_photos_owner_update" on public.profile_photos
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profile_photos_owner_delete" on public.profile_photos
for delete using (auth.uid() = user_id);
