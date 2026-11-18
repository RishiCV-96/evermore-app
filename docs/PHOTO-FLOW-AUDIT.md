# Photo flow audit

Written 2026-11-17 on `testflight-prep` (after `f8049bc`). A read-only trace of every photo, from the moment it is chosen to the moment it is deleted, through the code in `src/`, `supabase/schema.sql`, both Edge Functions, and the native code of the photo modules in `node_modules` (expo-image-picker 58, expo-image-manipulator 58). Nothing was run against Supabase. The Supabase dashboard can't be seen from here: the last section lists what to check there by hand. Examples use the fictional sample person June; `<caregiver id>`, `<person id>` and `<fact id>` are UUIDs.

## The short answer

- Photos go to **the phone, and our Supabase project only**. No analytics, crash reporting, ad or image service is in the app (the runtime dependencies are Expo modules, React Native and `@supabase/supabase-js`). The AI function never receives a photo, a photo URL or anything derived from one.
- The bucket is **private**. Photos are read through **signed URLs that last an hour**, issued only to the caregiver and, for photos practice can show, the person's login.
- **Two privacy gaps.** Location and time metadata survive in some photos (§4), and the picker's and resizer's temporary copies are never deleted from the phone's cache (§1).

## How a photo is chosen (every mode)

Both pickers are in `src/components/questionnaire.tsx` (the person's photo at line 430, a memory's photo at line 1002): `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })`, then `shrinkPhoto` (`src/lib/shrink-photo.ts`). There is no other way in: no camera, no video, no paste, no download (`scripts/check-store.mjs` checks this).

