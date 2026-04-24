-- ============================================================
-- Campus Event Navigation – Full Database Schema
-- Run these statements in order in the Supabase SQL editor.
-- Last updated: 2026-04-20
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================
-- Note: profiles table is created by Supabase Auth trigger.
-- These statements extend it.

alter table profiles add column if not exists name text;
alter table profiles add column if not exists username text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists phone_number text;
alter table profiles add column if not exists birthday date;
alter table profiles add column if not exists interests text[];
alter table profiles add column if not exists email text;
alter table profiles add column if not exists updated_at timestamptz default now();
alter table profiles add column if not exists account_type text not null default 'regular';
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists birth_month smallint;
alter table profiles add column if not exists birth_year smallint;
alter table profiles add column if not exists gender text;
alter table profiles add column if not exists school text;
alter table profiles add column if not exists school_id text;
alter table profiles add column if not exists student_verified boolean not null default false;
alter table profiles add column if not exists verification_status text not null default 'unverified';
alter table profiles add column if not exists organization_name text;
alter table profiles add column if not exists organization_type text;
alter table profiles add column if not exists organization_description text;
alter table profiles add column if not exists organization_website text;
alter table profiles add column if not exists parent_organization_id uuid references profiles(id) on delete set null;
alter table profiles add column if not exists parent_organization_name text;
alter table profiles add column if not exists logo_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_account_type_check
      check (account_type in ('student', 'organization', 'regular'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('Male', 'Female'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_birth_month_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_birth_month_check
      check (birth_month is null or birth_month between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_verification_status_check'
      and conrelid = 'profiles'::regclass
  ) then
    alter table profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;
end $$;

create index if not exists profiles_account_type_idx on profiles(account_type);
create index if not exists profiles_school_id_idx on profiles(school_id) where school_id is not null;
create index if not exists profiles_parent_organization_id_idx on profiles(parent_organization_id) where parent_organization_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'profiles'
      and indexname = 'profiles_username_unique_idx'
  ) and not exists (
    select 1
    from profiles
    where username is not null and length(trim(username)) > 0
    group by lower(username)
    having count(*) > 1
  ) then
    create unique index profiles_username_unique_idx
      on profiles(lower(username))
      where username is not null and length(trim(username)) > 0;
  end if;
end $$;

-- Settings: stores all notification/privacy toggles as JSONB.
alter table profiles
  add column if not exists settings jsonb not null default '{
    "pushNotifications": true,
    "eventReminders": true,
    "followerAlerts": true,
    "dmAlerts": true,
    "messageRequests": true,
    "readReceipts": false,
    "showOnlineStatus": true,
    "privateProfile": false,
    "showActivityStatus": true,
    "followersOnlyDms": false
  }'::jsonb;


-- ============================================================
-- 2. EVENTS
-- ============================================================
create table if not exists events (
  id               uuid default gen_random_uuid() primary key,
  title            text not null,
  description      text,
  location         text,
  location_address text,
  date             text,
  event_date       date,
  start_time       text,
  end_time         text,
  start_at         timestamptz,
  end_at           timestamptz,
  price            text default 'Free',
  capacity         integer,
  organizer        text,
  dress_code       text,
  image            text,
  tags             text[],
  privacy          text default 'public',
  created_by       uuid references auth.users(id),
  creator_username text,
  going_count      integer default 0,
  created_at       timestamptz default now()
);

alter table events enable row level security;

create policy "Anyone can read events"
  on events for select using (true);

create policy "Authenticated users can insert events"
  on events for insert
  with check (auth.uid() = created_by);

create policy "Creators can update their events"
  on events for update
  using (auth.uid() = created_by);

create policy "Creators can delete their events"
  on events for delete
  using (auth.uid() = created_by);


-- ============================================================
-- 3. RSVPS
-- ============================================================
create table if not exists rsvps (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  event_id   uuid references events(id) on delete cascade,
  rsvp_date  timestamptz default now(),
  unique(user_id, event_id)
);

alter table rsvps enable row level security;

create policy "Users can read all rsvps"
  on rsvps for select using (true);

create policy "Users can insert their own rsvps"
  on rsvps for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own rsvps"
  on rsvps for delete
  using (auth.uid() = user_id);


-- ============================================================
-- 4. FOLLOWS
-- ============================================================
create table if not exists follows (
  id           uuid default gen_random_uuid() primary key,
  follower_id  uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  unique(follower_id, following_id)
);

alter table follows enable row level security;

create policy "Follows are readable by authenticated users"
  on follows for select using (auth.role() = 'authenticated');

create policy "Users can follow others"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on follows for delete
  using (auth.uid() = follower_id);


-- ============================================================
-- 5. MESSAGES (Direct Messages)
-- ============================================================
create table if not exists messages (
  id           uuid default gen_random_uuid() primary key,
  sender_id    uuid references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  content      text not null,
  created_at   timestamptz default now(),
  read         boolean default false
);

alter table messages enable row level security;

create policy "Users can send messages"
  on messages for insert
  with check (auth.uid() = sender_id);

create policy "Users can read their own messages"
  on messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can mark messages as read"
  on messages for update
  using (auth.uid() = recipient_id);


-- ============================================================
-- 6. EVENT COMMENTS
-- ============================================================
create table if not exists event_comments (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) > 0),
  created_at timestamptz not null default now()
);

