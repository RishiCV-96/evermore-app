-- Cross-family check on the real project. Run in the SQL Editor after creating two caregiver
-- accounts in the app (A and B). It signs in as B inside a transaction and counts A's rows;
-- every number must be 0. Nothing is changed: the transaction is rolled back.
--
-- 1. Find the two ids:   select id, display_name, created_at from public.profiles where role = 'caregiver';
-- 2. Replace the two ids below, then run the whole file.

begin;
create temporary table ids on commit drop as
  select 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA'::uuid as a,  -- caregiver A (the one being protected)
         'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB'::uuid as b;  -- caregiver B (the one looking)
grant select on ids to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true) from ids;
set local role authenticated;

select 'people'        as "A's rows visible to B", count(*) from public.people        where caregiver_id = (select a from ids)
union all select 'cards',         count(*) from public.cards         where caregiver_id = (select a from ids)
union all select 'sessions',      count(*) from public.sessions      where caregiver_id = (select a from ids)
union all select 'attempts',      count(*) from public.attempts      where caregiver_id = (select a from ids)
union all select 'card_schedule', count(*) from public.card_schedule where caregiver_id = (select a from ids)
union all select 'daily_goal',    count(*) from public.daily_goal    where caregiver_id = (select a from ids)
union all select 'attempt_records', count(*) from public.attempt_records where caregiver_id = (select a from ids)
union all select 'profiles',      count(*) from public.profiles      where id = (select a from ids) or caregiver_id = (select a from ids)
union all select 'photos',        count(*) from storage.objects      where bucket_id = 'photos' and name like (select a from ids)::text || '/%';

rollback;
