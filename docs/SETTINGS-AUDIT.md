# Settings and data-safety audit

Written 2026-11-12, before the pre-release changes. It lists every control on the Settings tab and every action anywhere in the app that changes or deletes data: what it changes on the phone and on the server, whether it can lose data, what protects it now, and what happens to it.

"Sign-in on" is the product (`AUTH_ENABLED`, the default). "Local-only" is the development mode started with `EXPO_PUBLIC_LOCAL_ONLY=1`, where everything lives on the phone.

## Developer and debug controls (all removed from the app)

| Control | Where | What it did | Verdict |
| --- | --- | --- | --- |
| **Load 14 days of sample activity** | Settings, "Development only", sign-in on, any development build (Expo Go) | Inserted made-up sessions and attempts into the **signed-in caregiver's real family on the server** (`is_sample`), so their real Today, Trends and 4-week average showed invented practice. One tap, no confirmation | **Removed**, with `src/data/sample-activity.ts`. No in-app path writes made-up rows to a real account |
| **Clear sample activity** | Same | Deleted every `is_sample` session (and its attempts) in the family on the server. One tap, no confirmation | **Removed** |
| **Load demo data for Insights** | Settings, "Development only", local-only | Added or removed eight weeks of made-up card records on the phone; switching it off deleted them, and Clear test data also switched it off | **Removed** from the UI. Walks still seed demo records directly into the test browser's storage |
| **Clear test data** | Settings, local-only, while there is test data | Removed every invented answer about the real example people on the phone, and the demo records. A system confirm only | **Removed** from the UI. A development-only launch flag, `EXPO_PUBLIC_CLEAR_TEST_DATA=1`, does the same, never in a release build |

Also checked, and not present anywhere: reset, wipe, seed, force a score, force a study day or time, feature-flag toggles, a local-only switch, showing test IDs, fake AI, simulated offline. The development-only `__DEV__` sections are gone from every screen. A check in `scripts/check-logic.mjs` fails if a screen or component refers to a sample-data loader, a reset or wipe action, `__DEV__`, or "Development only".

## Every remaining action that changes or deletes data