create index if not exists event_comments_event_id_idx on event_comments(event_id);
create index if not exists event_comments_user_id_idx  on event_comments(user_id);

alter table event_comments enable row level security;

create policy "Comments are readable by authenticated users"
  on event_comments for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own comments"
  on event_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on event_comments for delete
  using (auth.uid() = user_id);

-- Threaded replies: a comment can point at a parent comment (1 level nesting).
alter table event_comments
  add column if not exists parent_id uuid references event_comments(id) on delete cascade;

create index if not exists event_comments_parent_id_idx on event_comments(parent_id);

-- ------------------------------------------------------------
-- 6b. EVENT COMMENT LIKES
-- ------------------------------------------------------------
create table if not exists event_comment_likes (
  comment_id uuid not null references event_comments(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists event_comment_likes_comment_id_idx on event_comment_likes(comment_id);
create index if not exists event_comment_likes_user_id_idx    on event_comment_likes(user_id);

alter table event_comment_likes enable row level security;

create policy "Comment likes are readable by authenticated users"
  on event_comment_likes for select
  using (auth.role() = 'authenticated');

create policy "Users can like any comment as themselves"
  on event_comment_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on event_comment_likes for delete
  using (auth.uid() = user_id);


-- ============================================================
-- 7. REPOSTS
-- ============================================================
create table if not exists reposts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  event_id   uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, event_id)
);

create index if not exists reposts_user_id_idx  on reposts(user_id);
create index if not exists reposts_event_id_idx on reposts(event_id);

alter table reposts enable row level security;

create policy "Reposts are readable by authenticated users"
  on reposts for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own reposts"
  on reposts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own reposts"
  on reposts for delete
  using (auth.uid() = user_id);


