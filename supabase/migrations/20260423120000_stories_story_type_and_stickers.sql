-- Add story_type and stickers columns so share-to-story can persist sticker
-- metadata (linked event id + card transform) alongside the story media.
alter table public.stories
  add column if not exists story_type text not null default 'standard',
  add column if not exists stickers jsonb not null default '[]'::jsonb;

-- Force PostgREST's schema cache to refresh immediately after the DDL so the
-- REST API recognizes the new columns without requiring a project restart.
notify pgrst, 'reload schema';
