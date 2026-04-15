-- ============================================================
-- Campus Event Navigation – Full Database Schema
-- Run these statements in order in the Supabase SQL editor.
-- Last updated: 2026-04-13
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
