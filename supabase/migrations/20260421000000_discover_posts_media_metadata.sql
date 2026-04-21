-- Phase 1/2: keep one unified discover_posts table and add optional media
-- metadata used by image/video rendering, caching, and upload thumbnails.
alter table discover_posts
  add column if not exists thumbnail_url text,
  add column if not exists duration numeric,
  add column if not exists width integer,
  add column if not exists height integer;

