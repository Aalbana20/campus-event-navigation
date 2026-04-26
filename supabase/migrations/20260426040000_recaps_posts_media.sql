-- Recaps v1: one durable post row with optional ordered media.
-- Media files reuse the existing private `event-memories` bucket and should be
-- uploaded under: recaps/{event_id}/{user_id}/{filename}

create or replace function user_can_read_event(
  target_user_id uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from events
    where id = target_event_id
      and (
        coalesce(privacy, 'public') = 'public'
        or created_by = target_user_id
        or user_attended_event(target_user_id, target_event_id)
      )
  );
$$;

create or replace function user_can_post_recap_event(
  target_user_id uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from events
    where id = target_event_id
      and (
        created_by = target_user_id
        or user_attended_event(target_user_id, target_event_id)
      )
  );
$$;

grant execute on function user_can_read_event(uuid, uuid) to authenticated;
grant execute on function user_can_post_recap_event(uuid, uuid) to authenticated;

create table if not exists recap_posts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recap_posts_has_content_check check (
    body is null or char_length(btrim(body)) > 0
  )
);

create table if not exists recap_media (
  id            uuid primary key default gen_random_uuid(),
  recap_post_id uuid not null references recap_posts(id) on delete cascade,
  media_url     text not null,
  media_type    text not null default 'image',
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint recap_media_media_type_check check (media_type in ('image', 'video'))
);

create index if not exists recap_posts_event_created_idx
  on recap_posts(event_id, created_at desc);
create index if not exists recap_posts_user_id_idx
  on recap_posts(user_id);
create index if not exists recap_media_post_sort_idx
  on recap_media(recap_post_id, sort_order);

alter table recap_posts enable row level security;
alter table recap_media enable row level security;

grant select, insert, update, delete on recap_posts to authenticated;
grant select, insert, update, delete on recap_media to authenticated;

drop policy if exists "Recap posts readable by event viewers" on recap_posts;
create policy "Recap posts readable by event viewers"
  on recap_posts for select
  to authenticated
  using (user_can_read_event(auth.uid(), event_id));

drop policy if exists "Eligible users can create recap posts" on recap_posts;
create policy "Eligible users can create recap posts"
  on recap_posts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and user_can_post_recap_event(auth.uid(), event_id)
  );

drop policy if exists "Users can update their own recap posts" on recap_posts;
create policy "Users can update their own recap posts"
  on recap_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own recap posts" on recap_posts;
create policy "Users can delete their own recap posts"
  on recap_posts for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Recap media readable by event viewers" on recap_media;
create policy "Recap media readable by event viewers"
  on recap_media for select
  to authenticated
  using (
    exists (
      select 1
      from recap_posts
      where recap_posts.id = recap_media.recap_post_id
        and user_can_read_event(auth.uid(), recap_posts.event_id)
    )
  );

drop policy if exists "Recap authors can add recap media" on recap_media;
create policy "Recap authors can add recap media"
  on recap_media for insert
  to authenticated
  with check (
    exists (
      select 1
      from recap_posts
      where recap_posts.id = recap_media.recap_post_id
        and recap_posts.user_id = auth.uid()
    )
  );

drop policy if exists "Recap authors can update recap media" on recap_media;
create policy "Recap authors can update recap media"
  on recap_media for update
  to authenticated
  using (
    exists (
      select 1
      from recap_posts
      where recap_posts.id = recap_media.recap_post_id
        and recap_posts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from recap_posts
      where recap_posts.id = recap_media.recap_post_id
        and recap_posts.user_id = auth.uid()
    )
  );

drop policy if exists "Recap authors can delete recap media" on recap_media;
create policy "Recap authors can delete recap media"
  on recap_media for delete
  to authenticated
  using (
    exists (
      select 1
      from recap_posts
      where recap_posts.id = recap_media.recap_post_id
        and recap_posts.user_id = auth.uid()
    )
  );

create or replace function set_recap_post_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recap_posts_set_updated_at on recap_posts;
create trigger recap_posts_set_updated_at
  before update on recap_posts
  for each row
  execute function set_recap_post_updated_at();

-- Extend the existing event-memory storage helpers to accept both legacy paths:
--   {event_id}/{user_id}/{filename}
-- and Recaps paths:
--   recaps/{event_id}/{user_id}/{filename}
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

  if path_parts[1] = 'recaps' then
    event_id_text := path_parts[2];
  else
    event_id_text := path_parts[1];
  end if;

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

  if path_parts[1] = 'recaps' then
    author_id_text := path_parts[3];
  else
    author_id_text := path_parts[2];
  end if;

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
    and user_can_read_event(auth.uid(), event_memory_path_event_id(name))
  );

drop policy if exists "Eligible users can upload event memory media" on storage.objects;
create policy "Eligible users can upload event memory media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-memories'
    and auth.uid() = event_memory_path_author_id(name)
    and user_can_post_recap_event(auth.uid(), event_memory_path_event_id(name))
  );

notify pgrst, 'reload schema';
