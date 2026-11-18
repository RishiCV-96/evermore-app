-- Evermore: tables, indexes, Row Level Security, and the private photo bucket.
--
-- Run once in the Supabase Dashboard: SQL Editor -> New query -> paste this file -> Run.
-- It is written to be safe to run again after changes (create if not exists, replace
-- functions, drop and recreate policies).
--
-- A family group is one caregiver and the one person they practice with (more of either is
-- not built yet). The person may sign in on more than one phone: a User ID login the caregiver
-- makes, and a login of its own for each phone paired with a PIN. Every family row carries
-- caregiver_id, the caregiver's user id, and composite foreign keys keep a row from pointing into
-- another family.

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
-- One login with a User ID per family ("Their login"). Phones paired with the caregiver's email and a
-- PIN (added 2026-11-11) each get a login of their own, with no User ID, so a family may have several
-- person logins: the old one-person-per-caregiver index is replaced by this one.
drop index if exists public.profiles_one_person_per_caregiver;
create unique index if not exists profiles_one_named_login_per_caregiver
  on public.profiles (caregiver_id) where role = 'person' and username is not null;

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

-- The profile questionnaire (added 2026-11-04). profile_step is the furthest step the caregiver
-- reached (0 to 7), so they can pick up where they left off. best_clue is what they say helps
-- most in recognizing this person; it steers the fact hint.
alter table public.people add column if not exists profile_step int not null default 0
  check (profile_step between 0 and 7);
alter table public.people add column if not exists best_clue text
  check (best_clue in ('voice', 'laugh', 'job', 'hobby', 'met'));

-- The 100% gate (added 2026-11-04). not_applicable holds the ids of questions the caregiver
-- marked "Not applicable" (src/data/questionnaire.ts): it counts toward completion and creates no
-- fact. in_deck says the caregiver added a complete profile to practice; until then the person
-- is a draft, and the person's login can't read them or their cards. New and existing people
-- start as drafts.
alter table public.people add column if not exists not_applicable text[] not null default '{}';
alter table public.people add column if not exists in_deck boolean not null default false;

