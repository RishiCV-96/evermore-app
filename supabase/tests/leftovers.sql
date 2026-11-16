-- Finds anything Evermore's tests may have left behind. Run in the SQL Editor. It changes
-- nothing unless you uncomment the delete at the end. Test caregivers use the reserved
-- domain caregiver.evermore.invalid, person logins person.evermore.invalid, and the logins an earlier
-- build made for paired phones phone.evermore.invalid (PIN pairing, removed 2026-11-16; each family's go
-- with it when the family is deleted in the app).

-- Test logins.
select email, created_at
from auth.users
where email like '%@caregiver.evermore.invalid' or email like '%@person.evermore.invalid'
   or (email like '%@phone.evermore.invalid' and id not in (select id from public.profiles))
order by created_at;

-- Photos still in the bucket, by family folder (each folder is a caregiver's user id).
select (storage.foldername(name))[1] as family_folder, count(*) as photos
from storage.objects
where bucket_id = 'photos'
group by 1;

-- Everything, counted. Each caregiver account adds 5 sample people and 5 cards.
select
  (select count(*) from auth.users) as logins,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.people) as people,
  (select count(*) from public.cards) as cards,
  (select count(*) from public.sessions) as sessions,
  (select count(*) from public.attempts) as attempts,
  (select count(*) from public.card_schedule) as schedule_rows,
  (select count(*) from public.attempt_records) as card_records,
  (select count(*) from public.devices) as paired_phones,
  (select count(*) from public.pairings) as pins,
  (select count(*) from storage.objects where bucket_id = 'photos') as photos;

-- To delete the test logins, uncomment the next line. Their rows go with them (foreign keys).
-- delete from auth.users where email like '%@caregiver.evermore.invalid' or email like '%@person.evermore.invalid'
--   or (email like '%@phone.evermore.invalid' and id not in (select id from public.profiles));
-- Photos can't be deleted with SQL: in Storage → photos, delete the folders listed above.
