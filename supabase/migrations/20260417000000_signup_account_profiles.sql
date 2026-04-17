-- Campus Event Navigation — multi-account signup persistence.
--
-- Extends public.profiles so it acts as the single identity row for student,
-- regular, and organization accounts, and rewrites the auth.users insert
-- trigger so every onboarding field submitted through supabase.auth.signUp
-- options.data lands in the profile row automatically (regardless of whether
-- email confirmation is on).

alter table public.profiles
  add column if not exists email text,
  add column if not exists account_type text not null default 'regular',
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists birth_month smallint,
  add column if not exists birth_year smallint,
  add column if not exists gender text,
  add column if not exists school_id text,
  add column if not exists student_verified boolean not null default false,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists organization_name text,
  add column if not exists organization_type text,
  add column if not exists organization_description text,
  add column if not exists organization_website text,
  add column if not exists parent_organization_id uuid references public.profiles(id) on delete set null,
  add column if not exists parent_organization_name text,
  add column if not exists logo_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_type_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_check
      check (account_type in ('student', 'organization', 'regular'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('Male', 'Female'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_birth_month_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_birth_month_check
      check (birth_month is null or birth_month between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_verification_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;
end $$;

create index if not exists profiles_account_type_idx
  on public.profiles(account_type);

create index if not exists profiles_school_id_idx
  on public.profiles(school_id)
  where school_id is not null;

create index if not exists profiles_parent_organization_id_idx
  on public.profiles(parent_organization_id)
  where parent_organization_id is not null;

-- Server-side persistence. Every key from raw_user_meta_data (as written by
-- the web + mobile signUp flows) maps onto the matching profiles column.
-- Runs SECURITY DEFINER so it works for email-confirmation flows where the
-- client has no session to satisfy RLS.
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
    id, username, name, bio, avatar_url, email, phone,
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
    nullif(meta->>'phone_number',''),
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
    end;

  return new;
end;
$fn$;
