-- Social Recaps: destination-based recap feed, engagement, comments, and media.
-- This evolves the existing event recap tables without breaking event-specific
-- recaps that already use recap_posts.event_id + recap_media.recap_post_id.

alter table public.recap_posts
  alter column event_id drop not null,
  add column if not exists destination_type text not null default 'public',
  add column if not exists destination_id uuid,
  add column if not exists temporary_destination_key text,
  add column if not exists caption text,
  add column if not exists tagged_event_id uuid references public.events(id) on delete set null,
  add column if not exists visibility text not null default 'public';

update public.recap_posts
set caption = coalesce(caption, body)
where caption is null
  and body is not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'recap_posts_has_content_check'
      and conrelid = 'public.recap_posts'::regclass
  ) then
    alter table public.recap_posts
      drop constraint recap_posts_has_content_check;
  end if;
end $$;

alter table public.recap_posts
  add constraint recap_posts_destination_type_check
    check (destination_type in ('public', 'school', 'work', 'group')),
  add constraint recap_posts_visibility_check
    check (visibility in ('public', 'community')),
  add constraint recap_posts_body_not_blank_check
    check (body is null or char_length(btrim(body)) > 0),
  add constraint recap_posts_caption_not_blank_check
    check (caption is null or char_length(btrim(caption)) > 0);

create index if not exists recap_posts_user_created_idx
  on public.recap_posts(user_id, created_at desc);
create index if not exists recap_posts_temporary_destination_created_idx
  on public.recap_posts(temporary_destination_key, created_at desc);
create index if not exists recap_posts_tagged_event_idx
  on public.recap_posts(tagged_event_id)
  where tagged_event_id is not null;
create index if not exists recap_posts_visibility_created_idx
  on public.recap_posts(visibility, created_at desc);

alter table public.recap_media
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists thumbnail_url text,
  add column if not exists width integer,
  add column if not exists height integer;

update public.recap_media media
set user_id = posts.user_id
from public.recap_posts posts
where media.recap_post_id = posts.id
  and media.user_id is null;

alter table public.recap_media
  alter column user_id set not null;

create index if not exists recap_media_user_created_idx
  on public.recap_media(user_id, created_at desc);
create index if not exists recap_media_type_user_idx
  on public.recap_media(media_type, user_id);

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

grant select, insert, update, delete on public.recap_posts to authenticated;
grant select, insert, update, delete on public.recap_media to authenticated;
grant select, insert, update, delete on public.recap_comments to authenticated;
grant select, insert, delete on public.recap_likes to authenticated;
grant select, insert, delete on public.recap_reposts to authenticated;

drop policy if exists "Recap posts readable by event viewers" on public.recap_posts;
drop policy if exists "Recap posts readable by eligible viewers" on public.recap_posts;
create policy "Recap posts readable by eligible viewers"
  on public.recap_posts for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      user_id = (select auth.uid())
      or (
        event_id is not null
        and user_can_read_event((select auth.uid()), event_id)
      )
      or (
        event_id is null
        and visibility in ('public', 'community')
      )
    )
  );

drop policy if exists "Eligible users can create recap posts" on public.recap_posts;
drop policy if exists "Users can create recap posts" on public.recap_posts;
create policy "Users can create recap posts"
  on public.recap_posts for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (
        event_id is not null
        and user_can_post_recap_event((select auth.uid()), event_id)
      )
      or (
        event_id is null
        and visibility in ('public', 'community')
      )
    )
  );

drop policy if exists "Users can update their own recap posts" on public.recap_posts;
create policy "Users can update their own recap posts"
  on public.recap_posts for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own recap posts" on public.recap_posts;
create policy "Users can delete their own recap posts"
  on public.recap_posts for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Recap media readable by event viewers" on public.recap_media;
drop policy if exists "Authenticated users can read recap media" on public.recap_media;
create policy "Authenticated users can read recap media"
  on public.recap_media for select
  to authenticated
  using (true);

drop policy if exists "Recap authors can add recap media" on public.recap_media;
create policy "Recap authors can add recap media"
  on public.recap_media for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.recap_posts posts
      where posts.id = recap_media.recap_post_id
        and posts.user_id = (select auth.uid())
    )
  );

drop policy if exists "Recap authors can update recap media" on public.recap_media;
create policy "Recap authors can update recap media"
  on public.recap_media for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Recap authors can delete recap media" on public.recap_media;
create policy "Recap authors can delete recap media"
  on public.recap_media for delete
  to authenticated
  using (user_id = (select auth.uid()));

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

create or replace function public.set_recap_comment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recap_comments_set_updated_at on public.recap_comments;
create trigger recap_comments_set_updated_at
  before update on public.recap_comments
  for each row
  execute function public.set_recap_comment_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recap-media',
  'recap-media',
  true,
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

drop policy if exists "recap-media public reads" on storage.objects;
create policy "recap-media public reads"
  on storage.objects for select
  using (bucket_id = 'recap-media');

drop policy if exists "recap-media authenticated uploads" on storage.objects;
create policy "recap-media authenticated uploads"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recap-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "recap-media owner updates" on storage.objects;
create policy "recap-media owner updates"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recap-media'
    and owner = (select auth.uid())
  )
  with check (
    bucket_id = 'recap-media'
    and owner = (select auth.uid())
  );

drop policy if exists "recap-media owner deletes" on storage.objects;
create policy "recap-media owner deletes"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recap-media'
    and owner = (select auth.uid())
  );

notify pgrst, 'reload schema';
