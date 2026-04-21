-- ============================================================
-- Profile Unification — Phase 1 Foundation
-- Adds grid membership on discover posts, polymorphic reposts
-- (events + posts), content tags (user mentions on posts),
-- attendee-aware event memories, and a reusable attendance helper.
-- Safe to run multiple times; additive except deterministic duplicate
-- repost cleanup before unique indexes.
-- Last updated: 2026-04-20
-- ============================================================


-- ------------------------------------------------------------
-- 1. discover_posts: grid membership
-- ------------------------------------------------------------
-- `on_grid` controls whether a post appears on the author's
-- profile grid (the curated canvas) independent of whether it
-- shows in the general Posts/Videos feed. Defaults to TRUE so
-- existing posts remain visible on profiles during rollout.
alter table discover_posts
  add column if not exists on_grid boolean not null default true;

create index if not exists discover_posts_author_on_grid_idx
  on discover_posts(author_id, on_grid, created_at desc);

-- Optional linkage to an event (used when a post is published
-- as part of an event's memory context). Nullable for normal posts.
alter table discover_posts
  add column if not exists event_id uuid references events(id) on delete set null;

create index if not exists discover_posts_event_id_idx
  on discover_posts(event_id)
  where event_id is not null;

drop policy if exists "Users can update their own discover posts" on discover_posts;
create policy "Users can update their own discover posts"
  on discover_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);


-- ------------------------------------------------------------
-- 2. reposts: extend to support both events and posts
-- ------------------------------------------------------------
-- Previously `reposts(user_id, event_id)` only. We add a
-- `target_type` discriminator plus a nullable `post_id` so the
-- same table can represent reposted posts. event_id becomes
-- nullable; check constraints enforce exactly-one target per row.
alter table reposts
  add column if not exists target_type text not null default 'event';

alter table reposts
  add column if not exists post_id uuid references discover_posts(id) on delete cascade;

alter table reposts
  alter column event_id drop not null;