-- Everyone complete is in the deck unless deselected (added 2026-11-05). include_in_practice is
-- the caregiver's toggle, on by default. The app keeps in_deck in step with it, since a database
-- rule can't see the percent; the person's read policies check both, so deselecting someone
-- takes effect at once.
alter table public.people add column if not exists include_in_practice boolean not null default true;
-- Reveal cards (added 2026-11-05): false opts this person out, so their photo always shows first.
alter table public.people add column if not exists reveal_ok boolean not null default true;
-- Archived people (added 2026-11-09). archived_at is when the caregiver archived someone, null while
-- they are active, so everyone already here stays active. Archiving keeps everything about them
-- (facts, photos, schedule, practice history) and takes them out of practice at once: the person's
-- read policies and person_in_deck check it, whatever in_deck says. Only deleting the row removes
-- them, and their facts, schedule and attempts go with it (foreign keys).
alter table public.people add column if not exists archived_at timestamptz;

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
alter table public.cards add column if not exists fact_type text not null default 'memory';
alter table public.cards drop constraint if exists cards_fact_type_check;
alter table public.cards add constraint cards_fact_type_check check (fact_type in (
  'memory', 'work', 'pastwork', 'field', 'workplace', 'plans', 'interest', 'team', 'show', 'movie',
  'food', 'music', 'place', 'habit', 'shared', 'regular', 'holiday', 'met', 'birthday', 'nickname',
  'calls', 'known', 'home', 'lives_with', 'partner', 'child', 'pet', 'marital', 'situation'
));
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
-- From the profile questionnaire (added 2026-11-04). A shared memory can have a year, and a
-- photo in the private bucket (shown with the sentence once it's answered). hint_ok is false
-- for a fact the caregiver doesn't want used as a hint.
alter table public.cards add column if not exists memory_year int check (memory_year between 1900 and 2100);
alter table public.cards add column if not exists photo_path text;
alter table public.cards add column if not exists hint_ok boolean not null default true;
alter table public.cards drop constraint if exists cards_dated_if_it_may_change;
alter table public.cards add constraint cards_dated_if_it_may_change check (not time_sensitive or as_of is not null);
-- Which wording the card's sentences use (added 2026-11-18, docs/SENTENCE-AUDIT.md). 1 is the original
-- fixed templates, kept exactly for every card approved or in use before then; 2 is the fluent wording
-- (src/lib/wording.ts) that new and edited drafts get, which the app writes itself. Additive and safe to
-- rerun: the column and its one-time move happen only the first time this runs. That once, cards still
-- waiting for approval move to wording 2, so the caregiver reads the new sentence before approving;
-- approved and skipped cards (the sample people's among them) stay 1. A caregiver moves one person's
-- cards on purpose with "Use the new wording" on their sheet.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'wording'
  ) then
    alter table public.cards add column wording smallint not null default 1;
    update public.cards set wording = 2 where status = 'pending';
  end if;
end $$;
alter table public.cards drop constraint if exists cards_wording_check;
alter table public.cards add constraint cards_wording_check check (wording in (1, 2));

-- A practice session. Ids are made on the phone so sessions can be saved offline and synced.
create table if not exists public.sessions (
  id uuid primary key,
  caregiver_id uuid not null,
  -- Null only for dev sample activity written before the person has a login.
  person_user_id uuid,
  started_at timestamptz not null,
  completed_at timestamptz,
  cards_completed int not null default 0 check (cards_completed >= 0),
  -- The day's target when the session started, so a later change doesn't rewrite past days.
  daily_goal int not null check (daily_goal between 1 and 200),
  is_sample boolean not null default false,
  check (is_sample or person_user_id is not null),
  unique (id, caregiver_id),
  foreign key (caregiver_id) references public.profiles (id) on delete cascade,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
create index if not exists sessions_caregiver_started on public.sessions (caregiver_id, started_at);
-- The day's target is worked out from the deck (added 2026-11-05), so it can be well past 10.
alter table public.sessions drop constraint if exists sessions_daily_goal_check;
alter table public.sessions add constraint sessions_daily_goal_check check (daily_goal between 1 and 200);
-- The study day a session counts toward (added 2026-11-12): the date its 05:30-to-05:29 day began
-- on, worked out on the person's phone in its own time zone when the session started
-- (src/lib/study-day.ts). Null on older sessions, whose day the app works out from started_at.
alter table public.sessions add column if not exists study_day date;

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

-- Each card's record for the caregiver's insights (added 2026-11-10): one row per card shown, made on
-- the person's phone as they leave the card (src/lib/attempts.ts), and the only source of insights
-- with sign-in on. It sits beside attempts rather than in it: attempts is the scheduling log, sent
-- at the right name, and its correctness columns stay unreadable. The person's login can only insert
-- records, for its own family; the caregiver's login can only read them, and delete them. They hold
-- ids, the shape, the kind of fact, each choice in order, the hints and active time: never a name, a
-- photo or anyone's words, and never whether a card started behind the "?". Kept 120 days, as on the
-- phone (attempt_records_prune below). Deleting a person or the family deletes their records.
create table if not exists public.attempt_records (
  -- Made on the phone, so an upload sent twice can't make a second row.
  id uuid primary key,
  caregiver_id uuid not null references public.profiles (id) on delete cascade,
  -- The person's login that practiced.
  person_user_id uuid not null,
  -- Whose card it was: the person in the photo.
  person_id uuid not null,
  -- The fact asked. Not a foreign key: a fact the caregiver removes keeps its records, as on the phone.
  card_id uuid not null,
  -- How it was asked: one of the fixed shapes in src/lib/stories.ts, or an approved AI sentence's id.
  phrasing_id text not null check (phrasing_id ~ '^(my-rel|name|favorite|ask|ask-met|whose|who|photo|ai-[0-9a-f-]{36})$'),
  shape text not null check (shape in ('blank', 'ask', 'who', 'photo', 'reverse')),
  -- Null only for a card from before facts. The same kinds as cards_fact_type_check.
  fact_type text check (fact_type in (
    'memory', 'work', 'pastwork', 'field', 'workplace', 'plans', 'interest', 'team', 'show', 'movie',
    'food', 'music', 'place', 'habit', 'shared', 'regular', 'holiday', 'met', 'birthday', 'nickname',
    'calls', 'known', 'home', 'lives_with', 'partner', 'child', 'pet', 'marital', 'situation'
  )),
  source text not null check (source in ('template', 'ai')),
  session_id uuid not null,
  shown_at timestamptz not null,
  -- Each answer chosen, in order: when, and whether it was the right one.
  selected_at timestamptz[] not null default '{}',
  selected_right boolean[] not null default '{}',
  -- How many answers were offered at the start.
  choices int not null check (choices between 0 and 10),
  -- The hint rungs shown, one for each other answer chosen.
  hints text[] not null default '{}' check (hints <@ array['letter', 'fact', 'relationship', 'fewer'] and cardinality(hints) <= 200),
  -- Ended on the right answer: false only when the person left the card first.
  success boolean not null,
  -- On screen while the app was in use, and up to the first choice.
  active_ms int not null check (active_ms between 0 and 86400000),
  first_selection_ms int check (first_selection_ms between 0 and 86400000),
  -- The day's target when the card was practiced.
  goal int not null check (goal between 0 and 200),
  -- Came back after a hint (a re-ask or the review pass), so not one of the day's cards.
  extra boolean not null default false,
  -- When the server took it, so the caregiver's phone fetches only what is new. Only the server sets it.
  uploaded_at timestamptz not null default now(),
  check (cardinality(selected_at) = cardinality(selected_right) and cardinality(selected_at) <= 200),
  foreign key (person_id, caregiver_id) references public.people (id, caregiver_id) on delete cascade,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
-- The caregiver's reads: a family's records over a time range, and what is new since the last fetch.
create index if not exists attempt_records_family_shown on public.attempt_records (caregiver_id, shown_at);
create index if not exists attempt_records_family_uploaded on public.attempt_records (caregiver_id, uploaded_at, id);
-- So deleting a person or a login doesn't scan every family's records.
create index if not exists attempt_records_person on public.attempt_records (person_id, caregiver_id);
create index if not exists attempt_records_login on public.attempt_records (person_user_id);
-- The study day a record counts toward (added 2026-11-12): its round's, worked out on the phone when
-- the round began. Null on older records, whose day the app works out from shown_at. And whether its
-- round began once the day's session was complete: extra practice, counted and labelled as such.
alter table public.attempt_records add column if not exists study_day date;
alter table public.attempt_records add column if not exists extra_practice boolean not null default false;
-- Each "I'm not sure" tap on the card (added 2026-11-13): when, and the hint step it reached (a rung,
-- 'wait' for "Take your time." with every rung off, or 'answer'). Asking for help, never a wrong
-- answer: it adds nothing to selected_at. Empty on older records, so they read as before.
alter table public.attempt_records add column if not exists help_at timestamptz[] not null default '{}';
alter table public.attempt_records add column if not exists help_steps text[] not null default '{}';
alter table public.attempt_records drop constraint if exists attempt_records_help_check;
alter table public.attempt_records add constraint attempt_records_help_check check (
  help_steps <@ array['fact', 'relationship', 'letter', 'fewer', 'wait', 'answer']
  and cardinality(help_at) = cardinality(help_steps) and cardinality(help_steps) <= 200
);

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

-- Practice settings. One person per family, so they belong to the family. goal is the old
-- fixed number of cards a day; the app no longer reads it.
create table if not exists public.daily_goal (
  caregiver_id uuid primary key references public.profiles (id) on delete cascade,
  goal int not null default 5 check (goal between 3 and 10),
  updated_at timestamptz not null default now()
);
-- How long a day of practice is (added 2026-11-05): the app works out the day's target from this
-- and the deck. The values match SessionLength in src/config/schedule.ts.
alter table public.daily_goal add column if not exists session_length text not null default 'standard'
  check (session_length in ('short', 'standard', 'long'));
-- How often a card's photo starts behind a "?" (added 2026-11-05). The values match RevealSetting
-- in src/config/schedule.ts. Who may get one that day is worked out on the phone and never stored.
alter table public.daily_goal add column if not exists reveal_cards text not null default 'sometimes'
  check (reveal_cards in ('off', 'sometimes', 'often'));

-- AI sentences (added 2026-11-05). The generate-questions Edge Function keeps nothing about what it
-- is sent. These hold only its limits and a usage counter. The app has no access to them: only
-- the function, through ai_take_request below. token_hash is a SHA-256 of a random install token.
create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  -- The kill switch. Off until you turn it on, and turning it off stops every request at once.
  enabled boolean not null default false,
  per_install_hour int not null default 5 check (per_install_hour between 1 and 1000),
  per_install_day int not null default 20 check (per_install_day between 1 and 10000),
  -- The spending ceiling: requests a day across every install.
  global_day int not null default 20 check (global_day between 1 and 100000),
  updated_at timestamptz not null default now()
);
alter table public.ai_settings alter column global_day set default 20;
insert into public.ai_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.ai_usage_installs (
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  hour_start timestamptz not null,
  requests int not null default 0,
  primary key (token_hash, hour_start)
);
create table if not exists public.ai_usage_days (
  day date primary key,
  requests int not null default 0
);

-- NO LONGER USED BY THE APP (2026-11-16, docs/PIN-REMOVAL-PLAN.md). PIN pairing was removed: the app
-- never calls the pair-phone function or device_seen now, and the person's phone signs in only with
-- Their login. These tables and functions are kept, unchanged, so nothing is lost and a phone paired
-- before keeps working (my_caregiver still refuses one marked removed). HANDOFF.md has the optional SQL
-- to end those phones' access and drop them by hand; until then, rerunning this file keeps them.
--
-- Pairing the person's phone (added 2026-11-11). The caregiver creates a 6-digit PIN in the app; on
-- the person's phone, the caregiver's email and that PIN make a login of its own for that phone,
-- linked to the family. Only the pair-phone Edge Function reaches these tables, through the
-- functions below. The PIN is never stored: pin_hash is an HMAC-SHA256 keyed with a secret pepper
-- that only the function holds (PAIRING_PEPPER), so the table alone can't be used to try PINs. A PIN
-- is single-use, expires, and is spent after a few wrong tries. Creating a new one deletes the
-- family's PIN still waiting.
create table if not exists public.pairings (
  id uuid primary key,
  caregiver_id uuid not null references public.profiles (id) on delete cascade,
  pin_hash text not null check (pin_hash ~ '^[0-9a-f]{64}$'),
  -- The caregiver who created it (the family's caregiver, while a family has one).
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Wrong PINs tried against it. At pairing_settings.per_pin it is spent.
  failures int not null default 0 check (failures >= 0)
);
create index if not exists pairings_family on public.pairings (caregiver_id);

-- Each phone paired with a PIN: its own person login, the phone's name (its device name, or "Phone 2"),
-- when it was paired and last seen, and when the caregiver removed it. A removed phone's login reads
-- and writes nothing (my_caregiver below), can't sign in or refresh (the function bans it), and its
-- practice history stays. The caregiver reads their own family's rows; the person's login reads none.
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null references public.profiles (id) on delete cascade,
  person_user_id uuid not null unique,
  name text not null check (char_length(name) between 1 and 40),
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  foreign key (person_user_id, caregiver_id) references public.profiles (id, caregiver_id) on delete cascade
);
create index if not exists devices_family on public.devices (caregiver_id);

-- The limits on pairing, and its kill switch (enabled). A 6-digit PIN can be guessed, so tries are
-- limited per caregiver email, per IP address and across everyone, in a sliding window, and a PIN is
-- spent after per_pin wrong tries. On by default, so pairing works once the function is deployed;
-- turning enabled off stops every PIN being created or redeemed at once. A rerun keeps these values.
create table if not exists public.pairing_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  pin_minutes int not null default 15 check (pin_minutes between 1 and 60),
  window_minutes int not null default 15 check (window_minutes between 1 and 1440),
  per_email int not null default 5 check (per_email between 1 and 100),
  per_ip int not null default 20 check (per_ip between 1 and 1000),
  per_pin int not null default 5 check (per_pin between 1 and 100),
  global_tries int not null default 500 check (global_tries between 1 and 100000),
  creates_per_hour int not null default 10 check (creates_per_hour between 1 and 1000),
  updated_at timestamptz not null default now()
);
insert into public.pairing_settings (id) values (true) on conflict (id) do nothing;

-- One row per try or PIN created, for the limits: a keyed hash of the email or IP address (never the
-- address itself), 'global:', or the creating family. Older than a day, they go as tries come in.
create table if not exists public.pairing_events (
  key text not null check (key ~ '^(email|ip|global|create):[0-9a-f]{0,64}$'),
  at timestamptz not null default now()
);
create index if not exists pairing_events_key_at on public.pairing_events (key, at);

-- The caregiver's agreements (added 2026-11-13), as versioned records: one row per agreement or choice,
-- added and never changed. 'policy' is the privacy policy and 'responsibility' the confirmation that the
-- caregiver may add information about the people they include: both are required, at sign-up (the
-- trigger below refuses an account without them) and again whenever the policy's version changes
-- (POLICY_VERSION in src/lib/consent.ts). 'research' is the optional choice, off unless chosen; its
-- newest row is the choice in force. policy_version names the exact text agreed to (the date it was
-- written, or 'legacy' for sign-ups before versions). agreed_at is the server's time, never the app's.
-- The caregiver reads and adds only their own; the person's login reads none. Deleting the account
-- deletes them.
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('policy', 'responsibility', 'research')),
  policy_version text not null check (policy_version ~ '^(legacy|[0-9]{4}-[0-9]{2}-[0-9]{2})$'),
  choice boolean not null,
  agreed_at timestamptz not null default now(),
  -- An agreement is only ever recorded as given: not agreeing means no account, or no further use.
  check (kind = 'research' or choice)
);
create index if not exists consents_caregiver on public.consents (caregiver_id, agreed_at);

