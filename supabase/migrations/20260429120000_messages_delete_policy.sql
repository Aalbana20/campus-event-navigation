drop policy if exists "Users can delete own thread messages" on public.messages;

create policy "Users can delete own thread messages"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