1. **The system picker** (iOS PHPicker, out of the app's process) hands over the chosen image. expo-image-picker writes it to **`<app>/Library/Caches/ImagePicker/<uuid>.<ext>`** (`MediaHandler.swift:525`). JPEG and PNG are re-encoded there (`image.jpegData`, `image.pngData`), which drops metadata. **HEIC, WebP, TIFF and AVIF are written as the original bytes** (`ImageUtils.swift`, `readDataAndFileExtension`: `return (rawData, ".heic")`), metadata included. HEIC is the iPhone's default format.
2. **The resize.** If the long edge is over 1280 px (`PHOTO_LONG_EDGE`, `src/lib/photo-size.ts`), expo-image-manipulator re-encodes it as JPEG at 0.8 into **`<app>/Library/Caches/ImageManipulator/<uuid>.jpg`** (`ImageManipulatorUtils.swift:99,141`, `jpegData`), which drops metadata. At or under 1280 px, or if the resize throws, **the picker's file is used as it is** (`shrink-photo.ts`: `if (!resize) return original;` and `catch { return original; }`).

Neither cache file is ever deleted by the app. Sign-out clears `expo-image`'s own cache and the exports folder (`src/data/forget.ts`), not these two folders. iOS may purge Caches when storage runs low; they are excluded from iCloud backup and readable only by the app.

## Mode 1: local-only (`npm run start:local`, with the real deck)

**1. Where it is stored.**
- **The real deck's photos** stay on the computer, in `assets/photos/` (gitignored). In a development build Metro includes them (`src/data/photos.ts`: `__DEV__ ? require.context('../../assets/photos', …) : null`) and serves them from the dev server to Expo Go, which keeps them in its own asset cache on the phone. They are referenced as bundled assets (`bundledPhoto`), never copied into the app's folder.
- **A photo picked in local-only mode** goes through the two cache files above, then `keepPhoto` (`src/lib/photo-files.ts`) copies it to **`<app>/Documents/photos/<person or fact id>-<timestamp>.<ext>`**. Its path is saved in AsyncStorage under `evermore.family.v1` (`photoUri`). `Documents` is included in the phone's iCloud or computer backup if the user has backups on. The two cache copies remain.
- Nothing goes in secure storage.

**2. Network.** None for photos: with sign-in off no Supabase client exists (`src/lib/supabase.ts`, `serverOff()`). In development the real deck's photos travel **from the computer's Metro server to the phone over the local network** (plain HTTP). With `npx expo start --tunnel` they would pass through a tunnel service instead, a third party (CLAUDE.md says to prefer the same Wi-Fi).

**3. Supabase Storage.** Not used.

**4. Metadata and size.** As in "How a photo is chosen". The real deck's photos are used exactly as they are in `assets/photos/` (not resized, metadata not touched), and only on the developer's own phone.

**5. AI.** None (see §5 below, the same for every mode). The local deck's people are also held back from AI by person (`HELD_BACK_FROM_AI`).

**6. Deletion and export.**
- **Delete permanently** (archived person): `deleteLocalPerson` (`src/data/local-store.ts:532`) deletes their kept photo (`dropPhoto`) and their memory photos (`dropUnused`). A replaced photo is deleted when it is replaced (`local-store.ts:440`). The deck's photos are never touched: they live on the computer.
- There is no Delete account in local-only mode (`settings-page.tsx:112`). Deleting the app removes `Documents`. The cache copies stay until then, or until iOS purges them.
- **Export, Photos (zip)**: only photos the caregiver picked (`photoEntries`, `src/lib/export.ts:313`, uses `photoPath ?? photoUri`; deck people have neither), as stored, so with any metadata §4 left in. The zip is written to `<app>/Library/Caches/exports/` and deleted when the share sheet closes (`src/lib/save-file.ts`).

**7. Logs, screenshots and the bundle.** Logs carry a fixed phrase and an error code only (`warnKind`, `src/lib/log.ts`), never a path or URI. **No real photo can reach a production build.**
- `__DEV__` is false in a release, and Metro drops the `require.context` before collecting files.
- `.easignore` keeps `assets/photos/*` out of the EAS upload.
- `scripts/check-store.mjs` compares every uploaded file's hash with the real photos.
- `scripts/check-release.mjs` compares every exported asset's hash with them.
- All four were confirmed on today's production iOS export.

Screenshots of the app show photos like any screen, including TestFlight feedback screenshots, which go to Apple.

## Mode 2: a signed-in caregiver on a production build, adding a person

**1. Where it is stored.**
- **Picking**: the same two cache files on the caregiver's phone, never deleted.
- **Upload**: `uploadPhoto` (`src/data/family-store.ts:297`) reads the file and uploads it to the **`photos` bucket at `<caregiver id>/<person id>.<ext>`**. A memory's photo goes to `<caregiver id>/<fact id>.<ext>`, a replaced photo to `<caregiver id>/<person id>-<timestamp>.<ext>`. The extension follows the type (jpg, png, heic or webp). `cacheControl: '0'`, so Supabase's CDN checks storage on every request. The row keeps the path (`people.photo_path`, `cards.photo_path`).
- **Display**: through a signed URL, cached on disk by `expo-image`, keyed by the storage path (`src/components/person-photo.tsx:20`). Signing out clears that cache (`forget.ts`: `Image.clearMemoryCache(), Image.clearDiskCache()`).
- No photo is kept in AsyncStorage or secure storage.

**2. Network.** Only to the Supabase project's host, `https://<project-ref>.supabase.co` (`EXPO_PUBLIC_SUPABASE_URL`):

| Call | Where | Sends |
| --- | --- | --- |
| `storage.from('photos').upload` | `family-store.ts:306` | The photo bytes |
| `storage.from('photos').createSignedUrls(…, 3600)` | `src/lib/photo-urls.ts:14` | Paths; returns links |
| GET each signed link | `expo-image` | Downloads the photo (served through Supabase's CDN) |
| `storage.from('photos').remove` | `family-store.ts:292, 369, 646` | Paths to delete |
| `storage.from('photos').list(<caregiver id>)` | `family-store.ts:642` | Lists file names, before Delete permanently |
| `createSignedUrls(…, 600)` + download | `src/data/export-store.ts:235`, `save-file.ts:70` | Photos export only |
| `functions.invoke(manage-family, { action: 'delete-family' })` | `src/data/account.ts:397` | No photo; the function deletes them server-side |

Every other network call in the app is a Supabase table or auth request with no photo in it, plus the AI call (§5). There is no analytics, crash-reporting or third-party image SDK. The share sheet is the only way a photo can leave the phone for anywhere else, and only when the caregiver exports and picks a destination.

**3. Supabase Storage.** `supabase/schema.sql:979–993`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false;

create policy "photos: caregiver family" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
         and (select public.is_caregiver()))
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.is_caregiver()));

create policy "photos: person reads family" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select public.my_caregiver())::text
         and public.person_sees_photo(name));
