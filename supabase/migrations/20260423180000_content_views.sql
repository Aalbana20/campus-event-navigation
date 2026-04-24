-- Unified view-tracking table for the Explore grid and any other surface that
-- needs per-content view counts (posts, videos, events).
create table if not exists public.content_views (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('post','video','event')),
  content_id   uuid not null,
  created_at   timestamptz not null default now()
);

create index if not exists content_views_content_idx
  on public.content_views (content_type, content_id);

create index if not exists content_views_user_idx
  on public.content_views (user_id, created_at desc);

alter table public.content_views enable row level security;

drop policy if exists "content_views_insert_anyone" on public.content_views;
create policy "content_views_insert_anyone"
  on public.content_views
  for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "content_views_select_all" on public.content_views;
create policy "content_views_select_all"
  on public.content_views
  for select
  using (true);

notify pgrst, 'reload schema';
