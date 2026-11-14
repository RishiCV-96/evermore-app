-- TEST FIXTURE, not for a real project. supabase/schema.sql as it was before the profile
-- questionnaire (commit 1e81937). supabase/tests/rls.test.mjs runs it, adds a family, then runs
-- the current schema over it to check that the upgrade keeps every row.

-- Evermore: tables, indexes, Row Level Security, and the private photo bucket.
--
-- Run once in the Supabase Dashboard: SQL Editor -> New query -> paste this file -> Run.
-- It is written to be safe to run again after changes (create if not exists, replace
-- functions, drop and recreate policies).
--
-- A family group is one caregiver and the one person they practice with (more of either is
-- not built yet). Every family row carries caregiver_id, the caregiver's user id, and
-- composite foreign keys keep a row from pointing into another family.

-- ---------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('caregiver', 'person')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  -- Set for a person: the caregiver who created their login. Null for a caregiver.
  caregiver_id uuid references public.profiles (id) on delete cascade,
  -- A person's User ID, chosen by the caregiver. Their login email is derived from it.
  username text unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  check ((role = 'person') = (caregiver_id is not null)),
  check (role = 'person' or consented_at is not null),
  unique (id, caregiver_id)
);
-- One person per caregiver for now.
create unique index if not exists profiles_one_person_per_caregiver
  on public.profiles (caregiver_id) where role = 'person';

-- The people who appear on cards.
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  relationship text not null default '' check (char_length(relationship) <= 40),
  -- Path inside the private "photos" bucket: <caregiver_id>/<file>.
  photo_path text,
  -- Fictional sample people use an illustration bundled with the app instead of a photo.
  sample_portrait text,
  created_at timestamptz not null default now(),
  unique (id, caregiver_id)
);
create index if not exists people_caregiver on public.people (caregiver_id);

-- Hints (added 2026-11-03): which rungs of the hint ladder the caregiver allows for each
-- person. The order is fixed (first letter, another fact, the relationship, fewer names);
-- all are on unless the caregiver turns one off.
alter table public.people add column if not exists hint_letter boolean not null default true;
alter table public.people add column if not exists hint_fact boolean not null default true;
alter table public.people add column if not exists hint_relationship boolean not null default true;
alter table public.people add column if not exists hint_fewer boolean not null default true;

-- One fact about a person each: the caregiver's words (memory_text) and what kind of fact
-- they are. Only approved cards reach the person.
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid(),
  person_id uuid not null,
  memory_text text not null check (char_length(memory_text) between 1 and 120),
  -- The fixed-template sentence built from the caregiver's words, with {name} for the blank.
  sentence text not null check (sentence like '%{name}%'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, caregiver_id),
  foreign key (person_id, caregiver_id) references public.people (id, caregiver_id) on delete cascade
);
create index if not exists cards_caregiver_status on public.cards (caregiver_id, status);
create index if not exists cards_person on public.cards (person_id);

-- Facts (added 2026-11-03). "add column if not exists", so running this file again upgrades
-- an existing project: every earlier card becomes a "memory" fact from the caregiver, with
-- its words, sentence, status, schedule and practice history unchanged.
-- The kinds of fact match FACT_TYPES in src/lib/stories.ts.
alter table public.cards add column if not exists fact_type text not null default 'memory'
  check (fact_type in ('memory', 'work', 'interest', 'team', 'show', 'food', 'music', 'shared', 'met', 'birthday'));
-- A fact that may change (a job, a plan) is shown only with the month it was true (as_of),
-- and only once the caregiver has confirmed it (confirmed_at).
alter table public.cards add column if not exists time_sensitive boolean not null default false;
alter table public.cards add column if not exists as_of date;
alter table public.cards add column if not exists confirmed_at timestamptz;
-- Who gave the fact. Only 'caregiver' for now; relatives can contribute later.
alter table public.cards add column if not exists source text not null default 'caregiver'
  check (char_length(source) between 1 and 40);
-- Phrasings (src/lib/stories.ts) the caregiver turned off for this fact. Practice asks the
-- fact only in the fixed shapes left on.
alter table public.cards add column if not exists phrasings_off text[] not null default '{}';
alter table public.cards drop constraint if exists cards_dated_if_it_may_change;
alter table public.cards add constraint cards_dated_if_it_may_change check (not time_sensitive or as_of is not null);

