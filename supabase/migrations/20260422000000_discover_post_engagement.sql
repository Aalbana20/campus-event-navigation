-- Discover post engagement: likes, threaded comments, comment likes, and shares.

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
