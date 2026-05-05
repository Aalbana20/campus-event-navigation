-- Allow social/text-only recaps to be posted with the current mobile schema.
-- The live table is intentionally kept compatible with the older
-- recap_posts(event_id, user_id, body) + recap_media(recap_post_id, ...)
-- shape while opening the RLS checks needed by the mobile Recaps feed.

do $$
begin
  if to_regclass('public.recap_posts') is not null then
    alter table public.recap_posts enable row level security;
    grant select, insert, update, delete on public.recap_posts to authenticated;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'recap_posts'
        and column_name = 'event_id'
    ) then
      alter table public.recap_posts alter column event_id drop not null;
    end if;

    drop policy if exists "Authenticated users can read recap posts" on public.recap_posts;
    create policy "Authenticated users can read recap posts"
      on public.recap_posts for select
      to authenticated
      using ((select auth.uid()) is not null);

    drop policy if exists "Users can insert own recap posts" on public.recap_posts;
    create policy "Users can insert own recap posts"
      on public.recap_posts for insert
      to authenticated
      with check (user_id = (select auth.uid()));

    drop policy if exists "Users can update own recap posts" on public.recap_posts;
    create policy "Users can update own recap posts"
      on public.recap_posts for update
      to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));

    drop policy if exists "Users can delete own recap posts" on public.recap_posts;
    create policy "Users can delete own recap posts"
      on public.recap_posts for delete
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end $$;

do $$
begin
  if to_regclass('public.recap_media') is not null then
    alter table public.recap_media
      add column if not exists user_id uuid references auth.users(id) on delete cascade;

    update public.recap_media media
    set user_id = posts.user_id
    from public.recap_posts posts
    where media.recap_post_id = posts.id
      and media.user_id is null;

    alter table public.recap_media enable row level security;
    grant select, insert, update, delete on public.recap_media to authenticated;

    drop policy if exists "Authenticated users can read recap media" on public.recap_media;
    create policy "Authenticated users can read recap media"
      on public.recap_media for select
      to authenticated
      using (true);

    drop policy if exists "Users can insert own recap media" on public.recap_media;
    create policy "Users can insert own recap media"
      on public.recap_media for insert
      to authenticated
      with check (
        (user_id is null or user_id = (select auth.uid()))
        and exists (
          select 1
          from public.recap_posts posts
          where posts.id = recap_media.recap_post_id
            and posts.user_id = (select auth.uid())
        )
      );

    drop policy if exists "Users can update own recap media" on public.recap_media;
    create policy "Users can update own recap media"
      on public.recap_media for update
      to authenticated
      using (
        (user_id is null or user_id = (select auth.uid()))
        and exists (
          select 1
          from public.recap_posts posts
          where posts.id = recap_media.recap_post_id
            and posts.user_id = (select auth.uid())
        )
      )
      with check (
        (user_id is null or user_id = (select auth.uid()))
        and exists (
          select 1
          from public.recap_posts posts
          where posts.id = recap_media.recap_post_id
            and posts.user_id = (select auth.uid())
        )
      );

    drop policy if exists "Users can delete own recap media" on public.recap_media;
    create policy "Users can delete own recap media"
      on public.recap_media for delete
      to authenticated
      using (
        (user_id is null or user_id = (select auth.uid()))
        and exists (
          select 1
          from public.recap_posts posts
          where posts.id = recap_media.recap_post_id
            and posts.user_id = (select auth.uid())
        )
      );
  end if;
end $$;

create table if not exists public.recap_comments (
  id uuid primary key default gen_random_uuid(),
  recap_id uuid not null references public.recap_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.recap_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recap_comments_body_not_blank_check check (char_length(btrim(body)) > 0)
);

create table if not exists public.recap_likes (
  recap_id uuid not null references public.recap_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recap_id, user_id)
);

create table if not exists public.recap_reposts (
  recap_id uuid not null references public.recap_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quote text,
  created_at timestamptz not null default now(),
  primary key (recap_id, user_id),
  constraint recap_reposts_quote_not_blank_check
    check (quote is null or char_length(btrim(quote)) > 0)
);

create index if not exists recap_comments_recap_created_idx
  on public.recap_comments(recap_id, created_at);
create index if not exists recap_comments_user_created_idx
  on public.recap_comments(user_id, created_at desc);
create index if not exists recap_likes_user_created_idx
  on public.recap_likes(user_id, created_at desc);
create index if not exists recap_reposts_user_created_idx
  on public.recap_reposts(user_id, created_at desc);

alter table public.recap_comments enable row level security;
alter table public.recap_likes enable row level security;
alter table public.recap_reposts enable row level security;

grant select, insert, update, delete on public.recap_comments to authenticated;
grant select, insert, delete on public.recap_likes to authenticated;
grant select, insert, delete on public.recap_reposts to authenticated;

drop policy if exists "Authenticated users can read recap comments" on public.recap_comments;
create policy "Authenticated users can read recap comments"
  on public.recap_comments for select
  to authenticated
  using (true);

drop policy if exists "Users can add their own recap comments" on public.recap_comments;
create policy "Users can add their own recap comments"
  on public.recap_comments for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their own recap comments" on public.recap_comments;
create policy "Users can update their own recap comments"
  on public.recap_comments for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own recap comments" on public.recap_comments;
create policy "Users can delete their own recap comments"
  on public.recap_comments for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authenticated users can read recap likes" on public.recap_likes;
create policy "Authenticated users can read recap likes"
  on public.recap_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can add their own recap likes" on public.recap_likes;
create policy "Users can add their own recap likes"
  on public.recap_likes for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own recap likes" on public.recap_likes;
create policy "Users can delete their own recap likes"
  on public.recap_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Authenticated users can read recap reposts" on public.recap_reposts;
create policy "Authenticated users can read recap reposts"
  on public.recap_reposts for select
  to authenticated
  using (true);

drop policy if exists "Users can add their own recap reposts" on public.recap_reposts;
create policy "Users can add their own recap reposts"
  on public.recap_reposts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own recap reposts" on public.recap_reposts;
create policy "Users can delete their own recap reposts"
  on public.recap_reposts for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "stories social recaps authenticated uploads" on storage.objects;
create policy "stories social recaps authenticated uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = 'social-recaps'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists "stories social recaps authenticated reads" on storage.objects;
create policy "stories social recaps authenticated reads"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = 'social-recaps'
  );

drop policy if exists "stories social recaps owner deletes" on storage.objects;
create policy "stories social recaps owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = 'social-recaps'
    and owner = (select auth.uid())
  );

notify pgrst, 'reload schema';
