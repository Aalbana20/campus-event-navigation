create table if not exists public.message_reactions (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (char_length(emoji) <= 8),
  created_at  timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create policy "Thread participants can read reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );

create policy "Users can react to messages"
  on public.message_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

create index if not exists message_reactions_message_id_idx
  on public.message_reactions (message_id);
