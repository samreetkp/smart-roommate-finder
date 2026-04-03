-- Allow participants to update message rows (used for marking messages as read).
-- Needed for the UI unread badge to clear after opening a conversation.

drop policy if exists "messages_conversation_participant_update" on public.messages;

create policy "messages_conversation_participant_update" on public.messages
for update
using (
  exists (
    select 1
    from public.conversations c
    join public.matches m on m.id = c.match_id
    where c.id = messages.conversation_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    join public.matches m on m.id = c.match_id
    where c.id = messages.conversation_id
      and (m.user_1_id = auth.uid() or m.user_2_id = auth.uid())
  )
);

