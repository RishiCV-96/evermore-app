# Handoff: "I'm not sure" on the person's cards

Updated 2026-11-13. Work in `~/evermore-clean` so `CLAUDE.md` loads. The history cleanup and the move to `~/evermore-clean` are finished; nothing below touches them.

## Status

**Built and committed on the branch `i-am-not-sure`** (not pushed, not merged), and checked:
- `npm test`: all 14 suites, the release bundles included; `node scripts/check-no-real-data.mjs` and `scripts/check-release.mjs` clean
- typecheck and lint, clean
- the local-only web build in headless Chrome at 375x647, 390x763 and 430x839, at Medium, Large and Extra large, with Reduce Motion on and off, from a throwaway copy without the local deck or the real photos (deleted afterwards)

**Not on a phone yet.** **The schema changed: rerun `supabase/schema.sql`** in the Supabase SQL Editor (below). The live project wasn't touched.

### What changed

- **The person's card.** A quiet **I’m not sure** under the names (label only, `primaryDark`, 48pt tall) on every card with the hint ladder: blank, ask, who, photo-only, reverse and reveal cards. Each tap brings the next step of the same ladder a different name would (another fact, the relationship, the letter, fewer names, then the answer), with "That is okay. Here is a little help." in place of "Take your time." on a first hint it brought. The tap that will show the answer reads **Show me**; the control goes once the answer is shown, and the person taps the right name to finish. VoiceOver: "I’m not sure. Show me a hint.", and focus moves to the new hint. Reduce Motion fades the hint in instead of sliding it, and the scroll doesn't animate. No sound, haptics, shake or red.
- **The steps are pure.** `src/lib/card-steps.ts` (`chooseName`, `askForHelp`, `hintNow`, `notSureButton`, `cardResult`), used by `PracticeCard`; the words are `NOT_SURE` and the step set `HINT_STEPS` in `src/lib/stories.ts`.
- **The record.** `help` on each card record (each tap's time and the step reached: a rung, `wait` or `answer`). A tap adds no selection, so nothing reads as a wrong answer. Each tap also counts as a moment of use for active time.
- **Scheduling.** Like any card that needed a hint: tries are the names chosen and every step is a hint used, so the card moves back a step, comes back later in the session, and gives no reveal unlock.
- **Insights.** A card with a help request counts as "With help" (`resolvedOn`), with that group's existing points (0.3) and nothing more. "Asked for help: N cards, counted in With help" under How answers were found, an "Asked for help" row on the day sheet, a line in the report, and an `askedForHelp` list on each card record in the data file.
- **Server.** `attempt_records.help_at timestamptz[]` and `help_steps text[]`, both `not null default '{}'`, with a check on the step set and matching lengths, and the person's insert grant.
- **Docs.** `CLAUDE.md` (a hard rule and the architecture), `DESIGN.md` (the decisions), `DESIGN-UI.md`, `docs/QUESTION-AUDIT.md` (change 10 and the clinician items), `docs/DATA-INVENTORY.md`.
- **Tests.** `scripts/check-logic.mjs`: the control on every kind of card, never once the answer is shown, the first tap's hint, the walk to the answer, no wrong-answer state, "With help" and the same score as a third-try card, scheduling equal to a one-hint card, the record's round trip and an older row, the schema's columns, quiet and 48pt, Reduce Motion, VoiceOver label and focus, no haptics or red. `supabase/tests/rls.test.mjs`: help rows taken, unknown steps refused, an older app's insert still taken with empty lists. `scripts/check-export.mjs`: help requests in the data file and the report, equal to Insights.

### What you must do

1. **Rerun `supabase/schema.sql`** in the SQL Editor. It is safe to rerun: the columns are added only if missing, and the check is dropped and added again. **Before then**, a phone with this build can't upload card records (the server doesn't know the columns): they wait in the phone's queue, nothing is lost, and they go once the schema is rerun. Older app builds keep uploading as before, and the caregiver's Insights read older rows as before.
2. **Look at the privacy policy wording.** I didn't change it. Its line on card records already says "the hints shown", which covers a hint the person asked for. If you want help requests named in it: change it in `src/lib/privacy-policy.ts`, then either `node scripts/build-policy.mjs --amend` (only if no caregiver has agreed to version 2026-11-13 yet) or give it a new `POLICY_VERSION`, which asks every caregiver to agree again.
3. Try it on a phone (next list).

### Decisions I made (also in `DESIGN.md`)

- **"With help" whatever choice found the answer.** A card the person said they didn't know isn't scored "Right away". That is the existing points for the most hinted cards, with no new penalty. Your brief asked for both ("counts as With help" and "no more than any other hint use"); this satisfies both. The alternative, scoring by the choice, is one line in `resolvedOn`.
- **The first tap jumps straight to the first hint** (no "Would you like a hint?" step). For the clinician.
- **The calm line only on the first hint.** Later taps show the hint's own words, so each new cue stays visible.
- **Fewer names with nothing chosen** sets aside the last other name chosen, or the first other name offered.
- **"Asked for help" is shown only where it is non-zero**, as a plain count, and only on caregiver screens.
- **Answer speed** (time to first choice) still means the first name chosen, so asking for help first makes that card's first choice later.
- **The data file's format stays 2.** One added field per record (`askedForHelp`, an empty list when none).
- **There is no pick-the-photo card** in the app; every card type that exists has the control.

### Only a phone can verify

- VoiceOver on iOS (TalkBack on Android): the label, and focus moving to the new hint after each tap. The web build has no accessibility events, so focus wasn't checked there.
- Reduce Motion with Reanimated running natively.
- The control's spot at Extra large on a small iPhone with real safe areas, and a reveal card with the "?" (the walk's sample cards never dealt one; the logic checks cover it).
- Uploading a help record to the live project once the schema is rerun, and seeing "Asked for help" on the caregiver's phone.

### Verified on 2026-11-13

- `npm test`: 14 of 14 suites. A planted change (`resolvedOn` ignoring help) failed the logic check, as it should.
- The browser walk, six runs: the control under the names with its VoiceOver label and a 48pt target; the first tap's calm line and hint; each tap to "Show me" and the answer; the control gone then and on the success banner; the right name still needed; the next card with the control again; the record holding the steps and only the right selection; no red, no judging words, scores or timers, every button 48 tall, nothing wider than the page, no page errors. It found one bug, fixed: React Native Web has no `sendAccessibilityEvent`, so the focus call is optional.

### Needs clinician review (added)

- The wording ("I’m not sure", "Show me", "That is okay. Here is a little help."), its placement under the names, whether the first tap should jump to the first hint or ask "Would you like a hint?", and how a help request should affect scheduling and Insights. Listed in `docs/QUESTION-AUDIT.md`.

# The release before: real family data off git

Updated 2026-11-13. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built and committed on the branch `no-real-data`** (four commits, not pushed, not merged), and checked:
- `npm test`: all 14 suites, the release bundles included, also with a trial denylist of the real names and facts
- typecheck and lint, clean

No server or schema change; the live project wasn't touched. **The working tree holds no real family data. The git history does, on GitHub too** (below). Real names appear nowhere in this file: people are "person 1" to "person 7", in the order of the original deck.

### What changed

- **The committed deck is fictional:** `src/data/sample-deck.ts`, the five sample people (June, Leo, Ruth, Omar, Mae) with their illustrations, the same five the server seeds. `src/data/deck.ts` is gone.
- **Your real cards are in `src/data/deck.local.ts`**: gitignored, in `.easignore`, read only in development builds and only if present (`src/data/example-deck.ts`). Without it, the app uses the sample deck, with no error. Photos stay in `assets/photos/` (gitignored). The local deck's people are held back from AI.
- **Tests and docs use invented people and facts.** `check-logic` has seven invented stand-ins in place of the real deck, so the rules for real people are still checked. Comments that named Supabase's row-limit setting by its dashboard label are reworded, since that label is person 2's name as a word.
- **The guard:** `scripts/check-no-real-data.mjs` and its self-test `scripts/check-no-real-data.test.mjs`, in `npm test` (new: `scripts/check-all.mjs`). `check-release` also scans its bundles with your denylist, fails if anything that ships imports the local deck, and fails if git tracks the local deck, the denylist or a photo.
- **Found along the way:**
  - `seedFamily` dropped the family's `testSeeded` flag and AI sentences whenever it copied someone in. It now keeps them, and notes anyone already on the phone as seeded instead of copying them twice. Ruth, Omar and Mae are on your phone already, added by the test data.
  - The guard's own test found that a UTF-16 string at an odd byte offset in a bundle was missed; both alignments are now read.
- **Your findings**, with paths and line numbers only, are in `cleanup-findings.local.md` (gitignored): 95 lines in 15 tracked files before the cleanup, and the history.

### What you must do

1. **Fill in your denylist.** `cp scripts/private-denylist.example.txt scripts/private-denylist.local.txt`, delete the invented examples, and add your family's names, one per line:
   - **A name** matches as a whole word in any capitalization, so ids like `name-0` are caught too.
   - **`=Name`** matches only that exact capitalization, for a name that is also an ordinary word (code such as `max` then doesn't trip it).
   - **`~=Name`** is checked in files but not in release bundles. Use it for a name a library uses in its own text: person 2's name is one, since a library's string contains it as a word.

   Add any other real words too: places, workplaces, a pet's name. Then run `npm test`. Never put a real name in the `.example.txt` file: it is committed.
2. **Keep using your real cards** on your phone: `src/data/deck.local.ts` is already there, with your photos in `assets/photos/`. Nothing changes in the local-only mode (`npm run start:local`).
3. **Review and merge `no-real-data`** into `main`. **Don't push it to the existing GitHub repository** until you've chosen one of the history options below. Pushing doesn't remove what's already there.
4. Restart the dev server with `npx expo start --clear`.

### Adding real people safely

Through the app on a device: kept on the phone (local-only), or in the caregiver's own account on the server (sign-in on). Never in code, tests, fixtures or docs. For personal testing in development builds only, add them to `src/data/deck.local.ts`, with photos in `assets/photos/` named by id, and add their names to your denylist.

## The git history (not rewritten, nothing pushed)

- **Refs:** `main`, `origin/main`, `consent-and-privacy`, `daily-reminder`, `export-my-data`, `no-real-data`. No stashes or tags. 120 commits on all refs, 117 on `origin/main` (GitHub).
- **The real cards:** `src/data/deck.ts`, with all 7 cards, was added in `d262b0c` (2026-11-01) and is in every later commit until `865f133` removes it (this branch, unpushed). That is **116 of the 117 commits on GitHub**, and every commit of the local branches.
- **Names:** each of persons 1 to 7 is in 116 commits on GitHub.
  - person 1: 13 paths (`DESIGN.md`, `HANDOFF.md`, `README.md`, `assets/photos/README.md`, `docs/QUESTION-AUDIT.md`, `scripts/check-logic.mjs`, `scripts/check-sync.mjs`, `src/data/deck.ts`, `src/data/photos.ts`, `src/lib/ai-request.ts`, `src/lib/attempt-records.ts`, `src/lib/stories.ts`, `supabase/tests/function.test.mjs`)
  - person 2: 4 paths
  - person 3: 2 paths
  - persons 4 and 5: 2 paths each
  - persons 6 and 7: `src/data/deck.ts` only
- **Facts:** each card is in 116 commits. Two also appear in old `DESIGN.md` versions, one in old `check-logic.mjs`. Person 2's team fact is in all 117 commits, across 9 paths.
- **Photos:** **never committed.** None of the 7 real photos exists as a git object, under any name. Only `assets/photos/README.md` was ever tracked.
- **Commit messages:** one line, in `ff5c1ee` (this branch, unpushed), uses person 2's name as the ordinary word in a Supabase setting's name. Option (a) removes it. To fix it on the branch before pushing anywhere, reword that commit with an interactive rebase in your own terminal.
- **Commit author:** your own name and your Mac's hostname are on all 120 commits. That is normal, and not family data, but it is in GitHub's copy too.

### Option (a): a clean repository from the current files (recommended)

1. Merge: `git checkout main && git merge --ff-only no-real-data`. Run `npm test` with your denylist filled in.
2. Copy only tracked files into a new folder, so no gitignored file and no history comes along: `mkdir ~/evermore-clean && git archive main | tar -x -C ~/evermore-clean`.
3. Copy back what you need locally (it stays gitignored): `cp .env ~/evermore-clean/`, `cp src/data/deck.local.ts ~/evermore-clean/src/data/`, `cp assets/photos/*.jpg ~/evermore-clean/assets/photos/`, `cp scripts/private-denylist.local.txt ~/evermore-clean/scripts/`.
4. In the new folder:
   - `cd ~/evermore-clean && git init -b main && npm install && npm test`
   - `git status --short`: check that no `.local.` file, photo or `.env` is listed
   - `git add -A && git commit -m "Evermore"`
   - `git grep -n -i -f <(grep -v '^#' scripts/private-denylist.local.txt | sed 's/^[=~]*//')` should print nothing (it prints matching lines, so run it only in your own terminal)
5. On GitHub, **create a new private repository**, empty (no README). Then `git remote add origin <new URL> && git push -u origin main`.
6. **Delete the old repository** on GitHub: its page → Settings → Danger zone → Delete this repository. That removes its commits, cached views, branches and pull-request refs with it. If it was ever public or forked, assume copies exist elsewhere, and ask GitHub Support about cached data.
7. Retire the old folder: keep it offline as a private archive (it still holds the history), or delete it. Re-clone on any other computer.

### Option (b): rewrite history with git filter-repo

1. Back up first: `git clone --mirror <old URL> ~/evermore-backup.git`. Keep it offline: it holds the real data.
2. `brew install git-filter-repo`. It needs a fresh clone: `git clone --mirror <old URL> ~/evermore-filter.git && cd ~/evermore-filter.git`.
3. Remove the deck file from every commit: `git filter-repo --invert-paths --path src/data/deck.ts`.
4. Replace the names and facts in every other file and in commit messages. Write a replacements file **outside any repository** (one `real==>invented` per line; `regex:` lines for whole words, such as `regex:\bName\b==>Nora`). Then run `git filter-repo --replace-text ../replacements.txt --replace-message ../replacements.txt`. Person 2's name is also an ordinary word: match it with exact capitalization only.
5. Verify every commit: `for c in $(git rev-list --all); do git grep -q -i -f <(…your names…) $c && echo $c; done` should print nothing.
6. Force-push everything: filter-repo removes `origin`, so `git remote add origin <old URL> && git push --force --mirror origin`. **Every commit hash changes, on every branch.**
7. **Warnings:**
   - Every other clone, including `~/evermore-expo` and its branches, must be deleted and re-cloned. Pushing any old branch would bring the real data back.
   - Open pull requests and links to old commits break.
   - GitHub can keep old commits reachable by hash, in cached views, pull-request refs and forks, until GitHub Support purges them. Ask them to run garbage collection and clear cached views.
   - Signed commits lose their signatures.
   - It can't be undone except from the backup.

**Recommendation: (a).**
- The real cards are in 116 of 117 commits and spread across 15 paths.
- Rewriting means getting every replacement right, including a name that is also an ordinary word, and GitHub can still serve the old commits by hash afterwards.
- You work alone, with no collaborators or open pull requests, so the history matters little next to the risk.
- A fresh repository is simple and fully checkable: one commit, scanned by the guard. Deleting the old repository takes GitHub's cached copies with it.
- Keep the old folder offline if you want the history for yourself.

## On the server (not touched: steps for you)

**The seed is fictional.** `seed_sample_people` in `supabase/schema.sql` adds June, Leo, Ruth, Omar and Mae, with illustrations. No script or test uploads real data: the live tests make `evermore-test` accounts with invented people and generated images, and delete them.

**Real data exists there only if you added real people through the app with sign-in on:**
- `people` rows (name, relationship) and `cards` (facts, sentences)
- photos in Storage (`photos/<your caregiver id>/…`)
- their schedule, practice rows (`attempts`, `attempt_records`, `sessions`)
- a person login's first name (`profiles.display_name`)
- paired phones' names (`devices.name`, often "<first name>'s iPhone")
- your own caregiver email in Authentication

**Export first:** in the app as the caregiver, Settings → Privacy and data → Export my data. Take **Data file (everything)**, then tick **Include photos** and take **Photos (zip)**. Keep the files somewhere private, never in a repository.

**Remove one person in the app:**
1. People tab: long-press, or open their sheet, then **Archive**.
2. **Archived people** → open them → **Delete permanently** → type `delete`.

This removes their photos, facts, schedule and practice records. Repeat for each real person. To remove everything (every person, photo and login), use Settings → **Delete account** instead.

**Or by hand in the Supabase dashboard** (read first, then delete):
1. SQL Editor, to see what's there without printing names. It lists everyone you added yourself, since sample people have an illustration:
   `select id, caregiver_id, created_at, photo_path is not null as has_photo from public.people where sample_portrait is null order by created_at;`
2. Table Editor → `people`: open each row from that list, check it, and delete it. Its `cards`, `card_schedule`, `attempts` and `attempt_records` go with it (foreign keys).
3. Storage → `photos` → your caregiver id's folder: delete each file named after that person's id or one of their card ids. A failed photo replacement can leave older ones; anything in your folder not named after a remaining person or card is a leftover.
4. Table Editor → `devices`: rename a phone whose name holds a first name (for example to "Phone 1"), or remove the phone in the app (Settings → Pair the person's phone → Remove phone; the row stays, renamed or not).
5. Table Editor → `profiles`: blank a person login's `display_name` if it holds a real first name.
6. `supabase/tests/leftovers.sql` lists anything a live test left behind.

## Verified on 2026-11-13

- `npm test`: all 14 suites pass, without a denylist (the guard warns) and with a trial denylist of 19 entries (7 names, 5 fact words, 7 cards):
  - nothing found in 210 tracked or new text files
  - nothing found in the iOS and Android release bundles
- **The guard's self-test (10):**
  - an invented word planted in a new file fails it, naming only the entry's number and the place, and passes once removed
  - any capitalization and ids are caught; longer words that only contain it aren't
  - `=` entries match their own capitalization only; `~` entries are skipped in bundles but caught in files
  - UTF-8 and UTF-16 (both alignments) are caught in bundles
  - without a denylist it warns and passes
  - a photo staged under `assets/photos/` fails it, in a temporary index
  - the word is never printed, and nothing planted is left behind
- **The release guard:**
  - a planted import of the local deck was caught
  - none of the 7 real photos and none of the local deck's 7 cards are in the bundles
- **`check-logic`:**
  - the five fictional sample people are the committed deck
  - a phone from before keeps Ruth once, noted as seeded, with its test data and AI sentences
  - a missing or malformed local deck falls back to the sample deck
  - the phone deck is still 12 people and 36 cards a day
- **Only a phone can verify:**
  - the local-only mode with `deck.local.ts` present: your real people and photos as before, no one twice
  - without the file: the five sample people only

---

# The release before: consent, the privacy policy, and TestFlight's privacy material

## Status

**Built, committed and checked:**
- in Node against the in-memory Supabase stand-in
- in PGlite with the real schema (Row Level Security)
- in the real iOS and Android release bundles
- in the web build in headless Chrome against the stand-in server

**Not on a phone yet.** **The schema changed: rerun `supabase/schema.sql`** (below). Your live project wasn't touched. Nothing here is legal advice: the policy and every agreement are drafts for a lawyer.

### What changed

- **The data inventory** (`docs/DATA-INVENTORY.md`), written from the code, the schema and the Edge Functions. It lists every table, bucket, Auth record, function, on-phone key and third party: who reads each, how long it is kept, and how it is deleted. It ends with the surprises.
- **The privacy policy**, one source (`src/lib/privacy-policy.ts`), in three places:
  - in the app: sign-up, Settings, and the person's first step
  - `docs/privacy-policy-draft.md`, with 24 numbered `[REVIEW]` notes
  - `docs/privacy-policy.html`, one file to host, with no scripts and nothing loaded from elsewhere

  `node scripts/build-policy.mjs` writes both files. A fingerprint lock means new words need a new `POLICY_VERSION`.
- **Create an account:**
  - a short summary of what is stored and who sees it
  - **Read the privacy policy**
  - two required boxes the caregiver ticks themselves: the policy, and that they may add these people and the person they help (or whoever is legally responsible for them) knows
  - an optional, unticked research box, "You can change this at any time"

  Without both required boxes the app sends nothing, and the database refuses the account anyway.
- **Agreements are versioned records** (`public.consents`): kind, policy version, choice, the server's time. Added, never changed. The caregiver reads only their own; the person's login reads none.
- **A new policy version asks again:** a sheet with no Close over every caregiver screen, Agree and continue or Sign out, nothing lost. It never asks offline.
- **The person's phone:** "Your caregiver set this up for you." in their own large type on their first step (Hello), and a **Privacy policy** link at the ordinary size with a 48pt target. No legal text, no boxes.
- **Settings → Privacy and data:** Privacy policy, What the app stores, Research use, AI questions agreement (where AI is available; it can be taken back), Export my data. Delete account stays last and apart.
- **AI's consent** now matches the policy: what is sent, the names replaced, no photos, and Anthropic's own retention.
- **App Store material** (documents only): `docs/app-store-privacy-answers.md` and `docs/testflight-checklist.md`.
- **Checks:**
  - `scripts/check-privacy.mjs` (new, 17): fails if the schema gains a table, or the app a storage key, that the inventory doesn't name.
  - Consent checks in `scripts/check-auth.mjs` (3 new) and `supabase/tests/rls.test.mjs`.
  - Live checks in `supabase/tests/live.test.mjs`.
- **Files:** new `src/lib/consent.ts`, `src/lib/privacy-policy.ts`, `src/data/consent-store.ts`, `src/components/consent.tsx`, `src/components/privacy-policy.tsx` (replacing `privacy-notice.tsx`), `scripts/policy-source.mjs`, `scripts/build-policy.mjs`, `scripts/check-privacy.mjs`; changes to sign-up, `account.ts`, `auth-form.ts`, Settings, the caregiver layout, `sheet.tsx` (a sheet may have no Close), the person's first step, `forget.ts`, `local-store.ts`, `app-data.ts`, the schema, the stand-in and the tests.

### What you must do

1. **Rerun `supabase/schema.sql`** in the Supabase SQL Editor. It adds `consents` and its rules, makes the sign-up trigger require both agreements, and gives each existing caregiver one `legacy` record, so they are asked to agree the next time they open the app. **An app from before this change can no longer make an account** (it doesn't send the agreements).
2. Then run `node supabase/tests/live.test.mjs` (Confirm email off) for the live checks of the agreements.
3. Restart the dev server with `npx expo start --clear`.
4. Have a lawyer or privacy professional review `docs/privacy-policy-draft.md`. Fill in `CONTACT`, `EFFECTIVE_DATE` and `REGION` in `src/lib/privacy-policy.ts`, run `node scripts/build-policy.mjs --amend` (only while no real caregiver has agreed), then host `docs/privacy-policy.html` (two options in `docs/testflight-checklist.md`).

### Decisions I made (also in `DESIGN.md`)

- **The person's sentence is on their first step** ("Hello", after I am practicing), not on the email or PIN step: it covers both ways in, before anything is sent.
- **The policy sheet uses the compact type** for its text, even on the person's phone, but keeps their 48pt Close.
- **Asking again never happens offline**, and nothing about agreements is kept on the phone. An offline caregiver keeps working and is asked once the server answers. The person's practice is never held up by the caregiver's agreement.
- **The research box is on sign-up as well as in Settings**, unticked, below the two required boxes. Asking again leaves research as it was.
- **Records store no wording.** The version names the exact words, which the lock and git keep. Keep every published version's text.
- **The old statement** ("I have permission to upload photos… not a medical device") is split: "not a medical device" moved into the summary, and the permission into the responsibility box.
- **Agreements aren't in Export my data**, and **they go with the account** on Delete account. Both are lawyer questions.
- **Settings order unchanged:** Privacy and data, then About, then Delete account apart (the hard rule wants it last).
- **The AI agreement can be taken back** in Settings. Generate then asks again, and approved AI sentences leave practice until the caregiver agrees again (they are kept).
- **App Store answers lean conservative:** Health, Name and Product Interaction are declared, all linked to the user, none for tracking, every purpose App Functionality.

### Only a phone can verify

1. **The agree-again sheet can't be dismissed:** iOS swipe-down on the page sheet (React Native's default is no swipe dismissal) and Android's back button.
2. **The person's Hello step** at Large and Extra large text: the sentence wraps calmly, the link stays reachable above the two buttons, and VoiceOver and TalkBack read "Read the privacy policy".
3. **Sign-up on a small phone** with the keyboard open: the boxes scroll into view, and the summary is readable.
4. **The live project, after the rerun:** a new sign-up, an existing caregiver asked once, research on and off.
5. **Coming back to the front** after the policy changed: the sheet appears without a restart.

### Verified on 2026-11-13

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:**
  - `check-privacy` (17, new) and `check-auth` (58, 3 new)
  - `check-logic`, `check-server-family`, `check-sync`, `check-export` (15) and `check-reminders` (18)
  - `rls` (with 27 new checks for agreements and the legacy upgrade), `records` (10), `pairing` (22) and `function` (18)
  - `check-release`

  The live tests weren't run (the schema isn't rerun yet).
- **`rls`:**
  - Sign-up is refused with the old consent time alone, either agreement alone, no version, or anything but `true`, and leaves nothing behind.
  - Sign-up records three versioned rows, research off.
  - Times are the server's.
  - Another caregiver, the person's login and visitors read none and add none in another's name.
  - Nobody changes, removes or back-dates one, and only known kinds and versions are accepted.
  - The table holds no words, email or device.
  - Upgrades give one `legacy` record, dated from the old tick, never twice.
- **Broken on purpose and caught (11):**
  - any caregiver reading every agreement
  - the trigger's check removed
  - research recorded on by default
  - sign-up sent without agreement
  - the research box pre-ticked
  - a new version not asking again
  - the policy's words changed under the same version
  - a new table missing from the inventory
  - a compliance claim
  - a person screen importing the boxes
  - the store logging an error message
- **Web walk** (sign-in on, against the stand-in; blank stand-ins for the family photos; every other request blocked; 83 checks at 375x647, 390x763 and 430x839):
  - **Sign-up:** every box starts unticked. The policy opens marked as a draft. Without the boxes there are calm notes and no request. With them the dashboard opens, with no sheet.
  - **Settings:** its five rows, research off then on recorded as a second record, and What the app stores swapping to the policy.
  - **Policy changed:** the sheet over the dashboard with no Close (Escape doesn't close it). A calm note without the boxes. The policy opens with Back. Agreeing lets the caregiver continue, and it isn't asked again.
  - **The person's step:** the sentence at their own body size (21px at Medium), the link at 16px with a 48pt target, no agreement or research words, the policy's Close at 48pt, and Create my account still leading on.
  - Everywhere: no red, nothing wider than the page, targets at least 44 or 48, none of the banned words, no page errors.

  The export and screenshots were deleted afterwards.

### Needs legal review

All 24 notes are numbered at the end of `docs/privacy-policy-draft.md`. The app store drafts carry their own `[REVIEW]` marks.

---

# The release before: Export my data, complete

## Status

**Built, committed and checked** in Node (against the in-memory Supabase stand-in), in PGlite with the real schema (Row Level Security), in real iOS and Android release bundles, and in the web build in headless Chrome against the stand-in server. **Not on a phone yet.** No schema change and no Edge Function: nothing to do on Supabase. Your live project wasn't touched.

### What changed

- **Export my data** (Settings → Privacy and data, and **Export my data first** inside Delete account) now offers **Data file (everything)** and **Report (PDF)**, and, only once **Include photos** is ticked, **Photos (zip)**. Progress shows while it reads, with **Cancel**. A read that fails gives no file, says what kind failed in calm words, and offers **Try again**; offline it also offers **Use this phone's copy**, which the file and the report label as possibly missing newer data.
- **The caregiver's own family only.** Every read uses the caregiver's own session (so Row Level Security decides) and names the family. The person's login, on any paired phone, is refused before any request; it never sees the row either.
- **Files** go to the app's temporary folder, to the share sheet, and are deleted when it closes (and at the next export and at sign-out).
- **No import or restore in the app.** Restoring is a manual job for the developer.
- **Files:** `src/lib/export.ts` (the data file, the photo list and zip, pure), `src/lib/insight-report.ts` (the report's figures and HTML, pure), `src/data/export-store.ts` (the server reads, the phone's copy, the photos), `src/data/export-data.ts` (the one chooser), `src/components/export-data.tsx` (the panel), `src/lib/save-file.ts` and `.web.ts`, small additions to the local store, the family store, the Insights store, `forget.ts` and `study-day.ts` (`DAY_START_TEXT`). New libraries: `expo-print` (~58.0.9, in Expo Go) and `fflate` (pure JavaScript).

### What the data file contains

JSON, `format: 2`, one file, in this order:
- **about:** app, format, export date, app version, where it came from (the server, or this phone), whether it's complete (and what isn't included if not), the privacy note, that restoring is manual, what is never included, the study day's meaning, a plain description of each section, and counts.
- **settings:** session length, reveal cards (and AI questions with sign-in off).
- **people:** everyone, drafts and archived people too (`status`: in practice, draft, not in practice, archived; `archivedAt`), with relationship, whether there is a photo, include in practice, reveal cards, hint settings, the profile step reached, best clue, "Not applicable" marks, and **facts**: each answer with its id, kind, question, words, the story as practice says it, its approval (approved, waiting for approval, skipped), dates, year, whether it may be a hint, phrasings turned off, and whether it has a photo.
- **aiSentences** (sign-in off only): each sentence, its status, whether it was edited, and the facts it came from.
- **sessions:** every one, back to the start: study day, started, completed, cards finished, the day's target.
- **cardRecords:** every one kept (the last 120 days): study day, extra practice, person, fact, how it was asked, when, choices offered, each answer chosen and when, the hints shown, asked again after a hint, time on screen, the day's target.
- **schedule:** each fact's step and when it is next due.
- **linkedPhones:** name, paired, last seen, removed.

Never: logins or their ids, User IDs, emails, passwords, tokens, PINs or their hashes, device credentials, photo paths or links, test data, the demo.

### How large it gets

- Measured in `scripts/check-export.mjs`: **4,800 card records** (120 days at 40 cards a day, the most the server keeps) **and 1,460 sessions** (two years, two a day) make a **3.1 MB** file. Sessions and card records are one per line, so it stays readable.
- The report is two pages for eight weeks of practice (about 70 KB). The weekly table grows by a row a week, up to about 18 rows for 120 days, so three pages at most.
- The photos zip is the photos as stored (each at most 1280 px, typically 150 to 400 KB), plus a small index.

### Decisions I made (also in `DESIGN.md`)

- **The export now includes how practice went** (card records, hints, the report's Memory score and how answers were found). The first export left that out. It stays within the Insights exception: caregiver-only, never on a person's screen.
- **Reads with the caregiver's session, not an Edge Function**, so Row Level Security is what guarantees one family only.
- **Offline, the fallback is the caregiver's choice**, never automatic, so a partial file is never handed over by surprise.
- **The report counts archived people** (labelled), as Insights do with "Include archived", and its figures come from the Insights functions unchanged. Two figures are new but built from existing ones: a week's average of its daily Memory scores, and each person's score over the report's period (`personScore`). "Found most readily" and "Needed the most support" appear only when two or more people have a score and they differ.
- **Card records are kept 120 days**, as before, so the "full history" of records and the report covers at most 120 days; sessions go back to the start. With sign-in off, sessions are kept on the phone about a month.
- **The placeholder note** reads "Spacing intervals, session lengths and the day’s start time are placeholders, still to be reviewed by a speech-language pathologist." The brief said "reviewed by a clinician"; the rules say they are not yet reviewed, so the report says they are still to be.
- **The report's font** is the phone's system sans-serif: Atkinson Hyperlegible isn't embedded in the PDF (it would add its font files to every report).
- **Photos:** only those the caregiver added; never the example deck's photos (sign-in off) or the sample people's illustrations. One photo that can't be read stops the zip.
- **"PDF"** joins "ID" as a word the sentence-case check lets keep its capitals.

### What you must do

- Nothing on Supabase. Restart the dev server with `npx expo start --clear` (a new native module, `expo-print`, which Expo Go includes; and the walk exported a copy of the project).

### Only a real phone can verify

1. **The share sheet** on iOS and Android, for each file: Save to Files, Mail, AirDrop or Drive, and the file opening there (the JSON in a text viewer, the PDF in a PDF viewer, the zip unpacking with its photos and `photos.json`).
2. **The PDF's layout from `expo-print`** (WKWebView on iOS, Android's print engine): two pages for a couple of months, tables not cut, the pink bands and line visible. Chrome's PDF of the same HTML was checked; the phone's engines can differ.
3. **A large history:** export with several months of real practice and check the time it takes, that progress counts up, that **Cancel** stops it, and that the phone stays responsive while the zip of photos is built.
4. **Offline:** airplane mode, then Data file: the calm words, **Try again**, then **Use this phone's copy**, and the file saying it isn't complete.
5. **The temporary file goes:** after sharing, nothing is left in the app's cache (`cache/exports`). On Android, check the receiving app still reads the file (the share sheet's promise resolves when it closes there too).
6. **The person's phone:** signed in as the person, no Export anywhere.

