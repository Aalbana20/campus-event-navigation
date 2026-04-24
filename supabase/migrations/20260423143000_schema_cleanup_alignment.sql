-- Schema cleanup / compatibility alignment for web + mobile clients.
-- Safe additive migration only: no drops, no destructive rewrites.

alter table public.events
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz;

alter table public.discover_posts
  add column if not exists duration_seconds numeric,
  add column if not exists media_width integer,
  add column if not exists media_height integer;

update public.discover_posts
set
  duration_seconds = coalesce(duration_seconds, duration),
  media_width = coalesce(media_width, width),
  media_height = coalesce(media_height, height)
where
  duration_seconds is distinct from coalesce(duration_seconds, duration)
  or media_width is distinct from coalesce(media_width, width)
  or media_height is distinct from coalesce(media_height, height);

notify pgrst, 'reload schema';
