-- Storage bucket and policies for profile photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read" on storage.objects
for select using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_owner_insert" on storage.objects;
create policy "profile_photos_owner_insert" on storage.objects
for insert with check (
  bucket_id = 'profile-photos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_owner_update" on storage.objects;
create policy "profile_photos_owner_update" on storage.objects
for update using (
  bucket_id = 'profile-photos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "profile_photos_owner_delete" on storage.objects;
create policy "profile_photos_owner_delete" on storage.objects
for delete using (
  bucket_id = 'profile-photos'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);
