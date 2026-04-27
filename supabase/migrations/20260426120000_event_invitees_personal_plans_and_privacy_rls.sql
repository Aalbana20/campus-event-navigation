-- Event privacy, private-event invitees, and personal calendar items.
--
-- Adds the database support the mobile app already expects but had no
-- backing for:
--   * private events with a per-user invitee list (event_invitees)
--   * personal plans owned by a single user (personal_calendar_items)
--   * RLS so only invitees / hosts can see a private event
--   * updated_at auto-touch trigger on events
--
-- Additive only. No drops on existing data.

-- ---------------------------------------------------------------
-- 1. EVENT PRIVACY HARDENING
-- ---------------------------------------------------------------

-- Backfill any rows where privacy is null.
update public.events
   set privacy = 'public'
 where privacy is null;

-- Speed up filtering on privacy + creator (used by hosting/discover queries).
create index if not exists events_privacy_idx
  on public.events(privacy);

create index if not exists events_created_by_privacy_idx
  on public.events(created_by, privacy);

-- updated_at touch trigger.
create or replace function public.touch_events_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'events_touch_updated_at'
       and tgrelid = 'public.events'::regclass
  ) then
    create trigger events_touch_updated_at
      before update on public.events
      for each row execute function public.touch_events_updated_at();
  end if;
end $$;

-- ---------------------------------------------------------------
-- 2. EVENT INVITEES (private-event allow list)
-- ---------------------------------------------------------------
create table if not exists public.event_invitees (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_invitees_user_id_idx
  on public.event_invitees(user_id);

create index if not exists event_invitees_event_id_idx
  on public.event_invitees(event_id);

alter table public.event_invitees enable row level security;

-- Helper: is the current user an invitee of a given event?
create or replace function public.user_is_event_invitee(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_invitees
     where event_id = target_event_id
       and user_id  = (select auth.uid())
  );
$$;

grant execute on function public.user_is_event_invitee(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'event_invitees'
       and policyname = 'Invitees readable by host and invitees'
  ) then
    create policy "Invitees readable by host and invitees"
      on public.event_invitees for select
      to authenticated
      using (
        (select auth.uid()) = user_id
        or (select auth.uid()) = (
          select created_by from public.events where id = event_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'event_invitees'
       and policyname = 'Hosts can invite users to their events'
  ) then
    create policy "Hosts can invite users to their events"
      on public.event_invitees for insert
      to authenticated
      with check (
        (select auth.uid()) = (
          select created_by from public.events where id = event_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'event_invitees'
       and policyname = 'Hosts can revoke invites for their events'
  ) then
    create policy "Hosts can revoke invites for their events"
      on public.event_invitees for delete
      to authenticated
      using (
        (select auth.uid()) = (
          select created_by from public.events where id = event_id
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------
-- 3. EVENTS RLS: hide private events from non-invitees
-- ---------------------------------------------------------------
-- The previous policy (events_select_all USING true) leaked private
-- events to everyone. Replace it with a privacy-aware policy.
drop policy if exists events_select_all on public.events;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'events'
       and policyname = 'events_select_visible'
  ) then
    create policy events_select_visible
      on public.events for select
      using (
        privacy = 'public'
        or (select auth.uid()) = created_by
        or public.user_is_event_invitee(id)
      );
  end if;
end $$;

-- ---------------------------------------------------------------
-- 4. PERSONAL CALENDAR ITEMS (personal plans)
-- ---------------------------------------------------------------
create table if not exists public.personal_calendar_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(btrim(title)) > 0),
  note       text,
  item_date  date not null,
  item_time  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_calendar_items_owner_id_idx
  on public.personal_calendar_items(owner_id);

create index if not exists personal_calendar_items_owner_date_idx
  on public.personal_calendar_items(owner_id, item_date);

alter table public.personal_calendar_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'personal_calendar_items'
       and policyname = 'Personal items readable by owner'
  ) then
    create policy "Personal items readable by owner"
      on public.personal_calendar_items for select
      to authenticated
      using ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'personal_calendar_items'
       and policyname = 'Owner can insert personal items'
  ) then
    create policy "Owner can insert personal items"
      on public.personal_calendar_items for insert
      to authenticated
      with check ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'personal_calendar_items'
       and policyname = 'Owner can update personal items'
  ) then
    create policy "Owner can update personal items"
      on public.personal_calendar_items for update
      to authenticated
      using ((select auth.uid()) = owner_id)
      with check ((select auth.uid()) = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'personal_calendar_items'
       and policyname = 'Owner can delete personal items'
  ) then
    create policy "Owner can delete personal items"
      on public.personal_calendar_items for delete
      to authenticated
      using ((select auth.uid()) = owner_id);
  end if;
end $$;

create or replace function public.touch_personal_calendar_items_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname = 'personal_calendar_items_touch_updated_at'
       and tgrelid = 'public.personal_calendar_items'::regclass
  ) then
    create trigger personal_calendar_items_touch_updated_at
      before update on public.personal_calendar_items
      for each row execute function public.touch_personal_calendar_items_updated_at();
  end if;
end $$;

notify pgrst, 'reload schema';
