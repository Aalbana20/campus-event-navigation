alter table public.events
  add column if not exists image_urls text[] not null default '{}'::text[];

alter table public.events
  add column if not exists location_coordinates jsonb;

update public.events
set image_urls = array_remove(array[nullif(image, '')], null)
where coalesce(array_length(image_urls, 1), 0) = 0
  and nullif(image, '') is not null;
