-- Item 2: add comment_count to discover_posts and maintain via trigger
alter table public.discover_posts
  add column if not exists comment_count integer not null default 0;

update public.discover_posts dp
set comment_count = (
  select count(*) from public.discover_post_comments c where c.post_id = dp.id
);

create or replace function public.fn_maintain_post_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.discover_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.discover_posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_post_comment_count on public.discover_post_comments;
create trigger trg_post_comment_count
  after insert or delete on public.discover_post_comments
  for each row execute function public.fn_maintain_post_comment_count();

-- Item 4: drop duplicate events updated_at trigger
drop trigger if exists events_touch_updated_at on public.events;

-- Item 5: drop duplicate policies on discover_post_saves
drop policy if exists "Users can remove their own discover post saves" on public.discover_post_saves;
drop policy if exists "Users can save discover posts as themselves" on public.discover_post_saves;
drop policy if exists "Users can read own saves" on public.discover_post_saves;

-- Item 5: drop duplicate policies on profiles
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
