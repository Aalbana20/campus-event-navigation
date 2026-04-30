alter table public.messages
  add column if not exists deleted_for_sender_at timestamptz,
  add column if not exists deleted_for_recipient_at timestamptz,
  add column if not exists unsent_at timestamptz;

create index if not exists messages_visible_thread_idx
  on public.messages (sender_id, recipient_id, created_at desc)
  where unsent_at is null;

drop policy if exists "Users can delete own thread messages" on public.messages;
drop policy if exists "Users can update own message state" on public.messages;

create policy "Users can update own message state"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create or replace function public.enforce_message_state_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.sender_id then
    if new.recipient_id is distinct from old.recipient_id
      or new.sender_id is distinct from old.sender_id
      or new.content is distinct from old.content
      or new.created_at is distinct from old.created_at
      or new.deleted_for_recipient_at is distinct from old.deleted_for_recipient_at
      or new.read is distinct from old.read then
      raise exception 'Invalid sender message update';
    end if;

    if old.unsent_at is not null and new.unsent_at is distinct from old.unsent_at then
      raise exception 'Cannot modify an unsent message';
    end if;

    return new;
  end if;

  if auth.uid() = old.recipient_id then
    if new.recipient_id is distinct from old.recipient_id
      or new.sender_id is distinct from old.sender_id
      or new.content is distinct from old.content
      or new.created_at is distinct from old.created_at
      or new.deleted_for_sender_at is distinct from old.deleted_for_sender_at
      or new.unsent_at is distinct from old.unsent_at then
      raise exception 'Invalid recipient message update';
    end if;

    return new;
  end if;

  raise exception 'Not a message participant';
end;
$$;

revoke all on function public.enforce_message_state_update() from public;
revoke all on function public.enforce_message_state_update() from anon;
revoke all on function public.enforce_message_state_update() from authenticated;

drop trigger if exists enforce_message_state_update on public.messages;

create trigger enforce_message_state_update
  before update on public.messages
  for each row
  execute function public.enforce_message_state_update();
