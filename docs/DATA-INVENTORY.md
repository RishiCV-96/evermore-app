# Data inventory

Written 2026-11-13 from the code, `supabase/schema.sql` and the Edge Functions, not from memory. Updated 2026-11-16: PIN pairing was removed from the app and its function deleted (`docs/PIN-REMOVAL-PLAN.md`); its tables stay on the server, unused, until dropped by hand. It covers the product as shipped: sign-in on (`AUTH_ENABLED`), AI questions off (`AI_VARIANTS_ENABLED = false`). The local-only development mode (`EXPO_PUBLIC_LOCAL_ONLY=1`) is listed at the end.

**This file and the privacy policy must change whenever data handling changes.** The policy's words live in `src/lib/privacy-policy.ts`, and `docs/privacy-policy-draft.md` and `docs/privacy-policy.html` are generated from it (`node scripts/build-policy.mjs`). `node scripts/check-privacy.mjs` fails if `supabase/schema.sql` creates a table, or the app keeps a storage key, that is not named in this file.

Who can read, in short:
- **Caregiver:** the caregiver's own login, through Row Level Security (RLS).
- **Person:** the person's login (Their login, the User ID login), and any phone login an earlier build made with PIN pairing.
- **Developer:** whoever holds the Supabase project's dashboard, its secret key, or a phone in hand. They bypass RLS: everything on the server, including photos, is readable to them. Nothing is end-to-end encrypted.
- **Supabase:** the hosting provider, under its own terms.

## On the server (Supabase Postgres, project in `.env`)

Every family row carries `caregiver_id`. Deleting the account (`manage-family`, `delete-family`) removes every stored photo first, then every login of the family, and the foreign keys remove every row below that names the caregiver.