```

- **Private.** Rerunning the schema forces `public = false`, but not the size limit or types.
- **The caregiver** reads, writes and deletes only files under their own id.
- **The person's login** reads only (no write policy). It reads only photos in its family's folder that `person_sees_photo` (`schema.sql:452`) allows: a person in the deck with at least one approved, current card, or an approved, current card's own memory photo. Not drafts, archived or deselected people, or pending cards.
- **Anyone else**: no policy, so nothing. `anon` has none.
- **Anyone holding a signed link**, for its lifetime (an hour; ten minutes for the export). A signed link is a bearer token, checked by its signature, not by the policies. Deleting the file ends it at once (CDN max-age 0). Archiving a person, or a card going back to pending, does not end a link already issued.

**4. Metadata and size.** **Not stripped in every case.** A photo whose long edge is over 1280 px is re-encoded as a JPEG, which drops location and timestamps; most phone-camera photos are this size. A HEIC, WebP, TIFF or AVIF at or under 1280 px, or any photo whose resize fails, is **uploaded with its original metadata, GPS location included if it has any**. TIFF and AVIF are then refused by the bucket's allowed types, so in practice this is HEIC and WebP. Nothing in the app reads or uses the metadata.

**6. Deletion and export.**
- **Replaced photo**: the old file is deleted after the new one is saved (`family-store.ts:367–370`). A failure only logs, leaving an orphan file that the person's or the account's deletion later removes.
- **Removed memory or emptied fact**: its photo is deleted (`family-store.ts:420, 424`), with the same log-only failure.
- **Archive**: keeps every photo, by design.
- **Delete permanently** (`deletePerson`, `family-store.ts:633`):
  - lists the family folder and deletes the person's and their facts' photos, plus leftovers named after them;
  - a failed delete stops it, before the row goes.
  - It reads only the first 1000 files of the folder for leftovers. Named paths are always deleted.
- **Delete account** (`manage-family`, `supabase/functions/manage-family/index.ts:119–130`): lists and deletes every file in `<caregiver id>/`, 1000 at a time until none are left, before deleting any login. A failure stops it.
- **On the caregiver's phone**: the `expo-image` cache is cleared at sign-out, which Delete account does. The picker and resizer cache copies remain.
- **Export**: the data file holds only `hasPhoto: true` (`export.ts:183, 204`), never a path or link. The PDF report has no images. **Photos (zip)**, when ticked, downloads each file (`downloadBytes` deletes each temporary copy), names it after the person, adds `photos.json`, and never includes a sample illustration or anything outside the family's folder. It contains the files as stored, metadata included where §4 left it.

**7. Logs.** App logs say only what failed and its code (`warnKind`). The Edge Function logs only the kind of failure. Supabase's own request logs record storage paths (UUIDs, no names) and may record signed-URL query strings (§ dashboard checks).

## Mode 3: the person's own phone

**1. Where it is stored.** The person never picks or uploads a photo: no picker is reachable, and the bucket gives the login no write policy.
- `usePractice` (`src/data/practice-store.ts:154–240`) reads `photo_path` for the deck and signs links (`signedUrls`, one hour).
- The links are kept in the phone's copy of the deck in AsyncStorage (`evermore.practice.v1.<person user id>`), so a cached photo still shows offline. They expire after an hour.
- `expo-image` caches each photo on disk by its path (`Library/Caches`).
- Signing out, or the caregiver resetting Their login, deletes the deck copy and clears the image cache (`forget.ts`).

**2. Network.** `https://<project-ref>.supabase.co`, for signing links and downloading. Nothing else.

**3. Supabase Storage.** Read-only, through `photos: person reads family` and `person_sees_photo` (above).

**4. Metadata.** The person's phone receives the files as stored (§4 of mode 2).

**6. Deletion.** A deleted person or account disappears from the deck at the next refresh, and their files are gone from the bucket. Existing links then fail, although the phone's image cache keeps showing the last copy until the deck refreshes and drops the person, or the phone signs out.

**7.** Practice screens show photos; screenshots include them. Nothing is logged.

## §5. The AI question function never sees a photo (every mode)

- `src/lib/ai-request.ts:46–51`: the request type is `{ placeholders, relationship, facts, shape_requests }`. `buildRequest` (line 94–116) builds each fact as `{ id: 'f1', type, text }` from the card's masked words only. No `photoPath`, `photoUri`, `photoUrl` or `year` is read.
- `src/data/ai-client.ts:21–25`: the only call sends `JSON.stringify(body)`, that request, with an install-token header.
- `supabase/functions/generate-questions/index.ts:333`: `if (Object.keys(body).sort().join() !== 'facts,placeholders,relationship,shape_requests') return null;`. Line 347: each fact must have exactly three keys. Anything else is refused before the model is called.
- `index.ts:381`: the model receives `messages: [{ role: 'user', content: promptFor(input, shapes) }]`, a text prompt. There is no image block anywhere in the function.
- AI is also off (`AI_VARIANTS_ENABLED = false`) and unavailable with sign-in on (`AI_AVAILABLE`).