| Action | Where | Phone | Server | Can lose data? | Protection before | After |
| --- | --- | --- | --- | --- | --- | --- |
| **Delete account** | Settings | Signs out and clears this phone's copies (as Sign out) | Deletes the whole family: every person, photo, fact, story, practice record, the caregiver's and every person's login (`manage-family`) | **Yes, everything, for good** | A sheet, a checkbox, then "Delete everything" | **Changes:** last, in its own section away from other rows. Names what goes and that it is on the server and every phone. Offers **Export my data** first. The button stays disabled until the caregiver **types "delete"** |
| **Delete permanently** (a person) | People → Archived people → their sheet; only for someone already archived | Removes their photo, facts, approved and AI sentences, schedule, practice kept for them and their card records | The same rows and stored photos (sign-in on) | **Yes, one person, for good** | Only after Archive; a system confirm naming them | **Changes:** a confirmation in the sheet that names exactly what goes and where (this phone and the server), and the caregiver **types "delete"** before the button works. Archive (with Undo) remains the only way in |
| **Archive** | People (long press or the person's sheet) | Hides them from practice; keeps everything | `archived_at` | No | Undo toast | Stays |
| **Restore** | Archived people | Brings them back as they were | Same | No | — | Stays, easy to find (a quiet Restore under each archived card and on their sheet) |
| **Sign out** | Settings | Forgets the session and this phone's copies of server data (family, Insights copy, the photo cache, a PIN on show). Keeps practice and card records not yet sent | Nothing | **No caregiver data is deleted**: everything is on the server. Offline, signing back in needs a connection | None | **Changes:** a calm confirm that says the family stays saved, and that signing in again needs the internet when offline |
| **Remove phone** | Settings → Linked phones | Nothing on this phone | Ends that phone's access and bans its login; its practice history stays | No (access, not data) | A confirm naming the phone | Stays |
| **Their login** (new User ID password) | Settings | — | Changes the person's User ID login; that phone signs in again | No | A sheet with Save | Stays; its sheet no longer says "Reset" |
| **Change password** | Settings | — | The caregiver's password, after the current one | No | Current password | Stays |
| **Session length, Reveal cards, AI questions, text size** | Settings | Settings | Settings | No | — | Stay, in a Practice section |
| **Approve all** | A person's sheet, story approval | Approves stories (and on the sheet AI sentences) | Same | No | Confirm on the sheet; Undo toast | Stays |
| **Skip, Edit** a story | Story approval | Status, words | Same | Reversible (Approve again, edit again) | — | Stays |
| **Emptying an answer, Remove photo** | Add a person | Removes that fact or photo when it saves | Same | One fact or photo, by the caregiver's own edit | Autosave of what is typed | Stays: editing is the caregiver's intent |
| **Export my data** | Settings → Privacy and data; Delete account's **Export my data first** | Writes a file to the temporary folder, deleted once the share sheet closes | Reads only, with the caregiver's own session | No | — | **Rebuilt 2026-11-13** (below): the full history, a report, and optional photos |

## Local and server, kept apart

- No action on the phone alone deletes anything on the server: Sign out only forgets this phone's copies.
- No server action deletes anything kept only on this phone, except Delete account, which says so.
- Every confirmation for Delete permanently and Delete account says where the data goes from ("this phone and the server", or "this phone" in local-only).

## Settings, redesigned

Sections in this order: **Account** (signed in as, change password, sign out), **Linked phones** (pair the person's phone, their login), **Practice** (session length, reveal cards, AI questions where available, practice text size), **Privacy and data** (privacy policy, what the app stores, research use, AI questions agreement where AI is available, export my data; since 2026-11-13), **About** (version, the note), and last, apart, **Delete account**. Local-only shows Practice, Privacy and data (with its one line about where things are kept), About, and Back to the home screen. Offline, the account rows stay; the Practice rows wait for the family with one calm line and a retry, so the tab is never blank.

## Export my data, rebuilt (2026-11-13)

The first export held only the last 30 days of practice. It is now a safety net after an accidental loss, for the caregiver's own family only. Nothing here imports or restores: that is a manual job for the developer.

| Choice | What it is | Holds | Never holds |
| --- | --- | --- | --- |
| **Data file (everything)** | JSON, format 2 | A header (format, date, app version, where it came from, complete or not, each section described), settings, every person (archived and drafts too) with every answer, story and approval, AI sentences and their facts (sign-in off), every session, every card record kept (120 days), the schedule, linked phones' names and dates | Logins and their ids, User IDs, emails, passwords, tokens, PINs or hashes, device credentials, photo paths or links, test data, the demo |
| **Report (PDF)** | `expo-print` | Date range, study days practiced, sessions and extra practice, the Memory score by day with band names, how answers were found, people (found most readily, needed the most support), week by week; the notes on personal information, "Practice activity, not a medical measure.", the 05:30 study day and the placeholder intervals | Anything about another family, or any comparison with other people |
| **Photos (zip)**, only once **Include photos** is ticked | `fflate`, stored as is | The photos the caregiver added, and `photos.json` saying whose each is | The example deck's photos, illustrations, anything outside the family's folder |

- **Who can export:** a signed-in caregiver only. The person's login, on any paired phone, is refused before any request, never sees the row (Settings is the caregiver's), and Row Level Security gives it no card record or phone. Every read uses the caregiver's own session; `supabase/tests/rls.test.mjs` runs the export's queries to show another caregiver reads none of the family's rows, even naming its id.
- **Safety:** read a page at a time with progress and **Cancel**. A failed page gives no file, says what kind failed, and offers **Try again**. Offline, **Use this phone's copy** is offered, never chosen for the caregiver, and the file and report say it may be missing newer data.
- **Where files go:** the app's temporary folder, deleted when the share sheet closes, and again at the next export and at sign-out.

## Consent and the privacy policy (2026-11-13)

| Action | Where | Phone | Server | Can lose data? | Protection |
| --- | --- | --- | --- | --- | --- |
| **Research use** | Settings → Privacy and data | Nothing kept | A new `consents` record each change; the newest is in force | No | Changes nothing in the app either way |
| **Agree and continue** | The sheet over the caregiver screens when the policy changed | Nothing kept | Two `consents` records for the new version | No | Both boxes unticked until the caregiver ticks them |
| **Sign out** (from that sheet) | Same | As Sign out | Nothing | No | The same calm confirm as Settings' Sign out |
| **AI questions agreement** (take it back) | Settings → Privacy and data, where AI is available | Clears the agreement; Generate asks again; approved AI sentences leave practice until then | — | No (sentences are kept) | A confirm that says what changes |
