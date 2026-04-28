-- Add birth_day to profiles so the new onboarding flow can persist a full
-- birthday (month + day + year). Additive only — existing rows stay null,
-- existing trigger logic is preserved, and the new column is optional in
-- raw_user_meta_data so older clients keep working.

alter table public.profiles
  add column if not exists birth_day smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_birth_day_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_birth_day_check
      check (birth_day is null or birth_day between 1 and 31);
  end if;
end $$;

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
  v_birth_day int;
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
    v_birth_day := nullif(meta->>'birth_day','')::int;
  exception when others then
    v_birth_day := null;
  end;
  if v_birth_day is not null and (v_birth_day < 1 or v_birth_day > 31) then
    v_birth_day := null;
  end if;

  begin
    v_birth_year := nullif(meta->>'birth_year','')::int;
  exception when others then
    v_birth_year := null;
  end;

  insert into public.profiles (
    id, username, name, bio, avatar_url, email, phone, phone_number,
    account_type, first_name, last_name,
    birth_month, birth_day, birth_year, gender,
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
    case when v_account_type = 'organization' then null else v_birth_day end,
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
    birth_day = excluded.birth_day,
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