| Table | What it holds | Caregiver | Person | Kept until | Deleted by |
| --- | --- | --- | --- | --- | --- |
| `profiles` | Role, display name (the person's first name, if given), the caregiver's id for a person login, a person's User ID (`username`), `consented_at` (when the caregiver ticked sign-up), created time | Own, and the family's person logins | Own row only | Account deleted | Delete account |
| `consents` | **New.** One row per agreement or choice: kind (`policy`, `responsibility`, `research`), policy version, the choice, the server's time. No words, email or device | Reads and adds own; never changes or deletes | None | Account deleted | Delete account only |
| `people` | Name, relationship, photo path, sample portrait, hint settings, profile step, best clue, "Not applicable" marks, in deck, include in practice, reveal ok, archived time | Full | In the deck, included, not archived, with an approved card | Deleted by the caregiver | Delete permanently (archived only); Delete account |
| `cards` | One fact each: the caregiver's words (`memory_text`, up to 120 characters), kind, the fixed sentence, approval, whether it may change, as-of month, confirmed time, source, phrasings off, a memory's year and photo path, hint ok, which wording its sentences use (`wording`, 1 or 2; since 2026-11-18) | Full | Approved (and confirmed if it may change), of a person in the deck | Removed by the caregiver | Editing (an emptied answer removes its fact), Delete permanently, Delete account |
| `sessions` | Session id, family, which person login, started, completed, cards finished, the day's target, study day, `is_sample` | Full | Reads the family's; writes own | **No limit** | Delete account; deleting a person login |
| `attempts` | The scheduling log, one row per card practiced: card, login, session, time, **tries, first try right, hints used** | Inserts and deletes; reads only id, card, login, session and time (the three correctness columns can't be read through the API) | Own, same columns | **No limit** | Deleting the fact, the person, a login, or the account |
| `attempt_records` | Insights, one row per card shown: ids, how it was asked (shape, fixed phrasing id), kind of fact, source, shown time, each answer chosen and when and whether right, choices offered, hints shown, success, active time, time to first choice, the day's target, re-asked, study day, extra practice, each "I'm not sure" tap and the fixed hint step it reached (`help_at`, `help_steps`, since 2026-11-13: asking for help, never an answer), server upload time. Never a name, photo or anyone's words | Reads and deletes | Inserts own only; reads none | 121 days, pruned **only when that family next uploads** | Pruning, Delete permanently, Delete account |
| `card_schedule` | Each fact's step (0 to 5) and when it is next due, per person login | Full | Own | Fact, person or account deleted | Same |
| `daily_goal` | Session length, reveal cards setting, the old fixed goal | Full | Reads | Account deleted | Delete account |
| `devices` | **Unused since 2026-11-16.** Phones paired with an earlier build: its person login, its name (the phone's device name, **which may hold the person's first name**, or "Phone 2"), paired, last seen, removed | Reads own family's through RLS; the app no longer reads it | None (`device_seen()` remains, but the app no longer calls it) | Account deleted, or the tables dropped by hand | Delete account |
| `pairings` | **Unused since 2026-11-16.** A PIN an earlier build made: HMAC-SHA256 of the PIN with a secret pepper (never the PIN), family, who made it, created, expires (15 minutes), used, wrong tries | None | None | Replaced by the family's next PIN; any row over 30 days goes when anyone creates a PIN | `pairing_create` |
| `pairing_events` | **Unused since 2026-11-16.** One row per pairing try or PIN made: a keyed hash of the email typed or of the IP address (never the address), or `global:`, or the family, and a time | None | None | About a day, removed as new tries come in | `pairing_lookup` |
| `pairing_settings` | **Unused since 2026-11-16.** Pairing limits and the kill switch. No personal data | None | None | Settings | The developer |
| `ai_settings` | AI limits and the kill switch (off). No personal data | None | None | Settings | The developer |
| `ai_usage_installs` | SHA-256 hash of an install's random AI token, the hour, a count | None | None | 36 hours | `ai_take_request` |
| `ai_usage_days` | A day and a count, across everyone | None | None | 7 days | `ai_take_request` |

## Storage (Supabase Storage)

| Bucket | What it holds | Caregiver | Person | Kept until |
| --- | --- | --- | --- | --- |
| `photos` (private, 10 MB a file, JPEG/PNG/HEIC/WebP) | `<caregiver id>/<person or fact id>-<time>.<ext>`: each person's photo and each shared memory's photo, as the caregiver picked them, at most 1280 px on the long edge | Full, own folder | Only photos of people in the deck with an approved card, and approved memories' photos (`person_sees_photo`) | Replaced (the old file is removed), removed, the person or account deleted. A failed removal leaves the old file until the person or the account is deleted |

Photos are shown through signed links that last an hour. Supabase's CDN caches a signed link by path and token, so an already-opened link can keep working until it expires.

## Supabase Auth (Supabase's own tables, not in our schema)

| What | Holds | Kept until |
| --- | --- | --- |
| The caregiver's login | Email, bcrypt password hash, sign-up metadata (`consented_at`, `policy_version`, `agreed_policy`, `agreed_responsibility`, `research`), confirmation and sign-in times | Delete account |
| The person's User ID login | `<User ID>@person.evermore.invalid` (a reserved domain that can't receive mail), password hash, `evermore_person` flag | Delete account, or the caregiver replaces it |
| A phone login made by an earlier build (PIN pairing, removed 2026-11-16) | A login on `phone.evermore.invalid` with a long random credential that phone kept | Delete account, or ended by hand (`HANDOFF.md`) |
| Sessions and refresh tokens | Supabase Auth also keeps, per sign-in, the session and refresh tokens and, in its own tables, request details such as IP address and user agent, and an audit log of sign-ins. **[REVIEW]** Confirm what this project's Auth keeps and for how long | Supabase's own rules |

## Edge Functions

| Function (slug: development project, production project) | Receives | Keeps | Logs |
| --- | --- | --- | --- |
| `manage-family` (`dynamic-api`, `manage-family`) | The caregiver's session; a User ID, password and first name for the person's login; `delete-family` | Writes the person login and its profile; deletes the family | The kind of a failure only |
| `pair-phone` (`hyper-function`) | **Removed 2026-11-16.** Its source is gone from the repository; the deployed function and its `PAIRING_PEPPER` secret are to be deleted by hand | Nothing new | — |
| `generate-questions` (`clever-service`, `generate-questions`) | One person's masked approved facts as text, an install token header. **Unreachable in the shipped app** (AI off, and needs sign-in off) | A hashed token and counters only | The kind of a failure only |

The app reads each slug from `src/config/functions.ts` (`EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION`, `EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION`, defaulting to the development project's). Only the URL changes; what each function receives and keeps is the same in both projects.

Supabase's platform also keeps its own request logs (API gateway, Edge Functions, Auth, Storage) with request metadata such as path, time, IP address and user agent, for the period the plan allows. **[REVIEW]** Confirm the retention for the plan in use.

## On the caregiver's phone

| Where | Key | Holds | Goes |
| --- | --- | --- | --- |
| Secure storage | `sb-<project>-auth-token` | The Supabase session (in pieces) | Sign out |
| AsyncStorage | `evermore.profile.<user id>` | The signed-in profile and email, so the app opens offline | Sign out |
| AsyncStorage | `evermore.insightsCache.v1.<caregiver id>` | Card records by month (120 days), when fetched, and Trends: names, archived and included flags, approved fact ids, settings, 30 days of sessions. No facts' words | Sign out; Delete account |
| AsyncStorage | `evermore.textSize.v1` | The text size | Stays |
| AsyncStorage | `evermore.studyDay.v1` | The furthest study day this phone has reached | Stays |
| Memory only | The family, the agreements | | Sign out |
| Image cache (`expo-image`) | Photos shown, by storage path | | Sign out |
| Temporary folder | `cache/exports` | An export while the share sheet is open | When it closes, at the next export, at sign-out |

## On the person's phone

| Where | Key | Holds | Goes |
| --- | --- | --- | --- |
| Secure storage | `sb-<project>-auth-token` | The person login's session | Sign out |
| Secure storage | `evermore.device.v1` | Only on a phone paired with an earlier build: that phone's login and credential. Nothing reads it now | Deleted at any sign-out |
| AsyncStorage | `evermore.profile.<user id>` | The person's profile (first name) | Sign out |
| AsyncStorage | `evermore.practice.v1.<user id>` | The approved deck (people, sentences, photo paths), schedule, recent sessions, the outbox of practice not yet sent, today's log | Sign out (the outbox stays until sent) |
| AsyncStorage | `evermore.recordQueue.v1.<user id>` | Card records waiting to upload: ids and numbers only | Once uploaded |
| AsyncStorage | `evermore.recordBackfill.v1.<user id>` | Progress of the one-time backfill | Stays |
| AsyncStorage | `evermore.reminders.v1` | Reminder on or off, its time, whether the person was asked | Turned off and cleared at sign-out, except whether they were asked |
| The system's notifications | `evermore.reminder.<study day>` | Up to 3 scheduled local reminders, the one fixed sentence | Rebuilt each open; cancelled at sign-out |
| AsyncStorage | `evermore.textSize.v1`, `evermore.studyDay.v1` | As on the caregiver's phone | Stays |
| Image cache | Photos of the deck | | Sign out |

## Third parties

| Who | What reaches them | When | Notes |
| --- | --- | --- | --- |
| **Supabase** (database, Auth, Storage, Edge Functions, logs) | Everything above marked "server", over HTTPS | Always, with sign-in on | Hosting region is the project's. **[REVIEW]** DPA, subprocessors, encryption at rest, backups (Supabase keeps daily backups on paid plans, kept for a period by plan) |
| **Supabase's built-in email** | The caregiver's email address, with a confirmation or reset code (the default templates carry a link instead until custom SMTP lets them be edited: `docs/FORGOT-PASSWORD.md`) | Sign-up (when Confirm email is on), resend, password reset | Built-in email isn't meant for production: it reaches only the project's team, about 2 an hour. A custom SMTP provider would be a new third party, to add here and to the policy. |
| **Anthropic** (AI) | One person's approved facts, as masked text: `[NAME]` and `[PERSON_1]` for names, `f1` for card ids. Never photos, time-sensitive facts or test data | Only with AI turned on in code, sign-in off, the caregiver's consent, and a tap of Generate. **Not reachable in the shipped app** | Anthropic may keep API data for a period under its own terms |
| **The phone's speech engine** (`expo-speech`) | The full read-back sentence, which includes a name | Each card the person answers | On-device on iOS. On Android it is whichever text-to-speech engine the phone uses. **[REVIEW]** |
| **Apple / Google** | Local notifications are scheduled and shown by the OS; nothing is sent to a push service. App Store and TestFlight crash reports and tester feedback (which can include a screenshot) go to Apple when a tester shares them | | A tester's screenshot can show a family photo |
| **The share sheet's destination** | An export, if the caregiver sends it | Only on request | Not deleted with the account |
| Crash reporting, analytics, ads, attribution | **None.** No such SDK is installed (`package.json`), no push token is requested, no over-the-air updates (`expo-updates` is not installed) | | |

## Retention, in one place

- Until the caregiver deletes it or the account: the account, `profiles`, `consents`, `people`, `cards`, photos, `daily_goal`, `devices` (unused; phones paired with an earlier build), **`sessions` and `attempts` (no time limit)**, `card_schedule`.
- 121 days: `attempt_records` (the app shows 120), pruned only when that family uploads again.
- `pairing_events` and `pairings`: unused, so nothing new is added; what an earlier build left stays until the tables are dropped or the family's PINs replaced. 36 hours: `ai_usage_installs`. 7 days: `ai_usage_days`.
- Supabase's backups and logs: the plan's own periods. **[REVIEW]**
- Exports: not on any server; files the caregiver saved elsewhere are theirs to delete.

## How each thing is deleted

| Action | Where | What goes |
| --- | --- | --- |
| Emptying an answer, Remove photo | Add a person | That fact (and its schedule and attempts) or that photo |
| Delete permanently | Archived people, "delete" typed | The person's photos (every file of theirs in the folder), row, facts, schedule, attempts, card records; on the phone, what was kept of their practice |
| Sign out | Settings, the hand-back, a refused session | Only this phone's copies (see the tables above) |
| Delete account | Settings, "delete" typed | Every photo, then every login of the family (caregiver, User ID, and any phone login an earlier build made), and through the foreign keys every row above that names the caregiver, `consents` included |

## Local-only development mode (not shipped)

With `EXPO_PUBLIC_LOCAL_ONLY=1` there is no account and no server: the family is kept in `evermore.family.v1` (people, facts, approvals, AI sentences, photos copied into the app's folder), practice and settings in `evermore.local.v1` (including the AI on/off and the AI consent time), card records in `evermore.attempts.v1.<YYYY-MM>`, the AI install token in secure storage under `evermore.installToken.v1`. The web build's stand-in for notifications uses `evermore.reminderStandIn.v1`. Only the AI request leaves the phone, and only as described above. Development builds also bundle your real family cards and photos, if you keep them in the gitignored `src/data/deck.local.ts` and `assets/photos/`; release builds exclude both (`scripts/check-release.mjs`), and a clone without them uses the fictional sample deck (`src/data/sample-deck.ts`).

## In the repository (git)

**No real family data in any tracked file** (since 2026-11-13): code, tests, fixtures, docs and config hold only invented people. On the developer's computer only, gitignored and in `.easignore`:

| File | Holds | Read by |
| --- | --- | --- |
| `src/data/deck.local.ts` | Your real cards, for personal testing | `src/data/example-deck.ts`, development builds only, if present |
| `assets/photos/*` (not its README) | Your real people's photos, named by id | `src/data/photos.ts`, development builds only |
| `scripts/private-denylist.local.txt` | Real names to keep out, which you fill in | `scripts/check-no-real-data.mjs`, `scripts/check-release.mjs` (never printed) |
| `cleanup-findings.local.md` | Where real data was found on 2026-11-13: paths and line numbers only | Nobody: notes |

**The git history before 2026-11-13 still holds the real cards**, on GitHub too: 116 of the 117 commits there carry `src/data/deck.ts` with them. `HANDOFF.md` has the findings and the steps. Real data on the server exists only if someone added real people through the app with sign-in on.

## Surprises worth a decision

1. **Developer access is total.** The developer can read every name, story and photo through the Supabase dashboard. The policy says so plainly.
2. **`sessions` and `attempts` have no time limit**, while card records are kept 120 days. `attempts` holds tries, first try right and hints used per card, unreadable through the API but readable in the dashboard.
3. **Card records are pruned only when that family uploads again.** A family that stops practicing keeps records past 121 days until the account is deleted.
4. **Phones paired with an earlier build stay on the server** (name, dates, their own login) until the account is deleted or the tables are dropped by hand, and a phone's name often contains the person's first name ("Rose's iPhone"). The app can no longer remove them; `HANDOFF.md` has the SQL to end their access.
5. **Supabase Auth and platform logs** keep IP addresses and user agents for sign-ins and requests, outside our schema, for Supabase's own periods.
6. **Consent records are deleted with the account**, which may not be what a lawyer wants as evidence.
7. **The read-back sentence goes to the phone's speech engine**, which on some Android phones is a separate app.
8. **TestFlight feedback screenshots** go to Apple and the developer and can show a family photo.
9. **Agreement is recorded per caregiver only.** Nothing records the person practicing, or the other people whose photos are added.
