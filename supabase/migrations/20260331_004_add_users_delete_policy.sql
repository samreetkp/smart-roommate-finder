-- Allow a user to delete their own row in public.users (and cascade to app tables).
-- Needed because RLS is enabled and there was no DELETE policy.

drop policy if exists "users_delete_self" on public.users;
create policy "users_delete_self" on public.users
for delete using (auth.uid() = id);