## Every place a photo can exist or travel

| Where | Mode | Marked |
| --- | --- | --- |
| The system picker (PHPicker, iOS) | all | device only |
| `Library/Caches/ImagePicker/` (picker copy; **original metadata for HEIC/WebP**) — never deleted by the app | 1, 2 | device only |
| `Library/Caches/ImageManipulator/` (resized JPEG) — never deleted by the app | 1, 2 | device only |
| `Documents/photos/` (kept photo) | 1 | device only (and the user's own iCloud or computer backup, if on) |
| `assets/photos/` on the developer's computer, served by Metro to Expo Go and cached there | 1, development only | device only (computer and phone on the local network); third party if `--tunnel` is used |
| `expo-image` memory and disk cache | all | device only (cleared at sign-out) |
| AsyncStorage: kept photo's path (`evermore.family.v1`); signed links (`evermore.practice.v1.<id>`) | 1; 3 | device only |
| Upload over HTTPS to `<project-ref>.supabase.co` | 2 | our Supabase project only |
| `photos` bucket, `<caregiver id>/…` | 2, 3 | our Supabase project only |
| Signed-link downloads through Supabase's CDN | 2, 3 | our Supabase project only (Supabase's own delivery network) |
| Supabase request logs (paths, perhaps link tokens) | 2, 3 | our Supabase project only |
| Export zip in `Library/Caches/exports/` (deleted when the sheet closes) | 1, 2 | device only |
| Wherever the caregiver sends the export from the share sheet | 1, 2 | third party, by the caregiver's choice |
| Screenshots the user takes; TestFlight feedback screenshots | all | device only; third party (Apple) if sent as feedback |
| AI function, Anthropic | — | never |
| Release bundle, EAS upload | — | never (checked by `check-store.mjs` and `check-release.mjs`) |

## What surprised me

- **Metadata is stripped only as a side effect of resizing.** The code's comments speak of size, never metadata. Photos at or under 1280 px in HEIC or WebP, and any photo whose resize fails, keep their location and timestamps all the way into the bucket, onto the person's phone and into the photos export.
- **The picker's copy keeps the original**, metadata and all, in the app's cache indefinitely, even after the resized copy is uploaded, and even after the caregiver signs out.
- **A signed link outlives the permission that issued it** by up to an hour: archiving a person or un-approving their cards doesn't revoke a link already on the person's phone. Deleting the file does.
- `deletePerson` looks for leftover files in only the first 1000 of the family's files (Delete account has no such limit).

## Gaps worth fixing (not changed: this audit is read-only)

1. Strip metadata always: re-encode every picked photo (not only large ones), or call the manipulator with a resize of the photo's own size. On failure, refuse the photo rather than fall back to the original.
2. After a photo is kept or uploaded, delete the picker's and the manipulator's cache files. Clear `Caches/ImagePicker` and `Caches/ImageManipulator` at sign-out.
3. Page through `list` in `deletePerson`, as `manage-family` does.
4. Consider shortening `SIGNED_URL_SECONDS` for the person's phone, or accept the hour as the window (and say so in the policy).

## Check by hand in the Supabase dashboard

- **Storage → Buckets → photos**: **Public** off. File size limit 10 MB, allowed types `image/jpeg, image/png, image/heic, image/webp`. Rerunning the schema forces Public off but doesn't reset the other two.
- **No other bucket** holds family files, and no bucket is public.
- **Storage → Policies (storage.objects)**: exactly the two policies above for `photos`, and nothing else that mentions `photos`. In particular, no policy created from a dashboard template ("Give public access…", "Allow access to authenticated users") and nothing granted to `anon`. Check `storage.buckets` too.
- **Storage S3 access** (Project Settings → Storage → S3 access keys): none. S3 keys bypass Row Level Security.
- **API keys**: who holds the secret key (`EVERMORE_SECRET_KEY` in Edge Function secrets) and any legacy `service_role` key. Either can read every photo. Rotate any that were ever shared.
- **Team** (Organization → Team, and project access): every member can open Storage in the dashboard and see every photo. Keep it to people who must.
- **Backups**: whether this plan's database backups or point-in-time recovery include Storage objects (Supabase documents that database backups don't include Storage files, but confirm for your plan), and how long Supabase keeps a deleted object in its underlying storage. Database backups do hold `photo_path` rows.
- **Logs** (Logs → Storage, API Gateway): whether request logs keep signed-URL query strings (the token), and for how long.
- **Region**: where the project, and so every photo, is stored. The privacy policy should say.
