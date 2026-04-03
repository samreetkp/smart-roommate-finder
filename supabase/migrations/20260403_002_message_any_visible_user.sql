-- Allow app clients to start a conversation by creating (or re-activating) a match + conversation.
-- This enables "Message" buttons to work without requiring a prior backend job.

-- Matches: participants can create their own match rows.
drop policy if exists "matches_participant_insert" on public.matches;
create policy "matches_participant_insert" on public.matches
for insert
with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

-- Conversations: participants can create a conversation for a match they are in.
drop policy if exists "conversations_match_participant_insert" on public.conversations;
create policy "conversations_match_participant_insert" on public.conversations
for insert
with check (
  exists (
    select 1
    from public.matches m
    where m.id = conversations.match_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

-- Optional: allow participants to update conversations (required for upsert conflict path).
drop policy if exists "conversations_match_participant_update" on public.conversations;
create policy "conversations_match_participant_update" on public.conversations
for update
using (
  exists (
    select 1
    from public.matches m
    where m.id = conversations.match_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.matches m
    where m.id = conversations.match_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