### Verified on 2026-11-13

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:** the new `check-export` (15), `check-logic` (with the new checks below), `check-auth` (55, now with export files cleared at sign-out), `check-server-family`, `check-sync`, `check-reminders` (18), `rls` (with the export's own queries), `records` (10), `pairing` (22), `function` (18), and `check-release`. The live tests weren't run (nothing on the server changed).
- **`check-export`:** 1,100 sessions over 550 study days and 2,640 card records over 110, read in pages of 1,000 with progress; every read naming the family; every section, archived people marked, approved, waiting and skipped stories as practice says them, the family's schedule, phones' names and dates; no PIN hash, user name, email, device credential, login id, caregiver id, other family, photo path or link, and no key like any of them; test data, the demo and a test fact's records left out; AI sentences with their facts; a failed second page giving no file and logging only its kind; Cancel stopping at the next page; the person's login and a signed-out phone refused with nothing asked of the server; offline giving no file, then this phone's copy labelled incomplete with what it may lack; the report's days, scores, bands, counts, time and extra practice equal to `insightsFor`'s for the same days, weeks adding up and running Monday to Sunday; names written as text, never markup; 05:29, 05:31, a round begun at 05:20 and 02:00 extra practice each on the right study day, sessions too, and a Monday 02:00 card in Sunday's week; the photos zip byte for byte with its index, another family's folder never asked for, and a missing photo stopping the zip; file names; and the size above.
- **`rls`:** the export's exact queries (read from `export-store.ts`) read all of a family as its caregiver and none of it as another caregiver, even naming its id; the person's login reads no card record or phone; no login reads PINs or the pairing limits.
- **Broken on purpose and caught:** the role check removed (the person's login could read), the family filter removed (another family's sessions appeared), and paging removed (only the first 1,000 rows).
- **`check-logic`:** Export my data under Privacy and data with its two choices, photos only once ticked, Cancel, Try again and this phone's copy offline; Delete account running the same panel; none of the banned words in any export file and no logs but `warnKind`; only Settings shows it and no person-facing screen reaches any export module; the export only reads card records; files deleted after sharing and at sign-out; the report's words through the Insights claims check, and its pinks allowed there only.
- **Web walk** (sign-in on against the stand-in, gray stand-ins for the family photos, every other request blocked, 32 checks at 390x763 and 375x647): both choices; the data file downloaded and read (format 2, complete, everyone and their facts, no email); the report; photos with none added saying so calmly; offline's calm words, Try again and this phone's copy, labelled incomplete; the export inside Delete account and Back; nothing wider than the page, targets at least 44, no red, no page errors. The report, printed to PDF in Chrome from eight weeks of demo practice, read page by page. The export, screenshots and PDFs were deleted afterwards.

### Needs clinician review (added)

- **The report's content and wording** for a clinician reader: what it shows, "Found most readily" and "Needed the most support", and the weekly average of daily Memory scores.

# The release before: the person's daily reminder

Updated 2026-11-13.

## Status

**Built, committed and checked** in Node (a fake clock and a fake device), against the in-memory Supabase stand-in (the real sign-out paths), in real iOS and Android release bundles, and in the local-only web build in headless Chrome. **Not on a phone yet.** No schema change, nothing on Supabase to do, and no server involved: the reminder lives on the person's phone only.

### What changed

- **A gentle daily reminder**, as a local notification on the person's own phone: "Your practice is ready whenever you are." At most one a study day, 09:00 by default, none today once the day's session is complete, no follow-ups, never anything personal in it. `expo-notifications` (~58.1.9) added, with its config plugin and remote notifications off.
- **Asked once:** after the person's first completed session, back on their home, a sheet asks "Would you like a gentle reminder on this phone each day to practice?" with **Yes, remind me** and **Not now**. Not now, or no at the system prompt, is final.
- **The person's Reminders:** the Aa sheet on their home has a Reminders row under the sizes: on or off, and the time with Earlier and Later (30 minutes a step, 06:00 to 21:00). With notifications off in the phone's Settings, a calm line says how to turn them on, with **Open settings**. Saved on the phone only; the caregiver has no control and sees nothing.
- **Kept right, never stale:** the phone keeps the next 3 days' reminders waiting and rebuilds them when the home opens, comes to the front, the day's session is completed, a new study day begins at 05:30, and any setting changes. One identifier per study day, and a day whose reminder has fired never gets another, whatever the clock or time zone does.
- **Cancelled on sign-out**, every way it happens, including a phone the caregiver removed, as soon as it checks in. A launch signed out or as the caregiver keeps none.
- **Files:** `src/lib/reminders.ts` (the rules, pure, with an injectable `Notifier`), `src/lib/notifier.ts` and `notifier.web.ts`, `src/data/reminders.ts`, `src/components/reminders.tsx`, the constants in `src/config/schedule.ts`, and small changes to the home, the Aa sheet, the root layout, `forget.ts` and the privacy notice.

### Decisions I made (also in `DESIGN.md`)

- **3 days scheduled ahead, not 1.** With only the next one, someone who didn't open the app would get one reminder and then none. Three keeps a daily cue for a day or two, and bounds a phone signed out or removed while closed to three more before it opens and cancels them.
- **"Fired" is read from the system's waiting list, not the clock.** The first version used the clock alone; the new tests caught a second reminder in one study day when the clock was set back after one had fired.
- **Where the setting lives:** the person has no settings screen, so Reminders is a row in their Aa sheet, with its view swapped inside the same sheet. The caregiver's copy of that sheet has no row.
- **Earlier and Later** buttons instead of a wheel time picker: large, two taps, no fiddly scrolling.
- **No reminder at all with nothing to practice** (fewer than two people in the deck).
- **Only "asked" survives sign-out**, so signing in again on the same phone never repeats the question; the reminders are cancelled and turned off.
- **Silent in the app's foreground**, and a delivered reminder is cleared from the notification list once the day is done.
- **The time zone gap:** a reminder is a fixed instant, so after a time zone change while the app is closed, it comes at the old zone's 09:00 until the app next opens. Accepted; noted in `CLAUDE.md`.

### What you must do

- Nothing on Supabase. Restart the dev server with `npx expo start --clear` (a new native module was added; it is bundled in Expo Go).

### Only a real device can verify

**In Expo Go on a phone** (local notifications work in Expo Go on iOS and Android; Expo Go logs a warning that push isn't supported, which doesn't affect this):
1. Finish the day's session and go back to the home: the question appears once. **Yes, remind me** shows the system prompt.
2. Aa, then Reminders: choose a time two or three minutes ahead (move the phone's clock if needed) and lock the phone: one reminder arrives, with only the sentence. Tapping it opens the app.
3. Finish the day's session before the time: nothing arrives that day.
4. Turn notifications off in iPhone Settings, then Evermore: the calm line and **Open settings**, which opens the app's page in Settings. Turn them back on and return: reminders are scheduled again.
5. Restart the phone: the next reminder still arrives (iOS keeps them; Android restores them at boot).
6. Daylight saving and a time zone change: set the phone's zone by hand, open the app, and check the next reminder is at the local time.
7. Sign out, or Remove phone from the caregiver's Settings: no reminder comes afterwards.

**Only a development build or TestFlight:** the Android notification icon in the status bar (the plugin has no monochrome icon yet, so Android may show a plain square), the iOS build carrying no push entitlement, Android 13's permission prompt with the channel, and Android's inexact delivery (without the exact-alarm permission a reminder may arrive a few minutes late). Reinstalling the app clears its reminders and settings on both platforms, so the question is asked again after the first completed session.

### Verified on 2026-11-13

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:** the new `check-reminders` (18), `check-logic`, `check-auth` (55, now with reminders cancelled on sign-out and on Remove phone), `check-server-family`, `check-sync`, `rls`, `records` (10), `pairing` (22), `function` (18), and `check-release`. The live tests weren't run (nothing on the server changed).
- **`check-reminders`, with a fake clock and a fake device:** the 09:00 default after 05:30, and every time you can choose belongs to its date's study day; the one message; three days ahead at 09:00; today skipped once the session is complete, and nothing firing after; a passed time skipped, never sent late; the 05:30 rollover; never two in a study day (time changed after it fired, rebuilt again and again, off and on); travel west after it fired and east before; the clock set back, or forward then back; daylight saving both ways (23 and 25 hours apart, 09:00 on the wall); turned off; sign-out and a removed phone; a reminder in the list cleared once the day is done; the permission denied, revoked and granted again, and failing system calls, all silent, logging only the kind; nothing to practice; defensive reads; and a month of random use with the clock and time zone jumping, with never two in a study day and never one after that day's practice.
- **Broken on purpose and caught:** the clock-only "fired" rule (two in a day), and `forgetReminders` taken out of sign-out (`check-auth` failed).
- **Web walk** (local-only build at 390x763, gray stand-ins for photos, every other request blocked, 28 checks): no question before the day is done; the question once after, Not now final across a reload, Yes turning reminders on with none today; the Aa sheet's Reminders row, On, 09:00 and Later to 09:30 rescheduling, Off cancelling; the calm line and Open settings with the permission off; targets at least 48, nothing wider than the page, no red. The export and screenshots were deleted afterwards.

### Needs clinician review (added)

- **The 09:00 default** and the 06:00 to 21:00 range.
- **One reminder a day, no follow-up**, and three days kept waiting.
- **The wording:** "Your practice is ready whenever you are." and the question "Would you like a gentle reminder on this phone each day to practice?"

# The release before: the pre-release sweep

Updated 2026-11-12. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built, committed and checked** in Node, PGlite (the real schema), real iOS and Android release bundles, and the web build in headless Chrome (sign-in on against the stand-in, and sign-in off). **Not on a phone yet.** No schema change in this sweep beyond the study day's (still to be rerun if you haven't: see the next section). Only fictional test accounts and gray stand-in photos were used; no real data on the phone or the server was touched. `docs/SETTINGS-AUDIT.md` was written first.

Commits, smallest first: Settings (`96abee0`), load failures (`bf6582b`), privacy (`3cc6e54`), photos (`a514dac`), reliability (`0bec572`), then these docs.

### Removed from Settings (and from every screen)

- **Load 14 days of sample activity** and **Clear sample activity** (development builds, sign-in on). This is the control that hurt real data: one tap wrote made-up sessions into the signed-in family on the server (so Today, Trends and the 4-week average showed invented practice), and the other deleted rows. Both gone, with `src/data/sample-activity.ts`.
- **Load demo data for Insights** (development, sign-in off). Gone; walks seed demo records directly.
- **Clear test data** (sign-in off). Gone from the app; `EXPO_PUBLIC_CLEAR_TEST_DATA=1 npm run start:local` does it in development only.
- A check in `scripts/check-logic.mjs` fails if any screen or component refers to a sample loader, a clearing action, `__DEV__` or debug, or carries such a label.

### Every destructive action and its safeguards

| Action | What it loses | Safeguards now |
| --- | --- | --- |
| **Delete account** (Settings, last, apart) | Everything in the family, from the server and every phone, and every login | Names all of it and where; **Export my data first** offered; works only once “delete” is typed; **Keep my account** |
| **Delete permanently** (only on an archived person's sheet) | That person's photo, facts, stories, AI sentences, practice history and card records, phone and server | Only after Archive; names what goes and where; works only once “delete” is typed; **Keep June** |
| **Archive** | Nothing (out of practice, all kept) | Undo toast; Restore from Archived people |
| **Sign out** | Nothing of the caregiver's: only this phone's copies (family, Insights copy, photo cache, a PIN on show) | A confirmation that says the family stays saved and that signing in again needs the internet |
| **Remove phone** | That phone's access (its practice stays) | A confirmation naming the phone |
| **Their login** (new password) | Nothing; that phone signs in again | A sheet with Save |
| **Editing** (emptying an answer, Remove photo, Skip, Edit) | The one fact or photo, as the caregiver intends | Autosave of what is typed; Skip and Edit reversible |
| **Approve all** | Nothing | Undo toast (and a confirmation on the sheet) |

No action on the phone alone deletes server data; signing out never deletes caregiver data. **Export my data** (Settings → Privacy and data) gives a JSON file of everything entered, through the share sheet; on the web it downloads.

### What else changed

- **Settings** is Account, Linked phones, Practice, Privacy and data, About, then Delete account apart. Offline it keeps its account rows and says calmly that practice settings appear once the family loads.
- **Load failures told apart:** offline, sign-in ended, server not yet updated, or the server away, each with calm words and **Try again**, on Insights and the dashboard. Insights used to say "need the internet" for all of them. They also read every column now, so they work before you rerun the schema.
- **Never a blank tab:** offline before the family loads (supabase-js retries for about 7 seconds), Today, Trends, Insights and People showed nothing; now one calm line, then the reason.
- **Privacy:** the real family's photos and cards load only in development builds; `scripts/check-release.mjs` builds release bundles and fails on any real photo (by bytes), any real card's words, a secret or a developer control, and was shown to catch the old photo loader. `.easignore` added. Logs print only the kind of a failure (`warnKind`). Every table has RLS, now also checked from the database itself.
- **Photos** are resized to at most 1280 px on the long edge as they are picked (`expo-image-manipulator`).
- **AI questions off by default** again (`AI_VARIANTS_ENABLED = false`), as the hard rule says.
- **Code health:** removed the unused `expo-web-browser`; the stand-in now lets a person read the family's sessions, as the schema does; a racy sign-in check made deterministic.

### Performance, before and after

Measured in headless Chrome (390x763), the median of 7 runs, from navigation or the tap until the target is on screen; sizes from `expo export`:

| | Before | After |
| --- | --- | --- |
| Startup to the welcome (sign-in on) | 730 ms | 727 ms |
| Startup to the person's home (sign-in off) | 728 ms | 724 ms |
| Tab: Today / People / Settings | 30 / 38 / 38 ms | 30 / 38 / 30 ms |
| Open Add a person (including its slide) | 350 ms | 337 ms |
| iOS bytecode | 5,412 KB | 5,436 KB (+24 KB: Settings, export, resizer) |
| iOS export, all files | 6,564 KB | 6,460 KB |
| Real family photos in a release build | 1,228 KB (all 7) | none |
| A picked camera photo (4032x3024, about 3 to 5 MB) | kept and uploaded whole | 1280 px, a few hundred KB |

An earlier figure of ~910 ms for Add a person was the measuring tool's polling, not the app. Startup is the bundle and fonts loading; no list is long enough to need virtualizing (People is a family; story approval one person's stories), and no long tasks (over 50 ms) were seen on any transition.

### Chose not to change

- **Haptics:** the only one is a light tap on the caregiver's long press on People, and iOS turns it off with the phone's own System Haptics setting; a setting of our own would be a feature.
- **No red for destructive buttons:** the palette has none, by rule; deletion is made deliberate by the typed word and its place.
- **`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `react-native-screens` and the rest** that nothing imports directly are Expo Router's, Reanimated's or the web build's peers: kept.
- **The export covers the last 30 days of practice** (what the dashboard loads) and leaves photos out (large, and they stay in the account).
- **Local-only mode** is still the development mode it was; without `__DEV__` it has no real family at all.

### What you must do

- **Rerun `supabase/schema.sql`** if you haven't since the study day (the steps are in the next section). Nothing new in this sweep.
- After this session, start the project with `npx expo start --clear` (the walks exported copies of the project).
- Before any release, run `node scripts/check-release.mjs`.

### Only a phone can verify

- **Export my data** through the real share sheet (Files, Mail), and the file opening.
- **Photo resizing** with a real camera photo, and the upload size.
- **The typed confirmations** with the real keyboard (autocapitalization off), and VoiceOver reading the disabled button's hint.
- **Offline start and sign-out** on a real network change, and coming back online.
- **VoiceOver order and focus after navigation**, the largest system text sizes (caregiver screens cap at 1.3x), and Reduce Motion with Reanimated running natively.
- **The release guard on a real release build** (it checks `expo export` bundles; an EAS build is never run).

### Verified on 2026-11-12

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:** `check-logic`, `check-server-family`, `check-auth` (55, eight runs in a row after the race fix), `check-sync`, `rls`, `records` (10), `pairing` (22), `function` (18), and `check-release` (14).
- **New checks:** no developer controls on any screen; Settings' order; typed confirmation for both deletions; sign-out deletes nothing on the server; the export's contents (everyone, every fact, nothing private); the load-failure classifier and its calm words; every log line fixed words only; the photo size rule; never a blank tab; every public table with RLS.
- **Web walks** (gray stand-ins for photos, every other request blocked): signed-in sweep 62 checks (welcome, sign-up, every tab, Settings, export downloaded and read, Delete account's typed word, archive, Delete permanently's typed word and Restore, offline start and offline sign-out, pairing a second phone and practicing on it); offline from a fresh phone (a calm line, the right reasons, Try again back online); add a person 424; study day 28; regression 20. The audit now also requires an accessible name on every control. Exports and screenshots were deleted afterwards.

# The release before: the study day (05:30), and practice never blocked

Updated 2026-11-12. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built, committed and checked** in Node (with the real schema in PGlite) and in the local-only web build with a fake clock. **Not on a phone yet, and the schema needs rerunning on Supabase** (below). `docs/STUDY-DAY-AUDIT.md` was written first: every place the app decided "today", and what changed.

### What changed

- **One boundary.** `DAY_START_HOUR = 5`, `DAY_START_MINUTE = 30` in `src/config/schedule.ts`; `studyDayKey(date, timeZone?)` in `src/lib/study-day.ts` is the only place the boundary is worked out. `dayKey` is now `calendarKey`, for calendar cells, labels and storage only, and a check fails if anything else computes "today".
- **Practice is never blocked.** The finished-day home says "Nice work." and "You can keep practicing, or come back in the morning.", with **Keep practicing** as its one main button, at any hour. Rounds begun after the day is complete are **extra practice**: recorded, hinted and counted in Insights, shown as "Extra practice" on a day's sheet, and left out only of practice time against the standard.
- **A fresh day at 05:30**, on a timer set to the next boundary and when the app returns to the front, without a reload. An unfinished day stays unfinished; nothing carries over. Practice at 23:00 or 03:00 counts toward that study day.
- **A round in progress at 05:30** finishes on the day it began: its cards, bar and log stay there, and it is never cut off.
- **Day steps** (1, 3, 7, 14) are due at the start of a study day, counted in study days.
- **Dashboard and Insights** group by study day; the Memory score's calculation is unchanged.
- **Each session and card record stores its study day** (and records whether they were extra practice), worked out on the device when the round began; older rows fall back to their time.
- **The device's study-day clock** (`src/data/study-clock.ts`) only moves forward: a clock set back, or travel west, can't hand out a day twice.
- **Paired phones:** a person's login may now read (never write) the family's sessions, so a day finished on one phone shows on the other.

### Choices the brief left to me (in `DESIGN.md`)

- **A record's day is its round's**, fixed on the device when the round started: the brief asked both "computed when the attempt was made" and "a round across 5:30 counts toward the day it started in"; this satisfies both.
- **Extra practice** = any round begun once the day's session is complete (Keep practicing's mix or one person). It counts in the score and the day's cards, but not in practice time against the standard, so it can't change whether the day was finished.
- **Clock forward then back:** the day reached stays until real time catches up (no session is handed out twice); practice is never blocked meanwhile.
- **Travel east** begins the new local day by the new local time; crossing the date line can move the key on by two calendar dates, and nothing practiced moves.
- **Scheduling** uses the study day of the moment each card is finished, not the round's.
- **"All done today."** is gone from the home and the wrap-up: it could read as practice being over.
- **Paired phones read the family's sessions:** a loosening of "a person reads only their own sessions" (sessions hold times and counts only), needed for the second phone to see the day finished.

### What you must do on Supabase: rerun the schema

It adds `sessions.study_day`, `attempt_records.study_day` and `attempt_records.extra_practice` (null or false on older rows), their insert grants, and the policy letting a person's login read the family's sessions. It is written to be rerun.

1. In Terminal: `pbcopy < ~/evermore-expo/supabase/schema.sql`
2. Supabase → your project → **SQL Editor** → **New snippet** → paste → **Run** (choose **Run this query** if it warns about the `drop … if exists` lines). It ends "Success. No rows returned".
3. Check it: **New snippet**, paste, **Run**:
   ```sql
   select count(*) = 3 as study_day_ready from information_schema.columns
   where table_schema = 'public' and ((table_name = 'sessions' and column_name = 'study_day')
     or (table_name = 'attempt_records' and column_name in ('study_day', 'extra_practice')));
   ```
   It should answer **true**.

**Until you rerun it:** sessions still sync (the phone resends one without `study_day` if the server refuses the column, and its day is worked out from its time), and card records wait safely in the phone's queue until the columns exist. Nothing is lost.

### Check on your phone

1. Finish the day's session: the home says "Nice work." and "You can keep practicing, or come back in the morning.", with **Keep practicing**. Tap it at any hour: a round starts.
2. Leave the app open past 05:30 (or set the phone's clock to 05:29 and wait a minute): **Start** appears for the new day without closing the app.
3. Practice after midnight, then look at Insights: those cards are on the day before; a day with extra practice shows "Extra practice" on its sheet.
4. Set the phone's clock back a day: the home doesn't offer yesterday's session again.

### Verified on 2026-11-12

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:** `check-logic` (with the new checks below), `check-auth` (55), `check-server-family`, `check-sync`, `rls` (with the new columns and the family read), `records` (10, in four time zones), `pairing` (22), `function` (18).
- **New logic checks:** 05:29:59 and 05:30:00, midnight, a new year and a leap day; daylight saving in New York both ways (23- and 25-hour study days, the doubled 01:30, due dates at 05:30 EDT and EST); the same instant in four time zones; the clock set back, forward then back, travel west and east, day after day (each day once, none skipped); a round finished at 23:00 completing its day, 03:00 practice counting there as extra practice, a fresh log and target at 05:30, an unfinished day staying partial; a round across 05:30 counting toward its own day and leaving the new day's log alone; a mix and one person's cards always offered at 02:00, 05:31 and 23:59, and calm words with no refusal or time; 1, 3, 7 and 14-day gaps in study days; Insights by study day with older records falling back, the score unchanged, extra practice labelled and out of the standard; records keeping their day through upload, a resend counted once and three offline days each kept; two phones by key, never a 24-hour window; and that nothing else works out "today". Three rules were broken on purpose (the boundary, the forward-only clock, the round's log) and each was caught.
- **Older checks changed on purpose:** day steps and returning cards are due at 05:30 rather than midnight; "an older session" fixtures now drop their saved day; the person's login reading the family's sessions; the record columns.
- **Web build with a fake clock in New York** (28 checks at 375x647 Medium and 430x839 Extra large): done at 23:00 with the calm words and Keep practicing, still the same day at 02:00 with a round opening, a fresh Start at 05:31 without a reload and the clock saved, and the clock set back staying on the new day; the usual audit. The export was deleted afterwards.

### Not verified

- **On a phone:** the timer and the return to the front at 05:30, the clock store in secure use over days, and two paired phones live (the read policy is checked in PGlite).
- **The live project** until the schema is rerun.

### Needs clinician review (added)

- **The 05:30 start of a study day.**
- **An unfinished day does not carry over:** the next day starts fresh, and the missed cards wait only in the schedule.
- **Extra practice:** counted in the Memory score and the day's cards, not in practice time against the standard, and moving the schedule like any card.

# The release before: add a person, refined

Updated 2026-11-12. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built, committed and checked** in Node and in the local-only web build in headless Chrome. **Not on a phone yet.** No schema, data, photos or Edge Function changed, so there is nothing to do on Supabase. The tree was clean at the start (`4e96829`). Two commits: the change with its tests and `docs/ADD-PERSON-AUDIT.md`, then these docs.

`docs/ADD-PERSON-AUDIT.md` was written first: every finding, its cause, the verdict, and what wasn't changed and why.

### What changed

| # | Change | Where |
| --- | --- | --- |
| 1 | **One flow of eight steps.** The first screen is Step 1 of 8 ("Who they are"), Review is Step 8. Every step has the same header: slim bar, "Step N of 8 · X% complete", Finish later. A short title and a one-line helper per step; Basics is now "Names and dates" | `StepLayout` in `src/components/questionnaire.tsx`; `helper`, `stepLabel` in `src/data/questionnaire.ts` |
| 2 | **The percent, defined and live.** 20 for each required question done; 3 for each optional question answered, at most 15, only while something required is missing. 100% still means complete (the gate), and nothing optional reaches it. It follows what is typed, not only what was saved | `profileCompletion`, `withAnswers` in `src/lib/profile.ts`; `COMPLETION` |
| 3 | **Notes once.** "* Required" only on steps with something required (1, 5, 6). Facts-only in full on step 1, a small "Facts only" link after | `hasRequired`, `StepLayout` |
| 4 | **One field pattern.** One card per step (a heading starts another); follow-ups joined to their answer; one ⊕ add row inside the card for every add-more action; "Not applicable" always at the end of the label line, gone from inside the relationship list; an 80pt photo preview that is a button, with Choose a photo beside it | `LabelLine`, `AddRow`, `joined` in `src/components/caregiver-ui.tsx`; `Picker` in `choices.tsx`; `PhotoField` |
| 5 | **Centered 520pt column** for the form and story approval | `CaregiverScreen narrow` |
| 6 | **Keyboard:** Next moves to the next typed field, Done on the last | `FieldChain`, `FormRow chain` |
| 7 | **Nothing typed is lost:** "Other" words become a chip on leaving the field; "Something else" words kept when the list closes; leaving a nameless new person with answers asks first | `ChipAnswers`, `Picker`, `mayLeave` |
| 8 | **Review:** Continue, disabled with "Continue · 60%" until 100%; What's left jumps to the first missing question, focuses it and shows its note; that step's button says "Back to review". Every other step's button is Next | `reviewAction`, `ReviewStep` |
| 9 | **Resume profile** (was Finish profile) says where it picks up: "Picks up at step 5 of 8, Interests." | `resumeLine`, `person-sheet.tsx` |
| 10 | **Approve all on story approval**, pinned beside Done: one tap approves exactly what one tap each would; toast with Undo; disabled when nothing can be | `storyApproval`, `approveAllButton` in `src/lib/approve-all.ts`; `src/app/caregiver/review.tsx` |
| 11 | Empty and error states: Hints with no facts says what will appear; a failed save's notice sits in the pinned bar; Reduce Motion checked explicitly | `questionnaire.tsx` |

### Choices the brief left to me (recorded in `DESIGN.md`)

- **The percent counts optional answers, capped below one required share.** The brief asked for both "Continue enabled only at 100%" and optional answers in the percent. If optional answers were part of 100%, either the five-item required list would silently grow or 100% would stop meaning complete, and the gate (hard rule) decides who is in the deck. So they count on the way, never to 100%. Drafts read a few points higher than before ("Draft, 63%" for name, photo, relationship and one fact, where it said 60%).
- **Only Review's button waits for 100%.** The required questions sit on steps 1, 5 and 6, so gating each step's button would make the form impossible to finish. Every other step's button is "Next"; "Continue" is the one that waits, and shows the percent.
- **Eight steps, not nine.** Interests is still the longest step (it scrolls about 310pt at 375x647 with Other open). Splitting it needs `people.profile_step` checked up to 8 in `supabase/schema.sql`, and a rerun on Supabase before the app could save step 8.
- **Approve all on story approval has no confirmation dialog**, unlike the sheet's: every story is on screen (which is what the sheet's confirmation shows), and Undo covers a slip. `CLAUDE.md`'s rule now says so. It never approves a fact that may change (hard rule; the toast counts them), an AI sentence (not on that screen), or a story open for editing.
- **"Skip" stays "Skip"** on story approval: the brief said "Reject", but Skip is the app's word (`CLAUDE.md`: "skipped ones never appear") and gentler.
- **"Edited sentences keep their edits":** a story's words are never touched by Approve all; an edit still open is left out, so nothing is approved under the caregiver's typing.
- **The facts-only note** opens in place from a small link rather than a sheet: one sentence doesn't earn a sheet.
- **Not changed:** `ProgressBar` (shared with the practice card, a person-facing screen) and every person-facing screen. Android's hardware Back on a nameless new person still leaves without asking (only the on-screen Back and Finish later ask).

### What you must do

- **Nothing on Supabase.**
- After this session, start the real project with `npx expo start --clear`: the walk exported a copy of the project, and Metro's cache is shared.

### Check on your phone

1. **People → Add a person.** Step 1 of 8 with the bar at 0%. Type a name: 20% at once. Tap the photo box: the library opens. Relationship: "Not applicable" is on its label line, not in the list.
2. **Keyboard:** on Names and dates, the key says Next and moves through Goes by, What the person calls them and Birthday; the last says Done.
3. **Steps 2 to 4:** no "* Required"; the bar moves a little as you answer (up to 15 points). "Facts only" opens the line.
4. **Finish later** partway, then the person's sheet: "Resume profile", "Picks up at step N of 8, …", and your answers are there.
5. **Review** before a shared memory: "Continue · 95%" is disabled; **What's left** opens Shared memories with the field focused. Type one: 100%, then **Back to review** and **Continue**.
6. **Story approval:** "Approve all N", tap it, the toast and **Undo**, then approve again. A fact marked "This may change" still needs its own Confirm.

### Verified on 2026-11-12

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:** `check-logic` (with the new checks below), `check-auth` (55), `check-server-family`, `check-sync`, `rls`, `records` (10), `pairing` (22), `function` (18).
- **New logic checks** (`scripts/check-logic.mjs`):
  - **The percent:** every figure by hand (0, 20, 23, 60, 63, 75, 83, 95, 100), a question counted once, the best clue counted, the cap, and 400 random profiles where 100% appears exactly when nothing required is missing and answering never lowers it; the live figure from typed answers, an emptied answer no longer counting.
  - **Steps:** one card per step plus one per heading; short titles and one-line helpers; "Step 1 of 8" and "Step 8 of 8"; the legend only on steps 1, 5 and 6.
  - **Review's Continue:** disabled with the percent below 100, "Continue" at 100, "Add Ann to practice" for someone deselected. **Resume:** its line.
  - **Approve all on story approval:** only waiting stories (not approved, skipped, dated or someone else's), a long sentence included, a story being edited left out, skipped stays skipped, words untouched, AI sentences untouched, Undo restores every story, disabled with nothing left, the count in the label; the screen uses the same rule, stories only, with Undo, and keeps Approve, Edit and Skip.
  - Older checks changed on purpose: groups (no more unheaded splits), "optional questions never count" (now they do, capped), and the drafts' percents (60 → 63 where a person has their one fact).
- **Web build in headless Chrome** (a throwaway copy with gray stand-ins for the family photos, local-only, every other request blocked):
  - **The add-person walk:** 424 checks at 375x647 and 430x839, Medium and Extra large, Reduce Motion on and off, plus 1024x800: the header on every step, the percent at each answer and the bar's fill, Not applicable and Undo, the photo picker, the relationship list without its own Not applicable, typed words kept, Next and Done, legends and asterisks only where needed, Back keeping answers, Finish later and Resume, Other words kept, What's left focusing the field with its note, Continue at 95% and at 100%, the simulated keyboard, the step sliding in only without Reduce Motion, and Approve all with its toast and Undo; the usual audit on every screen.
  - **Around it:** 20 checks on Settings and its list, People, a sample person's sheet, the person's home, Hints with no facts, and leaving a nameless person.
  - The audit itself caught a planted red word, an off-palette color, a small target and a wide element.
- The exports and screenshots were deleted afterwards. Your live project wasn't touched.

### Not verified

- **On a phone:** the real keyboard's Next and Done, the photo library, the step's slide with Reanimated running natively, VoiceOver on the label lines and the disabled Continue's hint, and the toast's position above the pinned bar with a home indicator.
- **Sign-in on:** walked local-only. The changes are in the shared form and the pure rules, and `check-server-family` covers Approve all against the in-memory Supabase, but no walk ran against the stand-in server.

# The release before: the landscape logo, and question refinement

Updated 2026-11-11. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built, committed and checked** in Node and in the web build in headless Chrome against the Supabase stand-in. **Not on a phone yet.** Two commits: `fa52a26` (A, the logo) and the one after it (B, question refinement, with these docs). No data, photos or schema changed, so there is nothing to rerun in Supabase. The tree was clean at the start (`61e98ef`).

### A. The landscape logo

- **No file was attached** to the request. The repo already had the landscape wordmark, `assets/images/logo-wordmark.png` (1200x396), so everything uses that file, unaltered. **To use a different logo, replace that one file.** If its shape differs, set `LOGO_ASPECT` in `src/components/logo.tsx` to its width / height: `node scripts/check-logic.mjs` reads the file and names the numbers.
- **One component,** `<Logo size="hero" | "home" | "form" />`: `expo-image`, `contentFit="contain"`, its own aspect ratio, read as "Evermore". No other file shows the logo itself (checked).
- **Where:**
  - the welcome
  - caregiver Sign in and Create an account
  - the person's I am practicing, Hello (User ID), email and PIN steps
  - You are all set (it replaced the mark)
  - the person's home, above the greeting and Start
  - test IDs `logo-welcome`, `logo-sign-in`, `logo-create-account`, `logo-person-choice`, `logo-person-sign-in`, `logo-pair-email`, `logo-pair-pin`, `logo-all-set`, `logo-home`
- **Keyboard and small phones.**
  - On steps with a field it folds away while the keyboard is up (`useKeyboardOpen`, now shared with `CaregiverScreen`).
  - Under 700pt tall each size is smaller (200, 160, 128 instead of 260, 220, 168).
  - The welcome, You are all set and the home have a middle that scrolls only if very large text needs it, so the primary button can't be pushed off the screen.

### B. Question refinement

`docs/QUESTION-AUDIT.md` has the audit (every template and shape, what it tests, its cue, its distractor rule, the principles it meets or misses), each change with before and after wording, and what wasn't changed and why. **The principles are design assumptions,** apart from the two evidence points stated there, and nothing in the app or docs claims practice helps memory.

| # | Change | Where |
| --- | --- | --- |
| 1 | Names that sound alike (same first letter, or a spelling a letter or two apart) aren't offered together while the deck has others; no name twice | `soundsAlike`, `chooseNames` in `src/lib/stories.ts` |
| 2 | Hint ladder: fact, relationship, letter, fewer names, then **the answer** ("It’s June.", its button selected). The relationship rung is skipped when the card already says it, and on reverse cards | `HINT_LADDER`, `hintAt` |
| 3 | Cue fading by schedule step: the relationship cue for new cards, leaner ways as a card climbs (a preference inside the existing rules) | `CUE_FADING` in `src/config/schedule.ts`, `nearestCue` in `src/lib/session.ts`, `cueLevel` |
| 4 | "Who is this?" comes after the fact | `SHAPES.who` |
| 5 | A question that would say the person's name is left out; a card with nothing left isn't practiced | `phrasingsFor`, `cardsOf` |
| 6 | Same-session re-asks at expanding gaps of about 1, 2, 4 and 8 minutes (as cards), at most 8 a session | `SAME_SESSION_MINUTES`, `SAME_SESSION_MOST`, `reaskSpot`, `PracticeScreen` |
| 7 | "Today you saw" on the wrap-up: up to 6 faces and names, first-seen order, everyone with a photo | `todayYouSaw`, `TODAY_YOU_SAW` |
| 8 | AI: 14 words asked and 16 enforced (were 18 and 22), active voice, no double negatives, question last; `lives_with` no longer a reverse kind | `generate-questions` prompt, `src/lib/ai-check.ts` (synced) |
| 9 | Story approval notes "Shorter sentences are easier to read." past 14 words | `review.tsx` |

**Template list, before and after.** Only these fixed shapes changed wording:

| | Before | After |
| --- | --- | --- |
| who | Who is this? This person loves the Otters. | This person loves the Otters. Who is this? |
| calls who | Who is this? You call this person Nana. | You call this person Nana. Who is this? |

Every other shape (`my-rel`, `name`, `favorite`, `ask`, `whose`, `ask-met`, `photo`, the calls shapes) and every predicate is word for word as before. What changed for them is when each is chosen (cue fading) and which are offered (a shape that shows the name is dropped). The audit lists all of them.

### What you must do

- **Nothing on Supabase** for either part.
- **Only if you use AI** (off by default, sign-in off only): redeploy `generate-questions` the usual way. Paste the whole `supabase/functions/generate-questions/index.ts` into the function at `clever-service`, keep Verify JWT off, and deploy. Until then, the live function asks for 18 words and accepts 22, and the phone's check (16) drops anything longer anyway.
- After this session, start the real project with `npx expo start --clear`: the walk exported a copy of the project, and Metro's cache is shared.

### Check on your phone

1. **Signed out** (sign in, then Settings → Sign out): the logo on the welcome, Caregiver → Sign in, Create an account, and I am practicing → Create my account (both steps) and Sign in. Tap into a field: the logo folds away while the keyboard is up, and the field and Continue stay in view.
2. **iPhone SE or the largest text size:** on the person's home, Start stays fully on screen.
3. **Practice:** choose other names on a card until the hint says "It’s …": that name's button is filled, and tapping it ends the card as usual. A card that needed a hint comes back a few cards later, and again later if answered first time.
4. **Finish a day:** the wrap-up shows "Today you saw" with faces and names.

### Verified on 2026-11-11

- `npx tsc --noEmit` and `npx expo lint` are clean.
- **All suites pass:**
  - `check-logic` (with the new checks below)
  - `check-auth` (55)
  - `check-server-family`, `check-sync`
  - `rls`, `records` (10), `pairing` (22), `function` (18)
- **New logic checks** (`scripts/check-logic.mjs`):
  - **Length:** no fixed shape of any kind of fact runs past 14 words; the hints and fixed lines are short; an AI sentence of 16 words passes and 17 is dropped.
  - **Distractors:** 600 random choices with sound-alike names in the pool never offer a name twice, never one that sounds like the answer, and never two alike distractors; with enough unlike names, the other names are always ones not just shown.
  - **Approved facts only:** a four-person family with waiting and skipped facts, planned 40 times, never says either in any card, read-back, hint (all six steps) or choice, and every word beyond the fixed shape is the card's own approved fact.
  - **No judging words:** none of wrong, incorrect or fail in any card, hint or practice screen's text.
  - **Answer in the stem:** never there; "June Bug" for June leaves only the photo card; a first name counts; "annual" for Ann doesn't.
  - **Cue fading:** the bands; a person's first new card leads with the relationship; about a third of new cards against about 2% at step 4; the face alone first only on a high step.
  - **Ladder:** the order and the answer at its end.
  - **Re-asks:** the gaps grow and stop past the session's end.
  - **Today you saw:** first-seen order, at most six, nobody without a photo.
  - **AI:** `lives_with` not reversible.
  - **The logo:** its shape against the file, one component, every screen's test ID, folding.
- **Each new rule was broken on purpose and caught:** sound-alike names, the name in a question, no answer at the end of the ladder, no cue fading, a judging word, a repeated distractor, a long template. The last two were caught by older checks that run first.
- **Older checks changed on purpose:**
  - the ladder's order and the answer at its end
  - the who card's wording
  - the one-person re-ask after 3 other cards instead of 2 (the 1-minute gap)
  - "other names not just shown", which now holds only where the deck has enough names unlike the answer: with Mae beside Milo there are too few, and the rotation of the right name's place keeps the hard rule
- **Web build in headless Chrome** (a throwaway copy with gray stand-ins for the family photos, against the stand-in on localhost, every other request blocked):
  - **The logo:** 456 checks at 320x568, 375x647 and 430x839, Medium and Extra large, on every screen above: its shape, inside the screen, nothing overlapping it, above the first field, the primary button wholly on screen below it, smaller under 700pt, the home's Start 64pt tall and its greeting at the display size, and the audit (48pt person targets, 44pt caregiver, contrast, palette, nothing red, no sideways scroll, no page errors).
  - **Practice:** 167 checks at 375x647 and 430x839, Medium and Extra large: a card's ladder reaching "It’s …" with only that name's button filled and two names left, no card opening with "Who is this?", a whole day to the wrap-up with 2 to 6 faces, and the same audit.
- The exports and screenshots were deleted afterwards. Your live project wasn't touched.

### Not verified

- **On a phone:** the logo folding with the keyboard (web has no keyboard events), the selected answer button read as "selected" by VoiceOver, and how a real session feels with the expanding re-asks: a hard day can add up to 8 cards.
- **The live AI function** with the new prompt (not redeployed).

### Needs clinician review

None of these is validated. Each is a placeholder for a speech-language pathologist:

- **Interval schedule:** same-session gaps of 1, 2, 4 and 8 minutes, the ceiling of 8 a session, and the across-day steps of 10 minutes, 1, 3, 7 and 14 days.
- **Hint ladder order:** fact, relationship, letter, fewer names, then the answer, and whether the answer should come sooner.
- **Cue fading thresholds:** the four bands in `CUE_FADING` and each way's cue level.
- **Re-exposure placement:** the wrap-up strip, 6 people, first-seen order, and whether re-exposure within the session would help.
- **Also:** the sound-alike test, and the 14-word guide.
- **The study day (added 2026-11-12):** the 05:30 start; that an unfinished day does not carry over; and extra practice counted in the Memory score and the day's cards but not in practice time against the standard.

# The release before: pairing the person's phone with the caregiver's email and a PIN

Updated 2026-11-11. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Built, committed and checked** in PGlite (the real schema), with the real `pair-phone` function running in Node against that schema, with the real supabase-js against the in-memory Supabase stand-in, and in the web build in headless Chrome against the stand-in on localhost, at the three iPhone sizes, Medium and Large, Reduce Motion off and on. **Not yet against your live project, and not on two phones**: the schema needs rerunning, the pepper setting, and two functions deploying (below). The AI integration and the Insights design weren't changed. The tree was clean at the start (`5227182`), so no checkpoint was needed. One commit each, backend first because the other two depend on it: `4fcd7be` (3), `40e5734` (1), `1c0e859` (2), `e60a722` (fixes found by the walk), then the docs and this handoff (4).

1. **Caregiver side** (Settings → **Pair the person’s phone**, a sheet): **Create a PIN** shows six digits in large type with a countdown ("Expires in 14:59"), **New PIN** (the old one stops working), and "What they need: Your email and this PIN." Once the phone pairs, the PIN gives way to "Phone 1 is linked." A clearly marked, disabled **Send the PIN by email**. **Linked phones**: each phone's name (its device name, or "Phone 1"), when it was paired and last seen, and **Remove phone**, which confirms first.
2. **Person side**: **I am practicing** now offers **Create my account** and **Sign in** (the User ID flow, unchanged). Create my account is "Your caregiver’s email" (email keyboard), then "The PIN from your caregiver" (number pad, large digits), one Continue each with a plain Back, then "You are all set" and straight to their home, signed in for good. Every failure reads "That did not work. Please check with your caregiver." The person chooses no password: the phone keeps its own login and a long random credential in `expo-secure-store`, and signs itself in again if its session is ever lost.
3. **Backend**: the **`pair-phone`** Edge Function (**deployed at the URL slug `hyper-function`**, the folder still `supabase/functions/pair-phone`; Verify JWT off because redeeming is the public way in, so it checks everything itself), four new tables (`pairings`, `devices`, `pairing_settings`, `pairing_events`), seven SQL functions, `my_caregiver()` refusing removed phones, several person logins per family, and `manage-family` updated for them.
4. **Docs**: `CLAUDE.md` (a new hard rule), `DESIGN.md`, `DESIGN-UI.md`, `README.md`, this file, and the in-app privacy notice.

### The security rules, in short

- **The link is enforced by the database, not the app.** A paired phone is a person login in the family; Row Level Security gives it exactly what the User ID login has (read the approved deck and settings, write its own practice and card records) and nothing else: it can't read `pairings`, `devices`, `pairing_events` or `pairing_settings`, and one family can't see another's. Removing a phone makes `my_caregiver()` refuse its login at once, everywhere, photos included.
- **The PIN** exists in plain form only on the caregiver's screen (in memory) and in the one request from the person's phone. The server keeps HMAC-SHA256 keyed with `PAIRING_PEPPER`, compares in constant time, and the PIN lasts 15 minutes, works once (atomically), is spent after 5 wrong tries, and is replaced by a new one.
- **Limits, mandatory and tested:** 5 tries per caregiver email and 20 per IP address in a sliding 15 minutes, one try at a time (so a burst gets no extra guesses), a ceiling of 500 tries across everyone, 10 PINs an hour per family, and the kill switch `pairing_settings.enabled`. Only keyed hashes of emails and addresses are kept, for a day.
- **Uniform answers:** every failed redeem is the same 400 `{"error":"not-paired"}` with the same headers after the same 1.5 s. The function logs only a failure's kind. The service-role key and the pepper live only in the function's secrets.
- **The person's phone** never shows the caregiver's email or any account detail after pairing, and doesn't keep the email: it is held in memory while the steps are open, cleared once used, with autofill off.
- **Remove phone** ends access at once (database), bans the login so its session can't refresh (within the hour at the latest) and changes its credential; the phone returns to the welcome as soon as it is online and checks in, and forgets its pairing.
- **Existing families and Their login keep working unchanged**: one User ID login per family, beside any number of paired phones.

### Choices the brief left to me (simplest safe option, recorded here and in `DESIGN.md`)

- **One login per paired phone**, rather than one shared person login: Remove phone has to end one phone's session without touching another's, and Supabase can only ban or sign out a whole login. So the schema's one-person-per-family index became one *User ID* login per family, and each phone gets its own. Practice rows are per login (as they always were), so **a new phone starts from the schedule each card reached on the family's other phones**: replacing a phone loses nothing. Two phones practicing on the same day both count on Today.
- **All three pairing actions are in one new function** (`redeem`, `create-pin`, `revoke-device`), so the pepper lives in one place. Linked phones are read straight from `devices` through Row Level Security.
- **Remove phone bans the login rather than deleting it**, because deleting would delete its practice history (the foreign keys). The ban also refuses its refresh token; Supabase has no way to end one session of a login from the server immediately, so the database rule does that part, at once.
- **"Within the hour":** a removed phone online notices when it next checks in: whenever practice refreshes (opening the app, its home screen, coming back to the front) and when the connection returns. A phone left open on one screen, online, notices at the next of those; one that never checks in is refused at its next token refresh, within the hour.
- **"Per-code" limits are per PIN** (5 wrong tries spend it). **The tries count per email whether or not it has an account**, so a lockout can't reveal one; someone who knows the caregiver's email can keep pairing locked for 15 minutes at a time (they wait, or pair later).
- **The IP address** is the first forwarded one. A caller can make that up, which only spends their own tries; the per-email, per-PIN and global limits hold regardless. Which header Supabase's gateway sets is unverified (below).
- **Only no connection reads differently** on the person's phone ("We couldn’t reach Evermore…"), since it says nothing about any account; every server answer reads the same.
- **On a failure the PIN box empties** and the email stays typed, in memory, for Back; leaving the steps or pairing clears both.
- **"You are all set" shows for 1.5 seconds**, then the phone signs in and their home opens, with nothing to tap (a Try again appears only if signing in can't happen then).
- **The device name** is the phone's own (`expo-device`; iOS 16 and later report "iPhone"), tidied to 40 characters, or "Phone N". On a new phone the first name from Their login, if the family has one, carries over ("Hello, Rose.").
- **The kill switch is on by default** (unlike AI's), so pairing works once deployed; without `PAIRING_PEPPER` the function refuses everything anyway.
- **Send the PIN by email** is a visible, disabled row: it needs custom SMTP (Supabase's built-in email reaches only your team), and a template that never puts the PIN in a subject line. Build it once SMTP is set up.
- **The User ID phone isn't in Linked phones:** Their login, in Settings, still resets it, which signs that phone out.

### What you must do on Supabase, one step at a time

Nothing here needs a key or the pepper in the chat, and none of it goes in the app, `.env` or git.

**1. Rerun the schema** (it adds the pairing tables and functions, and allows several person logins):
1. In Terminal: `pbcopy < ~/evermore-expo/supabase/schema.sql`
2. In your browser, open the Evermore project at supabase.com, then **SQL Editor** in the left sidebar.
3. Choose **New snippet**, click into the editor, paste (⌘V) and choose **Run**. If Supabase warns about a destructive operation (the file's `drop policy if exists`, `drop trigger if exists` and `drop index if exists` lines, which make it safe to rerun), choose **Run this query**. It ends with "Success. No rows returned".
4. Check it: **New snippet**, paste this, **Run**:
   ```sql
   select (select count(*) from information_schema.tables where table_schema = 'public'
           and table_name in ('pairings', 'devices', 'pairing_settings', 'pairing_events')) = 4
      and (select enabled from public.pairing_settings)
      and to_regclass('public.profiles_one_person_per_caregiver') is null
     as pairing_ready;
   ```
   It should answer `pairing_ready` **true**.

**2. Create the pepper secret, `PAIRING_PEPPER`** (it keys the PIN's hash; never paste it anywhere but Supabase's secret field):
1. In Terminal: `openssl rand -base64 48 | tr -d '\n' | pbcopy`. It makes 48 random bytes and puts them straight on the clipboard; nothing is shown.
2. In Supabase: **Edge Functions** in the left sidebar → **Secrets** → **Add new secret**. Name: `PAIRING_PEPPER`. Value: paste (⌘V). **Save**.
3. In Terminal: `pbcopy < /dev/null` to clear the clipboard.
4. Check that **Secrets** also lists `EVERMORE_SECRET_KEY` (set up for manage-family). If it doesn't, follow `README.md`, "Deploy the Edge Function", step 1 and 2.
5. If you ever change the pepper, PINs waiting at that moment stop working; nothing else is affected.

**3. Deploy the new function, `pair-phone`:**
1. In Terminal: `pbcopy < ~/evermore-expo/supabase/functions/pair-phone/index.ts`
2. In Supabase: **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Replace everything in the editor with what you copied (select all, ⌘V).
4. In the function name field, type **`pair-phone`** (replace any suggested name, such as "dynamic-api").
5. **Deploy function**.
6. Open the function's **Details** (or **Settings**) and turn **off** "Verify JWT" (it may read "Enforce JWT verification"). **Save**. It checks the caregiver's session itself, and redeeming has to work from a phone with nobody signed in.
7. **Check the slug:** the function's URL on its Details page ends **`/functions/v1/hyper-function`**, the value of `PAIR_PHONE_FUNCTION` in `src/config/functions.ts` (updated after you deployed it). If it is ever redeployed under another slug, change the constant to match.

**4. Redeploy `manage-family`** (it now finds the User ID login among several person logins, and deletes every paired phone's login with the family):
1. In Terminal: `pbcopy < ~/evermore-expo/supabase/functions/manage-family/index.ts`
2. In Supabase: **Edge Functions** → open the function whose URL ends `/functions/v1/dynamic-api` (named manage-family) → **Code**.
3. Replace everything with what you copied, and **Deploy**. Keep "Verify JWT" off.

**5. Check it against your project** (makes and deletes `evermore-test` accounts on reserved domains; needs Confirm email off, which it is):
1. In Terminal: `cd ~/evermore-expo && node supabase/tests/live-pairing.test.mjs`. Every line should say PASS. If the first check says there's no function, step 3's slug is off.
2. Then the older live test, to see everything else still answers as before: `node supabase/tests/live.test.mjs`.

**To stop all pairing at once** (the kill switch): **SQL Editor** → **New snippet** → `update public.pairing_settings set enabled = false;` → **Run**. `set enabled = true` turns it back on.

### Test on two devices

**Set up:** do steps 1 to 4 above. `cd ~/evermore-expo && npx expo start --clear`. The caregiver's device is your phone (scan the QR code with Expo Go) or the web build (press `w`); the person's device is a second phone with Expo Go.

1. **Caregiver device:** sign in (or create an account). **People**: finish two profiles so practice has two people (June and Leo: **Finish profile**, an interest and a shared memory or **Not applicable**, then approve their stories).
2. **Settings → Pair the person’s phone → Create a PIN.** Six digits, "Expires in 15:00" counting down. Tap **New PIN**: the digits change.
3. **Person's phone:** **I am practicing → Create my account.** Type your caregiver email with a capital or a space, **Continue**. Type a wrong PIN, **Continue**: "That did not work. Please check with your caregiver." and the box empties. Type the right PIN, **Continue**: "You are all set", then their home.
4. **Caregiver device:** within a few seconds the PIN gives way to "… is linked." and **Linked phones** shows the phone, "Paired today", "Last seen today at …".
5. **Person's phone:** practice a few cards. Force-quit Expo Go and reopen: straight to their home. Turn on **airplane mode**, force-quit and reopen: still their home; practice a card. Turn airplane mode off.
6. **Caregiver device:** **Insights** shows the practice (as before).
7. **The old PIN:** on the person's phone you can't test it without signing out; instead, on the web build or a third device, **I am practicing → Create my account** with the same email and the used PIN: the same calm message.
8. **Remove phone:** **Caregiver device → Linked phones → Remove phone**, confirm. **Person's phone:** switch away from Expo Go and back (or force-quit and reopen): the welcome. Within the hour it would happen by itself even without that.
9. **Pair again:** create a new PIN and pair the same phone: it works, and its schedule carries on.
10. **Lockout:** on the person's phone, **Create my account** with your email and a wrong PIN five times; then the right PIN also reads the same calm message. After 15 minutes the right PIN works (create a new one if it has expired).
11. **Their login still works:** **Settings → Their login**, make one, and sign in with it on another device (**I am practicing → Sign in**).
12. **Text size and Reduce Motion** on the person's phone (iOS Settings → Accessibility): the steps stay readable, nothing cut off.

### Verified on 2026-11-11

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile (deleted at once, as they hold the photos). **No package was added:** `expo-device` and `expo-secure-store` were already in the project, and both ship in Expo Go.
- **`node supabase/tests/rls.test.mjs` passes 330 checks (from 214):** the four new tables closed to signed-out visitors, to the person's login, and (but for `devices`) to the caregiver; only the function can run the six pairing functions; a PIN made with its 15 minutes, only a keyed hash fits, a new PIN replacing the old, 10 an hour; the email matched however it was typed, an unknown email and a User ID login finding nothing; limit keys that can't hold an address; 5 tries per email, then blocked from any address, blocked tries not counted, the window sliding open; 20 per IP address; the global ceiling; old counts going; the kill switch stopping tries, new PINs and use; 4 wrong PINs leaving it, the fifth spending it; used once; expired; a paired phone's profile (no User ID, the first name carried over), its schedule carried on, a second phone allowed, still one User ID login, a name cut to 40, no family that isn't one; the paired phone reading the deck as the User ID login does, its own schedule and sessions only, writing its own records only, reading no phones or PINs; the caregiver reading their own phones and not another family's, and unable to write them; `device_seen` active, last seen updated for that phone only, 'none' for the others; Remove phone only by the family's caregiver, then nothing read, written or seen by that phone, 'removed' on checking in, the other phone and the User ID login carrying on, idempotent, practice kept; **the User ID login reading exactly what it did before, table by table**; the schema rerun keeping phones, a removed phone and a switched-off setting; deleting the family taking PINs and phones. Both older schemas still upgrade.
- **`node supabase/tests/pairing.test.mjs` (new) passes 22 checks**, the real function file in Node with the real supabase-js against the real schema in PGlite: only POST and its three actions; no pepper (or a short one) refusing everything with the same answer; PIN creation for the signed-in caregiver only; six random digits for 15 minutes, the stored hash being HMAC-SHA256 with the pepper, the PIN and pepper in no row and no database call; a second PIN invalidating the first; the right email and PIN making a login on the reserved domain with a credential that meets any password rule, a person profile in the family, the phone by its name, reading the deck and no phones; once only; the email any case and spacing, "Phone 2" with no name; expired; five wrong spending it; lockout after 5 tries for an email, not using or counting against the PIN, and opening after 15 minutes; 20 per IP address, then blocked while another address gets through; the global ceiling; **a burst of 12 tries at once getting exactly 5 comparisons**; the kill switch; nonsense in, the same answer out; a login that can't be made or linked leaving nothing behind; **every one of over 40 failures identical in status, body and headers**; **every answer waiting for the 1.5 s floor**, measured in real time across six kinds of failure (each 1.5 to 1.75 s); Remove phone for the family's caregiver only, then nothing readable, the login banned with a new credential; the log only ever "pair-phone: <kind>".
- **`node scripts/check-auth.mjs` passes 55 checks (from 36)**, the real supabase-js against the stand-in, two phones each with its own disks: the PIN's words and countdown; a PIN made, replaced, never saved or logged; offline; Linked phones, the PIN giving way to the phone's name, none of another family's; Remove phone; Their login beside paired phones and the family store finding it; sign-out forgetting the PIN; Delete account taking paired logins; the person's form words; **Create my account end to end** (the credential in secure storage, this device only, never in AsyncStorage; signed in as a person with no User ID; the deck readable, no phones); **every failure identical** (no account, wrong, used, expired, locked out) and offline different; **nothing about the caregiver kept or logged** on the person's phone; never asked again (relaunched, an hour away and offline, then refreshed without the credential); **a lost session restored with the credential, no welcome shown**; Remove phone online (welcome, pairing and session gone) and offline (refused within the hour, then the welcome); the hand-back; the User ID sign-in beside paired phones; the screens' rules.
- **Each core check was seen to fail when broken on purpose:** removed phones not refused, no per-email limit, a PIN usable twice, the person reading devices (the database); an unknown email answered differently, no floor, wrong PINs not counted, an email logged (the function); the old one-login family query, no session restore, sign-out keeping the pairing, a removed phone ignored (the app).
- `node scripts/check-logic.mjs`, `check-sync.mjs` and `check-server-family.mjs` pass; `records.test.mjs` (10) and `function.test.mjs` (18) pass.
- **The web build in headless Chrome**, exported from a throwaway copy (blank stand-ins for the family photos, `.env` pointing at the stand-in on localhost, every other request blocked):
  - **Pairing and every existing screen, sign-in on (1,051 checks)** at 375x647, 390x763 and 430x839, Medium and Large, Reduce Motion off and on. Pairing: Settings with "None yet"; the sheet before a PIN, the disabled email row; Create a PIN (six digits at the display size, read digit by digit, "Expires in 14:5x" ticking, "Your email and this PIN."); New PIN replacing it (the old one refused); the welcome; I am practicing's two options; the email step (the email keyboard, autofill off, an empty Continue noted calmly, Back and in again); the PIN step (the number pad, Back keeping the email); a wrong PIN (the calm message, the box empty); "482 913" pasted keeping six digits; You are all set; their home, reopened straight to it; **no caregiver email or PIN anywhere in the phone's storage**, and no "@" on their home; the caregiver's sheet showing "Phone 1 is linked." and the phone's row (paired today, last seen today); Remove phone; the person's phone back on the welcome, its pairing gone. Regression: the caregiver's choice, Create an account, sign in, all five tabs, June's sheet, Their login, Change password, the privacy notice; the person's Hello with a User ID, their home, a practice card to its success banner, Home. Every step passed the audit: no target under 48pt on the person's steps or 44pt on the caregiver's, no text under 4.5:1, only palette colors, nothing red, no sideways scrolling, no label that would shrink past 70%, none of "wrong", "error", "invalid" or "failed", no page errors.
  - **Local-only, every existing screen (264 checks)** at the same sizes and settings, from an export with `EXPO_PUBLIC_LOCAL_ONLY=1`: the home with no welcome, a card to its success, Caregiver held into the dashboard, all five tabs, Settings with no account rows and nothing about pairing, June's sheet, and back home; the same audit.
  - **The audit was checked itself:** a planted red word, an off-palette color, a 30pt target, a too-wide element, faint text and a banned word each fail it, and the clean welcome passes.
  - **Found and fixed by the walk** (`e60a722`): "Send the PIN by email" wasn't announced as unavailable on web (`aria-disabled`); "Linked phones" was indented from the rest of the sheet; the PIN box was an ordinary field, now large spaced digits. **Found while testing:** a check of mine that a lost session comes back had passed without testing anything (it skewed the server's clock, which a phone can't see); it now expires the session the phone keeps, and was seen to fail with the restore removed.
- The family photos never entered the walks: the copy's `assets/photos/` held plain gray stand-ins of the same names and sizes, and every request off localhost was blocked. The exports and screenshots were deleted afterwards. **Your live project wasn't touched.**

### Not verified

- **Against your live project** (it needs steps 1 to 4): the function on Supabase's Deno runtime (it ran in Node with the real supabase-js and the real SQL, with Web Crypto as Deno has it); `auth.admin.createUser` and `updateUserById` with `ban_duration` as Supabase's GoTrue answers them (faked in the function test, emulated in the stand-in); that a banned login's refresh is refused, and its access token still reads nothing (the database rule, checked in PGlite); which address Supabase puts first in `x-forwarded-for`; PostgREST's answers to the table-returning functions; the 1.5 s floor under real network latency; the dashboard's slug and "Verify JWT" setting. `supabase/tests/live-pairing.test.mjs` checks most of this.
- **On phones in Expo Go:** `expo-device`'s name (iOS 16 and later say "iPhone"), `expo-secure-store` keeping the credential, the number pad and the email keyboard, iOS not offering to save the email (autofill off), Android's back button on "You are all set" (it does nothing), and the person's phone noticing a removal when it comes back to the front.
- **Email delivery** for "Send the PIN by email": not built; it needs custom SMTP.

# The release before: sign-in, on by default

## Status

**Five changes, built, committed and checked** with the real supabase-js client against an in-memory Supabase stand-in, and in the web build against the same stand-in on localhost, at the three iPhone sizes, Medium and Large, Reduce Motion off and on. **Not yet against your live project, and not on a phone.** The AI integration, the Insights design and the sync weren't changed (sign-out now also clears Insights' copy and the person's deck copy through the stores' own functions). The schema and the Edge Functions didn't change. One commit each, after a checkpoint of the last session's work (`a5cf2aa`): `99efc8c` (1), `cfd6072` (2), `70c95da` (3), `d17e42c` (4), `5d4b763` (5), `54a33b8` (a fix found by the walk), then the docs and this handoff.

1. **Welcome and role choice, sign-in on by default.** A welcome with **I am practicing** and **I am a caregiver**; the caregiver then chooses **Sign in** or **Create an account**. Every step has a plain Back (Android's back button too). `AUTH_ENABLED` is true unless the app is started with `EXPO_PUBLIC_LOCAL_ONLY=1`: `npm run start:local` runs the local-only mode for development.
2. **Caregiver sign-up.** Email, Password and Confirm password with Show/Hide and a calm strength hint (8 at least, longer encouraged), the consent, a short privacy line and a **Privacy** sheet. Notes under fields in the neutral palette. Confirm email read from Supabase's answer: off, straight to the caregiver home; on, "Check your email" with Continue (and by itself when the app comes back from the browser), resend after a minute, a code, or another email.
3. **Caregiver sign-in.** Email and password with Show/Hide, **Forgot password?** (the email, a calm confirmation that never says whether there's an account, then the code and a new password). Calm words for a mismatch, too many tries and no connection, with retry. The session lives in `expo-secure-store` and is restored on relaunch; **Sign out** is always in Settings and clears what the phone kept from the server.
4. **The person's sign-in.** "Hello", User ID, Password with Show, one big **Continue**, in the person's large type with 48pt targets; "That did not work. Please check the ID and password, or ask your caregiver." Once signed in, never asked again unless the caregiver signs the phone out.
5. **Account basics.** Settings shows "Signed in as" and the email, Their login, **Change password** (current password first), the privacy notice, **Sign out** and **Delete account**, even when nothing else could load.

### Found and fixed along the way

- **The person's phone offline after an hour away would have shown the welcome.** With an expired access token and no connection, supabase-js retries the refresh for about 25 seconds, then reports "no session" while keeping it. The app waited on that (the splash screen), then signed out. It now opens at once from the session and profile kept on the phone and refreshes once online. This was already true of the earlier sign-in; it would have hit the person's phone the first time it opened offline.
- **Sign out did nothing offline**: supabase-js keeps the session when it can't reach the server. The phone now forgets it itself.
- **Settings was empty when the family couldn't load** (offline), so there was no way to sign out. The account rows now always show.
- **A sign-out cleared only Insights' copy.** It now clears the saved profile, the family in memory, the person's copy of the deck (names, sentences, today's log), Insights' copy and the photo cache, for any login with a saved profile, and keeps only practice and card records not yet sent.
- **The caregiver's form for the person's login showed the password as typed.** It is hidden now, with Show.
- **Found by the walk:** the Show toggle's target made a password's label line taller than other fields', so fields were unevenly spaced.

### Choices the brief left to me (simplest option, recorded here and in `DESIGN.md`)

- **Steps, not screens.** The budget is 8 and all used, so the welcome and every form are steps of screen 1, as the questionnaire's sections are steps of screen 5.
- **"Keep me signed in" is gone.** The brief asks for the session to persist and restore; the checkbox (off by default for caregivers) would contradict it. Sign out is always in Settings.
- **The local-only switch is an environment variable** (`EXPO_PUBLIC_LOCAL_ONLY=1`), not an edit to `features.ts`, so the tree never changes to switch; `npm run start:local` sets it and clears Metro's cache.
- **The sign-up fields are the brief's three.** The optional first name is gone; nothing shows a caregiver's name.
- **The confirmation link opens in a browser.** Expo Go can't receive it, so "Check your email" signs in with **Continue** once the link is opened (the password waits in memory for that step only), and also by itself when the app comes back to the front. A code works too, where the email template includes one.
- **Forgot password uses the code**, as before: a reset link would land on Supabase's Site URL, which can't set a password on the phone. The email template needs the code (Before launch in `README.md`).
- **Change password asks for the current password**, so a phone left unlocked can't change it. Checking it signs in again, which also satisfies Supabase's "Secure password change" if it is ever turned on.
- **The person's error is the brief's sentence word for word** ("That did not work…"), though the copy elsewhere uses "didn’t".
- **The app's own pause after five misses stays** beside Supabase's limits; both read calmly.
- **What sign-out keeps:** practice and card records not yet sent (ids and numbers only), so a hand-back loses no practice; the text size; and the local-only family, which isn't server data.
- **AI questions** need sign-in off (`AI_AVAILABLE`), so with sign-in on by default they appear only in the local-only mode, as does the family kept on the phone with the 7 real cards.
- **Signing out with no connection** forgets the session on the phone; the server isn't told, and that session then simply goes unused.

### What you must do on Supabase, one step at a time

Nothing changed on the server in this release: no schema change, no function to redeploy. But sign-in is now the default, so the server must be current.

**1. Make sure the schema rerun is done** (it adds the columns and the `attempt_records` table sign-in-on screens read):
1. In Terminal: `pbcopy < ~/evermore-expo/supabase/schema.sql`
2. In your browser, open the Evermore project at supabase.com, then **SQL Editor** in the left sidebar.
3. Choose **New snippet**, click into the editor, paste (⌘V) and choose **Run**. If Supabase warns about a destructive operation (the file's `drop policy if exists` lines, which make it safe to rerun), choose **Run this query**. It ends with "Success. No rows returned".

**2. Confirm the rerun is done:**
1. **New snippet**, paste this, **Run**:
   ```sql
   select
     (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'attempt_records') = 1
     and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'people'
          and column_name in ('archived_at', 'include_in_practice', 'reveal_ok', 'in_deck', 'not_applicable')) = 5
     and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'daily_goal'
          and column_name in ('session_length', 'reveal_cards')) = 2
     as schema_is_current;
   ```
2. It should answer `schema_is_current` **true**. False means step 1 hasn't run on this project. (Checked in PGlite: true on the current schema, false on an older one.)

**3. Confirm email for testing tonight.** I read your project's public settings: **Confirm email is off right now** (`mailer_autoconfirm` is `true`), so sign-ups tonight go straight to the caregiver home and need no email. To check it yourself, or after changing it:
1. In Terminal: `cd ~/evermore-expo && set -a && . ./.env && set +a && curl -s "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" | grep -o '"mailer_autoconfirm":[a-z]*'` (it prints only that one setting, never the key).
2. `"mailer_autoconfirm":true` means Confirm email is **off**; `false` means **on**.

To turn it off if it is ever on: **Authentication** in the left sidebar → **Sign In / Providers** → **Email** → turn **Confirm email** off → **Save**.

**4. Before real users: turn Confirm email back on, with email that works.** Supabase's built-in email reaches only your Supabase team, a few messages an hour, so both emails (confirming a sign-up, resetting a password) need custom SMTP first.
1. **Authentication → Emails → SMTP settings**: enter your email provider's SMTP details, **Save**.
2. **Authentication → Emails → Templates**: in **Confirm signup** and **Reset password**, add the code, for example `<p>Your code: {{ .Token }}</p>`, and **Save** each. (The app also accepts the link for Confirm signup; the reset needs the code.)
3. **Authentication → Sign In / Providers → Email**: turn **Confirm email** on, **Save**.
4. Check with step 3's command: it should print `"mailer_autoconfirm":false`.
5. Optional: **Authentication → URL Configuration → Site URL** is where a confirmation link lands in the browser after confirming. Any page of yours is fine; the app doesn't need it.

**5. Optional, the live test** (makes and deletes `evermore-test` accounts on the real project; needs Confirm email off): `cd ~/evermore-expo && node supabase/tests/live.test.mjs`. Every line should say PASS. It predates this release and doesn't drive the new screens; it checks the server they talk to.

### Check on your phone

**Set up:** `cd ~/evermore-expo && npx expo start --clear`, then scan the QR code with Expo Go. (For the local-only mode instead: `npm run start:local`.)

**One phone:**
1. The app opens on **Welcome** with **I am practicing** and **I am a caregiver**. Tap **I am a caregiver**, then **Back**: the welcome again.
2. **I am a caregiver → Create an account.** Tap **Create account** with nothing filled in: calm notes under each field, nothing red. Type a password and watch the hint under it; tap **Show** and **Hide**. Fill it in properly, tick the statement, tap **Privacy** to read the notice, close it, **Create account**: with Confirm email off you're on **Today**.
3. **Settings:** "Signed in as" and your email at the top. **Their login**: a first name, a User ID such as `rose.m`, a password (hidden until **Show**), **Save**.
4. **Change password**: try a wrong current password (calm words), then the right one and a new one.
5. **Sign out.** Then **I am a caregiver → Sign in** with a wrong password ("That email and password didn’t match…"), then the right one.
6. **Settings → Sign out**, then **I am practicing**: "Hello" in large type. **Continue** with nothing typed, then a wrong password ("That did not work…"), then the User ID and password from step 3. Their home opens (practice needs two complete people: **People → June → Finish profile**, and the same for Leo, as before).
7. **Force-quit Expo Go and reopen it**: straight to their home, no sign-in. Turn on **airplane mode**, force-quit and reopen: still their home. Turn airplane mode off.
8. Hold **Caregiver** on their home for a second and confirm: the welcome. Sign in as the caregiver.
9. With **airplane mode** on: **Settings → Sign out** still works. Turn it off.
10. **Delete account** only on a test account you don't need: **Settings → Delete account**, tick, **Delete everything**: the welcome; signing in with it no longer works.
11. With the phone's **Text size** set larger (iOS Settings → Accessibility → Display & Text Size → Larger Text) and **Reduce Motion** on: the welcome and "Hello" stay readable and nothing is cut off.

**A second device** (the caregiver on one, the person on the other):
1. Caregiver device: create the account and make **Their login**.
2. Person's phone: **I am practicing**, the User ID and password, **Continue**. Practice a few cards.
3. Caregiver device: **Insights** shows them (as in the last release's two-device test).
4. Caregiver device: **Their login** → a new password. Person's phone: within the hour (or after force-quitting once the hour is up), it asks to sign in again; the new password works.
5. **iOS "Save password?"** prompts may appear on either phone; they come from iOS, not the app.

### Verified on 2026-11-11

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile (deleted at once, as they hold the photos). No package was added: `expo-secure-store` and `expo-image` were already in the project and ship in Expo Go.
- **`node scripts/check-auth.mjs` (new) passes 36 checks**, with the real supabase-js client talking over `fetch` to an in-memory stand-in for Supabase (`scripts/fakes/supabase-server.mjs`), and secure storage that refuses values over 2048 bytes as some iOS releases did:
  - **The switch:** `features.ts` through `babel-preset-expo` as a release bundle is built: on by default, off with `EXPO_PUBLIC_LOCAL_ONLY=1` only (not `0` or `true`), AI questions following; `npm run start:local`.
  - **The forms:** every note of the sign-up form (seven shapes of address that aren't one, 7 and 8 characters, a mismatch by a space, the consent); the strength levels, easy guesses and the email's name; every Supabase answer (16 kinds) in 7 contexts free of "wrong", "error", "invalid", "failed" and of saying whether an account exists; the resend countdown.
  - **Sign-up both ways:** Confirm email off signs in at once with the consent and the 5 sample people, sending nothing; on, "check your email", Continue too early (calm), resend within the minute (calm) and after it, the link, then Continue signs in; the code instead; an address with an account (neutral words with it off, an identical "check your email" and nothing sent with it on, the account untouched); offline, the project's own password rule, an address Supabase won't mail.
  - **Sign-in and the session:** a mismatch reads the same for an unknown address; the pause after five; Supabase's "too many"; offline, then retry; the session in the Keychain in pieces under 2048 bytes, after-first-unlock and this-device-only, nothing in AsyncStorage; relaunched with no password asked; relaunched with an expired token (refreshed) and, **offline with an expired token, still signed in** (then refreshed once online); a session the server refuses signs out and clears; a session from AsyncStorage moves into the Keychain; a locked Keychain at launch shows the welcome and clears nothing, and the next launch is signed in.
  - **Sign-out and delete:** the session (every piece), the saved profile, Insights' copy and the image cache go, the text size and the local-only family stay, and the server's session is revoked; offline, it still signs out and clears; Delete account removes the family on the server and everything here.
  - **Forgot password:** the same answer for any address, nothing sent for an unknown one, the minute between emails, a code that doesn't match, then the code and a new password (the old one no longer works).
  - **The person:** Their login made by the caregiver (lowercase, the reserved domain, one per family); on a second phone a mismatch, an unknown ID and no connection, each gently, then capitals and spaces not mattering; never asked again (relaunched, an hour away and offline); no person-facing file reaching an account detail; the layout's guards and no sign-in inside practice; a new password from the caregiver signing the phone out at its next refresh; handed back, only unsent practice and card records kept, no name left.
  - **Account basics:** Change password (a current password that doesn't match, the same password, too many tries, offline, then changed: the old fails, the new works); Settings' rows shown without the family.
  - **No password anywhere:** across every flow, no password in the console, in any storage on either phone, or put into words on a screen; the stand-in keeps salted hashes only.
  - **Each core check was seen to fail when its behavior was broken on purpose:** sign-up always or never asking to check email, an error read as success, no offline restore, offline sign-out not forgetting, Insights' copy not cleared, the unsent outbox dropped, the person's message context, and a password logged or stored even indirectly.
- `node scripts/check-logic.mjs`, `check-sync.mjs` and `check-server-family.mjs` pass; `supabase/tests/rls.test.mjs` (214), `records.test.mjs` (10) and `function.test.mjs` (18) pass; the schema and the functions didn't change.
- **The web build in headless Chrome**, exported from a throwaway copy (neutral stand-ins for the family photos, `.env` pointing at the stand-in on localhost, every other request blocked), at 375x647, 390x763 and 430x839, at Medium and Large, Reduce Motion off and on:
  - **Sign-in on, every flow (748 checks):** the welcome; Back from the caregiver's choice; Create account empty (every note), an address, a short password and a mismatch noted calmly, Show and Hide, "Strong.", the Privacy sheet; Check your email (the address named, "Send again in 60 s" not tappable, Continue too early, the link, then Continue to Today); Settings with "Signed in as", Their login with its password hidden and not shown back, Change password (a mismatch, then changed); Sign out (no session, profile or Insights' copy left in storage); sign-in with the old password (calm), Forgot password with the email carried over, the calm confirmation, the code from the stand-in's email and a new password into Today; all five caregiver tabs with their note and June's sheet; the person's "Hello" with no account detail, an empty Continue, a mismatch, Show, then their home, a reload straight back to it, two practice cards with no sign-in anywhere, Keep going; holding Caregiver signing the phone out; Delete account (the box first), nothing left in storage, and the account no longer signing in; Confirm email off going straight to Today. Every step passed the audit: no target under 48pt on the welcome and the person's steps or 44pt on the caregiver's, no text under 4.5:1, only palette colors, nothing red, no sideways scrolling, no page errors.
  - **Local-only, every existing screen (216 checks)**, from an export with `EXPO_PUBLIC_LOCAL_ONLY=1`: the person's home with no welcome, a practice card answered, the success banner, Caregiver held into the dashboard, all five tabs, Settings as before with no account rows, June's sheet, story approval with a story's Edit box open, the Session length picker, Add a person, and back home; the same audit.
  - **The audit was checked itself:** a planted red word, an off-palette color, a 30pt target and a too-wide element each fail it, and a clean page passes. Planting them found that its first version skipped every text color (a border's color defaults to the text's), so both walks were run again with it fixed.
- **Your live project, read only:** its public settings say Confirm email is off (`mailer_autoconfirm` true). Nothing was created or changed there.
- The family photos never entered the walks: the copy's `assets/photos/` held plain gray stand-ins of the same names and sizes, and every request off localhost was blocked. The exports, screenshots and native bundles were deleted afterwards.

### Not verified

- **Against your live project.** Everything ran against an in-memory stand-in written to answer as Supabase does (its error codes and API version, Confirm email both ways, the minute between emails, refresh-token rotation, the sign-up trigger and the row rules in miniature). Still to see on the real project: its exact answers for this project's settings (password rules, the rate limits' numbers, an address it won't mail); Confirm email on, with real email and the link landing on the Site URL; that a new password from **Their login** ends the person's session at its next refresh (Supabase revokes refresh tokens on an admin password change, which the stand-in copies); and `/logout` itself.
- **Email delivery:** the confirmation and reset emails, and the code in their templates, need custom SMTP (step 4).
- **On a phone in Expo Go:** `expo-secure-store` itself (the Keychain and Android's Keystore, and the pieces under 2048 bytes), coming back from the browser after the confirmation link, the keyboard riding under Continue, iOS password autofill, the 25-second offline case on a real network stack, and Android's back button between steps.
- **The phone's own largest text size:** caregiver screens cap it at 1.3×; the person's sign-in follows the app's Text size, which the walk checked at Medium and Large.

# The release before: the Insights redesign

## Status

**Five changes, built, committed and checked** in Node, PGlite, the in-memory Supabase and the web build (sign-in off). Not yet on a phone. The AI integration and the sync weren't touched; the schema didn't change. One commit each: `5dcfbe0` (1), `5154c67` (2), `09ecec2` (3), `3393ec5` (4), `5d8423c` (5), then this handoff.

1. **Every chart audited and fixed** (the audit is below): one shared chart frame on tested geometry, axes from zero, labels in the margins, a tap-to-highlight callout, the values a tap away, calm empty states.
2. **The Memory score as a pink ring** in one hero card (ring, band pill, note, two tiles, a real "What is this score?" button), the ranges folded into a slim bar under it, the same ring smaller in each day's sheet and each person's page. Empty and early: a dashed ring and "Needs 10 cards, 4 to go".
3. **"How answers were found" in plain words:** Right away, On a second try, With help, in a deep pink, a light pink and a blue-gray; one sentence, one bar for 14 days with percentages (always 100 in total) and counts, the chance in words (1 in 3, or 1 in 2), each day as a bar, and "How to read this". The day sheet, band meanings and score explanation use the same words.
4. **Insights is its own tab** with an original pink brain icon; a five-tab bar at the bottom (icons over short labels, one line at every width); a compact header instead of the large logo; pink as the Insights accent (tokens renamed `scorePink*` → `pink*`). Trends is Activity, unchanged.
5. **Four sections behind a sticky control** (Overview, Answers, People, Days); scannable "What stands out" and next steps; per-person speed in two even columns; a People section with a page per person; calendar days show their score on their band's pink.

### Choices the brief left to me (simplest option, recorded here and in `DESIGN.md`)

- **Two rules deliberately superseded, as the brief said:** pink is the Insights accent, not the score's alone; Insights is a top-level tab (screen 8; the budget is now 8). `CLAUDE.md`, `DESIGN.md` and `DESIGN-UI.md` say so.
- **The tab bar moved to the bottom.** Five tabs of icons over labels fit better there than under the header, and the header shrank to the logo's mark and the tab's name. The Undo toast now sits above the bar.
- **"With help"** is the third try or later. A second try also follows a hint (one appears after any other name), and whether a reveal card's "?" was tapped is never recorded (a hard rule), so it can't count. "How to read this" says so in plain words.
- **One summary bar for the last 14 days** (the window every other figure uses), with each day as its own bar under it, rather than bars per week.
- **A person's page didn't exist,** so People has one: the same ring shows the Memory score of that person's cards over 14 days, the same formula and the same minimum of 10 cards (`personScore`). People are listed in the order their cards came up, never ranked.
- **The score line runs from 50 to 100** (lower only when a day scored lower), so its bands share the height; the ring is always 0 to 100. Every card ends on the right answer, so no day scores under 30 and the ring at 0 or 1 is reachable only in tests.
- **The notes:** "Practice activity, not a medical measure." stays under the ring, every chart and in every sheet (the rule), and once at the foot of each section, never twice in a row.
- **Medium and Large text:** caregiver screens use the compact scale and ignore the app's Text size, as before; the phone's own accessibility size grows them up to 1.3×, which the web build can't show. The tab labels are checked to fit at 1.3× on paper.
- **No screenshots of the current screens came with the brief** (the four images were the reference app and three examples), so the audit below is from my own walk.

### What you must do

- **Nothing on Supabase.** No schema change, no function to redeploy.
- **On the phone:** `npx expo start --clear`, then the checks below.

### Check on your phone

1. Hold **Caregiver**, then the new tab bar at the bottom: five icons with labels, the pink brain on **Insights**, nothing cut off.
2. **Insights → Overview:** the ring fills once (turn on Reduce Motion in iOS Settings → Accessibility → Motion and it appears at once); the score, "out of 100", the band pill, the two tiles and "What is this score?" all fit above the tab bar. Tap **Ranges** to open the key.
3. Tap a day on the **Memory score** chart: a pink callout above the plot; tap another day; "Show the numbers".
4. **Answers:** the bar and its three rows; "How to read this"; the speed chart and the names in two columns.
5. **People:** tap June: her page with the small ring and "Open June’s profile".
6. **Days:** the calendar with scores in the cells; tap a day, then swipe left and right in the sheet (and with Reduce Motion); the arrows; close. Switch to **Completion**: unchanged.
7. Scroll any section: the Overview / Answers / People / Days control stays at the top.
8. **People tab:** hold a card, tap the minus to archive, and check the "archived" note with Undo sits above the tab bar; Undo.
9. Practice a few cards as the person: nothing pink, nothing new.

### Verified on 2026-11-11

Not recorded: the session that built the redesign stopped before filling this in, and its last change (the ring at 150pt on phones shorter than 700pt, so the hero fits above the tab bar) was committed as a checkpoint (`a5cf2aa`) at the start of the sign-in release. `node scripts/check-logic.mjs` passes with it, including its check of the ring sizes, and the sign-in release's regression walk opened the Insights tab at every size with no audit problem. The five commits' messages say what each was checked with.


## 1. The graph audit (before any change)

Walked in the web build (sign-in off, neutral photo stand-ins) at 375x647 and 430x839, Medium and Large, with demo data, two real days, an early day of 4 cards and no data. Screenshots were kept in the scratchpad and deleted afterwards. The brief mentioned screenshots of the current screens, but none came with it (the four images were the reference app and three examples), so the critique is from this walk.

**What was wrong, chart by chart**

- **Memory score over time:** band names sat inside the plot, where the line and points ran over "Steady" and "Building"; "Getting started" sat below the shaded area because that band was white, and with the scale running from 30 it took half the plot, so it read as a large empty gap between the line and its dates; the dates were far from the plot; the "86" callout sat on the line at the right edge; with one or two scored days the points hugged the right edge with nothing to say why.
- **How answers were found:** technical labels (First choice, Second, Third or later); the second and third shades (`sky`, `skySoft`) were nearly the same pale blue; "Chance" sat on top of the last bars on a white box; no y-axis and no numbers anywhere; a legend under the chart instead of direct labels; the early state drew an empty 160pt box with only the chance line in it.
- **Answer speed:** one "10 s" label and two lines, no zero, so the line floated; the scale was always at least 10 s, so typical 3 to 4 s days filled the bottom third; the per-person times (June, Leo, Ruth, Omar, Mae) wrapped onto a second row at a third of the width each, unevenly; empty state: a blank 160pt plot.
- **Practice time:** plotted as a ratio, so there was no axis in minutes; the "Standard" label sat in a white box over the dashed line and the bars; the legend's "Met the standard" swatch was the near-white `surface` band, which hardly shows, and its three items wrapped; "Day finished" and "Partial day" differed only by color (dark blue and pale `sky`).
- **Calendar:** each day was only its number in a circle; scored days in four pinks that are hard to tell apart at a glance and no score anywhere; the selected day and today looked alike.
- **Everywhere:** each chart laid itself out differently (margins, label sizes, where dates sat); label text fixed at 13pt or less with no tabular numbers; no way to see a single day's value except through the screen reader summary; "Practice activity, not a medical measure." printed seven times down one long page; the large logo header on the taller phones; the page was one long scroll with no sections, and "What stands out" and "Suggested next steps" were blocks of sentences.

**What change 1 fixed:** every chart is now drawn by one frame (`src/components/insight-chart-kit.tsx`) on shared, tested geometry (`src/lib/insight-scale.ts`): the same margins and thin light gridlines; y-axes from zero for bars and speed, in seconds and minutes with round ticks; the score line on 50 to 100 (lower only if a day scored lower), its bands named in the left margin; reference lines (Chance, Standard with its minutes) named in the right margin, off the data; dates directly under the plot, as many as fit, the first and last always, "Today" at the end; points inset by half a day so nothing touches an edge; a callout in its own row above the plot, the latest day by default, any day on a tap; partial days light with a dashed edge, so the difference doesn't rest on color; a one-line legend; "Show the numbers" for every line chart; and a short calm box ("Not enough cards yet") in place of an empty plot.

# The release before: the Memory score, its key, Approve all, and day paging

Updated 2026-11-10. Open the session in `~/evermore-expo` so `CLAUDE.md` loads.

## Status

**Four changes, built, committed and checked** in Node, PGlite, the in-memory Supabase and the web build. Not yet on a phone. The AI integration and the sync weren't changed (Approve all calls the AI queue's own `approveSentence`, unchanged). One commit each: `e604d07` (1), `00cd902` (2), `c9cb35f` (3), `cf3547e` (4), then this handoff.

1. **The Memory score.** "Practice score" is now "Memory score" on every screen, chart, calendar, sheet and next step, with the sign-in-on views using the same components; identifiers too (`MEMORY_SCORE`, `memoryScore`). Formula, bands and minimum unchanged. The copy check now allows the name, keeps every other banned word, and refuses claims that it diagnoses, tracks or measures the progression of, or predicts a condition, or compares people (it fails on 11 sample claims and passes the real copy). "What is this score?" says it summarizes one day of practice, is affected by sleep, mood and the time of day, is not a medical measure, and is compared only with the same person's own history. The note now also sits directly under the hero's score. **Its pink:** six rose tokens (`scorePink*`) sampled from the logo's brain, light for low scores and deep for high: the hero figure (`#A3416F`, 5.9:1), the Top band badge, the score line and the chart's bands behind it, the calendar's shading and the key. Completion keeps its blues. `DESIGN-UI.md` has the table and every ratio.
2. **The range key**, kept plain (the Insights layout is to be redesigned): under the hero, folded on the calendar, and at the top of "What is this score?". A bar of the band pinks with cutoffs labelled, a mark where random guessing would score with "This is about what random guessing would score, so it is not a sign of recall.", and a row per band whose tap shows its meaning. Every number from `scoreKey`, which reads `SCORE_BANDS`.
3. **Approve all** on each person's sheet: "Waiting for approval" opens a list of everything waiting (stories, AI sentences with their source facts, and what needs a deliberate look, each saying why). Approve all is in that list, and on the sheet once the list has been opened for that person this session. A confirmation shows the counts by kind with the items a tap away; then "Approved 8. 2 need your confirmation." with Undo, in a toast over the sheet.
4. **Swiping between days** in the day sheet, as specified: left for next, right for previous, arrows in the header, VoiceOver actions, calm empty days, stops at today and the first records, the calendar behind following the month and marking the day, and a crossfade with Reduce Motion.

