-- Shared mobile/web support for profile notes, app accent preferences,
-- derived notification state, and per-user DM thread preferences.

alter table public.profiles
  add column if not exists accent_color text not null default 'green'
    check (accent_color in ('green', 'blue', 'purple', 'pink', 'orange', 'red', 'white'));

update public.profiles
set accent_color = settings->>'accentColor'
where settings ? 'accentColor'
  and settings->>'accentColor' in ('green', 'blue', 'purple', 'pink', 'orange', 'red', 'white');

alter table public.profiles
  alter column settings set default '{
    "pushNotifications": true,
    "eventReminders": true,
    "followerAlerts": true,
    "dmAlerts": true,
    "messageRequests": true,
    "readReceipts": true,
    "showOnlineStatus": true,
    "privateProfile": false,
    "showActivityStatus": true,
    "followersOnlyDms": false,
    "accentColor": "green"
  }'::jsonb;

create table if not exists public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 120),
  visibility text not null default 'followers'
    check (visibility in ('public', 'followers', 'mutuals')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz
);

create index if not exists profile_notes_active_idx
  on public.profile_notes (expires_at desc, created_at desc)
  where deleted_at is null;

create index if not exists profile_notes_user_active_idx
  on public.profile_notes (user_id, expires_at desc)
  where deleted_at is null;

alter table public.profile_notes enable row level security;

drop policy if exists "profile_notes_select_active_authenticated" on public.profile_notes;
create policy "profile_notes_select_active_authenticated"
  on public.profile_notes
  for select
  to authenticated
  using (
    deleted_at is null
    and expires_at > now()
    and (
      visibility = 'public'
      or user_id = auth.uid()
      or exists (
        select 1
        from public.follows follows_check
        where follows_check.follower_id = auth.uid()
          and follows_check.following_id = profile_notes.user_id
      )
    )
  );

drop policy if exists "profile_notes_insert_own" on public.profile_notes;
create policy "profile_notes_insert_own"
  on public.profile_notes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profile_notes_update_own" on public.profile_notes;
create policy "profile_notes_update_own"
  on public.profile_notes
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profile_notes_delete_own" on public.profile_notes;
create policy "profile_notes_delete_own"
  on public.profile_notes
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.notification_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);

create index if not exists notification_states_user_updated_idx
  on public.notification_states (user_id, updated_at desc);

alter table public.notification_states enable row level security;

drop policy if exists "notification_states_select_own" on public.notification_states;
create policy "notification_states_select_own"
  on public.notification_states
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notification_states_insert_own" on public.notification_states;
create policy "notification_states_insert_own"
  on public.notification_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "notification_states_update_own" on public.notification_states;
create policy "notification_states_update_own"
  on public.notification_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_states_delete_own" on public.notification_states;
create policy "notification_states_delete_own"
  on public.notification_states
  for delete
  to authenticated
  using (auth.uid() = user_id);

create table if not exists public.dm_thread_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_user_id uuid not null references public.profiles(id) on delete cascade,
  muted_at timestamptz,
  pinned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_user_id),
  check (user_id <> thread_user_id)
);

create index if not exists dm_thread_preferences_user_updated_idx
  on public.dm_thread_preferences (user_id, updated_at desc);

alter table public.dm_thread_preferences enable row level security;

drop policy if exists "dm_thread_preferences_select_own" on public.dm_thread_preferences;
create policy "dm_thread_preferences_select_own"
  on public.dm_thread_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "dm_thread_preferences_insert_own" on public.dm_thread_preferences;
create policy "dm_thread_preferences_insert_own"
  on public.dm_thread_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "dm_thread_preferences_update_own" on public.dm_thread_preferences;
create policy "dm_thread_preferences_update_own"
  on public.dm_thread_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dm_thread_preferences_delete_own" on public.dm_thread_preferences;
create policy "dm_thread_preferences_delete_own"
  on public.dm_thread_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists messages_recipient_unread_idx
  on public.messages (recipient_id, sender_id, created_at desc)
  where read = false;