-- Caregivers who signed up before versions ticked one statement ("I have permission to upload photos and
-- details of the people I add, and I understand this app is not a medical device."): recorded once as a
-- 'legacy' responsibility, at the time they ticked it, so the app asks them to agree to the current policy.
insert into public.consents (caregiver_id, kind, policy_version, choice, agreed_at)
  select p.id, 'responsibility', 'legacy', true, p.consented_at
  from public.profiles p
  where p.role = 'caregiver' and p.consented_at is not null
    and not exists (select 1 from public.consents c where c.caregiver_id = p.id and c.policy_version = 'legacy');

-- ---------------------------------------------------------------------------------------
-- Helpers for policies. Security definer so they can read profiles without recursing
-- through its own policies.
-- ---------------------------------------------------------------------------------------

-- For a signed-in person: their caregiver's id. Null for anyone else, and for a phone the caregiver
-- removed (a paired phone whose devices row has revoked_at), so every person rule below refuses a
-- removed phone at once, whatever its token still says.
create or replace function public.my_caregiver()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.caregiver_id from public.profiles p
  where p.id = auth.uid() and p.role = 'person'
    and not exists (select 1 from public.devices d where d.person_user_id = p.id and d.revoked_at is not null)
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

-- Whether a person is in the practice deck: in it, included and not archived. Security definer,
-- because the cards policy asks about people while the people policy asks about cards.
create or replace function public.person_in_deck(person uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.in_deck and p.include_in_practice and p.archived_at is null from public.people p where p.id = person), false);
$$;