-- ============================================================
-- 8. STORIES
-- ============================================================
create table if not exists stories (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  media_url   text not null,
  media_type  text not null default 'image', -- 'image' | 'video'
  caption     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

-- Sticker/share metadata. story_type = 'standard' | 'event_share' | 'post_share' | 'video_share'.
-- stickers is a JSONB array of { type, transform: { x, y, scale, rotation }, eventId?, postId? }.
alter table stories add column if not exists story_type text not null default 'standard';
alter table stories add column if not exists stickers jsonb not null default '[]'::jsonb;

create index if not exists stories_author_id_idx  on stories(author_id);
create index if not exists stories_expires_at_idx on stories(expires_at);

alter table stories enable row level security;

create policy "Stories are readable by authenticated users"
  on stories for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own stories"
  on stories for insert
  with check (auth.uid() = author_id);

create policy "Users can delete their own stories"
  on stories for delete
  using (auth.uid() = author_id);


-- ============================================================
-- 9. STORY VIEWS
-- ============================================================
create table if not exists story_views (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references stories(id) on delete cascade,
  viewer_id  uuid not null references auth.users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  unique(story_id, viewer_id)
);

alter table story_views enable row level security;

create policy "Story views readable by story author"
  on story_views for select
  using (
    auth.uid() = viewer_id or
    auth.uid() = (select author_id from stories where id = story_id)
  );

create policy "Users can insert their own story views"
  on story_views for insert
  with check (auth.uid() = viewer_id);


-- ============================================================
-- 10. STORY REACTIONS
-- ============================================================
create table if not exists story_reactions (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references stories(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  reaction   text not null default 'heart',
  created_at timestamptz not null default now(),
  unique(story_id, user_id)
);

alter table story_reactions enable row level security;

create policy "Story reactions readable by authenticated users"
  on story_reactions for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own story reactions"
  on story_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own story reactions"
  on story_reactions for delete
  using (auth.uid() = user_id);

create policy "Users can update their own story reactions"
  on story_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ============================================================
-- 11. STORY SHARES
-- ============================================================
create table if not exists story_shares (
  id           uuid primary key default gen_random_uuid(),
  story_id     uuid not null references stories(id) on delete cascade,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table story_shares enable row level security;

create policy "Story shares readable by sender or recipient"
  on story_shares for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can insert their own story shares"
  on story_shares for insert
  with check (auth.uid() = sender_id);


-- ============================================================
-- 11b. DISCOVER POSTS
-- Photo/video posts published into the Discover feed.
-- Stored alongside profiles; reuses the "stories" storage bucket
-- under the "posts/" folder prefix to avoid creating a new bucket.
-- ============================================================
create table if not exists discover_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  media_url   text not null,
  media_type  text not null default 'image', -- 'image' | 'video'
  caption     text,
  created_at  timestamptz not null default now()
);

create index if not exists discover_posts_author_id_idx  on discover_posts(author_id);
create index if not exists discover_posts_created_at_idx on discover_posts(created_at desc);

alter table discover_posts enable row level security;

create policy "Discover posts are readable by authenticated users"
  on discover_posts for select
  using (auth.role() = 'authenticated');

create policy "Users can insert their own discover posts"
  on discover_posts for insert
  with check (auth.uid() = author_id);

create policy "Users can delete their own discover posts"
  on discover_posts for delete
  using (auth.uid() = author_id);

create policy "Users can update their own discover posts"
  on discover_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- Profile-grid membership flag (Phase 1 profile unification).
alter table discover_posts
  add column if not exists on_grid boolean not null default true;

create index if not exists discover_posts_author_on_grid_idx
  on discover_posts(author_id, on_grid, created_at desc);

-- Optional event linkage (used for event-memory posts).
alter table discover_posts
  add column if not exists event_id uuid references events(id) on delete set null;

create index if not exists discover_posts_event_id_idx
  on discover_posts(event_id)
  where event_id is not null;

-- Optional media metadata (legacy + canonical names both supported during the
-- transition so web + mobile can read/write the same rows safely).
alter table discover_posts
  add column if not exists thumbnail_url text,
  add column if not exists duration numeric,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric,
  add column if not exists media_width integer,
  add column if not exists media_height integer;


-- ============================================================
-- 11c. POLYMORPHIC REPOSTS (events + posts)
-- Extends the base reposts table so a user can repost a post
-- in addition to an event. event_id becomes nullable; a
-- target_type discriminator and partial unique indexes enforce
-- exactly-one-target-per-row and prevent duplicate reposts.
-- ============================================================
alter table reposts
  add column if not exists target_type text not null default 'event';

alter table reposts
  add column if not exists post_id uuid references discover_posts(id) on delete cascade;

alter table reposts
  alter column event_id drop not null;

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

create unique index if not exists reposts_user_event_unique_idx
  on reposts(user_id, event_id)
  where target_type = 'event';

create unique index if not exists reposts_user_post_unique_idx
  on reposts(user_id, post_id)
  where target_type = 'post';

create index if not exists reposts_post_id_idx      on reposts(post_id)     where post_id is not null;
create index if not exists reposts_target_type_idx  on reposts(target_type);
create index if not exists reposts_user_created_idx on reposts(user_id, created_at desc);


-- ============================================================
-- 11d. CONTENT TAGS (user mentions on discover posts)
-- ============================================================
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

create policy "Content tags are readable by authenticated users"
  on content_tags for select
  using (auth.role() = 'authenticated');

create policy "Post authors can tag users in their posts"
  on content_tags for insert
  with check (
    auth.uid() = tagger_id
    and auth.uid() = (select author_id from discover_posts where id = post_id)
  );

create policy "Tagger post author or tagged user can remove tag"
  on content_tags for delete
  using (
    auth.uid() = tagger_id
    or auth.uid() = tagged_user_id
    or auth.uid() = (select author_id from discover_posts where id = post_id)
  );


-- ============================================================
-- 11d-2. DISCOVER POST ENGAGEMENT
-- Likes, threaded comments, comment likes, and share tracking
-- for photo/video posts.
-- ============================================================
create table if not exists discover_post_likes (
  post_id    uuid not null references discover_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists discover_post_likes_post_id_idx on discover_post_likes(post_id);
create index if not exists discover_post_likes_user_id_idx on discover_post_likes(user_id);

alter table discover_post_likes enable row level security;

create policy "Discover post likes are readable by authenticated users"
  on discover_post_likes for select
  to authenticated
  using (true);

create policy "Users can like discover posts as themselves"
  on discover_post_likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own discover post likes"
  on discover_post_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists discover_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references discover_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references discover_post_comments(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists discover_post_comments_post_id_idx on discover_post_comments(post_id);
create index if not exists discover_post_comments_user_id_idx on discover_post_comments(user_id);
create index if not exists discover_post_comments_parent_id_idx on discover_post_comments(parent_id);
create index if not exists discover_post_comments_post_created_idx
  on discover_post_comments(post_id, created_at asc);

alter table discover_post_comments enable row level security;

create policy "Discover post comments are readable by authenticated users"
  on discover_post_comments for select
  to authenticated
  using (true);

create policy "Users can add their own discover post comments"
  on discover_post_comments for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own discover post comments"
  on discover_post_comments for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists discover_post_comment_likes (
  comment_id uuid not null references discover_post_comments(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists discover_post_comment_likes_comment_id_idx
  on discover_post_comment_likes(comment_id);
create index if not exists discover_post_comment_likes_user_id_idx
  on discover_post_comment_likes(user_id);

alter table discover_post_comment_likes enable row level security;

create policy "Discover post comment likes are readable by authenticated users"
  on discover_post_comment_likes for select
  to authenticated
  using (true);

create policy "Users can like discover post comments as themselves"
  on discover_post_comment_likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own discover post comment likes"
  on discover_post_comment_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists discover_post_shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references discover_posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  method     text not null default 'share',
  created_at timestamptz not null default now(),
  check (method in ('copy_link', 'native_share', 'message', 'share'))
);

create index if not exists discover_post_shares_post_id_idx on discover_post_shares(post_id);
create index if not exists discover_post_shares_user_id_idx on discover_post_shares(user_id);
create index if not exists discover_post_shares_post_created_idx
  on discover_post_shares(post_id, created_at desc);

alter table discover_post_shares enable row level security;

create policy "Discover post shares are readable by authenticated users"
  on discover_post_shares for select
  to authenticated
  using (true);

create policy "Users can record their own discover post shares"
  on discover_post_shares for insert
  to authenticated
  with check ((select auth.uid()) = user_id);


-- ============================================================
-- 11e. ATTENDANCE HELPER + EVENT MEMORIES
-- ============================================================
-- Phase 1 event-memory eligibility is RSVP-based. This is not
-- true attendance/check-in yet; event-memory posting is allowed
-- as soon as the RSVP exists.
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

grant execute on function user_attended_event(uuid, uuid) to authenticated;

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

create policy "Event memories are readable by eligible event users"
  on event_memories for select
  using (
    auth.uid() = author_id
    or user_attended_event(auth.uid(), event_id)
    or auth.uid() = (select created_by from events where id = event_id)
  );

create policy "Attendees can post event memories"
  on event_memories for insert
  with check (
    auth.uid() = author_id
    and user_attended_event(auth.uid(), event_id)
  );

create policy "Authors can update their event memories"
  on event_memories for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "Authors can delete their event memories"
  on event_memories for delete
  using (auth.uid() = author_id);


-- ============================================================
-- 12. PUSH TOKENS
-- ============================================================
create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   text,
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

alter table push_tokens enable row level security;

create policy "Users can manage their own push tokens"
  on push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Authenticated users can read tokens to send notifications to event creators
create policy "Authenticated users can read push tokens for notifications"
  on push_tokens for select
  using (auth.role() = 'authenticated');


-- ============================================================
-- 13. STORAGE BUCKET POLICIES
-- ============================================================

-- profile-images bucket
create policy "Allow authenticated profile image uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-images' and auth.role() = 'authenticated');

create policy "Allow authenticated profile image updates"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-images' and auth.role() = 'authenticated');

create policy "Allow authenticated profile image deletes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-images' and auth.role() = 'authenticated');

-- event-images bucket
create policy "Allow authenticated event image uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-images' and auth.role() = 'authenticated');

create policy "Allow public event image reads"
  on storage.objects for select
  using (bucket_id = 'event-images');

-- stories bucket
create policy "Allow authenticated story uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stories' and auth.role() = 'authenticated');

create policy "Allow public story reads"
  on storage.objects for select
  using (bucket_id = 'stories');

-- event-memories bucket
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

create policy "Eligible users can upload event memory media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-memories'
    and auth.uid() = event_memory_path_author_id(name)
    and user_attended_event(auth.uid(), event_memory_path_event_id(name))
  );

create policy "Memory authors can delete event memory media"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-memories'
    and auth.uid() = event_memory_path_author_id(name)
  );

-- ============================================================
-- Story expiration cleanup
-- ============================================================

-- SQL function called by the Edge Function or pg_cron.
-- Deletes cascade: story_views, story_reactions, story_shares → stories.
create or replace function cleanup_expired_stories()
returns integer
language plpgsql
security definer
as $$
declare
  deleted_count integer;
begin
  delete from story_views
  where story_id in (select id from stories where expires_at < now());

  delete from story_reactions
  where story_id in (select id from stories where expires_at < now());

  delete from story_shares
  where story_id in (select id from stories where expires_at < now());

  delete from stories where expires_at < now();
  get diagnostics deleted_count = row_count;

  return deleted_count;
end;
$$;

-- Schedule hourly cleanup via pg_cron (requires pg_cron extension).
-- Enable in Supabase Dashboard → Database → Extensions → pg_cron, then run:
--
--   select cron.schedule(
--     'cleanup-expired-stories',
--     '0 * * * *',
--     $$ select cleanup_expired_stories() $$
--   );
--
-- Or trigger manually:  select cleanup_expired_stories();