### Choices the brief left to me (simplest option, recorded here and in `DESIGN.md`)

- **No PDF text existed** to rename: data export isn't built.
- **Identifiers renamed too**, so the code and the screen use one name. The sync files never named the score.
- **The chart's band backgrounds are pink too** (the palest four tints), so the bands look the same in the key, the calendar and the chart. They are the Memory score's own chart, so this stays within "only for the Memory score".
- **Insights name no condition at all,** not even to deny one: the copy check refuses words like dementia, cognitive or condition anywhere in Insights. "Not a medical measure" says enough.
- **The chance mark** comes from the answers the records actually offered: about 63 with three names, 80 in a two-person family.
- **"Edited items awaiting re-validation"** are AI sentences the caregiver edited. A reworded story is the caregiver's own words, and nothing records that it was edited.
- **"The pending list"** is the new list inside the sheet, not story approval (screen 6), so everything Approve all would approve, AI sentences included, has been on screen.
- **Test facts are approved by Approve all** exactly as one tap each would approve them (the approval rule has no exception for them), with the Test data tag in the list. They still never leave the phone.
- **A draft can use Approve all;** the confirmation says the stories reach practice once the profile is complete (the 100% gate holds).
- **Day paging bounds:** the first day with a record shown, which follows "Include archived people". The calendar "scrolls to" the day by turning to its month. No page indicator (optional).