-- Whether the signed-in person may see a photo: the picture of someone they can read (in the deck,
-- with an approved card), or the photo of an approved card about them. So a draft's, a deselected
-- person's or an archived person's photos stay hidden from the person's login, even by listing the
-- folder. Security definer, because a storage policy asks about people and cards.
create or replace function public.person_sees_photo(path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.people p
    where p.photo_path = path and p.caregiver_id = public.my_caregiver() and public.person_in_deck(p.id)
      and exists (
        select 1 from public.cards c
        where c.person_id = p.id and c.status = 'approved' and (not c.time_sensitive or c.confirmed_at is not null)
      )
  ) or exists (
    select 1 from public.cards c
    where c.photo_path = path and c.caregiver_id = public.my_caregiver() and c.status = 'approved'
      and (not c.time_sensitive or c.confirmed_at is not null) and public.person_in_deck(c.person_id)
  );
$$;

-- Card records are kept as long as the phone shows them (ATTEMPTS_KEPT_DAYS, 120, in
-- src/config/insights.ts) and a day more, so the server never drops a day the app still shows. Each
-- upload clears the uploading family's older records, so nothing piles up. Security definer, because
-- the person's login can't delete.
create or replace function public.attempt_records_prune()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.attempt_records
  where caregiver_id = public.my_caregiver() and shown_at < now() - interval '121 days';
  return null;
