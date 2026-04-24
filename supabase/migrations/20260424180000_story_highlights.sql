-- Story highlights: Instagram-style pinned collections of past stories.
--
-- Two tables, both additive. The stories table is untouched so existing
-- 24-hour expiry logic keeps working on the clients that filter by
-- `expires_at > now()`.
--
-- Each highlight item also snapshots the story's media (url / type / caption /
-- created_at). That means even if a story row is later deleted — by a future
-- cron, by the author, or by migration — the highlight keeps playing the
-- saved content. This is the "safe archive" approach: no changes to how live
-- stories behave, but highlights own their media reference durably.

create table if not exists story_highlights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  title      text not null default 'Highlight' check (char_length(btrim(title)) > 0),
  cover_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists story_highlights_user_id_idx
  on story_highlights(user_id);

create table if not exists story_highlight_items (
  id               uuid primary key default gen_random_uuid(),
  highlight_id     uuid not null references story_highlights(id) on delete cascade,
  -- `set null` (not cascade) so the highlight keeps playing from its snapshot
  -- even if the source story row is removed.
  story_id         uuid references stories(id) on delete set null,
  position         integer not null default 0,
  media_url        text not null,
  media_type       text not null check (media_type in ('image', 'video')),
  caption          text,
  story_created_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists story_highlight_items_highlight_id_idx
  on story_highlight_items(highlight_id);

create index if not exists story_highlight_items_position_idx
  on story_highlight_items(highlight_id, position);

alter table story_highlights        enable row level security;
alter table story_highlight_items   enable row level security;

-- Highlights are public read (so visitors can see them), but only owners
-- can mutate. Matches how profiles/discover_posts are exposed.
drop policy if exists "Story highlights readable by authenticated users" on story_highlights;
create policy "Story highlights readable by authenticated users"
  on story_highlights for select
  to authenticated
  using (true);

drop policy if exists "Users can create their own story highlights" on story_highlights;
create policy "Users can create their own story highlights"
  on story_highlights for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own story highlights" on story_highlights;
create policy "Users can update their own story highlights"
  on story_highlights for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own story highlights" on story_highlights;
create policy "Users can delete their own story highlights"
  on story_highlights for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Items mirror the parent highlight's ownership rules through an EXISTS
-- subquery so we don't need to denormalise user_id onto the items table.
drop policy if exists "Story highlight items readable by authenticated users" on story_highlight_items;
create policy "Story highlight items readable by authenticated users"
  on story_highlight_items for select
  to authenticated
  using (true);

drop policy if exists "Users can add items to their own highlights" on story_highlight_items;
create policy "Users can add items to their own highlights"
  on story_highlight_items for insert
  to authenticated
  with check (
    exists (
      select 1 from story_highlights h
      where h.id = story_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update items on their own highlights" on story_highlight_items;
create policy "Users can update items on their own highlights"
  on story_highlight_items for update
  to authenticated
  using (
    exists (
      select 1 from story_highlights h
      where h.id = story_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from story_highlights h
      where h.id = story_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can remove items from their own highlights" on story_highlight_items;
create policy "Users can remove items from their own highlights"
  on story_highlight_items for delete
  to authenticated
  using (
    exists (
      select 1 from story_highlights h
      where h.id = story_highlight_items.highlight_id
        and h.user_id = (select auth.uid())
    )
  );

-- Keep updated_at fresh on any row-level change to story_highlights.
create or replace function set_story_highlights_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists story_highlights_set_updated_at on story_highlights;
create trigger story_highlights_set_updated_at
  before update on story_highlights
  for each row execute function set_story_highlights_updated_at();

-- Force PostgREST to pick up the new tables immediately.
notify pgrst, 'reload schema';
