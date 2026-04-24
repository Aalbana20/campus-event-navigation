-- Web/mobile schema alignment.
-- Additive only: keeps legacy columns and policies in place while adding the
-- columns/tables/buckets both clients currently expect.

-- Stories: event-share stories are linked directly from both clients.
alter table if exists public.stories
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists stories_event_id_idx
  on public.stories(event_id)
  where event_id is not null;

-- Story reactions: current clients use reaction_type. Keep the legacy
-- reaction column for older clients and backfill the canonical column.
alter table if exists public.story_reactions
  add column if not exists reaction_type text;

do $$
begin
  if to_regclass('public.story_reactions') is null then
    return;
  end if;

  -- Always backfill reaction_type on its own; this is guaranteed to parse
  -- because reaction_type is added just above.
  update public.story_reactions
  set reaction_type = coalesce(nullif(reaction_type, ''), 'heart')
  where reaction_type is null or reaction_type = '';

  -- Legacy copy-over: only run when a `reaction` column actually exists on
  -- this project. Wrapping the UPDATE in EXECUTE ensures Postgres does NOT
  -- statically parse `reaction` on databases where that column is absent
  -- (parse-time reference would otherwise fail with "column reaction does
  -- not exist").
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'story_reactions'
      and column_name = 'reaction'
  ) then
    execute $sql$
      update public.story_reactions
      set reaction_type = coalesce(nullif(reaction_type, ''), nullif(reaction, ''), 'heart')
      where reaction_type is null or reaction_type = ''
    $sql$;
  end if;
end $$;

alter table if exists public.story_reactions
  alter column reaction_type set default 'heart',
  alter column reaction_type set not null;

do $$
begin
  if to_regclass('public.story_reactions') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'story_reactions_reaction_type_check'
        and conrelid = 'public.story_reactions'::regclass
    )
  then
    alter table public.story_reactions
      add constraint story_reactions_reaction_type_check
      check (reaction_type in ('heart'));
  end if;
end $$;

create index if not exists story_reactions_story_type_idx
  on public.story_reactions(story_id, reaction_type);

-- Discover post saves: used by web and mobile profile collections.
create table if not exists public.discover_post_saves (
  post_id    uuid not null references public.discover_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists discover_post_saves_post_id_idx
  on public.discover_post_saves(post_id);

create index if not exists discover_post_saves_user_id_idx
  on public.discover_post_saves(user_id);

alter table public.discover_post_saves enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discover_post_saves'
      and policyname = 'Discover post saves are readable by authenticated users'
  ) then
    create policy "Discover post saves are readable by authenticated users"
      on public.discover_post_saves for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discover_post_saves'
      and policyname = 'Users can save discover posts as themselves'
  ) then
    create policy "Users can save discover posts as themselves"
      on public.discover_post_saves for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discover_post_saves'
      and policyname = 'Users can remove their own discover post saves'
  ) then
    create policy "Users can remove their own discover post saves"
      on public.discover_post_saves for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

-- Profiles: support both legacy phone and phone_number while clients converge.
alter table if exists public.profiles
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists phone text,
  add column if not exists phone_number text,
  add column if not exists birthday date,
  add column if not exists interests text[],
  add column if not exists school text,
  add column if not exists updated_at timestamptz default now();

update public.profiles
set
  phone = coalesce(nullif(phone, ''), nullif(phone_number, '')),
  phone_number = coalesce(nullif(phone_number, ''), nullif(phone, ''))
where
  phone is distinct from coalesce(nullif(phone, ''), nullif(phone_number, ''))
  or phone_number is distinct from coalesce(nullif(phone_number, ''), nullif(phone, ''));

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Profiles are readable by authenticated users'
  ) then
    create policy "Profiles are readable by authenticated users"
      on public.profiles for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
      on public.profiles for update
      to authenticated
      using ((select auth.uid()) = id)
      with check ((select auth.uid()) = id);
  end if;
end $$;

-- Keep the auth trigger compatible with both phone columns.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(btrim(coalesce(meta->>'username', '')));
  v_account_type text := lower(btrim(coalesce(meta->>'account_type', 'regular')));
  v_phone text := nullif(coalesce(meta->>'phone_number', meta->>'phone'), '');
  v_interests text[];
  v_birth_month int;
  v_birth_year int;