end;
$$;
drop trigger if exists attempt_records_prune on public.attempt_records;
create trigger attempt_records_prune
  after insert on public.attempt_records
  for each statement execute function public.attempt_records_prune();

-- One request's permission to reach the model: 'ok', or which limit stopped it ('off', 'hour',
-- 'day', 'global'). One at a time, so a burst can't slip past a cap. Install counters older than a
-- day and a half go as it runs, so nothing piles up.
create or replace function public.ai_take_request(install_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  limits public.ai_settings;
  this_hour timestamptz := date_trunc('hour', now());
  today date := (now() at time zone 'utc')::date;
  today_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  used_hour int;
  used_day int;
  used_global int;
begin
  if install_hash !~ '^[0-9a-f]{64}$' then
    return 'off';
  end if;
  select * into limits from public.ai_settings where id;
  if not found or not limits.enabled then
    return 'off';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai_take_request'));
  delete from public.ai_usage_installs where hour_start < now() - interval '36 hours';
  delete from public.ai_usage_days where day < today - 7;

  select coalesce(sum(requests) filter (where hour_start = this_hour), 0),
         coalesce(sum(requests) filter (where hour_start >= today_start), 0)
    into used_hour, used_day
    from public.ai_usage_installs where token_hash = install_hash;
  select coalesce((select requests from public.ai_usage_days where day = today), 0) into used_global;

  if used_global >= limits.global_day then return 'global'; end if;
  if used_hour >= limits.per_install_hour then return 'hour'; end if;
  if used_day >= limits.per_install_day then return 'day'; end if;

  insert into public.ai_usage_installs as u (token_hash, hour_start, requests)
    values (install_hash, this_hour, 1)
    on conflict (token_hash, hour_start) do update set requests = u.requests + 1;
  insert into public.ai_usage_days as d (day, requests)
    values (today, 1)
    on conflict (day) do update set requests = d.requests + 1;
  return 'ok';
end;
$$;

-- Pairing the person's phone. Only the pair-phone Edge Function calls these (as service_role); it holds
-- the pepper, makes and checks the keyed hashes, and compares them in constant time. None of them sees
-- a PIN, and none returns anything to the app.

-- A new PIN for a caregiver's family: 'ok' with when it expires, or why not ('caregivers-only', 'off',
-- 'busy'). It replaces the family's PIN still waiting, so only the newest works.
create or replace function public.pairing_create(p_caregiver uuid, p_id uuid, p_hash text)
returns table (outcome text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  limits public.pairing_settings;
  family_key text := 'create:' || replace(p_caregiver::text, '-', '');
  ends timestamptz;
begin
  if not exists (select 1 from public.profiles where id = p_caregiver and role = 'caregiver') then
    return query select 'caregivers-only'::text, null::timestamptz;
    return;
  end if;
  select * into limits from public.pairing_settings where id;
  if not found or not limits.enabled or p_hash !~ '^[0-9a-f]{64}$' then
    return query select 'off'::text, null::timestamptz;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('pairing:' || p_caregiver::text));
  if (select count(*) from public.pairing_events where key = family_key and at > now() - interval '1 hour') >= limits.creates_per_hour then
    return query select 'busy'::text, null::timestamptz;
    return;
  end if;
  insert into public.pairing_events (key) values (family_key);
  delete from public.pairings p where p.caregiver_id = p_caregiver and p.used_at is null;
  delete from public.pairings p where p.created_at < now() - interval '30 days';
  ends := now() + make_interval(mins => limits.pin_minutes);
  insert into public.pairings (id, caregiver_id, pin_hash, created_by, expires_at)
  values (p_id, p_caregiver, p_hash, p_caregiver, ends);
  return query select 'ok'::text, ends;
end;
$$;

-- One try at pairing, before the PIN is compared: 'blocked' when a limit or the switch stops it, or
-- 'try' with the newest PIN still waiting for the family with that caregiver email (no row when there
-- is none, so the function compares against a stand-in hash and answers the same either way). The
-- try counts against the email's and the IP address's keyed hashes and the global ceiling, one try at
-- a time, so a burst can't slip past a limit. Tries that are blocked don't count, so a window slides
-- open again by itself.
create or replace function public.pairing_lookup(p_email text, p_email_key text, p_ip_key text)
returns table (outcome text, pairing_id uuid, pin_hash text)
language plpgsql security definer set search_path = '' as $$
declare
  limits public.pairing_settings;
  since timestamptz;
  email_key text := 'email:' || p_email_key;
  ip_key text := 'ip:' || p_ip_key;