-- Drop the legacy unique(user_id, event_id) so we can replace it
-- with partial unique indexes (one per target type). Handles both
-- a named constraint and an implicit unique index if present.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'reposts_user_id_event_id_key'
      and conrelid = 'reposts'::regclass
  ) then
    alter table reposts drop constraint reposts_user_id_event_id_key;
  end if;

  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reposts'
      and indexname = 'reposts_user_id_event_id_key'
  ) then
    drop index if exists reposts_user_id_event_id_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reposts_target_type_check'
      and conrelid = 'reposts'::regclass
  ) then
    alter table reposts
      add constraint reposts_target_type_check
      check (target_type in ('event', 'post'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'reposts_target_consistency_check'
      and conrelid = 'reposts'::regclass
  ) then
    alter table reposts
      add constraint reposts_target_consistency_check
      check (
        (target_type = 'event' and event_id is not null and post_id is null) or
        (target_type = 'post'  and post_id  is not null and event_id is null)
      );
  end if;
end $$;

-- Production data may already contain duplicate repost rows from
-- older clients. Keep the oldest row per user/target deterministically
-- before adding the partial unique indexes below.
with ranked_event_reposts as (
  select
    id,
    row_number() over (
      partition by user_id, event_id
      order by created_at asc, id asc
    ) as row_rank
  from reposts
  where target_type = 'event'
    and event_id is not null
)
delete from reposts
using ranked_event_reposts
where reposts.id = ranked_event_reposts.id
  and ranked_event_reposts.row_rank > 1;

with ranked_post_reposts as (
  select
    id,
    row_number() over (
      partition by user_id, post_id
      order by created_at asc, id asc
    ) as row_rank
  from reposts
  where target_type = 'post'
    and post_id is not null
)
delete from reposts
using ranked_post_reposts
where reposts.id = ranked_post_reposts.id
  and ranked_post_reposts.row_rank > 1;

-- Partial unique indexes: one repost per user per target.
create unique index if not exists reposts_user_event_unique_idx
  on reposts(user_id, event_id)
  where target_type = 'event';

create unique index if not exists reposts_user_post_unique_idx
  on reposts(user_id, post_id)
  where target_type = 'post';

create index if not exists reposts_post_id_idx      on reposts(post_id)     where post_id is not null;
create index if not exists reposts_target_type_idx  on reposts(target_type);
create index if not exists reposts_user_created_idx on reposts(user_id, created_at desc);


-- ------------------------------------------------------------
-- 3. content_tags: user mentions/tags on discover posts
-- ------------------------------------------------------------
-- A simple join table representing "user X is tagged in post Y".
-- `tagger_id` records who added the tag (author or a privileged
-- user later). Same tag cannot be inserted twice.
create table if not exists content_tags (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references discover_posts(id) on delete cascade,
  tagged_user_id uuid not null references profiles(id) on delete cascade,
  tagger_id      uuid not null references profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique(post_id, tagged_user_id)
);

create index if not exists content_tags_post_id_idx        on content_tags(post_id);
create index if not exists content_tags_tagged_user_id_idx on content_tags(tagged_user_id);
create index if not exists content_tags_tagger_id_idx      on content_tags(tagger_id);

alter table content_tags enable row level security;

drop policy if exists "Content tags are readable by authenticated users" on content_tags;
create policy "Content tags are readable by authenticated users"
  on content_tags for select
  using (auth.role() = 'authenticated');

drop policy if exists "Post authors can tag users in their posts" on content_tags;
create policy "Post authors can tag users in their posts"
  on content_tags for insert
  with check (
    auth.uid() = tagger_id
    and auth.uid() = (select author_id from discover_posts where id = post_id)
  );

drop policy if exists "Tagger post author or tagged user can remove tag" on content_tags;
create policy "Tagger post author or tagged user can remove tag"
  on content_tags for delete
  using (
    auth.uid() = tagger_id
    or auth.uid() = tagged_user_id
    or auth.uid() = (select author_id from discover_posts where id = post_id)
  );


-- ------------------------------------------------------------
-- 4. RSVP eligibility helper (reused by event_memories RLS + feed logic)
-- ------------------------------------------------------------
-- Phase 1 intentionally treats "eligible for event memories" as
-- "has an RSVP row". This is not true attendance/check-in. The
-- function name stays stable for existing clients, but its current
-- semantics are RSVP-based and can later be replaced with a real
-- attendance/check-in predicate. Event-memory posting is allowed as
-- soon as the RSVP exists.
create or replace function user_attended_event(
  target_user_id  uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from rsvps
    where user_id  = target_user_id
      and event_id = target_event_id
  );
$$;

-- Allow PostgREST / authenticated clients to invoke the helper.
grant execute on function user_attended_event(uuid, uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. event_memories: attendee-posted media tied to an event
-- ------------------------------------------------------------
-- Media uploaded *to* an event by its attendees, surfaced in the
-- Tags → Event Tags tab on profiles and in a shared memory strip
-- on the event detail page. `metadata` is an open jsonb bag so we
-- can add ratings / reactions / reviews later without migration.
create table if not exists event_memories (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  media_url   text not null,
  media_type  text not null default 'image',
  caption     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_memories_media_type_check'
      and conrelid = 'event_memories'::regclass
  ) then
    alter table event_memories
      add constraint event_memories_media_type_check
      check (media_type in ('image', 'video'));
  end if;
end $$;

create index if not exists event_memories_event_id_idx       on event_memories(event_id);
create index if not exists event_memories_author_id_idx      on event_memories(author_id);
create index if not exists event_memories_event_created_idx  on event_memories(event_id, created_at desc);
create index if not exists event_memories_author_created_idx on event_memories(author_id, created_at desc);

alter table event_memories enable row level security;

drop policy if exists "Event memories are readable by authenticated users" on event_memories;
drop policy if exists "Event memories are readable by eligible event users" on event_memories;
create policy "Event memories are readable by eligible event users"
  on event_memories for select
  using (
    auth.uid() = author_id
    or user_attended_event(auth.uid(), event_id)
    or auth.uid() = (select created_by from events where id = event_id)
  );

drop policy if exists "Attendees can post event memories" on event_memories;
create policy "Attendees can post event memories"
  on event_memories for insert
  with check (
    auth.uid() = author_id
    and user_attended_event(auth.uid(), event_id)
  );

drop policy if exists "Authors can update their event memories" on event_memories;
create policy "Authors can update their event memories"
  on event_memories for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "Authors can delete their event memories" on event_memories;
create policy "Authors can delete their event memories"
  on event_memories for delete
  using (auth.uid() = author_id);


-- ------------------------------------------------------------
-- 6. Storage: event-memory media
-- ------------------------------------------------------------
-- Dedicated private bucket. Files land under:
--   {event_id}/{author_id}/{timestamp}.{ext}
-- Uploads are gated by the same RSVP-based eligibility helper as
-- event_memories inserts, and reads are limited to the memory author,
-- RSVP-eligible users, or the event creator.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-memories',
  'event-memories',
  false,
  125829120,
  array[
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function event_memory_path_event_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  path_parts text[];
  event_id_text text;
begin
  path_parts := storage.foldername(object_name);
  event_id_text := path_parts[1];

  if event_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return event_id_text::uuid;
  end if;

  return null;
end;
$$;

create or replace function event_memory_path_author_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  path_parts text[];
  author_id_text text;
begin
  path_parts := storage.foldername(object_name);
  author_id_text := path_parts[2];

  if author_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return author_id_text::uuid;
  end if;

  return null;
end;
$$;

grant execute on function event_memory_path_event_id(text) to authenticated;
grant execute on function event_memory_path_author_id(text) to authenticated;

drop policy if exists "Event memory media readable by eligible users" on storage.objects;
create policy "Event memory media readable by eligible users"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-memories'
    and (
      auth.uid() = event_memory_path_author_id(name)
      or user_attended_event(auth.uid(), event_memory_path_event_id(name))
      or auth.uid() = (
        select created_by
        from events
        where id = event_memory_path_event_id(name)
      )
    )
  );

drop policy if exists "Eligible users can upload event memory media" on storage.objects;
create policy "Eligible users can upload event memory media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-memories'
    and auth.uid() = event_memory_path_author_id(name)
    and user_attended_event(auth.uid(), event_memory_path_event_id(name))
  );

drop policy if exists "Memory authors can delete event memory media" on storage.objects;
create policy "Memory authors can delete event memory media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-memories'
    and auth.uid() = event_memory_path_author_id(name)
  );