begin
  if v_username = '' then
    v_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  if v_account_type not in ('student', 'organization', 'regular') then
    v_account_type := 'regular';
  end if;

  begin
    if jsonb_typeof(meta->'interests') = 'array' then
      select coalesce(array_agg(trim(both '"' from value::text)), '{}')
        into v_interests
      from jsonb_array_elements(meta->'interests');
    else
      v_interests := '{}';
    end if;
  exception when others then
    v_interests := '{}';
  end;

  begin
    v_birth_month := nullif(meta->>'birth_month','')::int;
  exception when others then
    v_birth_month := null;
  end;
  if v_birth_month is not null and (v_birth_month < 1 or v_birth_month > 12) then
    v_birth_month := null;
  end if;

  begin
    v_birth_year := nullif(meta->>'birth_year','')::int;
  exception when others then
    v_birth_year := null;
  end;

  insert into public.profiles (
    id, username, name, bio, avatar_url, email, phone, phone_number,
    account_type, first_name, last_name,
    birth_month, birth_year, gender,
    school, school_id, student_verified, verification_status,
    organization_name, organization_type, organization_description,
    organization_website, parent_organization_name, logo_url,
    interests
  )
  values (
    new.id,
    v_username,
    coalesce(nullif(meta->>'name',''), v_username),
    nullif(meta->>'bio',''),
    nullif(meta->>'avatar_url',''),
    coalesce(nullif(meta->>'email',''), new.email),
    v_phone,
    v_phone,
    v_account_type,
    case when v_account_type = 'organization' then null else nullif(meta->>'first_name','') end,
    case when v_account_type = 'organization' then null else nullif(meta->>'last_name','') end,
    case when v_account_type = 'organization' then null else v_birth_month end,
    case when v_account_type = 'organization' then null else v_birth_year end,
    case when v_account_type = 'organization' then null else nullif(meta->>'gender','') end,
    case when v_account_type = 'student' then nullif(meta->>'school','') else null end,
    case when v_account_type = 'student' then nullif(meta->>'school_id','') else null end,
    coalesce((meta->>'student_verified')::boolean, false),
    coalesce(nullif(meta->>'verification_status',''), 'unverified'),
    case when v_account_type = 'organization' then nullif(meta->>'organization_name','') else null end,
    case when v_account_type = 'organization' then nullif(meta->>'organization_type','') else null end,
    case when v_account_type = 'organization' then nullif(meta->>'organization_description','') else null end,
    case when v_account_type = 'organization' then nullif(meta->>'organization_website','') else null end,
    case when v_account_type = 'organization' then nullif(meta->>'parent_organization_name','') else null end,
    case when v_account_type = 'organization' then nullif(meta->>'logo_url','')
         else nullif(meta->>'avatar_url','') end,
    coalesce(v_interests, '{}')
  )
  on conflict (id) do update set
    username = excluded.username,
    name = coalesce(nullif(excluded.name,''), public.profiles.name),
    bio = coalesce(nullif(excluded.bio,''), public.profiles.bio),
    avatar_url = coalesce(nullif(excluded.avatar_url,''), public.profiles.avatar_url),
    email = coalesce(nullif(excluded.email,''), public.profiles.email),
    phone = coalesce(nullif(excluded.phone,''), public.profiles.phone),
    phone_number = coalesce(nullif(excluded.phone_number,''), public.profiles.phone_number),
    account_type = excluded.account_type,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    birth_month = excluded.birth_month,
    birth_year = excluded.birth_year,
    gender = excluded.gender,
    school = excluded.school,
    school_id = excluded.school_id,
    student_verified = excluded.student_verified,
    verification_status = excluded.verification_status,
    organization_name = excluded.organization_name,
    organization_type = excluded.organization_type,
    organization_description = excluded.organization_description,
    organization_website = excluded.organization_website,
    parent_organization_name = excluded.parent_organization_name,
    logo_url = excluded.logo_url,
    interests = case
      when array_length(excluded.interests, 1) is null then public.profiles.interests
      else excluded.interests
    end,
    updated_at = now();

  return new;
end;
$fn$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_auth_user();
  end if;
end $$;

-- Storage buckets/policies used by web and mobile clients.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', true, 10485760, array['image/heic','image/heif','image/jpeg','image/jpg','image/png','image/webp']),
  ('stories', 'stories', true, 125829120, array['image/heic','image/heif','image/jpeg','image/jpg','image/png','image/webp','video/mp4','video/quicktime','video/webm']),
  ('event-flyers', 'event-flyers', true, 52428800, array['image/heic','image/heif','image/jpeg','image/jpg','image/png','image/webp']),
  ('event-images', 'event-images', true, 52428800, array['image/heic','image/heif','image/jpeg','image/jpg','image/png','image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  bucket_name text;
begin
  foreach bucket_name in array array['profile-images', 'stories', 'event-flyers', 'event-images']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = bucket_name || ' authenticated uploads'
    ) then
      execute format(
        'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)',
        bucket_name || ' authenticated uploads',
        bucket_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = bucket_name || ' public reads'
    ) then
      execute format(
        'create policy %I on storage.objects for select using (bucket_id = %L)',
        bucket_name || ' public reads',
        bucket_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = bucket_name || ' owner updates'
    ) then
      execute format(
        'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and owner = (select auth.uid())) with check (bucket_id = %L and owner = (select auth.uid()))',
        bucket_name || ' owner updates',
        bucket_name,
        bucket_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = bucket_name || ' owner deletes'
    ) then
      execute format(
        'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and owner = (select auth.uid()))',
        bucket_name || ' owner deletes',
        bucket_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