begin
  select * into limits from public.pairing_settings where id;
  if not found or not limits.enabled or p_email_key !~ '^[0-9a-f]{64}$' or p_ip_key !~ '^[0-9a-f]{64}$' then
    return query select 'blocked'::text, null::uuid, null::text;
    return;
  end if;
  since := now() - make_interval(mins => limits.window_minutes);
  perform pg_advisory_xact_lock(hashtext('pairing_lookup'));
  delete from public.pairing_events e where e.at < now() - interval '1 day';
  if (select count(*) from public.pairing_events e where e.key = email_key and e.at > since) >= limits.per_email
     or (select count(*) from public.pairing_events e where e.key = ip_key and e.at > since) >= limits.per_ip
     or (select count(*) from public.pairing_events e where e.key = 'global:' and e.at > since) >= limits.global_tries then
    return query select 'blocked'::text, null::uuid, null::text;
    return;
  end if;
  insert into public.pairing_events (key) values (email_key), (ip_key), ('global:');
  return query
    select 'try'::text, waiting.id, waiting.pin_hash
    from (select 1) as one
    left join lateral (
      select pr.id, pr.pin_hash
      from auth.users u
      join public.profiles c on c.id = u.id and c.role = 'caregiver'
      join public.pairings pr on pr.caregiver_id = c.id
      where lower(u.email) = lower(btrim(p_email))
        and pr.used_at is null and pr.expires_at > now() and pr.failures < limits.per_pin
      order by pr.created_at desc
      limit 1
    ) as waiting on true;
end;
$$;

-- A wrong PIN against a waiting PIN. At per_pin wrong tries it is spent. Null does nothing, so the
-- function can call it the same way whether or not anything matched the email.
create or replace function public.pairing_fail(p_pairing uuid)
returns void language sql security definer set search_path = '' as $$
  update public.pairings set failures = failures + 1 where id = p_pairing and used_at is null;
$$;

-- The right PIN: uses it up, once, and returns its family. Null when it was already used, has expired,
-- was spent, or pairing is off, so two tries with the same PIN can't both pair a phone.
create or replace function public.pairing_consume(p_pairing uuid)
returns uuid language sql security definer set search_path = '' as $$
  update public.pairings p set used_at = now()
  from public.pairing_settings s
  where s.id and s.enabled and p.id = p_pairing and p.used_at is null and p.expires_at > now() and p.failures < s.per_pin
  returning p.caregiver_id;
$$;

-- The new phone's login, made by the function, joins the family: a person profile (with the first
-- name from the family's other person login, if it has one), the phone in devices, and the schedule
-- each card has reached on the family's other phones, so a new phone carries on where the old one
-- was. All at once, or not at all. Returns the device's id.
create or replace function public.pairing_link(p_user uuid, p_family uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  device uuid;
  label text := left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]+', '', 'g')), 40);
begin
  if not exists (select 1 from public.profiles where id = p_family and role = 'caregiver') then
    raise exception 'pairing_link: no such family';
  end if;
  perform pg_advisory_xact_lock(hashtext('pairing:' || p_family::text));
  if label = '' then
    label := 'Phone ' || ((select count(*) from public.devices where caregiver_id = p_family) + 1);
  end if;
  insert into public.profiles (id, role, caregiver_id, display_name)
  values (p_user, 'person', p_family, coalesce((
    select o.display_name from public.profiles o
    where o.caregiver_id = p_family and o.role = 'person' and o.display_name <> ''
    order by (o.username is not null) desc, o.created_at desc
    limit 1), ''));
  insert into public.devices (caregiver_id, person_user_id, name, last_seen_at)
  values (p_family, p_user, label, now())
  returning id into device;
  insert into public.card_schedule (card_id, person_user_id, caregiver_id, step, due_at, updated_at)
    select distinct on (s.card_id) s.card_id, p_user, s.caregiver_id, s.step, s.due_at, s.updated_at
    from public.card_schedule s
    where s.caregiver_id = p_family and s.person_user_id <> p_user
    order by s.card_id, s.updated_at desc
  on conflict do nothing;
  return device;
end;
$$;

-- "Remove phone": marks the caregiver's own phone removed, which ends its access at once (see
-- my_caregiver), and returns its login for the function to ban. Null when it isn't theirs.
create or replace function public.pairing_revoke(p_caregiver uuid, p_device uuid)
returns uuid language sql security definer set search_path = '' as $$
  update public.devices d set revoked_at = coalesce(d.revoked_at, now())
  where d.id = p_device and d.caregiver_id = p_caregiver
    and exists (select 1 from public.profiles c where c.id = p_caregiver and c.role = 'caregiver')
  returning d.person_user_id;
$$;

-- The person's phone, when it opens or comes back online: notes that it was seen, and learns whether
-- the caregiver removed it ('removed'), so it can sign out and show the welcome. 'none' for a login
-- that isn't a paired phone (the User ID login, or a caregiver). It reads nothing else.
create or replace function public.device_seen()
returns text language plpgsql security definer set search_path = '' as $$
begin
  update public.devices set last_seen_at = now() where person_user_id = auth.uid() and revoked_at is null;
  if found then
    return 'active';
  end if;
  if exists (select 1 from public.devices where person_user_id = auth.uid()) then
    return 'removed';
  end if;
  return 'none';
