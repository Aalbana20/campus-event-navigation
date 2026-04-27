-- Signup alignment + safety pass.
--
-- Goals:
--   1. Re-establish RLS policies on public.profiles. The dedup migration
--      20260427000000_comment_count_trigger_dedup_cleanup dropped both the
--      authenticated-read and owner-update policies without replacement,
--      leaving the table policy-less. With RLS still enabled, every query
--      from non-service roles silently returns zero rows — including the
--      signup username-availability check (which always reported "available")
--      and EditProfile updates (silently no-op).
--
--   2. Allow the signup username-availability check to run with the anon
--      role, but expose only identification columns (id, username) — phone,
--      birth info, school_email, etc. stay protected.
--
--   3. Add public.profiles.categories text[] for organization categories
--      collected during onboarding (Music / Sports / etc.). Mirrors the
--      existing interests column for individual users.
--
--   4. Tighten the profile-images storage bucket so an INSERT can only
--      target a path prefixed with the calling user's id. UPDATE/DELETE
--      already check storage.objects.owner; this closes the gap on INSERT.
--
-- All operations are idempotent; running multiple times is safe.

-- 1. Categories column ------------------------------------------------------
alter table public.profiles
  add column if not exists categories text[] not null default '{}';

-- 2. Trigger: re-issue with categories support ------------------------------
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
  v_categories text[];
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
    if jsonb_typeof(meta->'categories') = 'array' then
      select coalesce(array_agg(trim(both '"' from value::text)), '{}')
        into v_categories
      from jsonb_array_elements(meta->'categories');
    else
      v_categories := '{}';
    end if;
  exception when others then
    v_categories := '{}';
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
    interests, categories
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
    case when v_account_type = 'student' then coalesce(nullif(meta->>'school',''), nullif(meta->>'school_name','')) else null end,
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
    coalesce(v_interests, '{}'),
    coalesce(v_categories, '{}')
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
    categories = case
      when array_length(excluded.categories, 1) is null then public.profiles.categories
      else excluded.categories
    end,
    updated_at = now();

  return new;
end;
$fn$;

-- 3. RLS on public.profiles -------------------------------------------------
alter table public.profiles enable row level security;

-- Authenticated users can read all profile rows (used for displaying any
-- user's name, avatar, username, bio across the app).
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Anonymous users (pre-signup) need to read profiles for the username
-- availability check. Row access is broad, but column-level grants below
-- keep sensitive fields hidden.
drop policy if exists "Profiles are readable by anonymous users" on public.profiles;
create policy "Profiles are readable by anonymous users"
  on public.profiles for select
  to anon
  using (true);

-- Owners can insert their own row (rare, the trigger normally handles this,
-- but EditProfile and other callers occasionally upsert).
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Owners can update only their own row.
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 4. Anon column-level lockdown ---------------------------------------------
-- Default postgres grants give anon full table SELECT. Lock that down to a
-- short whitelist of identification columns. Phone, birth_month/year,
-- school_email, gender, email, etc. are NOT granted to anon and so will not
-- appear in any unauthenticated query, even with a permissive RLS policy.
revoke all on public.profiles from anon;
grant select (
  id,
  username,
  account_type,
  name,
  avatar_url,
  logo_url,
  organization_name
) on public.profiles to anon;

-- 5. Storage: tighten profile-images insert path ----------------------------
-- The bucket-wide policy created in 20260424120000_web_mobile_schema_alignment
-- only checks bucket_id, which means an authenticated user could upload under
-- another user's filename prefix. Replace it with a path-scoped check that
-- mirrors the app's upload convention: avatars/<auth.uid()>-<timestamp>.<ext>
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'profile-images_insert_authenticated'
  ) then
    drop policy "profile-images_insert_authenticated" on storage.objects;
  end if;

  create policy "profile-images_insert_authenticated"
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'profile-images'
      and name like ('avatars/' || (select auth.uid())::text || '-%')
    );
end $$;