### What you must do

- **Nothing on Supabase.** The schema didn't change, and no function needs redeploying. (The earlier rerun for `attempt_records`, below, still applies before sign-in goes on.)
- **On the phone,** `npx expo start --clear`, then the checks under [Next step](#next-step), first in the list.

### Verified on 2026-11-10

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile. No package was added, so it runs in Expo Go.
- `node scripts/check-logic.mjs` passes, now also checking: no "Practice score" in any string under `src/` or the functions, the sync's files included; the claim check passing the real copy and failing 11 forbidden claims; the help sheet's four statements; the pinks (rose hues only, light to deep, the brain's two pinks included, every text pairing at 4.5:1 and every mark at 3:1, nothing red anywhere in the palette, and no file outside the Memory score's using them); the key (ranges, breaks, the bar filling from the floor, the chance mark, its text alternative, and everything moving when a cutoff changes, with no cutoff written in the component); Approve all (exactly the eligible items, test data as one tap would, never a dated fact, an edited, flagged, failing, rejected or someone else's sentence, nothing pushed through by passing extra ids, a re-check at the moment of approving, the same writes as one tap, Undo restoring exactly and leaving anything changed since, nothing for an archived person, the toast's words, the session gate); day paging (every day from the first records to today, empty days included, month and year ends, March's clock change, nothing after today, archived people only with the box ticked, and the same days and pages from server rows as from the phone's records).
- `node scripts/check-server-family.mjs` passes with Approve all with sign-in on: one write for the two waiting undated stories, a dated one left waiting and unconfirmed, ids from another person ignored, Undo, and nothing for an archived person. `check-sync`, `rls.test` (214), `records.test` (10) and `function.test` (18) still pass.
- **Web build, sign-in off,** headless Chrome at 375x647, 390x763 and 430x839, Medium and Large, Reduce Motion on and off: **917 checks.** Insights says "Memory score" and never "Practice score"; the hero figure is the deep pink; the note sits under it; the key's ranges, chance line, text alternative and a band's meaning; the calendar key folded then open; scored days in the pinks and the Completion view without them; a day opened, eleven arrow taps each a new day crossing into October, an empty day's calm page, next, and a swipe (a page of scroll, or with Reduce Motion a drag that moves nothing until let go); after closing, the calendar on that day's month with the day marked; "What is this score?" with the key and its four statements. Approve all on June: no button before the list is opened, the list counting everything waiting, the button on the sheet afterwards, the counts by kind, the items shown, the toast, only held items left waiting, and Undo bringing every one back. Every existing screen as a regression pass: the home, three practice cards with nothing of the score on them, all four tabs with their note, a person's sheet and story approval. Every view: no horizontal overflow, no caregiver target under 44pt, nothing red, no page errors.
- **Found and fixed by the walk:** expanded and selected states weren't reaching screen readers on web through `accessibilityState` (now `aria-expanded` and `aria-selected`), and a selected day without practice wasn't announced as selected. **By the copy check:** my first wording of the help sheet ("never with anyone else") read as a comparison with others, so it now says only "Compare it only with the same person’s own history."
- The family photos never entered the walk: the export was built from a throwaway copy whose `assets/photos/` held neutral stand-ins of the same names and sizes, every request off localhost was blocked, and the export, screenshots and native bundles were deleted afterwards.

### Not verified

- **On a phone:** the swipe under a real finger inside the page sheet, and that dragging down still closes it; **the swipe with Reduce Motion on** (it uses React Native's responder, and on iOS the sheet's scroll could take a sideways drag first: the arrows and VoiceOver actions work either way); the crossfade with Reanimated running natively; the toast over the sheet; VoiceOver reading the key, the band rows and the day actions; and the pinks on a real screen.
- **The phone's own text size at its largest.** Caregiver screens use the compact scale (capped at 1.3×); the web build has no system text size, so Medium and Large were the app's setting, as in earlier walks.
- **A held item in the web walk:** the sample family has no dated or edited item waiting, so held items were checked in Node and against the in-memory server, not on screen.

## The release before: Insights with sign-in on

### Status

**Insights now work with sign-in on.** The person practices on their own phone, each card's record uploads in the background, and the caregiver sees Insights, the Practice score and the score calendar on theirs. With sign-in off everything works on the phone exactly as before. Built, committed and checked in PGlite, against in-memory stand-ins, and in the web build against a local stand-in for Supabase on two browser "devices". **Not yet against the live project** (the schema needs rerunning, below) **or on two phones.** The AI integration wasn't touched. One commit per phase: `f064b94` (1, the audit and design), `3b74933` (2, the table and its rules), `c3016c7` (3, the practice device's queue), `534307e` (4, the caregiver's Insights), then 5 (docs, the privacy notice and this handoff).

1. **The decision** (`DESIGN.md`, "Insights with sign-in on"): records go to a new table, `attempt_records`, beside `attempts` rather than in it. `attempts` stays the scheduling log, sent at the right name, with its correctness columns unreadable; records are made when a card is left, include cards left unanswered, and need a reader the person can't be. Each figure has one source: completion reads `sessions` and `attempts`, Insights read only `attempt_records`.
2. **The table** (`supabase/schema.sql`): RLS on, explicit grants (service_role too), indexes for a family's time ranges and for "what is new". The person's login may only insert its own family's rows and reads none back; the caregiver's login may only read and delete them; nobody updates one. Ids, fixed words, numbers and times only: no names, photos or words, enforced by the column types and checks.
3. **The practice device** (`src/data/attempt-sync.ts`): each record saved in a queue on the phone, then sent in batches of 25 in the background; waits that grow from 2 seconds to 5 minutes; waits for a connection; survives the app closing; a resend is kept once. A one-time backfill, resumable and idempotent.
4. **The caregiver's device** (`src/data/insights-store.ts`): the family's records for the last 120 days, a thousand at a time, then only what is new; plus anything still queued on the same phone; through the same `src/lib/insights.ts`. A copy on the phone opens Insights at once and offline, with "Last updated today at 3:42 PM", and pull to refresh. The "Insights work with sign-in off for now" notice is gone.
5. **Docs**: `CLAUDE.md`, `DESIGN.md`, `DESIGN-UI.md`, `README.md`, and the in-app privacy notice.

### What is uploaded, what never is, how long it is kept, and deleting

- **Uploaded,** with sign-in on, from the person's phone, one record per card shown: ids (the record's own, made on the phone; the family; the person's login; whose card; the card and how it was asked; the session), the shape, the kind of fact, template or AI, when it came up, each choice in order with its time and whether it was right, how many were offered, the hint rungs, whether it ended on the right answer, active time and time to the first choice, the day's target, and whether it came back after a hint. `src/lib/attempt-records.ts` (`toRow`) is everything that goes.
- **Never uploaded:** names, photos, sentences, a fact's words or any free text; whether a card started behind the "?" or the "?" was tapped; test data and the demo; anything about the family kept on the phone with sign-in off.
- **Kept** 120 days, as on the phone. The server keeps a day more, and each upload clears that family's older records.
- **Archiving** keeps a person's records; Insights leave them out until "Include archived people" is ticked. **Deleting a person permanently** deletes their records on the server (a foreign key), and a record about them still queued on a phone is refused and dropped. **Deleting the account** deletes all of it. A fact the caregiver removes keeps its records, as on the phone.
- **On the phones:** the person's phone keeps a record only until it is sent. The caregiver's phone keeps a copy of Insights (the records, and the names and settings Trends need, no facts' words), removed by Sign out or Delete account there.

### Choices the brief left to me (simplest option, recorded here)

- **A new table beside `attempts`,** not extending or replacing it: the four reasons are in `DESIGN.md`. Extending it would have meant the person's login updating rows, or the schedule waiting for Next.
- **A plain insert, not an upsert.** An upsert needs read access to the row it collides with, and the person's login has none. So a resend is refused as a duplicate (code 23505), and the phone counts that as sent. No record can be stored twice.
- **The backfill uploads nothing today.** The records kept with sign-in off belong to the family kept on the phone, which never goes to the server: the 7 real family people must never be uploaded, and their ids (a person's id and card ids such as `<id>-0`) hold first names. With sign-in on the family is a different one, with the server's ids. So the backfill takes only records about people in the signed-in family, which today is none, until a way to move a family to the server exists. It is built, resumable and idempotent, and checked with records that do belong.
- **"Memory score"** is the Practice score: the rules keep "memory score" off every screen.
- **"Card type"** is the shape plus whether the card came back after a hint. Reveal cards stay unrecorded (the hard rules).
- **"test_data (demo and sample)"**: test data and the demo stay on the phone. The 5 sample people the server seeds are ordinary people of that family, so their records upload like anyone's.
- **The window is 120 days,** the days the phone keeps, rather than the brief's example of 90, so both ways show the same days.
- **Offline on the caregiver's phone.** Records alone can't show Insights after a restart with no connection, because the dashboard needs the family to name people. So the copy also keeps each person's name, whether they are archived or in practice, which facts are approved, the settings and 30 days of sessions, and Trends (Activity and Insights) open from it. Today, People and Settings still need the connection, as before.
- **Pull to refresh is on phones only.** The web has no pull, so opening Insights fetches what is new too.
- **The privacy notice** (shown with sign-in on) said how cards went "is never shown on any screen", which Insights make untrue. It now says what the records hold, who can read them and for how long. Its line about removing a person still said "Remove", gone since archiving; it now describes archive and Delete permanently.
- **Known limits, left as they are:** a person's login can write as many records as it likes for its own family (there is no cap per family). A card open when the app is killed leaves no record, exactly as with sign-in off.

### What you must do on Supabase, one step at a time

1. In Terminal, run `pbcopy < ~/evermore-expo/supabase/schema.sql` (this copies the whole file).
2. In your browser, open the Evermore project at supabase.com, then **SQL Editor** in the left sidebar.
3. Choose **New snippet**, click into the empty editor, and paste (⌘V).
4. Choose **Run**. If Supabase warns about a destructive operation, that is the file's `drop policy if exists` and `drop trigger if exists` lines, which make it safe to rerun: confirm with **Run this query**. It should end with "Success. No rows returned".
5. Check it worked: **New snippet**, paste `select count(*) from public.attempt_records;`, **Run**. It should answer `0`.

That one rerun also covers every earlier release that needed it (archiving and the rest). Nothing else changes on Supabase: no Edge Function needs redeploying, and no secret is involved.

**Optional, the live test** (makes and deletes test accounts on the real project):
1. **Authentication → Sign In / Providers → Email**, turn off **Confirm email**, and **Save**.
2. In Terminal: `cd ~/evermore-expo && node supabase/tests/live.test.mjs`. Every line should say PASS.
3. Turn **Confirm email** back on if you use it.

### Testing on two devices

Your phone is the person. The caregiver is either the web build on this Mac or a second phone.

**Set up, once:**
1. Do the Supabase steps above.
2. In `src/config/features.ts`, change `export const AUTH_ENABLED = false;` to `export const AUTH_ENABLED = true;` and save.
3. In Terminal: `cd ~/evermore-expo && npx expo start --clear`.
4. **The caregiver's device:** for the web build, press `w` in that Terminal, and a browser tab opens the app. For a second phone, scan the QR code with it.

**The caregiver's account and the person's login:**
5. On the caregiver's device: **Caregiver → Create an account** (or sign in, if you made one earlier). With Confirm email on, you'll need the code from the email.
6. **Settings → Their login**: a first name, a User ID such as `rose.m`, and a password.
7. Practice needs two complete people, and the sample people start as drafts. **People → June → Finish profile**, answer one interest and one shared memory (or tap **Not applicable**), go on to Review, choose **Add June to practice**, then approve June's stories. Do the same for **Leo**.

**Practice on your phone, look on the caregiver's device:**
8. On your phone, scan the QR code, choose **Me**, and sign in with that User ID.
9. **Start** and answer about 12 cards, choosing a wrong name now and then, then **Home**. Nothing should look or feel any different from before.
10. On the caregiver's device: **Trends → Insights**. At the top, "Last updated today at …". **Cards answered** is the cards you finished (cards that came back after a hint don't count), and from 10 cards there is a Practice score. If it hasn't caught up, pull down on Insights (phone), or tap **Activity** then **Insights** (web).
11. **Offline, on your phone:** turn on airplane mode, answer 3 cards, then turn it off. Within a few seconds (or when you reopen the app) they upload. Refresh Insights: 3 more. Nothing on your phone should warn or wait at any point.
12. **Offline, on a caregiver phone** (second phone only): refresh Insights once online, turn on airplane mode, swipe Expo Go away and reopen it. The dashboard says "Some of this couldn't load", and **Trends → Insights** still shows the last copy with its "Last updated" time. Turn airplane mode off.
13. **Archived:** on the caregiver's device, archive June (hold her card, tap the minus). Insights leave her out; tick **Include archived people** to bring her back. Restore her afterwards.
14. **Deleted for good** (a sample person only): archive Leo, open **Archived people → Leo → Delete permanently**. His cards leave Insights for good.
15. **Sign out** on the caregiver's device: its copy of Insights is removed.

**Turning sign-in back off:**
1. In `src/config/features.ts`, change it back to `export const AUTH_ENABLED = false;` and save.
2. In Terminal, press Ctrl+C, then run `npx expo start --clear`.
3. The app opens on the family kept on your phone, as before, and its Insights read the phone's own records. Nothing from the server comes back to it, and nothing from it was uploaded.

To remove the test accounts afterwards: on the caregiver's device, **Settings → Delete account** (every record goes too), or run `supabase/tests/leftovers.sql` in a new snippet.

### Verified on 2026-11-10: Insights with sign-in on

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile. No package was added, so it runs in Expo Go.
- `node scripts/check-logic.mjs` passes, now also checking: the table's fixed lists (kinds of fact, shapes, hint rungs, how a card was asked) in step with the app, and its 121 days; exactly what a row holds, with no names, surviving Postgres's own way of writing times; what never goes (test data, the demo, a test fact, the phone's own family); what each refusal means; the waits (2, 4, 8 seconds up to 5 minutes); the "Last updated" words; that Insights no longer say they need sign-in off; that sign-in off is unchanged (the same storage key and functions, and no sync code reachable from the phone-only store); that the practice device only inserts records and the caregiver's only reads them, and nothing else touches the table. The banned-word check now covers the new files.
- `node scripts/check-sync.mjs` (new) passes, against stand-ins for Supabase, the phone's storage, the connection and the app's state. **The practice device:** a record is on the disk before it is sent, even with slow storage; leaving a card returns at once; three cards make three rows, field for field the records made with sign-in off; a resend is kept once; offline nothing is tried, then everything goes once; the queue outlives a restart, and a restart mid-upload (the server kept the rows, the reply never came) sends again without a second copy; a record made while the saved queue loads joins its end; waits of about 2, 4 and 8 seconds, never past 5 minutes, a new card not trying sooner and the app coming back trying at once; test data, the demo and the phone's own family never queued; a person deleted for good takes their waiting records; a refused value waits at the back and goes later; a broken client never reaches the person; the one-time backfill sends 60 eligible records of 66, stops when the server is busy, loses a reply, picks up again, sends nothing twice, and leaves the phone's records untouched. **The caregiver's device:** exactly the person's records, and identical insights; the first fetch for the whole window, then only what is new (six rows of forty); offline, the copy at once with its time and Trends; queued records on the same phone counted once; someone deleted leaves the view at once; archived people kept for "Include archived"; nothing past 120 days; 2,500 records in pages of a thousand, each once; sign-out removes the copy.
- `node supabase/tests/records.test.mjs` (new): 1,497 records (eight weeks of the demo's patterns, a card left unanswered, one from before facts, an AI sentence) uploaded as the person in batches of 25, read back as the caregiver in Postgres's own JSON: field for field the same, and the same insights (every figure, the Practice score, the bands, the calendar month by month) in UTC, Los Angeles, Kolkata and Auckland, with an archived person left out and included. 2,600 more come back in pages, each once, and "only what is new" brings the new records and the last few minutes again, nothing older.
- `node supabase/tests/rls.test.mjs` passes 214 checks (from 167): the person writes records for their own family and reads none, not even their own; can't change or delete one, write into another family, as another login or about someone else's person, or set `uploaded_at`; B's person can't write into A's family; the caregiver reads every choice and hint as written, can delete, can't write or change; B and B's person read none of A's; signed-out visitors can't read or write; no free text fits; the table has no column for a name, words, a photo or the "?"; records past 121 days go on the family's next upload, and another family's stay; the app can't run the clearing itself; the indexes and service_role grants are there; archiving keeps records and deleting a person deletes theirs and nobody else's; a removed fact keeps its records; rerunning the schema keeps every record; deleting the family deletes them all; both older schemas upgrade with the table.
- `node scripts/check-server-family.mjs` and `node supabase/tests/function.test.mjs` (18) still pass.
- **Each core check was seen to fail when its behaviour was broken on purpose:** treating a duplicate as a retry, letting test data through, sending before saving, forgetting the backfill's progress, waits that don't grow, retrying a deleted person's record, no family filter, always fetching everything, one page only, a copy not removed at sign-out, server times not normalized, queued records ignored, and a field lost on the way (the parity test).
- **The web build,** in headless Chrome, at 375x647, 390x763 and 430x839, at Medium and Large:
  - **Sign-in on, two devices** (192 checks), against a local stand-in for Supabase holding eight weeks of records: the caregiver's Insights come from the server, with "Last updated today at …", every chart drawn, today's cards matching the server's, the note, and no word of needing sign-in off. The person's home and practice are as always, with nothing from insights; each card they leave is uploaded once, by their login, as exactly the record's columns with no name or fact's words, and nothing is ever read back. The caregiver then sees the new cards. After a restart with no connection, Trends and Insights open from the copy with the same "Last updated" and figures. With the table not there yet (the schema not rerun), the caregiver gets the calm notice, and the person's records wait on their phone without a word to them, then go, each once, when it is there.
  - **Sign-in off, unchanged:** every existing screen (278 checks) and every Insights view with no data, real practice and demo data (240), as in the earlier releases' walks.
  - **The privacy notice** with sign-in on (30 checks).
  - Every screen passed the audit: no target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, no horizontal overflow, no page errors.
- The family photos never entered the walks: every export walked was built from a throwaway copy whose `assets/photos/` held blank stand-ins of the same names and sizes, against a stand-in server on localhost, with every other request blocked. The two compile checks from the project itself (the native bundles, and at the end every platform with `--clear`, which also points Metro's cache back at the project) bundle the photos by nature: they were never opened or served, and were deleted at once. The exports and screenshots were deleted afterwards.
- **Found and fixed along the way:** Trends couldn't open offline after a restart, because the dashboard needs the family (fixed with the Trends copy); that copy wasn't saved when the family loaded before the phone's copy had been read; the upload queue reported a round finished before its last write reached the disk; a send asked for during an upload was dropped if the login changed meanwhile; and the privacy notice's two out-of-date lines. Exporting two copies of the project in a row mixed old screens into the second build through Metro's cache, so `CLAUDE.md` now says to export each with `--clear`.

### Not verified (Insights with sign-in on)

- **Against the live project.** It needs the schema rerun, and the live test's new checks haven't run. In particular: PostgREST's plain insert from a login with no read policy (PGlite ran the same SQL, `INSERT … RETURNING 1`); the 23505 and 23503 codes as PostgREST returns them; the clearing trigger under Supabase's own `auth.uid()`; and Supabase's row limit per request (the app reads a thousand at a time, Supabase's default; a lower setting would cut a page short). The live test checks the first two.
- **On two phones in Expo Go:** sending as the app comes back to the front (iOS pauses timers in the background), NetInfo's events in Expo Go, a force-quit mid-upload, pull to refresh, the "Last updated" line, and opening offline after a restart.
- **A busy family over 120 days** (a few thousand records) on an older caregiver phone.
- **The backfill moving real records:** nothing qualifies today.

## The release before: caregiver insights

**Insights are built, committed and checked in the web build** with sign-in off, at the three iPhone sizes, Medium and Large text, Reduce Motion on and off, with no data, real practice and demo data. Not yet on a phone. The AI integration, invites and web forms weren't touched. One commit per phase: `6b21b9c` (1, the record of each card), `093bca1` (2, the metrics and the Practice score), `ca3a3ea` (3, the Overview), `88ad94b` (4, the calendar and sheets), `38ca9eb` (5, demo data), then the docs and this handoff.

1. **Each card leaves a record on the phone:** whose card and which question, every answer chosen in order with its time, the hints, how many answers were offered, whether it ended on the right one, and active time. Background time and long idle gaps don't count. Kept 120 days, sign-in off only.
2. **The figures,** all in `src/lib/insights.ts` with every number in `src/config/insights.ts`: how answers were found against chance, answer speed (the median), practice time against the standard, the daily Practice score with its bands, and how the last two weeks compare with the two before for the same person. Each is defined in plain words in `DESIGN.md` under "Insights".
3. **Trends → Insights,** a switch beside Activity (Trends as it was). The latest day's score and band, cards, practice time, what stands out, next steps that open a person's sheet or Settings, and four charts, each with a caption, a screen-reader summary and "Practice activity, not a medical measure."
4. **A score calendar** a month at a time, shaded by band, with Completion a tap away; a sheet for each day; and "What is this score?".
5. **Demo data,** in development builds only: Settings → "Load demo data for Insights" makes eight weeks for the five sample people, as test data, never synced, gone with Clear test data.

### Choices the brief left to me (simplest option, recorded here)

- **Sign-in on shows no insights,** just a calm line. There the person practices on their own phone, and the hard rules keep the correctness columns write-only on the server; insights there would need a new table the caregiver can read and the person can only write. So **no schema change in this release, and nothing to rerun for it.** (Superseded on 2026-11-10: that table is built; see the release above.)
- **Reveal cards aren't recorded.** The hard rules make the "?" tap a free hint that nothing records and keep the unlock unsaved, so the record has no card type or "used reveal", and the brief's "third choice or with the reveal" is the third choice or later.
- **The word "accuracy" stays off the screen** (the rules ban it): the chart is "How answers were found". **On screen it's "Practice score"**, in sentence case like every label.
- **The score's honest floor.** Every card ends on the right answer, so choosing at random would still score about 63 with three answers (80 with two). The bands start above that: Getting started below 65, Building 65, Steady 80, Strong 90. The explanation sheet says so.
- **Thresholds:** a score needs 10 cards, a share or median 5, "early read" under 30; the standard is met from 80% of the target's time and "about" from 60%; a day not finished is partial; a trend needs 10 cards in each 14-day window, 7 days of practice, and a change of at least 10 points and twice its standard error. Active time ignores the background, caps each gap between taps at a minute, and counts a card for at most 90 seconds.
- **What counts:** the day's resolved cards, as for completion. Re-asks and cards left with Home before answering don't count toward a figure; a day's practice time does include re-asks, since that time was spent practicing.
- **Archived people leave every insights figure,** past days included, until "Include archived people" is ticked; the completion calendar is unchanged. **Test data counts only in demo mode,** so attempts on flagged test facts stay out of real insights.
- **Per-person figures are few:** each person's median answer time, and whose cards needed the most support, only when clearly below the rest over at least 10 of their cards. The person practicing is only ever compared with their own earlier practice.
- **The demo switch exists only in development builds** (`__DEV__`), like the server's sample activity. Expo Go on your phone is one.
- **Days before 2026-11-09 have no records,** so they show no score or breakdown rather than a guess.

### What the user must do for that release

- **Nothing on Supabase.** (Before sign-in goes on, `supabase/schema.sql` still needs its rerun: see the release above.)
- **On the phone,** after `npx expo start --clear`: see [Next step](#next-step), first in the list.

### Verified on 2026-11-09: insights

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile. No package was added.
- `node scripts/check-logic.mjs` passes, now also checking against hand-worked figures: active time with background spells and idle gaps; the record's fields, and that nothing about the "?" is recorded; how answers were found (6, 3 and 1 of 10 is 60%, 30%, 10%), the chance level with 2, 3 and mixed answers, and chance scores of 63 and 80; the Practice score (81 for that day, 100 and 30 at the ends, none from 9 cards or no practice); every band edge; medians (3 of 1, 1, 3, 4, 5; 3.5 of 1 to 6; caps at 90 seconds; missing times left out); the standard (met, about, short of, partial); a whole day; the trend (improving, needing support, a 5-point change called steady, a 14-point change within twice its standard error called steady, too few cards or days); observations and next steps pointing where they should; old rows, test data and archived people; the calendar's months, leap years and labels; the explanation matching the constants; every pattern in the demo. A copy check reads every word insights can show for wrong, failed, failure, decline, diagnosis, disease, progression, severity, memory score, accuracy, missed and comparisons with other people, and keeps "accuracy" off every screen; another keeps every person-facing file from importing insights.
- `node scripts/check-server-family.mjs`, `node supabase/tests/rls.test.mjs` (167) and `node supabase/tests/function.test.mjs` (18) still pass; the schema didn't change.
- **Web build, sign-in off,** in headless Chrome, at 375x647, 390x763 and 430x839, Medium and Large, Reduce Motion on and off:
  - **Insights** (480 checks): with no data, Trends opens on Activity as before and Insights shows its empty state and calendar; with real practice, the hero's cards are exactly the day's recorded cards without re-asks, with a score from 10 and "not enough cards" below, the person's home shows nothing from insights, the view simply appears with Reduce Motion, and today's sheet and "What is this score?" open; with demo data, every chart says what it shows, up to three observations and steps, the calendar goes back months with days to open, Completion shows completion levels, and archiving Mae takes her out until "Include archived people" brings her back. Every view passed the audit and the on-screen copy check, and kept the note.
  - **Every existing screen** (557 checks), and the archive release's walks (312 and 528), all passing.
- The family photos never appeared: the exports' photos were replaced with plain stand-ins, nothing could leave the machine, and the exports and screenshots were deleted afterwards.

### Not verified (insights)

- **On a phone:** the background and idle handling with a real app switch, the charts drawn by `react-native-svg` natively, VoiceOver reading each chart's summary, and how Insights feel with 120 days of records on an older phone.
- **The practice screens feeling exactly the same:** they show nothing new and measuring adds no wait, but only a run on the phone confirms nothing feels different.
- **Sign-in on:** Insights there only said they need sign-in off (until 2026-11-10: see the release above).

## The release before: archive and restore people

**Archiving is built, committed and checked in the web build** with sign-in off, at the three iPhone sizes, at Medium and Large text, with Reduce Motion on and off. It hasn't been tried on a phone yet. The AI integration wasn't changed. Each numbered change of the brief is its own commit, built in the order 4, 3, 1, 2, 5, because the screens needed the data first: `c06c507` (4), `dbc627d` (3), `408ca4c` (1), `8cbde87` (2), `e28cd6e` (5), then this handoff.

1. **Archive from the People tab.** Hold a picture card for about 400 ms: a light haptic, Done takes the place of Add a person, and a small minus badge (dark blue on a white ring, never red) appears on every card. A minus archives that person at once. A calm toast says "June archived." with Undo for 6 seconds (15 with a screen reader). Done, a tap on a card or a tap anywhere else ends editing. Without the gesture: Archive on the person's sheet, and an "Archive June" VoiceOver action on each card. Each badge is its own 44pt button labelled "Archive June".
2. **Archived people.** A folded section at the foot of the People tab, with a count, gone when nobody is archived. Muted cards, each with Restore; a tap opens a read-only sheet with Restore and Delete permanently. Delete asks first, naming the person and saying their photo, facts and approved sentences go from this phone (and the server, with sign-in on) and that it can't be undone.
3. **What archived means.** Out of everything practice shows: every kind of card, reveal cards, hints, the names offered (never a distractor), the daily target and "X of N cards today", Practice more, AI generation and the approval queue, and the current figures on Today and Trends. Past days don't change, and their history comes back with them. Include in practice stays its own switch: restoring brings back the setting they had.
4. **The day's target when someone is archived mid-day.** What they finished still counts, their remaining cards go, and the target can't grow again that day, so the bar never moves back or past the end. Restoring after a day or more brings their overdue cards back three a day, longest overdue first.
5. **Fewer than two people.** No practice: the person's home keeps its calm line, and Today says "Add or restore people to start practicing." Archiving is allowed down to nobody. With two people every card offers two names.
6. **Data.** `archivedAt` on the phone and `archived_at` on the server (null while active, so everyone is active after the upgrade). The person's login can't read an archived person, their cards or their photos. Delete removes every stored photo of theirs first, then their rows.

**Calls in this release the user may want to look at** (the reasons are in `DESIGN.md`, under "Decisions changed for archiving"):

- **Restore keeps the include setting they had.** The brief said both "as an included person" and "with the include setting they had". The second is kept: someone you deselected comes back deselected.
- **Remove is gone** from the person's sheet and from story approval. Archive takes its place, and deleting is only on the archived sheet.
- **One person alone no longer practices.** Before, a one-person deck practiced with a single name on each card. Now practice needs two, as the brief asked.
- **The fewer-names hint is left out when a card has two names,** since it would leave only one.
- **The person's photo rule is tighter.** The person's login may read only photos of people and approved cards it can see. That covers archived people, and also drafts and deselected people, whose photos it could list before.
- **With sign-in on, the dashboard can't see the person's log,** so on a day someone is archived mid-day it may show a target a card or two smaller than the person's phone. Both only ever move forward.
- **There are no test-data people,** only test facts, so Clear test data clears an archived person's test facts and leaves them archived.
- **Three a day** for overdue cards coming back is a placeholder like the other pacing numbers (`RETURN_DUE_PER_DAY`).

### What the user must do for this release

- **With sign-in off (now): nothing on the server.** Run `npx expo start --clear` once, because `expo-haptics` was added (it ships with Expo Go, so no build is needed).
- **Before turning sign-in on: rerun `supabase/schema.sql`** in the Supabase SQL Editor (`pbcopy < ~/evermore-expo/supabase/schema.sql`, then SQL Editor → New snippet → paste → Run). It adds `people.archived_at`, makes `person_in_deck()` and the person's read rule skip archived people, and adds `person_sees_photo()` to the person's photo rule. It is safe to rerun and leaves everyone active. Until it runs, the app with sign-in on can't load the family, because it asks for `archived_at`. This is on top of the reruns earlier releases already needed. Then `node supabase/tests/live.test.mjs` (it gained archive checks).
- **The phone checks** under [Next step](#next-step), first in the list.
- **Delete permanently only on a fictional sample person** (June, Leo, Ruth, Omar or Mae). Deleting one of the 7 real family people removes them from the phone's family for good; the deck files and photos stay unchanged, but they aren't copied back.

### Verified on 2026-11-09: archiving

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile.
- `node scripts/check-logic.mjs` passes, now also checking: archiving keeps every fact and setting and restoring brings them back exactly; deselected stays deselected and a draft stays a draft; across 60 days of plans, Practice more and one-person sessions on a 6-person family, an archived person is never a card, never a choice (even from old rotation memory) and never a fact in a question or hint, on all four kinds of card; their approved AI sentences stay out of practice and come back with them; the day's target in fixed cases (the floor holds at 36, 45 goes to 44, cards back after a hint never count, a new day starts fresh, a small deck that would allow more holds) and 400 random mid-day archives (never back, never past the end, their remaining cards gone, the day ending at its target, a same-day restore giving the day back); two-person decks offer two names with no fewer-names hint, one person has no session of any kind; past days unchanged; the spread-out return (three today, three tomorrow, and so on, steps kept, same-day Undo moving nothing, local midnight across a clock change, a fair first day); deleting forgets their schedule, week, today's questions and names offered, and keeps day totals; Clear test data reaching archived people.
- `node scripts/check-server-family.mjs` (new) passes, against an in-memory Supabase: archive and restore with sign-in on keep every row and setting, `in_deck` follows, the overdue schedule rows spread before they're back in the deck and newer than the person's phone's copy, an active person can't be deleted, delete removes every photo of theirs (a leftover from a failed replacement too) before the rows, and a failed photo delete stops it.
- `node supabase/tests/rls.test.mjs` passes 167 checks (from 143): the person's login can't read an archived person, their cards or their photos even with `in_deck` true, can't archive, restore or delete anyone, and can't list a draft's or deselected person's photos; caregiver B can't archive A's people; archiving keeps practice history; deleting a person takes facts, schedule and attempts and keeps sessions; rerunning keeps who is archived; both older schemas upgrade with everyone active.
- **Web build, sign-in off**, in headless Chrome, at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion on and off:
  - **The interaction** (312 checks): a quick tap still opens the sheet; a long press shows Done and a badge on every card; the badges grow in, or with Reduce Motion simply appear; each badge is 44pt and labelled "Archive June"; Done, a tap outside and a tap on a card each end editing; a minus archives at once with "June archived." and a 44pt Undo; Undo brings them back; Archive on the sheet does the same; the toast goes by itself; nothing to archive on the person's home.
  - **Archived people, the target, delete** (528 checks), seeded with eight cards done that morning: archiving two people moves neither the cards done nor the bar back; Trends leaves them out and counts them again once restored; the section is folded with its count, opened shows muted cards with 44pt Restore links, and a long press there starts nothing; the read-only sheet says when, offers nothing to change, restores; with nobody archived the section is gone; Delete asks first (Cancel deletes nothing), names the person, says what goes and that it can't be undone, then removes them and their facts, schedule, today's questions and names offered from the phone, keeping the morning's total; down to one person and then nobody, Today shows the calm line and the morning's progress, only ever having moved forward, and the person's home has no Start.
  - **Every existing screen** (556 checks): the home, the text size sheet, practice cards with a hint and the success banner, the cards done counting while a card back after a hint doesn't, Keep going, the four dashboard tabs with their footer, the Session length, Reveal cards and text size sheets, the person's sheet (Include in practice, Reveal cards, hints, Stories, Edit details, and Archive in place of Remove), deselecting and selecting again, story approval, Add a person, All done and Practice more, and a one-person session through to the wrap-up.
  - Every screen above passed the audit: no target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, no horizontal overflow, no page errors.
- **Found and fixed along the way:** in decks of four or fewer people, archiving someone could raise the target (fewer people need less spacing) and move the bar back, so the day now keeps a ceiling once anyone leaves, found by the random checks; archiving down to one person dropped the bar to 0%; the Archived row didn't say on web whether it was open (now `aria-expanded`); Restore links sat centered rather than under the names; and a sheet vanished instead of sliding away once its person was archived, restored or deleted. The audit's known false positive on the chart's labels was its own: it read the CSS color of SVG text, which is painted with its palette `fill`.
- The family photos never appeared: the export's photos were replaced with plain stand-ins of the same size, nothing could leave the machine, and the exports and screenshots were deleted afterwards.

### Not verified (archiving)

- **On a phone:** the long press's feel and timing under a real finger, the haptic, the badges growing in with Reanimated running natively, the toast with VoiceOver (that it is read out and stays 15 seconds), and the "Archive June" custom action in VoiceOver's actions.
- **With sign-in on against the live project:** it needs the schema rerun first. The new server paths ran against an in-memory stand-in and the schema in PGlite, but not against Supabase. The live test's new archive checks haven't run.
- **The person's phone with sign-in on** keeps a deleted person's photo in its image cache until the cache clears it. The file is gone from the bucket, and nothing shows it, since the person's deck no longer has them.

## The release before: AI questions, off by default

Updated 2026-11-05.

**AI questions are built and committed, and the flag is now on for testing.** They have been checked end to end against a mocked model, never the live one, and not yet on a phone. What's left is the setup under [What the user must do](#what-the-user-must-do), then a first real run.

1. **The function.** `supabase/functions/generate-questions` calls Claude from the server, with the key as a Supabase secret and the model in one constant. It takes the exact contract and nothing else, and returns only sentences that pass the checks.
2. **Limits with no login.** A random token per install, kept in `expo-secure-store`, with only its hash on the server. Limits per hour and per day, a daily cap across every install, request size limits, and a kill switch that starts off.
3. **What leaves the phone.** One person's approved facts as text, on a tap of Generate. The name becomes `[NAME]`, other names and proper nouns `[PERSON_1]`, and card ids `f1`. Never a photo, test data or a fact that may change. `src/lib/ai-request.ts` is the privacy line.
4. **Checked in two places.** The function and the phone run the same checks, and the phone runs them again in real words. Every word must trace to the cited facts, their kind's fixed words, the relationship or a short list of small words, and every content word of a fact must stay.
5. **The caregiver decides.** A one-time consent, Settings → AI questions, and an opt-out per person. Every sentence waits in a queue on the person's sheet, with its source facts, for approve, edit or reject, at most 20 per person. "Approve all valid" appears inside the opened list. A changed or removed fact pulls its sentences from practice and flags them.
6. **In practice.** Approved sentences join a card's phrasings, so spacing, rotation, the no-repeat rule, hints, per-phrasing switches, reveal eligibility and daily targets all apply as they are. An approved sentence comes before a template when both fit. Each is used once a day, apart from the re-ask after a hint.
7. **The reverse card.** The one new kind of card: the photo and name, and the person chooses the fact ("June enjoys ______.").

**Calls in this release the user may want to look at** (the reasons are in `DESIGN.md`):

- **The consent doesn't say "Nothing is saved."** Evermore can promise that for itself, but not for the AI service: Anthropic's own terms say API data isn't used for training, and may be kept for a limited time, up to 30 days and longer if flagged. The screen says so plainly. A zero-data-retention agreement with Anthropic would make the original wording true.
- **The model is Claude Sonnet 5.5 at low effort, with refusal fallbacks on.** The user's choice, for cost. `MODEL` in the function is the one place to change it. Whether it writes enough sentences that pass the strict checks is still to be seen in real output.
- **AI works with sign-in off only.** Approved sentences live on the phone. With sign-in on they'd need server storage, which isn't built.
- **Every proper noun is masked,** not only people, because a place can't be told from a person in free text. The limits of that: a name typed in lowercase, or one that is also a month, isn't caught unless it's a family member's. A fact written in a script with no capitals isn't sent at all.
- **The 7 real family people are held back by person,** not only by flag: their deck facts carry no `testData` flag, contrary to the brief. Their sheet shows no Generate.
- **With the flag off nothing shows,** not even a calm line, because the brief also says the app must behave exactly as it does today.
- **Sentences stay in practice offline,** and through the kill switch, because they're on the phone. Off in Settings, or for one person, takes them out of practice and keeps them.
- **The server's limits can't stop someone who makes new tokens.** The global cap is the true ceiling, and the Anthropic spending limit in step 7 below is the backstop.

## AI test results

Section added 2026-11-05. **No live test result has been recorded yet.** Until the fields below are filled in from a real run, AI has only been checked against a mocked model.

| Item | Result |
| --- | --- |
| Date of the test | Not recorded yet |
| How long Generate took for June | Not recorded yet |
| Sentences that came back | Not recorded yet |
| Sentences that passed | Not recorded yet |
| Failures or tuning needed | Not recorded yet |

The function drops sentences that fail before the phone sees them, and the phone can drop more, so "came back" is the number under To review. The number the model first wrote isn't logged or shown anywhere: the function logs only failure kinds.

**Settings in the repo:**

| Setting | Value |
| --- | --- |
| `AI_VARIANTS_ENABLED` | `true`, for testing |
| `AUTH_ENABLED` | `true` unless `EXPO_PUBLIC_LOCAL_ONLY=1` (since 2026-11-11) |
| `MODEL`, `EFFORT` | `claude-sonnet-5-5`, `low` |
| `global_day` | 20 by default, and 20 in step 8 |
| `per_install_hour`, `per_install_day` | 5, 20 |
| `enabled` (kill switch) | Off by default; step 8 turns it on |

These are the repo's values. The live `ai_settings` row can't be read from here, so check it in Supabase if it matters.

## The release before: a real study session, flip cards and a premium form

**That release is built, committed and checked in the web build** with sign-in off. What's left is a run-through on the user's phone in Expo Go.

**Changed last: "Next story" is ready at once.** The read-back's minimum hold is gone. Next is enabled the moment the right name is chosen, on plain, hinted and reveal cards, and never looks disabled. Taps are ignored for 350 ms (`NEXT_TAP_GUARD_MS`) so the tap that chose the name can't skip the read-back, and a flip never holds it. A day's length now comes from its cards: `SECONDS_PER_CARD` is 14, so a Standard day of 36 cards estimates to 8.4 minutes ("About 8 minutes today"). That's in range, so Standard stays at 3 per person, and Short and Long are unchanged. Nothing now stops someone tapping straight through a day.

1. **The questionnaire is a premium form.** One calm column of soft, borderless groups with thin dividers; a small label that stays put in a row whose whole height is the tap target; a clear header (slim bar, "Step 2 of 7 · X% complete", the title); pickers as a phone's own lists; quick steps that arrive from the direction of travel; a pinned bar with Back and Continue; neutral inline notes, only after a field was touched.
2. **Required markers and wording.** A small asterisk on the five required questions and "* Required" on every step of questions. "Not applicable" replaces "Doesn't apply", only on photo, relationship, one interest and one shared memory.
3. **Capitalization and copy.** Sentence case everywhere, from one place, enforced by a check (`DESIGN-UI.md` has the rule). Names and places use `autoCapitalize="words"`. An all-lowercase picker or chip value gets a capital at the display layer only; what is saved never changes.
4. **The deck includes everyone unless deselected.** A complete profile joins by itself. "Include in practice" on the person's sheet is on by default; off shows "Not in practice" on the People tab, keeps the profile, and skips them in practice, hints, the names offered and the dashboard's counts.
5. **A real study session.** The day's target comes from the deck: Session length Short, Standard or Long, about 2, 3 or 5 questions per person. Due first, then new; different facts and shapes; no sentence twice in a day; the same person at least 4 cards apart; a re-ask a few cards after a hint and a short review pass at the end, neither counting toward the day. Stop and resume freely. "About 8 minutes today" shows on the person's home and the dashboard's Today.
6. **Flip cards.** A reveal card shows a large "?" in the photo's place. A tap flips it (a crossfade with Reduce Motion) as a free hint nothing records; the right name flips it too, so it always ends on the photo. Only after a first-try answer about that person that day. About 1 in 4 eligible cards (Reveal cards: Off, Sometimes, Often), with an opt-out per person. The unlock is in memory only, for the day's deck, and nothing can read it but the practice screen.

**Calls made in this release that the user may want to look at** (the reasons are in `DESIGN.md`):

- **Pets and partner stay optional.** The brief gave them as examples of required questions, but the hard rule keeps the required list at five, and adding two would send every person on the phone back to being a draft. To make them required: `required: true`, `mayNotApply: true` and a `missing` label on each in `src/data/questionnaire.ts`, then flagged marks for the test data, and an update to the hard rule.
- **The asterisk is dark blue, not the logo yellow.** The yellow is 1.4:1 on white and the palette says fills only.
- **A very small deck has a shorter day,** because repeats are never used to fill it. After Clear test data, the 5 sample people with one approved fact each give 25 cards.
- **Skip for now is gone:** it did exactly what Continue does.
- **The fixed daily goal is gone.** Session length replaces it, because a stepper of 3 to 10 cards can't sit beside a computed target.

The release before, the 100% gate and compact caregiver screens:

- **Drafts never lose typing.** Answers save about 500 ms after the last keystroke, and on blur, app background and step change (`src/lib/autosave.ts`, `src/components/use-autosave.ts`). A new person's id is made on the client, so repeated saves update one person and one fact.
- **Caregiver screens are compact.** One slim type scale (16pt body, 21pt titles, 13pt helper text, `COMPACT_SCALE`) with 44pt targets, whatever the Text size setting says. That setting controls the person's screens only. The questionnaire is slim rows in tidy sub-groups, and `CaregiverScreen` pins the bar above the keyboard and scrolls the focused field into view.
- **Continue and the percent bar.** The bar at the top shows profile completion with "X% complete", and Continue echoes it with a thin strip. Review ends in "Add [name] to practice", disabled until 100%, with the missing items as links that jump to their step and come straight back.
- **The 100% gate.** Five required questions (name, photo, relationship, one interest, one shared memory), each answered or marked "Doesn't apply". Below 100% a person is a draft, shown as "Draft, X% complete", and never reaches practice cards, hints, the names offered or the person's screens. Nobody is grandfathered, and anyone who drops below 100% goes back to being a draft.
- **Test data.** With sign-in off, the 7 real example people start with flagged made-up answers, so each reaches 100% (`src/data/test-data.ts`). They show a "Test data" tag, stay on the phone, are never sent to the server or to AI, and go with Settings → Clear test data, after which those people return to their real percentage and leave the deck. The real sentences stay exactly as written.
- **Sample people's facts are ordinary facts.** The 5 fictional sample people's invented answers carry no flag or tag, have `sample-` ids, and stay when test data is cleared, so AI can be tested on them. A phone seeded earlier converts on its next launch, keeping those facts' schedule. A phone that already cleared test data doesn't get them back, and they don't seed the server yet.

The guided profile, from the release before:

- **The questionnaire** replaces "Add more details". The first screen stays quick (name, relationship, photo, one fact). Then seven steps inside screen 5: Basics, Work and school, Family and home, Interests, Shared memories, Hints and recognition, Review. All questions are in `src/data/questionnaire.ts`, with chips and pickers where they fit, Back, Continue, Skip for now and Finish later.
- **19 new kinds of fact**, 29 in all, each with 4 to 6 fixed phrasings that work with rotation, name rotation and the per-phrasing switches.
- **Shared memories** take a year ("In 1987, ...") and a photo, shown with the sentence once answered. **Hints:** a best clue steers the fact hint, and any fact can be left out of hints.
- **Private facts.** Marital status and family situation are caregiver-only, always dated and confirmed, stated but never asked, and out of hints unless chosen.

The earlier release, also on this branch:

Four phases are built, committed and checked in the web build with sign-in off.

- **A. People as facts.** Add a person is two steps (name, relationship, photo and one fact; then optional details). The same screen edits a person. Facts that may change carry a month and wait for the caregiver to confirm them. The People tab opens a sheet per person. With sign-in off, the family now lives on the phone and can be added to, edited and approved there.
- **B. Hint toggles.** Four rungs in a fixed order (first letter, another fact, relationship, fewer names), each switchable per person.
- **C. Question variety.** 3 to 6 fixed phrasings per kind of fact, in four kinds (fill in the blank, fact first, who is this, photo only). No person is asked the same way twice in a row. The caregiver previews every phrasing and can turn single ones off.
- **D. Practice more.** One person again, or a mix (the lowest schedule step first). With sign-in off, the caregiver can also hand the phone over into one person's cards.

**Changed on 2026-11-04**, after the user's review:
- **The photo is on every card.** A fact-first question no longer hides it until answered.
- **Names rotate.** Each card's other names and the right name's place change, so the same person never gets the same three buttons in the same order twice in a row (within a session, on a re-asked card, or across sessions).
- **The framework (`CLAUDE.md`)** now allows one bounded exception for AI sentences (not built; see below), adds the rotation rule, and lists the four kinds of question as built.

`DESIGN.md` records every changed verdict ("Decisions changed for the 100% gate", "Decisions changed for the guided profile", "Decisions changed for profiles, hints and question variety" and "Decisions changed on 2026-11-04"), the cut and deferred lists, and the sections Question variety and Hints. `DESIGN-UI.md` covers the new pieces and the size check.

## What the user must do

**The flag is on for testing,** so step 9 is done. To go back to the app as it was, set it to `false`.

**To turn AI questions on,** one at a time. Keys go only into the Supabase dashboard, never into the app, `.env`, git or a chat.

1. **Run the schema.** In a terminal, run `pbcopy < ~/evermore-expo/supabase/schema.sql`. In Supabase, open **SQL Editor → New snippet**, paste, and choose **Run**. It's safe to run again, and it leaves AI switched off.
2. **Copy the function.** In a terminal, run `pbcopy < ~/evermore-expo/supabase/functions/generate-questions/index.ts`.
3. **Deploy it.** In Supabase, open **Edge Functions → Deploy a new function → Via editor**. Name it `generate-questions`, replace everything in the editor with what you copied, and deploy.
4. **Turn Verify JWT off.** On the function's **Details** tab, turn **off** "Verify JWT" (it may read "Enforce JWT verification"), then save.
5. **Check the URL.** The function's page shows its URL. As deployed it ends in `/functions/v1/clever-service`, the value of `GENERATE_QUESTIONS_FUNCTION` in `src/config/functions.ts` (updated 2026-11-11).
6. **Add the key.** Make an API key at [console.anthropic.com](https://console.anthropic.com). In Supabase, open **Edge Functions → Secrets**, and add a secret named `ANTHROPIC_API_KEY` with your key as its value. The function also uses the `EVERMORE_SECRET_KEY` secret you added for `manage-family`.
7. **Set a spending limit at Anthropic.** In the Anthropic Console, set a monthly limit you're comfortable with. It's the backstop behind the daily cap.
8. **Set the cap and turn it on.** In **SQL Editor → New snippet**, paste this, and choose **Run**:
   ```sql
   update public.ai_settings set enabled = true, global_day = 20, per_install_hour = 5, per_install_day = 20, updated_at = now();
   ```
   `global_day` is the ceiling, 20 for testing. A request costs about $0.09 at the very most, so 20 a day can't pass about $1.80 a day, and a usual one costs far less.
9. **Turn it on in the app.** In `src/config/features.ts`, change `AI_VARIANTS_ENABLED` to `true`, then run `npx expo start --clear`.
10. **Try it on June.** See [Next step](#next-step).

**To turn it off:**
- **Kill switch, at once, for everyone:** in a new snippet, run `update public.ai_settings set enabled = false, updated_at = now();`. To turn it back on, the same with `true`.
- **To change the cap:** run `update public.ai_settings set global_day = 50, updated_at = now();` with your number.
- **On the phone:** Settings → AI questions → Off, or untick AI questions on one person's sheet.
- **In the app altogether:** set `AI_VARIANTS_ENABLED` back to `false`.

**For everything else:**

- **Nothing, with sign-in off** (the current setting). No server change is needed. The phone keeps its family, schedule and today's practice, and everyone complete joins the deck on the next launch, so today's target jumps to about 36 and cards already done still count.
- **Before turning sign-in on: yes, run `supabase/schema.sql` again** in the Supabase SQL Editor (paste the whole file, Run). It adds `people.include_in_practice`, `people.reveal_ok`, `daily_goal.session_length` and `daily_goal.reveal_cards`, widens `sessions.daily_goal` to 1 to 200, and adds the toggle to the person's read rules, on top of what the release before needed (`people.in_deck`, `people.not_applicable`, `person_in_deck()`). It is safe to rerun and keeps every fact word for word. Then set `AUTH_ENABLED` to `true` and run `npx expo start --clear`. After that, `node supabase/tests/live.test.mjs` can be rerun (it needs Confirm email off). Until the schema is rerun, the app with sign-in on can't load the family or deck from the server.
- **What that means for sign-in on:** a new family's 5 sample people stand at 60%, as drafts, and the server has no test data, so the person's login sees no stories until the caregiver finishes a profile. A finished profile joins the deck by itself.
- **The phone run-through** in [Next step](#next-step), reporting anything that looks wrong.

## Data model

**Server** (`supabase/schema.sql`, rerunnable):

| Table | New columns |
| --- | --- |
| `cards` (one fact each) | `fact_type` (memory, work, interest, team, show, food, music, shared, met, birthday; default memory), `time_sensitive` (default false), `as_of` (date; required when time-sensitive), `confirmed_at`, `source` (default `caregiver`), `phrasings_off` (text array) |
| `cards`, for the guided profile | 19 more `fact_type` values (`cards_fact_type_check`, kept in step with `FACT_TYPES` in `src/lib/stories.ts`), `memory_year`, `photo_path` (a memory's photo, in the family's folder), `hint_ok` (default true) |
| `people` | `hint_letter`, `hint_fact`, `hint_relationship`, `hint_fewer` (all default true), `profile_step` (0 to 7, default 0), `best_clue` (voice, laugh, job, hobby or met) |
| `people`, for the gate | `not_applicable` (text array of question ids, default empty), `in_deck` (default false) |
| `people`, 2026-11-05 | `include_in_practice` (default true), `reveal_ok` (default true) |
| `people`, 2026-11-09 | `archived_at` (timestamptz, null while active). New function `person_sees_photo(path)` for the person's photo rule; `person_in_deck()` and the person's people rule skip archived people. |
| `attempt_records`, 2026-11-10 | A new table: each card's record for Insights (see `DESIGN.md`, "Data model"). Insert-only for the person's login, read and delete for the caregiver's. New trigger function `attempt_records_prune()` clears a family's records past 121 days on each upload. |
| `daily_goal`, 2026-11-05 | `session_length` (short, standard or long; default standard), `reveal_cards` (off, sometimes or often; default sometimes). `goal` stays but is no longer read. |
| `sessions`, 2026-11-05 | `daily_goal` now takes 1 to 200, since the day's target comes from the deck |

The person reads only cards that are approved and, if time-sensitive, confirmed, of people with `in_deck` and `include_in_practice` true (and only those people). The app decides who is in the deck, since a database rule can't see the percent; `settleDeck` in `family-store.ts` keeps `in_deck` in step on every load. They can read hint settings and `phrasings_off` but change nothing. `memory_text` holds the fact's words and `sentence` the approved sentence, as before.

**For AI, on the server** (`supabase/schema.sql`): `ai_settings` (one row: `enabled`, off by default; `per_install_hour` 5; `per_install_day` 20; `global_day` 20, for testing), `ai_usage_installs` (`token_hash`, `hour_start`, `requests`) and `ai_usage_days` (`day`, `requests`). None of them hold content. Only `ai_take_request` touches them, and only `service_role` can call it.

**For AI, on the phone:** `evermore.family.v1` gains `sentences` and each person `aiOk`; `evermore.local.v1` gains `aiOn` and `aiConsentAt`. The install token is in secure storage under `evermore.installToken.v1`.

**On the phone, sign-in off** (AsyncStorage):
- `evermore.family.v1`: `{ seeded, testSeeded, people, cards }`. People carry `photoUri` (a photo picked on the phone, copied into the app's folder), `deckPhoto`, `samplePortrait`, `hints`, `profileStep`, `bestClue`, `notApplicable`, `testMarks`, `inDeck`, `includeInPractice` and `revealOk` (both missing means on). Cards are the same shape as the server's, with a memory's photo in `photoUri` and `testData` on made-up answers about real people, whose ids start `test-`; sample people's invented facts have ids starting `sample-` and no flag. `testSeeded` means the test data was copied once, so clearing it is for good. `seeded` lists example-deck people already copied, so a deleted one stays gone. Since 2026-11-09 people also carry `archivedAt` (missing while active): archiving keeps everything and can be undone, and deleting, offered only once someone is archived, is permanent on that phone.
- `evermore.local.v1`: practice as before, plus `lastPhrasing` (the phrasing each person was last asked with), `lastChoices` (the names their last card offered, in order), `sessionLength`, `revealCards`, and `today`: the questions asked today and, since 2026-11-09, the deck and target `goalToday` last worked out (`deck`, `goal`) and the day's ceiling once someone has left the deck (`most`). An older `goal` at the top level is ignored. Who is unlocked for reveal cards is never stored. Since the insights release, `insightsDemo` says demo insights are on.
- `evermore.attempts.v1.<YYYY-MM>` (insights, 2026-11-09): each card's record, one key per month, kept 120 days: `personId`, `cardId`, `phrasingId`, `shape`, `factType`, `source`, `sessionId`, `shownAt`, `selections` (each `at` and `right`), `choices`, `hints`, `success`, `activeMs`, `firstSelectionMs`, `goal`, and `extra`, `testData` and `demo` where they apply.

**On the phones, sign-in on, for Insights (2026-11-10):** the person's phone queues records under `evermore.recordQueue.v1.<person user id>` until sent, and the one-time backfill's progress under `evermore.recordBackfill.v1.<person user id>`. The caregiver's phone keeps its copy under `evermore.insightsCache.v1.<caregiver id>` (when fetched, the newest upload seen, and the Trends copy) and `evermore.insightsCache.v1.<caregiver id>.<YYYY-MM>` (the records by month), removed by Sign out and Delete account.

**On the phone, sign-in on:** `evermore.practice.v1.<user id>` adds each card's fact and `phrasingsOff`, the people's hints and `revealOk`, `lastPhrasing`, `lastChoices`, `sessionLength`, `revealCards` and `today`. A copy saved before this release still practices, using each card's approved sentence.

## Flags

| Flag | Where | Value | Meaning |
| --- | --- | --- | --- |
| `AUTH_ENABLED` | `src/config/features.ts` | `true` unless `EXPO_PUBLIC_LOCAL_ONLY=1` (since 2026-11-11) | Sign-in and Supabase. With `EXPO_PUBLIC_LOCAL_ONLY=1` (`npm run start:local`): no sign-in and no server, everything on the phone. |
| `AI_VARIANTS_ENABLED` | `src/config/features.ts` | `true`, for testing | AI questions. Off: nothing about AI shows, nothing is sent, and approved sentences stay out of practice. On: it also needs the function set up and the caregiver's consent. |
| `AI_AVAILABLE` | `src/config/features.ts` | `AI_VARIANTS_ENABLED && !AUTH_ENABLED` | What the app actually reads: AI works with sign-in off only, so in the local-only mode. |
| `enabled`, `global_day`, `per_install_hour`, `per_install_day` | `ai_settings` in Supabase | off, 20, 5, 20 | The kill switch and the limits. They take effect on the next request, with no redeploy. |
| `MODEL`, `EFFORT` | `supabase/functions/generate-questions/index.ts` | `claude-sonnet-5-5`, `low` | The one place the model is named. Redeploy after changing it. |
| `AI_LIMITS` | `src/lib/ai-request.ts` | 12 facts and 8 sentences a request, 20 waiting per person | The function refuses more than a request may hold. |
| `SESSION_LENGTHS` | `src/config/schedule.ts` | 2, 3 or 5 per person | The day's target, within `least` and `most` for each length. Placeholder. |
| `CARD_SECONDS`, `SECONDS_PER_CARD` | `src/config/schedule.ts` | 5 + 3 + 5 + 1 = `14` | Behind "About 8 minutes today". Placeholder: tune it from a real day. |
| `NEXT_TAP_GUARD_MS` | `src/config/schedule.ts` | `350` | How long after the right name a tap on Next is ignored. |
| `CARDS_APART`, `REVIEW_PASS` | `src/config/schedule.ts` | 4, up to 4 cards | Spacing, and the review pass. Placeholders. |
| `REVEAL_CHANCE` | `src/config/schedule.ts` | 1 in 4, 1 in 2 | Sometimes, Often. Placeholder. |
| `PERSON_PRACTICE` | `src/config/schedule.ts` | 3 to 10 | Practicing one person: their facts again, asked other ways. |
| `RETURN_DUE_PER_DAY` | `src/config/schedule.ts` | `3` | Overdue cards a day for someone restored after a day or more. Placeholder. |
| `MIN_PEOPLE` | `src/lib/session.ts` | `2` | People practice needs, so every card offers a choice. |
| `LONG_PRESS_MS`, `TOAST_MS` | `src/components/people-grid.tsx`, `src/components/toast.tsx` | 400; 6000, or 15000 with a screen reader | The hold that starts editing, and how long Undo stays. |
| `PRACTICE_SCORE` | `src/config/insights.ts` | points 1, 0.6, 0.3; at least 10 cards | The daily Practice score. |
| `SCORE_BANDS` | `src/config/insights.ts` | Getting started, Building 65, Steady 80, Strong 90 | Its named bands, never pass or fail. |
| `MIN_CARDS_SHOWN`, `EARLY_READ_CARDS` | `src/config/insights.ts` | 5, 30 | No share or median from fewer than 5 cards; "early read" under 30. |
| `SESSION_STANDARD` | `src/config/insights.ts` | met 80%, about 60% | Practice time against the target times `SECONDS_PER_CARD`. |
| `TREND` | `src/config/insights.ts` | 14-day windows, 10 cards each, 7 days, 10 points | How the last two weeks compare, for the same person only. |
| `ACTIVE_TIME`, `ATTEMPTS_KEPT_DAYS` | `src/config/insights.ts` | a minute between taps, 90 s a card; 120 days | How active time is counted, and how long records are kept (on the server too, which keeps a day more: `interval '121 days'` in `supabase/schema.sql`). |
| `RECORD_BATCH`, `RETRY` | `src/lib/attempt-records.ts` | 25; 2 s doubling to 5 min | Records a person's phone uploads at once, and the waits after an upload that can't go. |
| `PAGE`, `OVERLAP_MS` | `src/data/insights-store.ts` | 1000; 5 minutes | Records the caregiver's phone reads at once (keep at or below the project's row limit per request), and how far back "what is new" looks. |
| `PRACTICE_MORE.cards` | `src/config/schedule.ts` | `10` | A mix, once the day is done. |
| `MIN_PASSWORD`, `RESEND_SECONDS` | `src/lib/auth-form.ts` | 8; 60 | A new password's least length (longer is encouraged), and the wait before "Send the email again", as Supabase allows one email a minute. |
| `CHUNK_BYTES` | `src/lib/session-storage.ts` | 1800 | The most bytes in one secure-storage value; a session takes several. |
| `SIGN_OUT_WAIT_MS`, the lockout | `src/data/account.ts` | 4000; 5 misses, 60 s | How long signing out waits to send what is waiting; the short pause after repeated misses. |

## What the next prompt (invite links) needs

The relatives' form should reuse `src/data/questionnaire.ts`: `relativeSections()` returns the sections a relative may answer (Work and school, Family and home, Interests, Shared memories) without the caregiver-only questions. Each answer already becomes a typed fact with a `source`, and goes through story approval like any other. A memory's photo from a relative would need its own upload path through the Edge Function, since a public form has no access to the bucket.

1. **Sign-in on.** Invites need the server, so they won't exist with sign-in off (as add a person once didn't).
2. **Invite links.** These need four pieces:
   - A table of invites: a hashed token, `caregiver_id`, expiry, revoked. No anon access.
   - An Edge Function that takes a token and a contributor's facts and inserts cards with `source` set to identify the invite (the column holds up to 40 characters; widen it or add `invite_id` / `contributor_name` columns), status `pending`. A fact that may change still needs the caregiver's Confirm.
   - The public web form, outside the app.
   - On story approval, a "From <name>" line for facts not from the caregiver. Rate limits, consent wording for contributors, and an update to the draft privacy notice (`src/components/privacy-notice.tsx`).
3. **AI with sign-in on, if wanted.** Approved sentences would need a server table the person can read only when approved, in place of `evermore.family.v1`. Until then `AI_AVAILABLE` keeps it off there, and the privacy notice's line that Evermore never writes stories stays true.

## Verified on 2026-11-05: AI questions

Everything here ran with a mocked model. See [Not verified](#not-verified) for what that leaves open.

- `npx tsc --noEmit` is clean with the flag off and on, `npx expo lint` is clean, and the native iOS and Android bundles compile.
- `node scripts/check-logic.mjs` passes, now also checking:
  - **Bad outputs that must be rejected:** an invented place, a changed number, a new name, a leaked answer, a citation of an unknown fact, a time-sensitive fact reworded, softened or dropped words, a repeat, and a shape the facts can't support.
  - **What is sent:** no real name or other name in the body, no card id, and no test data, time-sensitive, unapproved or too-long fact. The real family is held back.
  - **The queue:** nothing reaches practice unapproved, edits are checked again, and Approve all valid takes only what still passes.
  - **Facts changing:** a changed or removed fact, or a new relationship, pulls and flags every sentence that used it.
  - **Practice:** 60 random days meeting their targets with no sentence twice, people kept apart, the per-phrasing switch working, and approved sentences first. What a reverse card offers is never true of the person, and never a fact that may change.
  - **Flag off:** no sentence reaches practice, and the deck is as it was.
- `node supabase/tests/function.test.mjs` passes 18 checks, with the real SDKs around a mocked model: refusals before any cost, each limit and the kill switch, failing closed, bad outputs dropped, and no content in logs.
- `node supabase/tests/rls.test.mjs` passes 143 checks, adding that only the function reaches the limits, each limit stops at its number, and the kill switch stops everything.
- **Hermes:** its compiler accepts all five masking patterns, two of them built at runtime, and rejects deliberately broken ones.
- **Web build, flag on, mocked function,** 62 checks end to end: consent before anything is sent, the request's contents, bad sentences dropped on the phone, the queue, edits, sentences in practice, a changed fact, every calm failure, the busy state, a timeout, offline, and both ways of turning it off.
- **Every AI view** at 375x647, 390x763 and 430x839, at Medium and Large, including forced reverse cards with their hints and read-backs: no target under 44pt or 48pt, no text under 4.5:1, only palette colors, no overflow. Looking at the screenshots found the clipped fact in the success line and the one-line edit box, both fixed.
- **Web build, flag off:** 540 checks at the same sizes that nothing about AI shows, offline too, nothing leaves the phone, and sentences left from an earlier flag-on stay out of practice. The 30 regression checks pass, as do reveal cards at all three text sizes.
- **Every existing screen,** in the same run: 455 practice and Next checks, the upgrade walk, the questionnaire and person screens at all sizes, and 75 keyboard fields. The audit's only hits were its known false positive on the chart's labels. This run came before the last AI-only fixes (the request limits, the reverse card's choices), which no flag-off screen reaches, so it wasn't repeated; flag off, regressions and reveal cards were rerun on the final code.
- **Reading the code found** a bug no test had caught: a reverse card could offer something true of the person as a wrong choice, or a time-sensitive fact undated. Fixed, with checks.
- The family photos never appeared: stand-ins in the export and in the browser. The exports and screenshots were deleted afterwards.

**Security review:**

| Area | Finding |
| --- | --- |
| Keys | `ANTHROPIC_API_KEY` is read only from the function's environment. Every tracked file, the working tree, all of git history and the built bundles were searched for key patterns: the one hit is the test's fake `sk-ant-test-not-a-real-key`. `.env` is ignored, and `.env.example` holds no values. |
| Token | 32 random bytes, in secure storage. Only its SHA-256 hash is stored. It's checked as 64 hex characters at both ends, and never logged. It's high-entropy, so a hash needs no salt. |
| Rate limits | Per hour and per day, in one locked transaction, and only `service_role` can call it. A refused request isn't counted. If the limits can't be read, the function refuses. |
| Spending cap | `global_day` is checked first, and the model is called only after a request is taken. The kill switch starts off, and takes effect on the next request. At most about $0.09 a request. |
| Abuse | The exact contract only, and the body read only up to 8 KB. No CORS. Output must pass the checks, so it can't serve as a general model endpoint. |
| Logging | Failure kinds only: `anthropic <status>`, `unexpected` or `limits unavailable`. The phone's AI code logs nothing. |
| Fixed by this review | A fact kind like `constructor` passing the contract; an oversized body read whole; a fact outgrowing the limit once masked, which refused the whole request; names in writing with no capitals; a retry outlasting the phone's timer; a timeout called no internet; the button stuck busy on an unexpected error. |
| Known limits, left as they are | Anyone can make new tokens, so the global cap is the true ceiling. A flood of bad requests costs Supabase calls, not model money. Supabase's own logs keep request details such as IP addresses on its schedule, which the function can't change; they don't hold the facts. |

## Verified on 2026-11-05: Next story at once

- `npx tsc --noEmit` and `npx expo lint` are clean, the native iOS and Android bundles compile, `node supabase/tests/rls.test.mjs` passes its 120 checks (the schema didn't change), and `node scripts/check-logic.mjs` passes, now also checking: the guard between 300 and 400 ms, taps inside it ignored and every tap after it counting; the guard reading only the clock, so card kind, hints and flips can't hold Next; Next having no disabled state and nothing delaying it; a stray tap never cutting the voice short; the flip telling nobody when it ends; the parts of `SECONDS_PER_CARD` adding up and fitting the phone deck's word counts; a 12-person Standard day at 8.4 minutes, and 8 to 12 at every deck size tried.
- **Web build, sign-in off**, in headless Chrome, at 375x647, 390x763 and 430x839, each at Medium and Large, 440 checks on plain, hinted and reveal cards: Next enabled, fully opaque and in full color as soon as it exists; a tap inside the guard ignored with no change in how it looks; the read-back still there a second later; one tap after the guard moving on; Next during the 450 ms flip moving on, with the next card starting fresh. No target under 48pt, no contrast or palette problem, no page errors, across the home, every kind of card and hint, success and wrap-up. The first hint on a long-fact card still scrolls 25pt at Large on the 375-wide phone, as before.
- **A machine playing a whole Standard day:** 17.4 seconds for 36 cards, with 82 taps absorbed by the guard, 36 different sentences, 3 cards each for 12 people, and "All done today" only at the full target. This shows nothing blocks Next, and that nothing stops a day being tapped through.
- The 30 regression checks and the upgrade walk from the last release still pass.
- The family photos never appeared: stand-ins in the export and in the browser. The exports and screenshots were deleted afterwards.

## Verified on 2026-11-05: the study session

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile. No package was added, so it runs in Expo Go as before.
- `node scripts/check-logic.mjs` passes, now also checking:
  - **Markers and wording:** the asterisk on exactly the five required questions; Not applicable on exactly four, reaching 100% with no fact and showing on review; marks from an earlier release showing nowhere; "Do not fill out" and the old wording appearing nowhere.
  - **Capitalization:** every question, option and screen label in sentence case; mixed-case values untouched; names and places using `autoCapitalize="words"`.
  - **The deck:** everyone complete in by default; deselected people out of practice with their profile kept; drafts held out by the toggle.
  - **The day:** targets for Short, Standard and Long and for small and large decks; the estimate; 400 random decks (1 to 24 people, mixed schedules) meeting the target with no sentence twice and people kept apart; 120 days stopped and resumed at random; 150 full days with hints, re-asks and review passes, with what came back never counting; rotation of phrasings, names and the right name's place across 40 whole days; two people sharing a fact never both offered.
  - **Flip cards:** no reveal card before a first-try answer; a hinted, second-try or revealed answer doesn't unlock; unlocking resets with the day; never a re-ask, review, photo-only, opted-out or photo-less card; Sometimes and Often at about 1 in 4 and 1 in 2 over 20,000 cards; hidden first, shown on a tap, always shown by the end; a crossfade under Reduce Motion; and the unlock unreadable from any view, the phone's saved state or the schema.
- `node supabase/tests/rls.test.mjs` passes 120 checks, adding: the person can't read a deselected person or their cards, however `in_deck` stands, or change the toggle, the session length, the reveal setting or an opt-out; caregiver B can't either; the three lengths and three reveal settings are the only values; large targets are accepted; nothing on the server can store who is unlocked; and both older schemas still upgrade.
- **Web build, sign-in off**, in headless Chrome:
  - **Every questionnaire step,** empty and answered, the pickers, and review, at 375x647, 390x763 and 430x839, at Medium and Large: no target under 44pt, no contrast under 4.5:1, only palette colors, no horizontal overflow, no label needing more than 30% shrink, no page errors.
  - **The keyboard, simulated:** 75 fields across the steps with the viewport shrunk by 291pt: every focused field clear of the bar, and Continue on screen.
  - **Every existing screen** at the same sizes: the home, all four kinds of card with every hint state and success, the wrap-up, All done, Practice more, the four dashboard tabs, a person's sheet (complete, draft and deselected), story approval, and both settings sheets. No target under 48pt on person screens or 44pt on caregiver screens, and no practice card scrolled in this run, though cards are random, so a long fact's hint may still scroll as before.
  - **Reveal cards** at the three sizes at Medium, Large and Extra large: the label inside the tile and nothing scrolling. A real 3D turn with the faces swapping halfway; with Reduce Motion, opacity alone from 1 to 0. A tap shows no hint; a wrong name keeps the tile and gives the usual hint; the right name always ends on the photo.
  - **Stop and resume:** Home on a success banner, a reload, and Keep going, with nothing repeated and sessions closed as finished.
  - **30 regression checks:** the caregiver lock, hint toggles, ways to ask, deselecting and selecting again, the dashboard's counts, the gate through Not applicable, a draft staying out, Clear test data, and text size growing the person's screens while caregiver screens stay compact.
  - **A phone from the last release, mid-day:** the morning's cards still count against the new target, someone complete but never added joins by themselves, and nobody is lost. Typed words survive a closed app.
- The audits found and fixed: picker rows with a 40pt target; a hinted last card of the day coming straight back; "Practice more" taking its 10 cards from the first few people; a greedy order that could crowd people; a crossfade that Reduce Motion skipped.
- The family photos never appeared: stand-ins in the export and in the browser. The exports and screenshots were deleted afterwards.

## Verified on 2026-11-04: the gate and compact caregiver screens

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile.
- `node scripts/check-logic.mjs` passes, now also checking: the gate refusing below 100%; a person dropping below 100% becoming a draft; drafts absent from practice cards, the names offered and hints; "Doesn't apply" reaching 100% with no facts and showing on review; test data flagged, pending and generic for real people, filling only gaps, and leaving alone people the caregiver added or removed; test data held out of server writes and the practice outbox, and absent from the schema; Clear test data restoring the real percentages (60%, or 40% with no relationship, and 100% for sample people, who keep their facts); sample facts held to ordinary rules, and an older phone's converting with its schedule; a fact the caregiver rewords no longer counting as test data; a debounced draft surviving a simulated close, with a fake clock.
- `node supabase/tests/rls.test.mjs` passes 94 checks, adding: the person can't read a draft or its cards, or change `in_deck`; caregiver B can't either; after an upgrade nobody is grandfathered; the `person_in_deck` check is closed to signed-out visitors.
- **Web build, sign-in off**, in headless Chrome:
  - The gate from end to end: a name saves a draft at 20%; the strip echoes the percent; the disabled button refuses a tap; each missing item jumps to its step and Continue comes back; "Doesn't apply" on a picker, chips and a memory reaching 100% with no facts; an answer clearing a mark; adding to practice; emptying the only interest sending them back to a draft.
  - Clear test data: every real person back to 60% or 40% and out of the deck, the 5 sample people still at 100% and in it, and no draft on the person's home.
  - Draft survival: a new person, mid-step, background inside the debounce, blur and step change, each with the app killed and reopened.
  - Phones from the last release: every fact, schedule and hint setting kept, and someone the caregiver added becoming a draft.
  - Every step, empty and answered, at 375x647, 390x763 and 430x839, at Medium and Large; every existing screen and the practice flow at the same sizes. No page errors, no target under 48pt on person screens or 44pt on caregiver screens, no color outside the palette, no label needing more than 30% shrink.
  - **Keyboard, simulated:** 75 fields across all seven steps at the three sizes, with the viewport shrunk by a 291pt keyboard: the focused field stayed clear of the bar and Continue stayed on screen.
- The family photos never appeared: stand-ins in the export and in the browser. The exports and screenshots were deleted afterwards.

## Verified on 2026-11-04: the guided profile

- `npx tsc --noEmit` and `npx expo lint` are clean, and the native iOS and Android bundles compile.
- `node scripts/check-logic.mjs` passes, now also checking the questionnaire (every fact kind has exactly one question, limits the database accepts, no words the framework bans), answers to facts and back, profile completion (private questions never count, it can reach 100%), the new phrasings (no word beyond the fixed shape), the best clue and left-out facts in hints, and saving a section without touching other facts.
- `node supabase/tests/rls.test.mjs` passes 82 checks, adding every fact kind, the new columns' rules, and upgrades from both earlier schemas keeping every fact and its history.
- **Web build, sign-in off**, in headless Chrome:
  - A person with only the first screen; a person through every section (33 facts, all approved, private facts out of hints, 100% complete, no nudge).
  - Leaving mid-way, a reload, and "Finish profile" resuming at the same step with the answer there; the nudge and percent.
  - Skip keeping typed words; the system back gesture saving the step; a bad year refused; unticking a chip removing its fact; passing through the hints step leaving the toggle alone; leaving out every fact turning the fact hint off.
  - New facts in phrasings and hints in a session of that person's cards; "Think of their laugh."; a memory's photo and year on the answer.
  - Phones from earlier releases: practice only, and a family saved by the last release, with walking the whole form changing no fact.
  - Every existing screen and the practice flow at 375x647, 390x763 and 430x839, each at Medium and Large, with the earlier walks for hints, ways to ask, rotation and Practice more. No page errors, no target under 48pt, no color outside the palette, no label needing more than 30% shrink. See `DESIGN-UI.md` for what scrolls.
- The family photos never appeared: stand-ins in the export and in the browser. The exports and screenshots were deleted afterwards.

## Verified on 2026-11-04: photo on every card, name rotation

- `npx tsc --noEmit` and `npx expo lint` are clean; `node scripts/check-logic.mjs` passes, now also checking name rotation: 40 cards of one person (never the same names in the same order twice running, the right name always moving and taking every place, other names they weren't just shown), a mixed session (the right name away from where the card before had it), a new session after the last, and a two-name deck.
- **The practice flow in the web build**, sign-in off, at 375x647, 390x763 and 430x839, each at Medium and Large: every kind of card (forced in turn) shows the photo before and after the answer; today's goal and two one-person sessions per size, with every pair of consecutive cards for the same person (6 or 7 per run) offering a new order and moving the right name; the dashboard still completion only. Everything fits except the first hint on a long-fact card at Large on the 375-wide phone (25pt, caught by the scroll view, as before). No page errors. Exports and screenshots deleted afterwards.

## Verified on 2026-11-03

- `npx tsc --noEmit` and `npx expo lint` are clean. The native iOS and Android bundles compile (`npx expo export`).
- `node scripts/check-logic.mjs` passes, and now also checks:
  - each kind of fact's sentence, and the example deck's sentences unchanged
  - every phrasing: kinds, needs, and no word beyond the fixed shape
  - the month on facts that may change
  - turned-off phrasings, and rotation across 40 rounds and across sessions
  - the hint ladder: order, toggles and the fact hint
  - `needMostFirst` and `personQueue`
  - the phone's family: seeding, re-approval and removal
- `node supabase/tests/rls.test.mjs` passes 67 checks, among them:
  - confirmation before the person sees a fact that may change
  - hint and phrasing columns readable but not changeable by the person
  - rerunning the schema
  - upgrading a project made with the schema before facts (`supabase/tests/schema-before-facts.sql`), keeping every card word for word with its practice history
- **Web build, sign-in off**, in headless Chrome:
  - Migration from a phone that practiced before this release: deck copied, schedule and sessions kept.
  - Editing June with five details, one marked "may change", then confirmed.
  - A minimal person with a photo, and a full person with details; the missing-fields message.
  - A new relationship sending facts back for approval; removing a person; a reload keeping everything.
  - Hint toggles per person: one person without the letter hint; a second fact used as another person's hint; fewer names leaving two.
  - Ways to ask: turning ways off, the last one staying on, and every way of a dated fact showing its month.
  - 24 cards over three sessions: all four kinds, nobody asked the same way twice running.
  - Practice more for one person and for a mix; the caregiver's hand-over.
  - The dashboard still showing completion only, capped at 100%, with no correctness words.
- **Sizes:** every screen at 375x647, 390x763 and 430x839 at Medium; 375x647 at Large; 390x763 and 375x647 at Extra large. See `DESIGN-UI.md` for what scrolls. No target under 48pt, no color outside the palette.
- The family photos never appeared: the export's photo files were overwritten with plain stand-ins of the same shape, and the browser was given stand-ins as well. The exports and screenshots were deleted afterwards.

## Not verified

- **Anything against the live Anthropic API.** No key was available, so the model was mocked, with the real SDKs around it. Still unknown:
  - **What the model really writes, and how many sentences survive the checks.** This is the biggest unknown. The checks are strict by design, and if too few pass, the prompt or the small-word list needs tuning against real output.
  - The refusal fallback beta and structured output together on the live API. If the API refuses that pairing, every Generate says "couldn't be written just now", and the log line shows `anthropic 400`.
  - The Anthropic SDK under Supabase's Deno runtime. The tests ran it in Node.
  - How long a real request takes, against the 45-second timeout.
- **The function on real Supabase:** its URL slug, reaching it with no `apikey` header and Verify JWT off, and `ai_take_request` under a true concurrent burst. PGlite has one connection, so the lock was read and reasoned about, not raced.
- **AI on a real phone:** `expo-secure-store` and `@react-native-community/netinfo`, the multi-line edit box with a real keyboard, and the masking running on Hermes. Hermes's compiler accepts every pattern, but only a phone runs them.
- **Anything on a real phone in Expo Go:**
  - **the real keyboard:** the pinned bar riding above it and the focused field scrolling into view were checked only by shrinking a browser, on neither iOS nor Android
  - **the flip,** with Reanimated running natively, and with Reduce Motion on the phone
  - **how long a real day takes,** so `SECONDS_PER_CARD` (14) is still an estimate
  - **how tapping through feels:** the guard on a real finger, and whether a quick double tap on Next lands on a name on the next card, which the guard doesn't cover because it only follows an answer
  - the labels on the fields: their fit at the phone's largest text sizes, up to the 1.3× cap
  - shrink-to-fit labels (web truncates instead), fonts, safe areas, speech being cut short by Next, and AsyncStorage across launches
  - picking a photo, for a person or a memory; the sheets and pickers; the iOS swipe back saving a step; a real app close
- **Sign-in on against the live project.** It needs the schema rerun first, and the live API test wasn't rerun. The new server paths were typechecked, and the schema was run in PGlite, but no phone has talked to them.
- **A person with memory loss.** Nobody has tried a full session or a reveal card with the person they are for, and every number in `src/config/schedule.ts` is a placeholder for a speech-language pathologist to review.

## Next step

**First, this release on the phone** (sign-in off), after `npx expo start --clear`:
1. **The Memory score.** Hold Caregiver → Trends → Insights (Settings → "Load demo data for Insights" if you have no practice yet). The score should be pink and say "Memory score", with "Practice activity, not a medical measure." right under it; the calendar's days pink, lighter for lower scores; the Completion view still blue.
2. **The key.** Under the hero: tap a band to read what it means. On the calendar, "Show score ranges". Open "What is this score?": the key is at the top.
3. **Swipe between days.** Tap a day on the calendar, then swipe left and right: one day at a time, empty days included, stopping at today and the first day. Drag down: the sheet should still close. Try the arrows, then VoiceOver (swipe up or down on the score for "Next day"). Turn on Reduce Motion (Settings → Accessibility → Motion), restart Expo Go, and check it crossfades. Close the sheet: the calendar should be on that day's month with the day marked. Tell me if a sideways swipe ever scrolls or closes the sheet instead.
4. **Approve all.** People → a sample person with stories waiting (June) → "Waiting for approval": look through the list, tap Approve all, check the counts, Show them, Approve, then Undo on the toast. Back on the sheet, Approve all now sits under the row. With AI questions generated, the list shows them with their facts; an edited one should say it waits for you.

**First, Insights with sign-in on:** the Supabase rerun and the two-device test, under [Testing on two devices](#testing-on-two-devices). Then turn sign-in back off, and:

**Insights on the phone** (sign-in off), after `npx expo start --clear`:
1. **Practice feels the same.** Do part of a day as the person would. Nothing new should appear on the practice screens, and nothing should wait or hurry. Tell me if anything feels different.
2. **Your own practice in Insights.** Hold Caregiver → Trends → Insights. With at least 10 cards done today, the hero shows today's Practice score and band, the cards answered and practice time against the standard; with fewer it says how many a score needs. Open today on the calendar, and "What is this score?".
3. **Background time doesn't count.** Mid-card, switch to another app for a minute, come back, and finish the card. Today's practice time should grow by the time you spent in the app, not the minute away.
4. **The demo.** Settings → tick "Load demo data for Insights". Look through Insights: the charts, the calendar's earlier months, a day's sheet, the next steps (one should open Mae's sheet). Then Settings → Clear test data, and Insights should be empty of it again.
5. **Archived people.** Archive Mae with the demo on: she leaves Insights, and "Include archived people" brings her back. Restore her afterwards.
6. **Reading it.** With VoiceOver, each chart should read a plain summary. With the phone's text size raised, labels should stay readable.

**Then archiving on the phone,** after `npx expo start --clear`. Use the fictional sample people (June, Leo, Ruth, Omar, Mae) for anything you delete.
1. **The long press.** Hold Caregiver, open People, and hold a picture card. About half a second in, you should feel a light tap and see a minus badge grow onto every card, with Done at the top. Tell me if the hold feels too long or too short, or if the tap is too strong or missing. A quick tap should still open the card's sheet.
2. **Done and tapping outside.** Done ends editing, and so does a tap on empty space or on a card. Scrolling the grid while editing should still work.
3. **The minus and Undo.** Tap June's minus: June leaves the grid at once and "June archived." appears at the bottom with Undo. Tap Undo within 6 seconds: June is back. Archive Leo and let the toast go by itself.
4. **Archived people.** At the bottom of People, open "Archived people". Leo's card is muted, with Restore. Tap the card: the sheet says when, and offers Restore and Delete permanently. Restore Leo. Archive Ruth, open her sheet, tap Delete permanently, read the confirmation, and cancel once, then delete.
5. **Mid-day.** Practice a few cards on the person's home, then archive someone who came up. The home's bar and Today's "X of N cards today" must not move back. Restore them.
6. **Accessibility.** With VoiceOver on, focus a card and swipe up or down for the "Archive June" action; the toast should be read out and stay about 15 seconds. With Reduce Motion on, the badges and the toast should appear without growing or fading.
7. **Archive down to one person.** Today should say "Add or restore people to start practicing.", and the person's home should have no Start. Restore everyone afterwards.

**Then AI on a phone,** once the steps under [What the user must do](#what-the-user-must-do) are done:
1. **Generate for June.** Hold Caregiver, open People, then June. Approve their stories if they wait for approval. Tap Generate new questions, read the consent, and agree. Note how long it takes, how many sentences come back under To review, and whether they read well. Tell me: too few means the checks or the prompt need tuning.
2. **Try the queue.** Approve one, reject one, and edit one by adding a word that isn't in the facts: it should be refused calmly. Then Approve all valid.
3. **See them in practice.** Run a day, or Practice with June now. Look for your approved sentences, and for a reverse card.
4. **Change a fact.** Edit one of June's stories, and check its sentences are flagged under To review and gone from practice.
5. **Turn it off each way:** Settings → AI questions; the box on June's sheet; airplane mode; and the kill switch.
6. **Check a real family person.** Their sheet should say "These facts stay on this phone." and offer no Generate.

**Then the run-through from the last release,** on the phone, with `npx expo start --clear`:
1. **Tap through, and notice how it feels.** Next should be ready the moment the banner appears, with no dimmed look, and a double tap on the right name shouldn't skip the read-back. Try a card with a hint and a reveal card too, including tapping Next while the card is still turning.
2. **A full Standard day, timed.** Note the time, press Start, and play the whole day at your own pace. Home should say "0 of 36 cards today" and "About 8 minutes today". Tell me how long it took: if it's well under 8 minutes for someone who listens to each read-back, `SECONDS_PER_CARD` is too high or Standard needs more questions per person.
3. **The flip.** Reveal cards come in after a first-try answer, so about 1 card in 4 from a person's second card on. Set Settings → Reveal cards → Often to see more. Tap a "?", then let another flip by answering. Turn on Reduce Motion in the phone's settings, restart the app, and check it crossfades.
4. **Stop and resume.** Tap Home on a success banner, force-quit, reopen: the count holds and Keep going carries on with new sentences.
5. **The real keyboard.** Hold Caregiver → People → Add a person. Tap each field down the form, on the smallest phone you have: the field must stay in view, and Back and Continue must sit just above the keyboard. Names should capitalize; a job shouldn't. Repeat on Interests and Shared memories, the longest steps.
6. **The form.** Check the asterisks, "* Required", and Not applicable on Photo, Relationship, Hobbies and A time we…, and that a note shows only after leaving a required field empty.
7. **Deselect someone.** Open their sheet, untick Include in practice, and check "Not in practice" on the People tab and that their name never comes up in practice. Tick it again.
8. **Session length.** Settings → Session length: check the minutes beside each, and that Short and Long change the target on the home screen.
9. **Text sizes.** Aa → Large: caregiver screens must stay compact while the person's screens grow. Then raise the phone's own text size and check the form's labels don't crowd their answers.