end;
$$;

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
  -- Sign-up requires both agreements (src/lib/consent.ts, signUpData) and a policy version: without
  -- them this fails, and with it the whole sign-up, so no account is made. Profiles also rejects a
  -- caregiver without consented_at.
  if coalesce(new.raw_user_meta_data ->> 'agreed_policy', '') <> 'true'
     or coalesce(new.raw_user_meta_data ->> 'agreed_responsibility', '') <> 'true'
     or coalesce(new.raw_user_meta_data ->> 'policy_version', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'evermore: a caregiver account needs both agreements';
  end if;
  insert into public.profiles (id, role, display_name, consented_at)
  values (
    new.id,
    'caregiver',
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60),
    nullif(new.raw_user_meta_data ->> 'consented_at', '')::timestamptz
  );
  -- Each agreement as its own record, at the server's time, and the research choice (off unless chosen).
  insert into public.consents (caregiver_id, kind, policy_version, choice)
  values
    (new.id, 'policy', new.raw_user_meta_data ->> 'policy_version', true),
    (new.id, 'responsibility', new.raw_user_meta_data ->> 'policy_version', true),
    (new.id, 'research', new.raw_user_meta_data ->> 'policy_version', coalesce(new.raw_user_meta_data ->> 'research', '') = 'true');
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
  public.card_schedule, public.daily_goal, public.attempt_records from anon, authenticated;
revoke all on public.ai_settings, public.ai_usage_installs, public.ai_usage_days from public, anon, authenticated;

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
-- Card records: the person's login inserts them (every column but uploaded_at, which is the
-- server's), and the caregiver's login reads and deletes them. Nobody updates one. The policies
-- below decide whose rows each may touch.
grant insert (id, caregiver_id, person_user_id, person_id, card_id, phrasing_id, shape, fact_type, source,
  session_id, shown_at, selected_at, selected_right, choices, hints, success, active_ms, first_selection_ms,
  goal, extra, study_day, extra_practice, help_at, help_steps) on public.attempt_records to authenticated;
grant select, delete on public.attempt_records to authenticated;
grant select, insert, update, delete on public.attempt_records to service_role;
revoke execute on function public.attempt_records_prune() from public, anon, authenticated;

-- AI limits: the generate-questions function works as service_role, and nobody else gets in.
grant select, insert, update, delete on public.ai_settings, public.ai_usage_installs, public.ai_usage_days to service_role;
revoke execute on function public.ai_take_request(text) from public, anon, authenticated;
grant execute on function public.ai_take_request(text) to service_role;

-- Pairing: the pair-phone function works as service_role. The caregiver's login reads their own
-- family's phones (the policy below), and nothing else here; the person's login reads none of it. The
-- person's phone may only say it was seen (device_seen), which tells it nothing but its own state.
revoke all on public.pairings, public.devices, public.pairing_events, public.pairing_settings from public, anon, authenticated;
grant select on public.devices to authenticated;
grant select, insert, update, delete on public.pairings, public.devices, public.pairing_events, public.pairing_settings to service_role;
revoke execute on function public.pairing_create(uuid, uuid, text), public.pairing_lookup(text, text, text),
  public.pairing_fail(uuid), public.pairing_consume(uuid), public.pairing_link(uuid, uuid, text),
  public.pairing_revoke(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pairing_create(uuid, uuid, text), public.pairing_lookup(text, text, text),
  public.pairing_fail(uuid), public.pairing_consume(uuid), public.pairing_link(uuid, uuid, text),
  public.pairing_revoke(uuid, uuid) to service_role;
revoke execute on function public.device_seen() from public, anon;
grant execute on function public.device_seen() to authenticated;

-- Agreements: the caregiver reads their own and adds new ones (never the time, which is the server's);
-- nobody changes or removes one. The policies below keep the person's login out.
revoke all on public.consents from public, anon, authenticated;
grant select on public.consents to authenticated;
grant insert (caregiver_id, kind, policy_version, choice) on public.consents to authenticated;
grant select, insert, delete on public.consents to service_role;

revoke execute on function public.seed_sample_people(uuid) from public, anon, authenticated;
revoke execute on function public.person_in_deck(uuid) from public, anon;
grant execute on function public.person_in_deck(uuid) to authenticated, service_role;
revoke execute on function public.person_sees_photo(text) from public, anon;
grant execute on function public.person_sees_photo(text) to authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Row Level Security
--   Caregiver: everything in their own family (caregiver_id = their id), nothing else.
--   Person: reads cards in practice (approved and, for a fact that may change, confirmed;
--   the same rule as inPractice in src/lib/facts.ts) of people in the deck and not archived, the
--   people on them, their photos and the daily goal;
--   reads and writes only their own sessions, attempts and schedule rows.
--   Card records (insights): the person's login only inserts its own; the caregiver only reads
--   their family's, and deletes them. Neither can change one.
--   Paired phones: the caregiver reads their own family's; a removed phone's login is refused by
--   every person rule (my_caregiver). PINs and the pairing limits: the pair-phone function only.
-- ---------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.cards enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.card_schedule enable row level security;
alter table public.daily_goal enable row level security;
alter table public.attempt_records enable row level security;
-- No policies on these three: with Row Level Security on, only service_role can reach them.
alter table public.ai_settings enable row level security;
alter table public.ai_usage_installs enable row level security;
alter table public.ai_usage_days enable row level security;
-- Pairing: no policies on the PINs, the limits or their settings (service_role only); devices has
-- one, for the caregiver.
alter table public.pairings enable row level security;
alter table public.pairing_events enable row level security;
alter table public.pairing_settings enable row level security;
alter table public.devices enable row level security;
alter table public.consents enable row level security;

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
    and in_deck
    and include_in_practice
    and archived_at is null
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
    and public.person_in_deck(person_id)
  );

-- sessions
drop policy if exists "sessions: caregiver family" on public.sessions;
create policy "sessions: caregiver family" on public.sessions for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
-- A person's login may also read (never write) the family's sessions, from every paired phone, so a
-- day finished on one phone shows as finished on the other (by study_day). Sessions hold times and
-- counts only.
drop policy if exists "sessions: person reads family" on public.sessions;
create policy "sessions: person reads family" on public.sessions for select to authenticated
  using (caregiver_id = (select public.my_caregiver()) and not is_sample);

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

-- attempt_records: write-only for the person, read-only (and delete) for the caregiver. With no
-- select policy for the person, their login reads no record, not even one it wrote.
drop policy if exists "attempt_records: person inserts own" on public.attempt_records;
create policy "attempt_records: person inserts own" on public.attempt_records for insert to authenticated
  with check (person_user_id = (select auth.uid()) and caregiver_id = (select public.my_caregiver()));
drop policy if exists "attempt_records: caregiver reads family" on public.attempt_records;
create policy "attempt_records: caregiver reads family" on public.attempt_records for select to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "attempt_records: caregiver deletes family" on public.attempt_records;
create policy "attempt_records: caregiver deletes family" on public.attempt_records for delete to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));

