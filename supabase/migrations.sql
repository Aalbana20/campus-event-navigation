-- ============================================================
-- Campus Event Navigation – Database Migrations
-- Run these statements in the Supabase SQL editor.
-- ============================================================

-- 1. Event comments
-- Stores per-event comments tied to a user profile.
create table if not exists event_comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(body) > 0),
  created_at  timestamp with time zone not null default now()
);

create index if not exists event_comments_event_id_idx on event_comments(event_id);
create index if not exists event_comments_user_id_idx  on event_comments(user_id);

-- Enable Row Level Security
alter table event_comments enable row level security;

-- Anyone authenticated can read comments
create policy "Comments are readable by authenticated users"
  on event_comments for select
  using (auth.role() = 'authenticated');

-- Users can only insert their own comments
create policy "Users can insert their own comments"
  on event_comments for insert
  with check (auth.uid() = user_id);

-- Users can only delete their own comments
create policy "Users can delete their own comments"
  on event_comments for delete
  using (auth.uid() = user_id);


-- 2. Reposts
-- Tracks which users have reposted which events.
create table if not exists reposts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  created_at  timestamp with time zone not null default now(),
  unique (user_id, event_id)
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


-- 3. Settings column on profiles
-- Stores user notification/privacy settings as a JSONB object.
-- Default shape mirrors the UI toggle keys in Profile.jsx.
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