-- A practice session. Ids are made on the phone so sessions can be saved offline and synced.
create table if not exists public.sessions (
  id uuid primary key,
  caregiver_id uuid not null,
  -- Null only for dev sample activity written before the person has a login.
  person_user_id uuid,
  started_at timestamptz not null,
  completed_at timestamptz,
  cards_completed int not null default 0 check (cards_completed >= 0),
  -- The daily goal when the session started, so a later change doesn't rewrite past days.
  daily_goal int not null check (daily_goal between 3 and 10),
  is_sample boolean not null default false,
  check (is_sample or person_user_id is not null),
  unique (id, caregiver_id),
  foreign key (caregiver_id) references public.profiles (id) on delete cascade,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
create index if not exists sessions_caregiver_started on public.sessions (caregiver_id, started_at);

-- Every answered card. Used only to schedule cards: the correctness columns can't be read
-- through the API at all (see the grants below), so no screen can show them.
create table if not exists public.attempts (
  id uuid primary key,
  caregiver_id uuid not null,
  card_id uuid not null,
  person_user_id uuid,
  session_id uuid not null,
  attempted_at timestamptz not null,
  tries int not null check (tries >= 1),
  first_try_correct boolean not null,
  hints_used int not null check (hints_used >= 0),
  foreign key (card_id, caregiver_id) references public.cards (id, caregiver_id) on delete cascade,
  foreign key (session_id, caregiver_id) references public.sessions (id, caregiver_id) on delete cascade,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
create index if not exists attempts_caregiver_time on public.attempts (caregiver_id, attempted_at);

-- When each card comes back. Steps and intervals are in src/config/schedule.ts.
create table if not exists public.card_schedule (
  card_id uuid not null,
  person_user_id uuid not null,
  caregiver_id uuid not null,
  step int not null check (step between 0 and 5),
  due_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (card_id, person_user_id),
  foreign key (card_id, caregiver_id) references public.cards (id, caregiver_id) on delete cascade,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
create index if not exists card_schedule_person_due on public.card_schedule (person_user_id, due_at);

-- Cards per day. One person per family, so the goal belongs to the family.
create table if not exists public.daily_goal (
  caregiver_id uuid primary key references public.profiles (id) on delete cascade,
  goal int not null default 5 check (goal between 3 and 10),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------
-- Helpers for policies. Security definer so they can read profiles without recursing
-- through its own policies.
-- ---------------------------------------------------------------------------------------

-- For a signed-in person: their caregiver's id. Null for anyone else.
create or replace function public.my_caregiver()
returns uuid language sql stable security definer set search_path = '' as $$
  select caregiver_id from public.profiles where id = auth.uid() and role = 'person'
$$;

-- True when the signed-in user is a caregiver.
create or replace function public.is_caregiver()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'caregiver')
$$;

-- ---------------------------------------------------------------------------------------
-- New users. A caregiver who signs up gets a profile, a daily goal and five fictional
-- sample people. A person's login is made by the manage-family Edge Function, which writes
-- their profile itself with the server key, so nobody can sign themselves up into a family.
-- ---------------------------------------------------------------------------------------

create or replace function public.seed_sample_people(family uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  sample record;
  new_person uuid;
begin
  -- Made-up people with illustrated portraits bundled in the app. One memory each, in the
  -- standard template "My {relationship}, {name}, {memory}."
  for sample in
    select * from (values
      ('June', 'aunt', 'grows tomatoes and shares them every summer', 'june'),
      ('Leo', 'neighbor', 'walks his dog past the house every morning', 'leo'),
      ('Ruth', 'cousin', 'knits warm scarves for the whole family', 'ruth'),
      ('Omar', 'friend', 'plays chess at the library on Tuesdays', 'omar'),
      ('Mae', 'granddaughter', 'loves to bake banana bread', 'mae')
    ) as t (name, relationship, memory, portrait)
  loop
    insert into public.people (caregiver_id, name, relationship, sample_portrait)
    values (family, sample.name, sample.relationship, sample.portrait)
    returning id into new_person;
    insert into public.cards (caregiver_id, person_id, memory_text, sentence, status)
    values (family, new_person, sample.memory,
            'My ' || sample.relationship || ', {name}, ' || sample.memory || '.', 'approved');
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Made by the Edge Function, which adds the person's profile next. Anyone who sets this
  -- flag on a public sign-up just gets a login with no profile, which can read nothing.
  if new.raw_user_meta_data ? 'evermore_person' then
    return new;
  end if;
  -- Sign-up requires the consent checkbox: profiles rejects a caregiver without consented_at,
  -- which fails the whole sign-up.
  insert into public.profiles (id, role, display_name, consented_at)
  values (
    new.id,
    'caregiver',
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60),
    nullif(new.raw_user_meta_data ->> 'consented_at', '')::timestamptz
  );
  insert into public.daily_goal (caregiver_id) values (new.id);
  perform public.seed_sample_people(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------
-- Grants. Signed-out visitors get nothing. Profiles are changed only by the trigger and the
-- Edge Function, apart from a display name.
-- ---------------------------------------------------------------------------------------

revoke all on public.profiles, public.people, public.cards, public.sessions, public.attempts,
  public.card_schedule, public.daily_goal from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.people, public.cards, public.sessions,
  public.card_schedule, public.daily_goal to authenticated;
-- Attempts: write all columns, but read only the ones that say a card was practiced.
grant insert, delete on public.attempts to authenticated;
grant select (id, caregiver_id, card_id, person_user_id, session_id, attempted_at)
  on public.attempts to authenticated;
-- The manage-family Edge Function works as service_role (the secret key). Some projects
-- don't grant new tables to it automatically, so grant what it needs explicitly.
grant select, insert, update, delete on public.profiles, public.people, public.cards, public.sessions,
  public.attempts, public.card_schedule, public.daily_goal to service_role;

revoke execute on function public.seed_sample_people(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Row Level Security
--   Caregiver: everything in their own family (caregiver_id = their id), nothing else.
--   Person: reads cards in practice (approved and, for a fact that may change, confirmed;
--   the same rule as inPractice in src/lib/facts.ts), the people on them and the daily goal;
--   reads and writes only their own sessions, attempts and schedule rows.
-- ---------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.cards enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.card_schedule enable row level security;
alter table public.daily_goal enable row level security;

-- profiles
drop policy if exists "profiles: read own and own person" on public.profiles;
create policy "profiles: read own and own person" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or caregiver_id = (select auth.uid()));
drop policy if exists "profiles: rename self" on public.profiles;
create policy "profiles: rename self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- people
drop policy if exists "people: caregiver family" on public.people;
create policy "people: caregiver family" on public.people for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "people: person reads people on approved cards" on public.people;
create policy "people: person reads people on approved cards" on public.people for select to authenticated
  using (
    caregiver_id = (select public.my_caregiver())
    and exists (
      select 1 from public.cards c
      where c.person_id = people.id and c.status = 'approved' and (not c.time_sensitive or c.confirmed_at is not null)
    )
  );

-- cards
drop policy if exists "cards: caregiver family" on public.cards;
create policy "cards: caregiver family" on public.cards for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "cards: person reads approved" on public.cards;
create policy "cards: person reads approved" on public.cards for select to authenticated
  using (
    caregiver_id = (select public.my_caregiver())
    and status = 'approved'
    and (not time_sensitive or confirmed_at is not null)
  );

-- sessions
drop policy if exists "sessions: caregiver family" on public.sessions;
create policy "sessions: caregiver family" on public.sessions for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "sessions: person own" on public.sessions;
create policy "sessions: person own" on public.sessions for all to authenticated
  using (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()))
  with check (
    person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()) and not is_sample
  );

-- attempts
drop policy if exists "attempts: caregiver family" on public.attempts;
create policy "attempts: caregiver family" on public.attempts for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "attempts: person own" on public.attempts;
create policy "attempts: person own" on public.attempts for all to authenticated
  using (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()))
  with check (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()));

-- card_schedule
drop policy if exists "card_schedule: caregiver family" on public.card_schedule;
create policy "card_schedule: caregiver family" on public.card_schedule for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "card_schedule: person own" on public.card_schedule;
create policy "card_schedule: person own" on public.card_schedule for all to authenticated
  using (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()))
  with check (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()));

-- daily_goal
drop policy if exists "daily_goal: caregiver family" on public.daily_goal;
create policy "daily_goal: caregiver family" on public.daily_goal for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "daily_goal: person reads" on public.daily_goal;
create policy "daily_goal: person reads" on public.daily_goal for select to authenticated
  using (caregiver_id = (select public.my_caregiver()));

-- ---------------------------------------------------------------------------------------
-- Photos: a private bucket. Files live at <caregiver_id>/<file>, so the first folder of the
-- path is the family. The app shows them through short-lived signed URLs.
-- ---------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "photos: caregiver family" on storage.objects;
create policy "photos: caregiver family" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.is_caregiver()))
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.is_caregiver()));
drop policy if exists "photos: person reads family" on storage.objects;
create policy "photos: person reads family" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.my_caregiver())::text);