-- devices: the caregiver reads their own family's phones. Nobody writes them but the function.
drop policy if exists "devices: caregiver reads family" on public.devices;
create policy "devices: caregiver reads family" on public.devices for select to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));

-- consents: the caregiver's own only, read and added. No update or delete policy, so nobody changes one;
-- the person's login, whose id is never a caregiver_id, reads and adds none.
drop policy if exists "consents: caregiver reads own" on public.consents;
create policy "consents: caregiver reads own" on public.consents for select to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "consents: caregiver adds own" on public.consents;
create policy "consents: caregiver adds own" on public.consents for insert to authenticated
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));

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
-- The person reads only the photos practice can show them (person_sees_photo).
drop policy if exists "photos: person reads family" on storage.objects;
create policy "photos: person reads family" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.my_caregiver())::text
         and public.person_sees_photo(name));

-- =======================================================================================
-- FAMILY BOARD (added 2026-11-18 on branch person-home-board; docs/PERSON-HOME-PLAN.md)
-- Kept as one block at the end so it merges cleanly with other branches. Safe to rerun.
-- A few short notes the caregiver writes for the person's home screen. The caregiver reads and
-- writes only their family's; the person's login reads only its family's and never writes; nobody
-- else reads anything. At most 3 a family, 200 characters each, one pinned. Deleting the account
-- deletes them (the cascade from profiles).
-- =======================================================================================

create table if not exists public.family_notes (
  id uuid primary key default gen_random_uuid(),
  caregiver_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200 and char_length(body) <= 200),
  from_name text check (from_name is null or char_length(btrim(from_name)) between 1 and 40),
  from_relationship text check (from_relationship is null or char_length(btrim(from_relationship)) between 1 and 40),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_notes_caregiver on public.family_notes (caregiver_id, created_at);
-- One pinned note a family.
create unique index if not exists family_notes_one_pinned on public.family_notes (caregiver_id) where pinned;

-- At most 3 notes a family. A lock per family, so two inserts at once can't both pass the count.
create or replace function public.family_notes_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('family_notes:' || new.caregiver_id::text, 0));
  if (select count(*) from public.family_notes where caregiver_id = new.caregiver_id) >= 3 then
    raise exception 'family_notes: at most 3 notes a family' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists family_notes_limit on public.family_notes;
create trigger family_notes_limit before insert on public.family_notes
  for each row execute function public.family_notes_limit();

revoke all on public.family_notes from public, anon;
grant select, insert, update, delete on public.family_notes to authenticated;
grant select, insert, update, delete on public.family_notes to service_role;

alter table public.family_notes enable row level security;
drop policy if exists "family_notes: caregiver family" on public.family_notes;
create policy "family_notes: caregiver family" on public.family_notes for all to authenticated
  using (caregiver_id = (select auth.uid()) and (select public.is_caregiver()))
  with check (caregiver_id = (select auth.uid()) and (select public.is_caregiver()));
drop policy if exists "family_notes: person reads family" on public.family_notes;
create policy "family_notes: person reads family" on public.family_notes for select to authenticated
  using (caregiver_id = (select public.my_caregiver()));
-- ============================== END FAMILY BOARD =======================================
