# Evermore design record

The framework pass for Evermore: core function, core loop, accessory features, screen budget and retention hook. The rules themselves are in `CLAUDE.md`. This file records the decisions and where the build stands, so update it whenever a verdict changes.

## Core function

Help a person with early memory loss keep recognizing the important people in their life, through short, personal fill-in-the-blank stories.

## Core loop (under 30 seconds)

| Step | What the person experiences | Code |
| --- | --- | --- |
| Trigger | A card with a large photo and one sentence with a blank: "My aunt, ______, grows tomatoes and shares them every summer." The same fact can also be asked three other fixed ways (see [Question variety](#question-variety)). | `PracticeCard` in `src/components/practice-screen.tsx` |
| Action | They tap one of up to 3 names: the right one, plus up to two others from the approved deck. A small deck can offer fewer. The other names and the right name's place rotate, so the answer can't be learned by pattern. | `chooseNames` in `src/lib/stories.ts` |
| Feedback | Another name brings a gentle hint, one rung further each time, in a fixed order: another fact the caregiver gave, the relationship ("This is your aunt."), the first letter, then fewer names, and after the last one the answer itself ("It’s June.", that name’s button shown selected). The caregiver can turn rungs off per person. No red, no "wrong", no score, and every card ends on a success. Since 2026-11-11 (see [Question refinement](#question-refinement-2026-11-11)). **I’m not sure**, under the names, starts the same hints with nothing chosen (since 2026-11-13, see ["I'm not sure"](#im-not-sure-2026-11-13)). | `hintAt` in `src/lib/stories.ts`, `src/lib/card-steps.ts` |
| Reward | The blank fills in (or the question becomes the whole sentence), the photo stays, and a soft banner says "Yes, that's June." The whole sentence is read aloud, and stays on screen while the person decides to move on. One button moves on, ready at once. | `speak` in `src/lib/speak.ts` |

There are no timers anywhere in the loop. Only cards the caregiver approved ever appear. Status: **built**. Since Phase 3 the cards come from the server, in the order the spaced-retrieval schedule chooses.

## "I'm not sure" (2026-11-13)

A calm way to ask for a hint without choosing a name first, so not knowing is never a mistake. The rules are in `CLAUDE.md`; this records the decisions.

- **The same ladder, entered earlier.** Each tap is one hint step, as a different name would be (`src/lib/card-steps.ts`): no new hint content, and the existing order (another fact, the relationship, the letter, fewer names, then the answer). The calm line "That is okay. Here is a little help." replaces only "Take your time." on a first hint it brought; later hints keep their own words.
- **"Show me" for the last tap.** The control's label changes on the tap that will show the answer, and it goes once the answer is shown. The person still taps the right name to finish, as on every card.
- **Fewer names with nothing chosen.** The last other name chosen is set aside, or the first other name offered when none was. Names already rotate, so this says nothing about the answer.
- **Scoring: "With help", the existing points.** A card with any help request counts as "With help" (0.3 points), whatever choice found it, the same as a card that took three tries. That is the existing scoring for the most hinted cards, with no penalty of its own; the alternative, counting it by its choice, would score a card the person said they didn't know as "Right away". For the clinician to review.
- **Scheduling: like any hinted card.** Tries are the names chosen and every step is a hint used, so the card moves back a step, comes back later in the session, and gives no reveal unlock.
- **Recorded as its own event.** `help` on the card record (each tap's time and the step reached), `help_at` and `help_steps` on the server, added with defaults so older rows and older apps keep working. A tap adds no selection, so nothing reads as a wrong answer. "Asked for help" is a plain count in Insights (under How answers were found, and on the day sheet), in the report, and as a list per card in the data file (format unchanged at 2: one added field).
- **Answer speed is unchanged.** The time to the first choice still means the first name chosen, so a card where the person asked for help first takes longer to its first choice. Each help tap counts as a moment of use for active time.

## Consent and the privacy policy (2026-11-13)

Plain-language consent and an in-app privacy policy, ahead of TestFlight. The rules are in `CLAUDE.md`; this records the decisions. Everything legal is a draft for a lawyer (`docs/privacy-policy-draft.md`, 24 `[REVIEW]` notes), and nothing claims compliance with any law.

- **The inventory first.** `docs/DATA-INVENTORY.md` was written from the code, the schema and the Edge Functions, and the policy from it. A check fails when the schema gains a table, or the app a storage key, that the inventory doesn't name.
- **One source for the policy.** `src/lib/privacy-policy.ts` feeds the in-app sheet, the Markdown draft (with the lawyer's notes) and a single-file HTML page to host, so the three can't drift. Each version's fingerprint is locked (`docs/privacy-policy.lock.json`): new words without a new `POLICY_VERSION` fail the check, since caregivers must agree to what they read.
- **Sign-up: no account without both agreements.** A five-line summary, a link to the whole policy, then two unticked boxes: the policy, and a plain responsibility statement (they may add these people, and the person they help, or whoever is legally responsible for them, knows). The app sends nothing without both, and the database's sign-up trigger refuses the account anyway, so an older app or a direct call can't make one. The old single statement ("I have permission to upload photos… not a medical device") is folded into these: "not a medical device" moved into the summary.
- **Research is a third, optional box, unticked**, and a **Research use** row in Settings. Nothing is used for research and nothing was built to export it. Saying no changes nothing.
- **Versioned records** (`public.consents`): one row per agreement or choice, kind, version, choice and the server's time; never changed or removed except with the account. No wording is stored: the version names the exact words, which git and the lock keep. Research changes are new rows, so the history is kept. Existing caregivers get one `legacy` record from their old `consented_at`, so they are asked to agree to the new policy.
- **Asking again** is a sheet with no Close over every caregiver screen (`PolicyGate`), within the screen budget: Agree and continue, or Sign out; the policy opens in the same sheet with Back. It asks only on a fresh answer from the server and keeps nothing on the phone, so a caregiver who is offline is never locked out (they're asked once the server answers). The person's phone keeps practicing meanwhile.
- **The person is never shown legal text.** Their first step ("Hello", after I am practicing) gains one bold sentence at their own body size, "Your caregiver set this up for you.", and a **Privacy policy** link at the compact reading size with a 48pt target. The policy sheet uses the compact scale for its text but keeps the person's 48pt Close. It is on that first step, rather than the email or PIN step, because it covers both ways in (pairing and the User ID) before anything is sent.
- **Settings → Privacy and data:** Privacy policy, What the app stores (the plain inventory), Research use, AI questions agreement (where AI is available; it can be taken back, and Generate then asks again), Export my data. Delete account stays last and apart, as the hard rule requires.
- **AI's consent** now says what the policy says: approved facts as text, names replaced, no photos, no facts that may change, Anthropic may keep data for a short time under its terms.
- **Agreements aren't in Export my data.** The export is a safety net for a restore, and agreements are re-given on the next sign-in. Add them if a lawyer wants the export to double as an access request.
- **Consent records go with the account** on Delete account. A lawyer may want them kept for a time as evidence (`[REVIEW]`).

## Real data off git (2026-11-13)

No real family data in any tracked file, test, fixture or doc. The rules are in `CLAUDE.md`; this records the decisions.

- **The committed deck is the five fictional sample people** (June, Leo, Ruth, Omar, Mae), the ones the server already seeds and the app already has illustrations for, so nothing new was drawn and the local-only mode, the tests and the walks keep working. Their facts stay ordinary facts, not test data (asked and confirmed), so AI questions can still be tested on them.
- **The real cards moved to `src/data/deck.local.ts`**, gitignored and in `.easignore`, loaded by the existing development-only `require.context`, so a clone without it builds and runs with the sample deck. The phone's family already holds the sample people Ruth, Omar and Mae (added by test data before); `seedFamily` now notes anyone already present as seeded instead of copying them twice, and keeps the family's other state (it used to drop `testSeeded` and AI sentences when it copied someone in).
- **Tests use invented stand-ins for real people** (seven, with the same shape as before but different names and relationships), so the rules for real people (test data flagged, held back from AI) are still checked, and the phone-deck figures (12 people, 36 cards) are unchanged.
- **The denylist is yours to fill.** The guard never prints an entry and warns rather than fails without one, so a fresh clone still passes `npm test`. Three forms: a whole word in any capitalization (catching ids like `name-0`), `=` for exact capitalization (a name that is also an ordinary word), and `~` for a word libraries use in their own strings, which a bundle can't tell from a leak (found with a library's own text), checked in files only. The local deck's cards are still looked for in bundles by their words.
- **History isn't rewritten here.** Every commit on GitHub but the first holds the real cards; `HANDOFF.md` has the counts and both ways to remove them.

## Pre-release sweep (2026-11-12)

The final pass before release. `docs/SETTINGS-AUDIT.md` lists every action that changes or deletes data, what protects it, and what changed.

- **No developer tools in the app.** Removed: Load and Clear sample activity (they wrote made-up sessions into, and deleted rows from, a real signed-in family on the server, one tap each), Load demo data for Insights, and Clear test data. Clearing test data is a development launch flag. A check fails if any screen refers to one again.
- **Deliberate deletion.** Delete account and Delete permanently name what goes and from where, and work once "delete" is typed. Delete permanently stays behind Archive. Sign out confirms, and says the family stays saved.
- **Export my data**, new: a JSON copy of everything entered, through the share sheet. Photos are left out (they stay in the account); so are logins, emails, test data and how answers went. (Superseded on 2026-11-13: see "Export my data, complete".)
- **Settings** in sections, destructive last and apart, calm offline. Every dashboard tab shows one calm line while its data is on the way, and the reason (offline, sign-in ended, server not yet updated, server away) with Try again when it couldn't load.
- **Privacy in release builds.** The real family's photos and cards load only in development builds, a release guard (`scripts/check-release.mjs`) checks real release bundles, and `.easignore` keeps them out of any upload. Logs carry only the kind of a failure.
- **Photos** are kept at most 1280 px on the long edge.
- **AI questions are off by default** again (`AI_VARIANTS_ENABLED = false`), as the hard rule says; the code had it on.

## Export my data, complete (2026-11-13)

A safety net after an accidental loss: the caregiver's own family, complete, on request. The rules are in `CLAUDE.md`; this records the decisions. It replaces the first export (2026-11-12), which held only what was entered and the last 30 days of sessions.

- **Verdict changed: the export now holds how practice went.** The first export left out "how answers went"; this one carries every card record (each answer chosen, the hints shown) and a report of the Memory score and how answers were found, because a backup without them can't restore Insights. It stays inside the Insights exception: caregiver-only, behind the caregiver's login, never on a person's screen, practice activity only.
- **Three files, not one.** A JSON data file of everything (for a restore), a PDF report (for reading, and for a clinician), and photos as a separate zip only when "Include photos" is ticked. Photos are large and show faces, so they never ride along with the data file by default.
- **Read from the server with the caregiver's own session**, so Row Level Security decides; no Edge Function. A function with the secret key would bypass RLS, which is the one guarantee that a caregiver reads only their family. Every query also names the family. The person's login is refused in the app before any request, and RLS gives it no card record or phone regardless.
- **Never a partial file silently.** Any page that fails fails the whole export, with Try again. Offline, the app doesn't fall back by itself: the caregiver chooses **Use this phone's copy**, and the file (`about.complete: false`, `notIncluded`) and the report say what it may lack. An automatic fallback would hand over a partial file the caregiver might take for a full one.
- **What "everything" means in practice.** Sessions go back to the start on the server. Card records are kept 120 days (as they always were), so the records and the report cover at most 120 days. The schedule is the family's (the row changed last for each fact across the person's logins). Linked phones are names and dates; who practiced on which phone isn't exported, since a login's id is an account detail.
- **The report uses the Insights functions, unchanged**, over every record with archived people included (as "Include archived"), so its figures equal what Insights shows for the same days. New figures, kept close to existing ones: a week's "average daily score" is the mean of that week's daily Memory scores (days with one); a person's score is `personScore` over the report's period. "Found most readily" and "Needed the most support" name the highest and lowest person score, only when at least two people have one and they differ, and say they compare within the family.
- **Files stay in the app's temporary folder** only while the share sheet is open; the share sheet resolves when it closes on both platforms, so the file is deleted then. Leftovers (the app closed mid-share) go at the next export and at sign-out.
- **No import or restore in the app.** Restoring is a manual job for the developer, from the data file (ids link records to people and facts) and the photos zip (`photos.json` says whose each photo is).
- **New libraries:** `expo-print` (in Expo Go) for the PDF, `fflate` (pure JavaScript) for the zip.

## The daily reminder (2026-11-13)

A gentle daily practice reminder, as a **local notification on the person's own phone**. The rules are in `CLAUDE.md`; this records the decisions.

- **Local only.** `expo-notifications` schedules it on the phone; no push service, no server, nothing synced, no caregiver control, not in Export my data. The caregiver can't see whether it is on.
- **Asked once, at a calm moment:** on the home, after the person's first completed session, never over the wrap-up or practice. One sentence and two big buttons. Not now, or a refusal at the system prompt, is never asked again automatically. Choosing On in the person's settings asks the system then, if it hasn't been asked.
- **Where the person changes it:** a **Reminders** row under the sizes in the Aa sheet on their home, which opens its view in the same sheet (no new screen, no sheet on a sheet). Earlier and Later move the time by 30 minutes, from 06:00 to 21:00, rather than a wheel picker: two 64pt buttons in large type are easier than a spinning control. The Aa button's accessible name becomes "Text size and reminders".
- **One message, one a day, rebuilt.** "Your practice is ready whenever you are." at 09:00 by default. The phone keeps the next **3** days' reminders waiting (`REMINDER_DAYS_AHEAD`) and rebuilds them on every event that could change them. Three, not one, so someone who doesn't open the app for a day or two is still reminded each morning; not more, so a phone signed out or removed while closed stops within three days, and someone who has stopped opening the app isn't reminded for long.
- **Never two in a study day:** one identifier per study day, and a day counts as reminded once its reminder has left the system's waiting list (it fired), whatever the clock says afterwards. A test with the clock set back after a reminder fired found the first version, which looked only at the clock, reminding twice; it now reads the waiting list first.
- **No reminder with nothing to practice** (fewer than two people in the deck), and none today once the day's session is complete. A reminder still in the notification list goes once the day is done.
- **Kept across sign-out:** only whether the question was asked. The reminders themselves are cancelled and turned off.
- **Time zones:** iOS and Android fire a dated reminder at a fixed instant, so after a time zone change while the app is closed, a waiting reminder comes at the old zone's 09:00 until the app next opens. Calendar triggers would follow the wall clock but are iOS-only and behave unevenly across a change; a rebuild on every open covers both platforms the same way.
- **In the app's foreground** a reminder shows nothing: the person is already there.
- **Needs clinician review:** the 09:00 default and the 06:00 to 21:00 range, one reminder a day with no follow-up, three days ahead, and the wording.

## The study day (2026-11-12)

A study day begins at **05:30 local time** on each device and runs until 05:29:59 the next morning, named for the date it began on. It replaces local midnight as the day everywhere: completion, the daily session, the schedule's day steps, Insights and sync. `docs/STUDY-DAY-AUDIT.md` lists every place and what changed; `CLAUDE.md` has the rule.

- **It never limits practice.** After the day's session, Keep practicing is always on the home, at any hour. Rounds begun once the day is complete are **extra practice**: counted in the day's cards, the Memory score and every insight, labelled "Extra practice" on a day's sheet, and left out only of practice time against the standard, so they can't change whether the day was finished.
- **A fresh day at 05:30.** Finishing at 23:00 or 03:00 counts toward that study day; at 05:30 the target and the day's log start fresh, and an unfinished day stays recorded as not completed. Nothing carries over.
- **A round in progress at 05:30** runs on undisturbed and counts toward the day it began in: its cards, its progress bar and its log. Scheduling uses the study day of the moment each card is finished.
- **Day steps** (1, 3, 7, 14) fall due at the start of a study day: a card finished at 02:00 with a 1-day step is due at 05:30 that morning.
- **The device's clock only moves forward** (`src/data/study-clock.ts`), so a clock set back or travel west can't give out a day's session twice. Set forward then back, the day reached stays until real time catches up; practice is never blocked meanwhile. Travel east begins the new local day by the new local time.
- **Stored with each row.** Sessions and card records keep the study day their round began in, worked out on the device, so a late upload after days offline lands on the right day; rows from before fall back to their time.
- **Paired phones** read the family's sessions (never write them), so a day finished on one shows on the other by its key, never a 24-hour window. This loosens "a person reads only their own sessions": sessions hold times and counts only.
- **The person's words** after the day: "Nice work." and "You can keep practicing, or come back in the morning." The wrap-up says the same; "All done today." is gone, as it could read as practice being over.
- **Needs clinician review:** the 05:30 start, that an unfinished day doesn't carry over, and how extra practice is treated (counted in the score, not in the standard).

## Add a person, refined (2026-11-12)

Screen 5 and the approval that follows it, made consistent and slimmer. `docs/ADD-PERSON-AUDIT.md` has the audit, each finding's cause and what wasn't changed. No new screens, no schema change, and nothing person-facing changed.

- **One flow of eight steps.** The quick first screen is now **Step 1 of 8** ("Who they are"), and Review is Step 8. Every step has the same slim header: the bar, "Step N of 8 · X% complete" and Finish later (Review too). Each step has a short title and a one-line helper (`helper` on each section in `src/data/questionnaire.ts`). Basics is renamed "Names and dates". The count stays at eight because `people.profile_step` is checked `between 0 and 7` on the server: a ninth step would need a schema change.
- **The percent, defined.** Each required question done (answered or "Not applicable") is worth 20 points; each optional question answered adds 3, at most 15, and only while something required is missing (`COMPLETION`, `profileCompletion`). So **100% still means exactly what the 100% gate says**, and nothing optional can reach it: the most an incomplete profile shows is 95%. A question counts once however many answers it has; the best clue counts; the list of hint facts doesn't. It replaces "the percent counts only those [required questions]" from 2026-11-04, at the user's request, because the bar sat still across the four steps with nothing required (20% from Basics to Family and home). On the form it is worked out live from what is typed (`withAnswers`), not only from what was saved. "Draft, X% complete" on the People tab and the sheet uses the same figure, so a draft with optional answers reads a little higher than before.
- **Notes once.** "* Required" only on steps with a required question (the first, Interests, Shared memories: `hasRequired`). The facts-only line in full on the first step; after that a small "Facts only" link that opens it in place.
- **One field pattern.** A step is one card; only a heading (Home, Family, Favorites) starts another (`startsGroup` is gone). A fact's follow-ups ("This may change", its month, a memory's year and photo) sit under it with no hairline between. Every add-more action is the same row inside the card, a ⊕ and the words, including "Marital status or situation" and "Add something else", which used to float below. "Not applicable" is always at the end of the question's label line, and no longer inside the relationship list. The photo is an 80pt preview that is itself the button, with Choose a photo beside it.
- **Narrower column.** The form and story approval center in 520pt instead of 640, so short answers don't read as hugging the left of a wide row.
- **The keyboard** says Next and moves to the next typed field; the last says Done (`FieldChain` in `src/components/caregiver-ui.tsx`).
- **Nothing typed is lost.** Back saves first, as before. Words typed in the hobbies' "Other" become a chip when the field is left; words typed in a list's "Something else" are kept when the list is closed; leaving a new person who has answers but no name asks first, since nothing can be saved without one.
- **Review's way on is Continue.** Disabled below 100% and showing the percent ("Continue · 60%"), enabled at 100%, opening story approval. Someone the caregiver took out of practice still sees "Add June to practice", since it also puts them back (`reviewAction`). "What's left" opens the step of the first missing item, brings the question into view, focuses it if typed and shows its note; that step's button reads "Back to review". Every other step's button is **Next**, never gated, because the required questions are on three different steps.
- **Resume profile.** "Finish profile" on the sheet is now "Resume profile", with where it picks up: "Picks up at step 5 of 8, Interests." (`resumeLine`).
- **Approve all on story approval (screen 6).** Pinned beside Done: "Approve all 12" approves, in one tap, exactly the stories one tap each would (`storyApproval` in `src/lib/approve-all.ts`, built on the sheet's `approvalPlan`). Skipped stories stay skipped, every story keeps its words, a story open for editing is left out, and a fact that may change keeps its own Confirm. It never approves an AI sentence, which this screen doesn't show. Disabled ("Approve all") when nothing can be. A toast with Undo, the sheet's words ("Approved 6. 1 needs your confirmation."). **No confirmation dialog here**, unlike the sheet: every story is on this screen, which is what the sheet's confirmation shows, and Undo covers a slip. Long sentences stay in and keep their note. Per-story Approve, Edit and **Skip** stay: the brief said "Reject", but Skip is the app's word and gentler.

## Sign-in, on by default (2026-11-11)

Sign-in is part of the product now, not a switch left off: `AUTH_ENABLED` is true unless the app is started with `EXPO_PUBLIC_LOCAL_ONLY=1` (`npm run start:local`), which keeps the local-only mode for development. No new screen: screen 1 is a few steps, as screen 5 is a few steps of the questionnaire. Built from the existing pieces and tokens; `DESIGN-UI.md` has the look.

**The steps of screen 1** (`src/app/sign-in.tsx`, the steps in `src/components/sign-in/`). Every step has a plain Back, and Android's back button goes back a step.

| Step | For | What it is |
| --- | --- | --- |
| Welcome | Everyone | The logo, "Welcome", one line, and two large buttons: **I am practicing** (filled) and **I am a caregiver**. The person's large type. |
| Hello | The person | "Hello", User ID, Password with Show, and one big **Continue**. Their own Text size, 48pt targets, one action, nothing timed. |
| Caregiver | The caregiver | **Sign in** or **Create an account**, on the compact scale. |
| Create an account | The caregiver | Email, Password and Confirm password (both with Show), a strength hint, the consent the database requires, a short privacy line and a **Privacy** link to the full notice (a sheet). |
| Check your email | The caregiver | Only when Supabase sent a confirmation email: **Continue** once the link is opened, **Send the email again** after a minute, **Enter a code instead**, **Use a different email**. |
| Sign in | The caregiver | Email and Password (Show), **Forgot password?**, **Create an account**. |
| Reset password, then Check your email | The caregiver | The email to send to; then a calm confirmation that never says whether the address has an account, the code from the email and a new password with its confirmation. Saving signs in. |

**Decisions.**

- **Confirm email is read from Supabase's answer, never set in the app.** A sign-up that comes back with a session is signed in and goes straight to the caregiver home; one without goes to "Check your email". Its link opens in a browser (Expo Go can't receive it), so the step's **Continue** signs in with the password held in memory for that step only, and the app does the same by itself when it comes back to the front. A code works too, where the email template has one (`README.md`, Before launch).
- **Nothing says whether an account exists, where Supabase allows it.** A mismatch reads the same for a wrong password and an unknown address; Forgot password answers the same for any address; with Confirm email on, signing up with an address that has an account looks exactly like a new sign-up (Supabase sends nothing). With Confirm email off Supabase does say so, and the words stay neutral: "If you already have one, sign in or reset your password."
- **Calm words for everything Supabase can answer** (`src/lib/auth-form.ts`): no connection or a server that can't answer ("check the internet connection and try again"; the button is the retry), too many tries or emails (Supabase's limits), its own password rules, an address it won't mail, an expired code. Never "wrong", "error", "invalid" or "failed", never red. The app's own short pause after five misses stays, beside Supabase's limits.
- **Passwords.** At least 8 characters, with a strength hint that encourages longer (three slim segments in blue, and a few words: easy guesses and the email's own name are called out, nothing is refused for being long). Every password box is hidden until **Show**. Never logged, never stored, never shown once saved: the caregiver's form for the person's login now hides it too, with Show, where it used to show it as typed.
- **The session lives in secure storage** (`src/lib/session-storage.ts`, `expo-secure-store`: the Keychain or Android's Keystore), in pieces under 2048 bytes, readable after the phone's first unlock and never restored onto another phone. A session an earlier release kept in AsyncStorage moves there on first read. **"Keep me signed in" is gone:** a phone stays signed in until someone signs it out, and Sign out is always in Settings.
- **Opening the app.** A phone that signed in opens straight to its home from the kept session and saved profile, without waiting for the server. Found while building it: with an expired token and no connection, supabase-js retries the refresh for about 25 seconds and then reports no session (while keeping it), which would have held the person's phone on the splash screen and then shown the welcome. Now it stays signed in and refreshes once online. A session the server refuses (a new password elsewhere) signs out; secure storage that can't be read for a moment is told apart from an empty one and clears nothing.
- **The person is never asked again** unless the caregiver signs that phone out: by holding Caregiver on the person's home and confirming, by giving Their login a new password (the phone asks for it at its next refresh, within the hour), or by deleting the account. No person-facing screen reaches an email or any account detail; the person's first name is the only thing of the account they see ("Hello, Rose.").
- **Signing out clears what the phone kept from the server**, however it happens (Settings, the hand-back, Delete account, a refused session), for any login it kept a profile for (`src/data/forget.ts`): the saved profile, the family in memory, the person's copy of the deck and today's log, the caregiver's copy of Insights, and the image cache. Practice and card records not yet sent stay, holding ids and numbers only, and go when that login signs in again. The text size and the local-only family aren't server data and stay. With no connection the phone forgets the session by itself; it then expires on the server unused.
- **Settings** (caregiver): "Signed in as" with the email, Their login, **Change password** (the current password first, so a phone left unlocked can't change it), the privacy notice (since 2026-11-13 the privacy policy, what the app stores and research use), **Sign out** and **Delete account**. All but Their login show even when the family couldn't load.
- **Choices the brief left open:** the sign-up form is the brief's three fields, so the optional first name is gone (nothing shows a caregiver's name). The person's error is the brief's sentence word for word ("That did not work…"), although the copy elsewhere prefers "didn’t". The welcome's filled button is "I am practicing", the path an older adult is most likely to need. AI questions need sign-in off (`AI_AVAILABLE`), so with sign-in on by default they show only in the local-only mode, as does the family kept on the phone with its 7 real cards.

## Pairing the person's phone (2026-11-11)

The person creates their own account on their own phone with the caregiver's email and a PIN the caregiver creates in the app, which links the phone to the family through the backend. The User ID and password login ("Their login") stays as the other way in. No new screen: the caregiver's side is a sheet in Settings, the person's side is steps of screen 1. Built and checked in PGlite, against the real function in Node and an in-memory Supabase, and in the web build; not yet against the live project or on two phones (`HANDOFF.md`).

**The flow.**

| Where | Who | What |
| --- | --- | --- |
| Settings → Pair the person's phone (a sheet) | The caregiver | **Create a PIN**: six digits in large type, "Expires in 14:59" counting down, **New PIN** (the old one stops working), and "What they need: Your email and this PIN." Once a phone that wasn't linked appears, the PIN goes and "Phone 1 is linked." takes its place. Then a disabled **Send the PIN by email** ("Not available yet"), and **Linked phones**: each phone's name, "Paired today", "Last seen today at 3:42 PM" and **Remove phone**, which asks first. |
| Screen 1 → I am practicing | The person | Two large options: **Create my account** (filled) and **Sign in** (the User ID and password, as before). |
| Create my account, step 1 | The person | "Your caregiver's email": a large field, the email keyboard, one Continue, a plain Back. |
| Create my account, step 2 | The person | "The PIN from your caregiver": large spaced digits, the number pad, one Continue, Back to the email (still typed). A failure, whatever it was: "That did not work. Please check with your caregiver." |
| You are all set | The person | The logo's mark, "You are all set" and "Your home is opening.", then their home, signed in for good. |

**The security rules** (the hard rule in `CLAUDE.md` holds them all):

- **The server decides.** The `pair-phone` Edge Function is the only code that makes a PIN or a login. It holds the secret key and the pepper; "Verify JWT" is off only because redeeming is the public way in, so it checks everything itself. The link is a person profile in the family, and Row Level Security enforces what that login may do: exactly what the User ID login may (read the approved deck and the practice settings, write its own practice and card records), nothing more.
- **The PIN** is 6 random digits, stored only as HMAC-SHA256 keyed with `PAIRING_PEPPER` (a stolen table can't be used to try PINs), compared in constant time, for 15 minutes, used once (atomically, so two phones can't both pair with it), spent after 5 wrong tries, and replaced by a new one. The caregiver's phone holds it in memory only.
- **Guessing is limited, and that is tested:** 5 tries per email and 20 per IP address in a sliding 15 minutes, counted one try at a time so a burst can't slip past, a ceiling of 500 tries across everyone, 10 new PINs an hour per family, and a kill switch, all in `pairing_settings`. The limits keep keyed hashes, never an address. With 5 tries per PIN, a guess succeeds 5 times in a million at most.
- **Nothing tells failures apart:** every failed redeem gets the same 400 `{"error":"not-paired"}`, with the same headers, after the same 1.5 seconds, whether the email has no account, the PIN was wrong, used, expired or spent, a limit stopped it, or pairing is off. Only no connection reads differently on the phone, since that says nothing about any account. Nothing logs a PIN, an email, an IP address, a token or a credential.
- **No password for the person.** The function makes a login for the phone (`<uuid>@phone.evermore.invalid`) and a long random credential (256 bits). The phone keeps both in `expo-secure-store`, this device only, and uses them to get its session back if it is ever lost, so the person is never asked anything. If the phone is replaced or removed, the caregiver creates a new PIN.
- **The caregiver's email on the person's phone** is typed there only to pair: held in memory while the steps are open, cleared once used, autofill off, sent once over HTTPS, and never kept. After pairing no screen shows it or any account detail.
- **Remove phone** marks the phone removed, and from that moment `my_caregiver()` refuses its login everywhere: it reads and writes nothing, photos included, whatever its token says. The function also bans the login (its session can't refresh, within the hour at most) and changes its credential. The phone returns to the welcome as soon as it checks in (`device_seen`: when practice refreshes on opening, on the home screen and on coming back to the front, and when the connection returns), and forgets the pairing. Its practice history stays for the caregiver.

**Decisions.**

- **Several person logins per family.** The schema allowed one person login per family (`profiles_one_person_per_caregiver`). It now allows one User ID login (`profiles_one_named_login_per_caregiver`) and any number of paired phones, each its own login, so one phone can be removed without touching another. Practice rows are per login, as before; a new phone starts from the schedule each card reached on the family's other phones, so replacing a phone loses nothing. `manage-family` finds the User ID login by its username, and deletes every person login with the family.
- **Device name** is the phone's own (`expo-device`), tidied and cut to 40 characters; with none (the web, or a phone that gives none), "Phone 2". Shown only to the caregiver.
- **The tries count per caregiver email, whether or not it has an account,** so a lockout can't reveal one either. Someone who knows the caregiver's email can keep them locked out for 15 minutes at a time; the caregiver then waits, or pairs later.
- **"Per code"** is per PIN: 5 wrong tries spend it.
- **The IP address** is the first one forwarded. A caller can make that up, which only spends their own tries; the per-email, per-PIN and global limits hold whatever it says.
- **"You are all set"** shows for a second and a half before the phone signs in and their home opens; there is nothing to tap. If signing in can't happen just then, a calm note and **Try again**.
- **On a failure** the PIN box empties and the email stays typed (in memory only) for Back; leaving the steps or pairing clears both.
- **Last seen** is when the phone last checked in: whenever it opens or refreshes practice, and when its connection returns.
- **The User ID login isn't in Linked phones**: Their login, in Settings, still resets and so signs out that phone.

## The Memory score (2026-11-10)

- **Renamed.** The daily Practice score is now the **Memory score** on every screen, chart, calendar, sheet and next step, with the sign-in-on views reading the same components. Its formula, bands and minimum of 10 cards are unchanged. This deliberately supersedes the rule that kept "memory score" off every screen; the other banned words stay banned. No PDF exists (data export isn't built), so there was no PDF text to change.
- **What it may never be said to do.** Diagnose, track or measure the progression of, or predict any condition, or compare people. The copy check in `scripts/check-logic.mjs` refuses those claims wherever the score is named, and Insights name no condition at all, not even to deny it: "not a medical measure" says enough.
- **Next to it, always:** "Practice activity, not a medical measure." under the hero's score, under its chart, at the foot of the calendar, in each day's sheet and in "What is this score?".
- **Its own pink.** A small family of rose pinks sampled from the logo's brain (outline `#FFB8D2`, folds `#F192B6`), light to deep, used only for the Memory score: its figure and Top band badge, its line over time and the chart's band backgrounds behind it, the calendar's shading and the key. Lower scores are lighter, so a low day never reads as a warning. The calendar's Completion view keeps its blues.
- **The score range key.** Under the hero, folded on the calendar ("Show score ranges", score view only), and at the top of "What is this score?": a bar of the four bands' pinks on the score chart's scale (the floor of 30 to 100), each cutoff labelled, a mark where random guessing would score, and each band's name and range as a row whose tap shows what it means. Every number comes from `scoreKey` in `src/lib/insights.ts`, which reads `SCORE_BANDS`; the component writes none. **The chance mark** is worked out from the answers the records offered (`chanceScoreOf`): about 63 with three names, 80 in a two-person family, and 63 with no records. It is kept plain on purpose: the Insights layout is to be redesigned.

## Swiping between days (2026-11-10)

The day sheet (opened from the calendar, in its Memory score or Completion view, since both open the same sheet) now steps through days without closing. **A swipe left is the next day, a swipe right the day before**, one calendar day at a time, practiced or not: a day without practice says "No practice" and "Nothing counts against a day without practice.", a day under 10 cards how many a score needs. The days run from the earliest day with records shown (with "Include archived people" as it is set) to today: never a future day, and the ends simply bounce. Each page has the date and the Memory score at the top, with the note under it; the header holds "Nov 7" (or Today, Yesterday) between previous and next arrows (44pt, disabled at the ends), and the score's block carries VoiceOver's "Next day" and "Previous day" actions, so nothing depends on the gesture. Behind the sheet the calendar turns to the day's month and marks the day (a soft tile and a ring in the text color, apart from today's blue ring), and keeps it marked after closing.

- **How it slides:** a horizontal paging list inside the sheet's vertical scroll, its neighbors already drawn, so a swipe shows them at once and dragging down still scrolls and closes the sheet. **With Reduce Motion** nothing slides: one day at a time, crossfading in 250 ms, and a swipe moves a day only once it lets go.
- **The same either way:** `pagerDays` and `stepDay` in `src/lib/insights.ts` read the same `InsightsView`, so sign-in off and on step through the same days with the same pages (checked with the same records kept on a phone and read back through the server's rows).
- **Choices:** "the earliest date that has any data" is the earliest day with a record in the view, the same day the calendar's month buttons go back to. "Scrolls to the selected day" is the calendar turning to its month: the calendar is already on screen when a day is opened. A page indicator was left out (optional in the brief).

## Approve all, per person (2026-11-10)

On each person's sheet (caregiver only), a "Waiting for approval" row opens the list of everything waiting for them, in the sheet's own place like the AI queue: stories as practice will show them (with the Test data tag), AI sentences with the facts they came from, and what needs a deliberate look, each saying why. **Approve all** is at the top of that list, and on the sheet itself once the list has been opened for that person in this session (memory only, never saved). It opens a short confirmation in the same sheet: how many stories and new questions, "Show them" for the items themselves, how many will stay waiting, and for a draft that they reach practice once the profile is complete. After approving, a toast in the sheet says "Approved 8. 2 need your confirmation." with Undo.

- **What it approves:** waiting stories that aren't facts that may change, and new AI sentences (not edited, not flagged) that pass the checks against the facts as they are at that moment. Each goes through the same rule as its own button (`statusChange`, `approveSentence`), in `src/lib/approve-all.ts`; ids beyond what is eligible are ignored even if passed.
- **What waits, and says so:** a fact that may change (it needs its own Confirm), an AI sentence the caregiver edited, one flagged because a fact changed, and one that no longer passes the checks.
- **Never bypassed:** the 100% gate (an approved story for a draft still waits for the profile), the checks, the source facts shown with each sentence, archived people (no approvals at all) and test data (approved on the phone as one tap would, never sent).
- **Undo** puts each story and sentence back exactly as it was, unless the caregiver has changed it since. With sign-in on it is one write each way, filtered on the server to waiting, undated stories; AI sentences don't exist there.
- **On story approval too** (since 2026-11-12): the same rule for stories, in one tap with Undo and no confirmation, since every story is on that screen. See [Add a person, refined](#add-a-person-refined-2026-11-12).
- **Choices:** "edited items awaiting re-validation" are AI sentences the caregiver edited: a story the caregiver rewords is their own words again, and nothing records that it was edited. "The pending list" is the list in the sheet, not story approval (screen 6), so the AI sentences Approve all would approve have been on screen too. The existing "Approve all valid" inside the AI queue stays as it was.

## Insights as its own tab, in pink (2026-11-10)

Two earlier verdicts changed on purpose. **Insights is a top-level caregiver tab** (screen 8 in the budget, now 8), between Trends and People, rather than a view under Trends; Trends is Activity alone, unchanged. **Pink is the Insights brand accent,** not only the Memory score's color: the tab's brain and chosen state, the page header and segmented controls, chart colors (pink first, blue for a second series), card accents and the soft tint behind the hero. Text and surfaces stay neutral, the pinks stay soft rose and never red, a low score is never deeper than a high one, and none of it reaches a person's screen (checked by following every import from those screens). The caregiver tab bar moved to the bottom, five tabs of icons over short labels that fit the smallest iPhone without wrapping, and the dashboard's large logo became a compact header.

**The redesign of the same day** (`DESIGN-UI.md`, "The Insights redesign"): four sections behind a sticky control (**Overview**: the score as a ring in one hero card, the ranges folded under it, the score over 30 days, what stands out and next steps; **Answers**: how answers were found and answer speed; **People**: whose cards came up, each with a page; **Days**: the score calendar, now showing each day's score, and practice time). Every chart is drawn by one shared frame. "How answers were found" says **Right away** (the first name chosen), **On a second try** (another name first, then usually a hint) and **With help** (a third try or later); whether a reveal card's "?" was tapped is never recorded, so it can't be one of them.

- **Choices the brief left open:** *A person's page* didn't exist, so People has one per person, headed by the same ring showing the **Memory score of that person's cards over the last 14 days**: the same points and the same minimum of 10 cards as a day's score (`personScore`), labelled as such, never ranked. *The summary bar* covers the last 14 days (the window every other figure uses), with each day as its own bar under it. *Percentages* are whole and always add to 100 (largest remainder). *The chance line* is in words from the answers actually offered ("about 1 in 3", "1 in 2" in a two-person family) and hidden without records. *The score line's range* is 50 to 100, lower only when a day scored lower, so the bands share the height; the ring itself is always 0 to 100.

## Insights (2026-11-09)

A caregiver-only view (under Trends until 2026-11-10, now its own tab), the one exception to the completion-only dashboard (the rule is in `CLAUDE.md`). It describes practice, never memory or health, and compares the person only with their own earlier practice. Every number below lives in `src/config/insights.ts` and every figure comes from `src/lib/insights.ts`.

**What is kept.** One record per card practiced (`src/lib/attempts.ts`): whose card and which question (the card, the phrasing, its shape, the kind of fact, a template or an approved AI sentence), the session, when it came up, each answer chosen in order with its time, how many answers were offered, the hint rungs shown, whether it ended on the right answer, the day's target, and active time. Kept for 120 days: on the phone with sign-in off, and with sign-in on on the server, uploaded from the person's phone (next section). Records began on 2026-11-09; earlier days show nothing rather than a guess.

**Not kept, on purpose:** whether a card started behind the "?" and whether the "?" was tapped. The hard rules make that tap a free hint that nothing records, and keep who is unlocked unsaved and unseen. So "the third choice or with the reveal" in the brief is the third choice or later.

**Active time.** Time on a card counts only while the app is in use. Time in the background never counts, and no stretch between one tap and the next counts for more than a minute, so a phone set down mid-card doesn't run up minutes. For averages and totals a card counts for at most 90 seconds.

**The day's cards.** Every figure counts the day's cards that ended on the right answer. Cards that came back after a hint (a re-ask or the review pass) don't count, as for completion, and nor does a card left with Home before it was answered.

- **How answers were found** (selection accuracy, in the code): of the cards in a window, the share found on the first choice, the second, and the third or later. A stacked bar for each day of the last 14. The chance level is always drawn: choosing at random finds the right answer first 1 time in the number offered, so about a third with three answers and a half with two. No share is shown from fewer than 5 cards. The screens never say "accuracy", which the rules keep out of the UI.
- **Answer speed:** the middle time (median, never the mean) to the first choice, for each day and for each person whose cards came up, from at least 5 cards. Its own chart, with the reminder that speed varies for many reasons: the time of day, sleep, mood, how a question is asked. It never feeds the Memory score.
- **Practice time against the standard:** each day's active time against its target times `SECONDS_PER_CARD` (14 seconds, so 504 seconds for a Standard day of 36 cards). From 80% of it the day "met the standard"; from 60%, "about the standard"; below that, "short of the standard". A day whose target wasn't finished is "partial: some cards left for later", whatever its time, never a failure.
- **The daily Memory score, 0 to 100** (called the Practice score until 2026-11-10). Each of the day's cards earns points for the choice it was found on: the first 1, the second 0.6, the third or later 0.3. The score is the average, out of 100, rounded. A day of 6 first, 3 second and 1 third choice scores (6 + 1.8 + 0.3) / 10 = 81. A day needs at least 10 such cards for a score; otherwise it says "Not enough cards". A day without practice has no score at all: no zeros, no streaks, nothing that counts against a missed day. Even a day of every card on the third choice scores 30.
- **Bands,** from each band's lower edge: Getting started (below 65), Building (65), Steady (80), Strong (90). They are soft backgrounds on the score chart, never a pass or a fail. **The chance level shapes them:** choosing at random scores about 63 with three answers offered, and 80 with two, because every card ends on the right answer. So the bands start above 63, and "What is this score?" says so: the score is a summary of practice, best read against the same person's other days.
- **How practice is going:** the mean points per card over the last 14 days against the 14 before, for the same person only. It needs at least 10 cards in each window and at least 7 days of practice across both; otherwise there is no label. A change counts only if it is at least 10 points and at least twice its standard error, so ordinary day-to-day variation reads as "steady". Labels: "Gently improving", "Steady", "Needed more support lately", with "early read" while either window has fewer than 30 cards. There are no alerts and no notifications.
- **What stands out** (up to 3), rule-based, about the last two weeks: the trend, most cards found on the first choice, how often practice time met the standard, partial days, days with too few cards for a score, and whose cards needed the most support (only when clearly below the rest, over at least 10 of their cards).
- **Suggested next steps** (up to 3), each opening the right place: look over someone's photo and hints, or add stories about someone with fewer than 3 approved, on their sheet; a shorter session length after 3 partial days in the last 7; reveal cards for a gentle challenge after 3 Strong days in the last 5 scored, if they are off.

**With sign-in on (since 2026-11-10)** the person practices on their own phone and the caregiver reads Insights on theirs, from a table the person's login can only write and the caregiver's can only read: see the next section. `attempts`' correctness columns stay write-only, as the rules ask.

## Insights with sign-in on (2026-11-10)

With sign-in on, the person practices on their own phone and the caregiver looks at Insights on theirs. The records have to travel from one to the other, through a table the person's login can only write and the caregiver's login can only read. **Built and checked** (see `HANDOFF.md`); not yet run against the live project or on two phones.

### The audit: what reaches the server today

- **Completion.** The person's phone keeps an outbox (`src/data/practice-store.ts`). The moment the right name is chosen, each card queues three upserts, sent in order: the session (`sessions.cards_completed`, `daily_goal`), the attempt (`attempts`: card, session, time, and `tries`, `first_try_correct`, `hints_used`, which nobody can read back) and the card's schedule (`card_schedule`). The caregiver's dashboard (`src/data/activity-store.ts`) reads 30 days of sessions and a week of `attempts.card_id` for Today, Trends → Activity and the calendar's Completion view.
- **Insights.** Each card's record (`src/lib/attempts.ts`) is made when the person leaves the card, because its active time includes the read-back. It is kept only on the phone, under `evermore.attempts.v1.<YYYY-MM>`, and only with sign-in off; with sign-in on `recordAttempt` does nothing.

### The decision: a new table beside `attempts`

Records go to their own table, `attempt_records`, one row per card shown. They don't extend or replace `attempts`, for four reasons:

1. **A different moment.** An `attempts` row is queued at the right name, so the card counts even if the app closes before Next. A record is complete only once the card is left. One row for both would mean the person's login updating rows, or the schedule waiting for Next.
2. **Different rows.** A record exists for a card left with Home before it was answered; `attempts` has no such row (it needs `tries` of at least 1).
3. **Different readers.** Grants work per database role, and the caregiver and the person are both `authenticated`, so a column the caregiver may read the person could read too. A table of its own gets its own policies: the person's login can only insert, the caregiver's can only read, and delete.
4. **The hard rule stays exactly as it is.** `attempts.tries`, `first_try_correct` and `hints_used` stay write-only for everyone, and the completion dashboard keeps reading exactly what it read.

**One source for each figure,** so two tables can never disagree:

| Figures | Source | Never read from |
| --- | --- | --- |
| Completion: Today, Trends → Activity, the calendar's Completion view | `sessions` (and `attempts.card_id` for times practiced) | `attempt_records` |
| When each card comes back | `card_schedule` (`attempts` is its write-only log) | `attempt_records` |
| Every insight: the Memory score, bands, shares, speed, practice time, the trend, the score calendar | `attempt_records` (sign-in on), or the phone's records (sign-in off), through `src/lib/insights.ts` | `sessions`, `attempts` |

What the tables share (a card id, a session id, a time) identifies things; no figure is worked out from both.

### Data flow

```
Sign-in off: one phone
  practice card --on leaving the card--> evermore.attempts.v1.<month> --> Insights (src/lib/insights.ts)

Sign-in on: two devices
  The person's device (the person's login: writes only)
    practice card --at the right name------> outbox --> sessions, attempts, card_schedule
                  --on leaving the card----> record queue, saved first --> attempt_records (insert only)

  The caregiver's device (the caregiver's login: reads, and deletes with a person or the family)
    sessions, attempts.card_id --> Today, Trends -> Activity, the calendar's Completion view
    attempt_records, last 120 days, in pages
      + records still queued on this device
      + the cache on this device                 --> Insights (the same src/lib/insights.ts)
```

### What a record holds, and never holds

- **Holds:** ids only (the record's own, made on the practice device so a retry can't duplicate it; the family; the person's login; whose card; the card and the way it was asked; the session), the shape, the kind of fact, template or AI, when the card came up, each choice in order with its time and whether it was right, how many were offered, the hint rungs, whether it ended on the right answer, active time, time to the first choice, the day's target, and whether the card came back after a hint. "Card type" in the brief is the shape plus that last flag.
- **Never holds:** a name, a photo, a sentence, a fact's words or any free text. The table's types and checks refuse them: the way a card was asked must be one of the fixed shape ids or an AI sentence's id. Whether a card started behind the "?" and whether it was tapped are never recorded, as with sign-in off.
- **Never uploaded:** test data and the demo (both phone-only, with sign-in off), records of a test fact, and records about anyone outside the signed-in family.

### Retention and deletion

- **Kept 120 days, as on the phone.** The app reads the last `ATTEMPTS_KEPT_DAYS`, and each upload removes that family's records older than a day past it.
- **Archiving keeps them.** Insights leave archived people out by their `archived_at`, until "Include archived people" is ticked.
- **Deleting a person permanently removes their records** with the row (a foreign key on whose card it is). A removed fact keeps its records, as on the phone. **Deleting the account removes all of it,** with the logins.

### The roles

- **The practice device, signed in as the person,** makes each record exactly as with sign-in off, saves it in its queue, and uploads it in the background in small batches, with retries that wait longer each time. It never reads a record back, never shows anything new, and never waits on the network.
- **The caregiver's device, signed in as the caregiver,** reads the family's records for the window, keeps a copy for quick and offline opening, adds any records still queued on that same device, and feeds them to the same `insightsFor` as sign-in off. It never writes a record.

### The one-time backfill

The brief asks for the phone's existing records to be uploaded when sign-in is first turned on. Those records belong to the family kept on the phone with sign-in off, and that family never goes to the server: the 7 real family people must never be uploaded, and their ids (a person's id and card ids such as `<id>-0`) hold first names. With sign-in on the family is a separate one on the server, with its own ids. So the backfill uploads, once, only records whose person is in the signed-in family and that aren't test data. Today that matches nothing, until a way to move a family to the server exists.

### How it works, in numbers

- **Uploading.** Each record is saved in the phone's queue before anything is sent, then sent in batches of 25 as a plain insert: the person's login can't read records, so it can't ask the server whether one is already there. A record the server already has (a resend after a lost reply) is refused as a duplicate and counts as sent, so a record is never kept twice. One about someone deleted for good is refused by the foreign key and goes with them. Anything that keeps a batch from going (no connection, signed out, the server busy, the schema not rerun yet) is tried again after 2 seconds, doubling each time up to 5 minutes, give or take a fifth. With no connection the queue simply waits for one. It sends on each card, when the app opens, and when the connection or the app comes back.
- **Reading.** The caregiver's phone asks for the family's records from the last 120 days, a thousand at a time, oldest upload first; after that, only what the server took since the newest it has, less 5 minutes in case an upload landed late. Records still queued on the same phone (when the person practiced on it) join them, each record once.
- **The copy on the caregiver's phone.** The records, when they were fetched, and what Trends need to show them (each person's name, whether they are archived or in practice, which facts are approved, the settings and 30 days of sessions; no facts' words), so Trends and Insights open at once, and offline after a restart. It goes when the caregiver signs out or deletes the account here.
- **On screen.** A calm "Last updated today at 3:42 PM" at the top of Insights. Opening Insights fetches what is new, and pulling down fetches the whole window again (on phones; the web has no pull). The first time on a phone, a caption while the first fetch runs, and a calm notice if there is no connection. Insights no longer say they need sign-in off. The person's screens don't change at all.
- **The privacy notice** (shown with sign-in on) now says what the records hold, that only the caregiver can read them and for how long. It said how cards went was never shown on any screen, which Insights make untrue.

### Choices the brief left open

- **"Memory score"** was the Practice score: the rules then kept "memory score" off every screen. (Renamed on 2026-11-10: see "The Memory score".)
- **"Card type"** is the shape plus whether the card came back after a hint. Whether it was a reveal card is never recorded (the hard rules).
- **"test_data (demo and sample)"**: test data and the demo stay on the phone. The 5 sample people seeded on the server are ordinary people of the family there, so their records are uploaded like anyone's.
- **The window** is the 120 days the phone keeps, not 90, so both ways show the same days.

## Question refinement (2026-11-11)

From an audit of every template and shape (`docs/QUESTION-AUDIT.md`, which has the before and after wording and the reasons). Two points rest on published evidence: spaced retrieval at expanding intervals with errorless cueing, and incidental re-exposure of face-name pairs reducing forgetting in amnestic MCI. **Everything else is a design assumption, not a finding, and nothing claims practice helps memory.** No data, photo or schema changed.

- **Names that sound alike aren't offered together** (`soundsAlike`): the same first letter, or a spelling a letter or two apart. That also keeps the letter hint useful. Only a deck with nothing else falls back to them. When it costs fresh names, the rotation still moves the right name's place, so the hard rule holds.
- **The hint ladder** is now another fact, the relationship, the first letter, fewer names, then **the answer itself** ("It’s June.", that name's button selected). This replaces "with the defaults the first two misses read as they always did". The relationship rung is skipped when the card already says it, and on reverse cards. The stored rungs and the schema are unchanged (`HINT_RUNGS`). Insights record the same rungs.
- **Cue fading** (`CUE_FADING`): the relationship cue while a card is new or needed a hint, one fact as it climbs, and the face alone or a reverse card only from step 2 and 3. It is a preference inside the existing tiers, never a lock. Measured on a four-person deck, it leads about a third of new cards and about 2% of cards on step 4.
- **"Who is this?" comes last** on a who card, after its fact, like every other question card.
- **The answer never shows in the question:** a shape that would say the name is left out, and a card left with no way to ask isn't practiced.
- **Expanding re-asks within a session:** about 1, 2, 4 and 8 minutes as cards, at most 8 a session. This replaces "the re-ask stays, once". A first-try answer moves a card to the next gap; another hint starts the series again.
- **"Today you saw"** on the wrap-up: up to 6 faces and names, everyone with a photo whose card came up, in first-seen order, so it reveals nothing about answers. It replaces the line of names, which stays when no one has a photo.
- **AI:** 14 words asked, 16 enforced (was 18 and 22), active voice, no double negatives, a question always last, and `lives_with` is no longer a reverse kind.
- **Story approval** notes "Shorter sentences are easier to read." under a sentence of more than 14 words. A guide, never a block.
- **Not changed:** the fixed predicates (rewording them would change approved sentences), the across-day steps (the server stores their numbers), and re-exposure inside another person's sentence (it would add unapproved words).
- **Needs clinician review:** the same-session gaps and ceiling, the across-day steps, the hint order and when the answer comes, the cue-fading bands and levels, the wrap-up strip, the sound-alike test, and the 14-word guide.

## Decisions changed for archiving (2026-11-09)

Built on the People tab, with no new screen: a section and a sheet. The rules are in `CLAUDE.md` under "Archive and delete" and "Two people to practice".

- **Archive versus delete.** Archiving sets someone aside and loses nothing: their facts, photos, hint settings, approved stories and sentences, schedule and practice history all stay, and Restore brings them back as they were. Delete permanently is the only way to lose anything, and it is offered only once someone is archived, on their sheet, behind a confirmation that names them. Remove, which deleted at once from the person's sheet and from story approval, is gone: archiving takes its place, and deleting moved behind it.
- **No confirmation to archive.** It is fully reversible, so the minus badge archives at once and a calm toast offers Undo for 6 seconds (15 with a screen reader, which has to find it). Delete keeps a confirmation, because it can't be undone.
- **Edit mode, iOS style.** A long press (400 ms, a light haptic) puts a small minus badge on every card. Done, or a tap anywhere else, ends it, and so does a tap on a card, rather than opening it, so a stray tap while editing does nothing surprising. The badge is the palette's dark blue on a white ring, not red. Without the gesture: Archive on the person's sheet, and an "Archive [name]" action on each card for VoiceOver.
- **Archived is stronger than "Include in practice", and separate from it.** Archived people are out of everything practice shows, deselected or not, and leave the main grid for a folded "Archived people" section with a count. Restoring keeps the include setting they had, so someone deselected comes back deselected, and a draft comes back a draft. The brief said both that they return "as an included person" and that they return with the setting they had; the second is kept, because quietly turning a deliberate "off" back on would be a surprise.
- **The distractor rule.** An archived person's name is never offered as a choice. The names come only from the deck, and the phone's memory of names shown earlier only orders them, so an old memory can't bring a name back.
- **The day's target when someone leaves mid-day.** What they finished still counts; their remaining cards go, and nobody makes them up. Because a smaller deck can allow more (fewer people need less spacing), recomputing alone could raise the target and move the bar back, so once anyone leaves, the target can't grow again that day. Restoring or adding someone grows it by their share, as before. Down to one person, a day already begun keeps its progress on Today, next to "Add or restore people to start practicing." With sign-in on, the caregiver's dashboard can't see the person's log, so on such a day it may show a target a card or two smaller than the person's phone.
- **Coming back after a long absence.** Their overdue cards return three a day, longest overdue first, each keeping its step; the rest of their schedule is as it was. A person gets about three cards a day at Standard anyway, so this mostly keeps the oldest first and keeps Practice more from filling with them. Restored the same day, as with Undo, nothing moves. Three is a placeholder like the other pacing numbers.
- **Practice needs two people.** One person alone would be a card with one name on it. With fewer than two there is no target and no session; the person's home keeps its calm line, and Today says "Add or restore people to start practicing." Archiving is allowed down to nobody. With two, every card offers two names, and the fewer-names hint is left out, since it would leave only one.
- **The person's login sees nothing archived,** photos included: it may now read only the photos of people and approved cards it can see (`person_sees_photo`). This also closes the same gap for drafts and deselected people, whose photos the person's login could list before.
- **There are no test-data people,** only test facts on real people, and the sample people's facts are ordinary. So Clear test data clears an archived person's test facts too, and leaves them archived.
- **Deleting keeps the day totals.** Sessions say how many cards were done on a day, with no names in them, so past days don't change when someone is deleted. Everything that names or points to the person goes: photos (a leftover from a failed photo replacement too), facts, approved sentences, schedule, per-card practice rows, today's questions about them and the names last offered.

## Decisions changed for AI sentences (2026-11-05, last of the day)

Built, off by default, within the first hard rule in `CLAUDE.md`. The brief's reasons: the longer daily sessions need more distinct questions than fixed templates give, and new wording tests recall instead of pattern recognition.

- **Local-first, and sign-in off only.** AI needs no login, and people, photos and profiles stay on the phone. With sign-in on the caregiver and the person are on two phones, so approved sentences would have to live on the server, which isn't built: `AI_AVAILABLE` is false there.
- **The strict check is the feature.** A sentence may reorder and recombine, but every word must be traceable to its facts, their kind's fixed words, the relationship or a short list of small words, and every content word of a cited fact must stay. That rules out softening as well as invention. It also means some good sentences get dropped: fewer true sentences beat many doubtful ones. How many survive from the live model is not yet known.
- **Every proper noun is masked, not only people.** A place can't be told from a person in free text, so all of them go. Months, weekdays and "I" stay, as ordinary words. Card ids go too, because an id like `nora-0` holds a name. Writing with no capitals can't be read for names at all, so a fact in it stays on the phone.
- **Real family, held back by person.** The brief says their cards keep the test_data flag, but the 7 deck people's own facts carry no flag, so they are held back by person (`HELD_BACK_FROM_AI`) as well as by flag. Their sheet says "These facts stay on this phone."
- **The consent says less than the brief's "Nothing is saved."** Evermore can promise that for itself but not for the AI service: Anthropic doesn't train on API data and may keep it for a limited time under its own policy, longer if flagged. The first line is the brief's; the second says this. A zero-data-retention agreement with Anthropic would make the original wording true.
- **Flag off shows nothing at all.** The brief asks both for a calm message and for the app to behave exactly as today; the second won. A calm line shows only when the flag is on: offline, off in Settings, off for this person, or a real family person.
- **Offline, approved sentences keep working.** They live on the phone, so practice doesn't change; only Generate needs the internet.
- **Off keeps the sentences.** Turning AI off in Settings or for one person takes their sentences out of practice and keeps them, so turning it on again loses nothing.
- **The reverse card is a new kind of card.** Photo and name, then choose the fact ("June enjoys ______."). It needs two other short facts of the same type to stand beside it, so its choices are real ones. It ends on "Yes, that's it.", because a fact can be too long for the line a name fits on, and the highlighted sentence already says it. It is never a reveal card and doesn't move name rotation.
- **The queue stays short.** At most 20 waiting per person, and 8 per request. "Approve all valid" appears only inside the opened list, and approves only what passes the checks again at that moment.
- **Flagged stays flagged.** If a changed fact is changed back, the sentence stays out of practice until the caregiver looks at it: they were told it needs review, and it shouldn't quietly return.
- **The model is Claude Sonnet 5.5 at low effort,** the user's choice, in one constant, with refusal fallbacks on. The cost is bounded by the global cap, not the model: about $0.09 a request at the very most, far less in practice.
- **Tokens can't stop a determined caller.** Anyone can make new tokens, so per-install limits only slow one person down. The global cap is the real ceiling and the kill switch the real stop, and both are in `ai_settings`.
- **The privacy notice stays as it is.** It is shown only with sign-in on, where its line that Evermore never writes stories is still true. The consent covers AI.

## Decisions changed for pacing (2026-11-05, later the same day)

- **"Next story" is ready the moment the right name is chosen.** This replaces the read-back's minimum hold. The button is visible, enabled and tappable at once on every kind of card, including cards that needed a hint and reveal cards, with no waiting state, no grayed-out look and no countdown. The hold made every card wait to protect one number, and it made a person who was ready sit in front of a dimmed button.
- **One guard, and it can't be seen.** Taps on it are ignored for `NEXT_TAP_GUARD_MS` (350 ms) after the right name is chosen, so the tap that chose the name can't also skip the read-back. The button looks exactly the same during that instant. An ignored tap doesn't cut the voice short either.
- **A flip never holds Next.** The guard reads only the clock. Tapping Next while a reveal card is turning leaves the card, which stops the turn, and the next card starts fresh.
- **The read-back itself hasn't changed.** It stays on screen, with the voice, until the person moves on. Next stops the voice, as it always did.
- **A day's length comes from its cards.** The estimate is cards times `SECONDS_PER_CARD`, now 14 and built from parts in `CARD_SECONDS`: 5 to read the card and take in the photo, 3 to choose a name, 5 for the read-back, 1 to move on. The phone's deck averages 8.7 words on a card and 13.5 read back, and the voice runs at about 2.6 words a second. The old 16 is gone because 8.4 of it was the hold. It assumes someone who stays for the read-back, and is an estimate until a real day is timed.
- **Standard stays at 3 per person.** 36 cards at 14 seconds is 8.4 minutes for the 12-person deck, so nothing needed raising. Short is 5.6 minutes and Long 14. If a timed day comes in under about 8 minutes, raise `perPerson` for Standard, and Long in proportion.
- **What this gives up.** Nothing now stops a day being tapped through. "Never under about 5 minutes" and "not completable in under a minute" were limits on tapping, and they are gone with the lock: a machine finished a day in 17 seconds. The day is still 36 cards, and the person gets as long as they want on each.

## Decisions changed for the study session (2026-11-05)

- **A day of practice is a study session, not a check-in.** The fixed daily goal of 3 to 10 cards is gone. The day's target comes from the deck: about 2, 3 or 5 questions per person, chosen by the caregiver as Session length (Short, Standard, Long), with the estimated minutes in plain words beside each. Standard is 8 to 12 minutes for most families. A small deck gets a floor (36 cards at Standard), a large one a ceiling (45), and the day is smaller only when the deck has too few different questions, because nothing repeats to fill it.
- **The estimate is an explicit number:** cards times `SECONDS_PER_CARD`. It shows as a calm line, "About 8 minutes today", on the person's home (or what is left of it) and on the dashboard's Today. It is an estimate, not a timer.
- **Inside a session:** due questions first, then new ones. Different facts first, then different shapes of the same fact. No sentence twice in a day; "Who is this?" with another person's photo is another question. The same person's cards are at least 4 apart (fewer only in a deck of fewer than 4 people, and never back to back unless there is only one person), across a stop and a resume too. Asking which fact stays random among equals, so people don't come round in the same order.
- **The re-ask stays, and spacing wins.** The step-0 re-ask comes 3 or 4 cards later instead of 2 or 3, and moves further on if that would crowd the person's next card. A short review pass ends a session with up to 4 cards that needed hints, as long as the person's cards stay apart. A card that doesn't fit stays due, so it leads next time. A re-ask may repeat a sentence if none is left: this is the one exception.
- **Cards that come back don't count.** A re-ask or a review card moves the schedule but not "X of N cards today". If they counted, the total would reveal how answers went, and a person who needed hints would reach the target before finishing the plan.
- **A very small deck can't reach the floor.** A deck with few different questions has a short day, because repeats are never used to fill it: 5 people with one fact each is 25 cards. One person alone has no day at all: practice needs two (2026-11-09).
- **Stopping is free.** The Home button works on any card, what's finished is already saved, and the session counts as finished once a card is. The home screen offers Keep going, and "All done today" appears only at the full target (or sooner if nothing new is left to ask). Practice more stays available after that, as 10 cards from a mix of people.
- **Everyone complete is in the deck unless deselected.** This replaces the "Add [name] to practice" step as the way in. A complete profile joins by itself. "Include in practice" on the person's sheet is on by default; off leaves the profile and shows "Not in practice" on the People tab. Review's "Add [name] to practice" remains only for someone complete and deselected. Drafts stay out, and the toggle only appears once they are complete. Nothing changes for "Nobody is grandfathered", which is about the percent.
- **Flip cards ("Tap to reveal").** The photo starts behind a large grayed-out "?"; a tap reveals it as a free hint that nothing records, and the right name flips it if it hasn't been, so every card still ends on the real photo. This is the one exception to "the photo is on every card". A person gets one only after a first-try answer about them that day, with no hint or reveal, because a reveal card asks for more than the photo does. That unlock is scheduling only: in memory, for the day's deck, never saved, sent or shown, not even to the caregiver. About 1 eligible card in 4 by default (Reveal cards: Off, Sometimes, Often), with an opt-out per person.
  - **Never for a re-ask or a review card**, because that person needs the photo; **never a photo-only card**, which would ask "Who is this?" of a blank tile; **never someone without a photo**.
  - **It ends on the person's own photo**, even for a memory with its own, because the card is about recognizing them.
- **"Not applicable" replaces "Doesn't apply",** and only on required questions that can honestly have no answer: photo, relationship, one interest, one shared memory. Optional questions no longer need a way out, so they lose the clutter. Marks an earlier release saved on optional questions mean nothing and show nowhere. **"Pets" and "partner" are still optional:** the release brief named them as examples of required questions, but the hard rule keeps the required list at five, and adding two would send every person on the phone back to being a draft. `required` and `mayNotApply` on a question are all it takes to change this, plus test data for them.
- **The asterisk is dark blue, not yellow.** `Colors.accent` is the logo's yellow, for fills only: 1.4:1 on white. `primaryDark` is the accent used for text.
- **Skip for now is gone.** It did exactly what Continue does, and Continue never requires an answer.
- **One question each, not two shapes of the form.** Every row has a small label over its answer, on soft groups with thin dividers. This changes "No panels" for forms only, at the user's request; the dashboard stays on plain lists.
- **Two people with the same fact.** "Who enjoys gardening?" no longer offers both as names, because the person would be told a true answer wasn't the one.

**The intervals, the session lengths and all the pacing numbers are placeholders.** A speech-language pathologist must review them before real use. They are not clinically validated and nothing may present them as if they were.

## Decisions changed for profiles, hints and question variety (2026-11-03)

- **A person is a set of facts.** Each card is one fact: a kind (something about them, work, an interest, a favorite team, show, food or music, a shared memory, how you met, a birthday), the caregiver's words, and a source (`caregiver`, so relatives can contribute later). Practice history stays per card. Every earlier card became a "something about them" fact, word for word.
- **Add a person is two steps** (screen 5). Step 1, under 30 seconds: name, relationship, photo, one fact. Step 2, "Add more details", is optional. The same screen edits a person, which was deferred since Phase 2. A new relationship changes every sentence, so that person's facts wait for approval again.
- **Facts that may change** (a job, a plan) are marked by the caregiver with the month they were true. Every phrasing that states one leads with that month ("As of May 2026, ..."), and it reaches practice only once the caregiver confirms it (Confirm in place of Approve). Row Level Security applies the same rule to the person.
- **The hint ladder has four rungs in a fixed order**, each one the caregiver can turn off per person: the first letter, another fact, the relationship, fewer names. Hints only say what the caregiver typed, never the fact the card already shows. This replaces "every name stays available": the last rung sets the name just chosen aside, once.
- **Question variety.** Each fact can be asked in 3 to 6 fixed shapes of four kinds. Photo-only cards, deferred until now, are built as one of them. Every kind shows the photo, before and after the answer (decided 2026-11-04: a fact-first card no longer hides it). The caregiver previews every phrasing on story approval and can turn single ones off. Nobody is asked the same way twice in a row; the schedule still picks the cards.
- **Practice more** offers one person again, or a mix. "The weakest ones" became "the cards on the lowest schedule step first": scheduling data the app already uses, never shown or ranked on any screen. The "Strong / Needs practice" overview stays cut.
- **People can be added and approved with sign-in off.** The family is kept on the phone, copied once from the example deck (the deck files and `assets/photos/` are never changed). This reverses "adding people and approving stories need the server".
- **AI variants: a switch and a plug-in point only.** `AI_VARIANTS_ENABLED` is `false` and `src/lib/variants.ts` returns nothing. No AI is called. (Built on 2026-11-05: see "Decisions changed for AI sentences".)

## Decisions changed for the 100% gate (2026-11-04)

- **Drafts save as they are typed.** About 500 ms after the last keystroke, and on blur, app background and step change, so an app that closes loses nothing. This replaces "each step saves on the way out".
- **The caregiver's screens are compact.** They use one slim type scale with 44pt targets, whatever the Text size setting says. Very large text is for the person practicing, and the system text size still counts, capped at 1.3×. `DESIGN-UI.md` has the details.
- **The 100% gate.** A person joins the practice deck only with a complete profile. Below 100% they are a draft: saved, listed in the People tab as "Draft, X% complete" with Finish profile (Resume profile since 2026-11-12), and absent from practice cards, hints, the names offered and the person's screens. It replaces "every question is optional": the five required questions are name, photo, relationship, one interest and one shared memory, and the percent counts only those (since 2026-11-12 optional answers add a little on the way, never reaching 100%: see [Add a person, refined](#add-a-person-refined-2026-11-12)). A favorite counts as an interest, and "A place we went", "A holiday" and "How we met" count as a shared memory, because each is one. Marital status and family situation stay optional. The first screen still saves a draft in under 30 seconds.
- **Nobody is grandfathered.** Someone added before this release is a draft until their profile is done, and someone who drops below 100% goes back to being one. The rule runs on every change on the phone and on the server; the person's read policies add `in_deck`. A database rule can't see percent, so the app decides who reaches 100%. Only the caregiver can set `in_deck`, so the app's check protects nothing the caregiver doesn't own.
- **"Doesn't apply"** is on every question except the name (a person needs one) and the hint list (it only lists facts). It counts toward 100%, creates no fact, shows on the review step, and is replaced by an answer. Without it the gate would push people to invent facts.
- **"Add [name] to practice"** is the review step's button, disabled below 100% with the missing items as links. Adding does not approve: each story still waits for approval. Someone already in the deck sees Approve stories, and a complete draft can also be added from their sheet.
- **Test data, for testing only.** Every real example-deck person gets invented answers on the phone so the flow can be tested end to end. It is the only exception to "no invented facts": flagged on each value, tagged on the caregiver's screens, never sent to the server or to AI, and gone with Clear test data, after which they return to their real percentage and leave the deck.
  - **Test facts wait for approval like any other**, because the approval rule has no exception. They count toward 100% but reach practice only if approved. A fact stops being test data once the caregiver changes its words.
  - **One example person has no relationship in the deck**, so they get a flagged "Doesn't apply": an invented relationship would rewrite a real person's sentence.
  - **The 5 fictional sample people are not test data.** They describe nobody, so their invented profile facts are ordinary facts: no flag, no tag, ids starting `sample-`, kept by Clear test data, so AI can be tested on them end to end. They still wait for approval. A phone that already cleared test data does not get them back.
  - **Ruth, Omar and Mae** were only in the server seed, so they are added to the phone with their one seed fact, approved as the seed has it. (Since 2026-11-13 they are in the committed sample deck itself.)
- **With sign-in on,** a new family's 5 sample people have a portrait and one approved story each but stand at 60%, as drafts, so the person's login sees nothing until the caregiver finishes a profile. The fuller sample facts live only in `src/data/test-data.ts` and don't seed the server yet.

## Decisions changed for the guided profile (2026-11-04)

- **A questionnaire replaces "Add more details".** After the quick first screen (still under 30 seconds), the profile is seven sections, one per step within screen 5: specific questions, tappable choices where they fit, short answers, a progress bar, and Back, Next, Skip for now and Finish later. Every question is optional.
- **Autosave.** Each step saves on the way out, and a step left any other way still saves what was typed. A new person is saved as they pass the first screen, so a person can be left at any point and picked up from their sheet at the step reached. There is no separate draft: unfinished means the facts so far, waiting for approval as usual.
- **"Profile X% complete".** The person's sheet shows how much of the form is filled in, with a "Finish profile" nudge until the caregiver has been through it or it is all filled in. It is about the form only, never the person's memory, and it can reach 100% without questions that don't apply to everyone (partner, children, pets, plans) or private ones (marital status, family situation). CLAUDE.md's completion-only rule still reads "and nothing else": this figure is the one addition to it, made at the user's request, and sits on the person's sheet rather than on a dashboard tab.
- **Facts only.** Every step says "Facts only, please: nothing medical, financial or private." The brief also named "diagnosis", but the hard rules keep that word out of the UI, so the line doesn't use it.
- **Answers that are not facts.** Each answer becomes a typed fact, except three that set something else: the relationship stays on the person, and the best clue and the choice of hint facts are hint settings.
- **Private questions.** Marital status and family situation are caregiver-only (a relatives' form leaves them out), wait behind a quiet button, are always dated and confirmed, are stated but never asked ("Who is widowed?" is not gentle), and stay out of hints unless chosen.
- **Shared memories.** Up to three with starters ("A time we...", "The place we always...", "A holiday we..."), each with an optional year ("In 1987, ...") and photo. The photo appears with the whole sentence once the card is answered; the question itself keeps the person's own photo, so every card stays a picture of the person.
- **Hints.** A best clue steers the fact hint: job, hobby or where we met picks that kind of fact, and voice or laugh says "Think of their laugh." The caregiver can leave any fact out of hints; leaving all out turns the fact hint off, which feeds the toggle on the person's sheet.
- **Story approval** opens the phrasings of the next story up rather than of every waiting story, so a full profile doesn't make a page 26,000pt long. Each story still lists them before it is approved, and any can be opened.
- **Saving a section leaves other facts alone.** Only a fact the caregiver emptied is removed. This replaces "a fact missing from the form is removed", which can't work one section at a time.

## Decisions changed on 2026-11-04

- **AI sentences: allowed within bounds, not built** (built on 2026-11-05: see "Decisions changed for AI sentences"). The framework now lets AI write NEW sentences from the caregiver's facts, so practice tests recall rather than a familiar sentence shape. It may never add or infer a fact; each sentence is checked on the server (no new names, places, numbers or claims) and approved by the caregiver before the person sees it; time-sensitive facts are never reworded; `AI_VARIANTS_ENABLED` stays `false` until it is built. This replaces the cut "AI-generated stories".
- **Names rotate.** The other names offered and the right name's place change from card to card, so answers can't be learned by pattern (a new hard rule).
- **The photo is on every card.** A fact-first question no longer hides it until answered.

## Decisions changed in the redesign (2026-11-03)

- **Sign-in can be switched off.** `AUTH_ENABLED` in `src/config/features.ts` (off then; on by default since 2026-11-11, with `EXPO_PUBLIC_LOCAL_ONLY=1` for the local-only mode). Off: the app opens on the person's home with no sign-in, practices the example deck from the phone's own storage, and makes no server calls; holding Caregiver opens the dashboard. On: exactly Phase 3. Adding people and approving stories needed the server, so they existed only with sign-in on (changed later the same day: see above).
- **A visual system, recorded in `DESIGN-UI.md`.** Colors come from the logo; one type scale of four sizes; one spacing scale; one radius; no outlines, boxes inside boxes or shadows.
- **Text size is a setting** with four levels (Small, Medium, Large, Extra large), Medium by default, saved on the device. The caregiver changes it in Settings, the person with **Aa** on their home screen.
- **The dashboard is four tabs** (Today, Trends, People, Settings) instead of one long page. "People practiced this week" became a compact "Times practiced this week" table, still counts only.
- **Remove a person** moved from the dashboard list to the person's story page.
- **Copy:** "All done today." replaces "All done for today."; "Start" replaces "START".

## Decisions changed in Phase 3

- **Accounts and server storage are allowed (Supabase).** This replaces "store everything on the device, no accounts, no server". These stay forbidden:
  - third-party analytics or ad SDKs
  - selling or sharing data
  - any AI or face-recognition processing of photos
  - AI-generated story text
- **The dashboard shows completion percentages only.** This reverses the cut of "percentage dashboards", but only for completion: cards finished against the daily goal. Nothing is shown or ranked by correctness, hints or accuracy. The columns that record how a card went can't even be read through the API.
- **The "Strong / Needs practice" overview is cut.** It would rank people by how answers went, which the completion-only rule rules out. "People practiced this week" (counts only) replaces it.
- **Unchanged:**
  - Story text comes only from the caregiver's words in fixed templates.
  - No diagnosis or progression claims.
  - Older-adult design rules.
  - Nothing red, no "wrong", no scores and no streaks shown to the person.

## Accessory features

| Feature | Verdict | Why |
| --- | --- | --- |
| Caregiver adds people, photos, and 1 to 3 memories | **Keep, built** (Phase 2, on the server since Phase 3) | It is the only source of story words. |
| Guided profile questionnaire, with autosave, resume and "Profile X% complete" | **Keep, built** (2026-11-04) | Specific questions and tappable choices get more true facts with less typing. The first screen stays under 30 seconds; the rest is optional. |
| Deeper profile: kinds of fact, in two steps; editing a person | **Keep, built** (2026-11-03) | More of the caregiver's own words means more to practice, still nothing invented. Step 1 stays under 30 seconds. |
| Facts that may change, dated and confirmed | **Keep, built** (2026-11-03) | A plan or a job can stop being true; the month keeps every sentence true, and nothing shows before the caregiver confirms it. |
| Caregiver approves each story before the person sees it | **Keep, built** (Phase 2) | Shows every way practice may ask it, so nothing reaches the person unseen. Row Level Security also stops the person reading unapproved or unconfirmed cards. |
| Hint rungs the caregiver turns on or off per person | **Keep, built** (2026-11-03) | Some hints suit one person and not another. The order stays fixed, and every card still ends on a success. |
| Question variety from fixed templates | **Keep, built** (2026-11-03) | Asking the same fact different ways keeps practice fresh without new words. The caregiver turns off any phrasing. |
| Practice one person again, or a mix | **Keep, built** (2026-11-03) | Lets the person (or, with sign-in off, the caregiver) choose who to see after the daily goal. Completion counts the same way. |
| AI-written sentences from the caregiver's facts | **Keep, built, off by default** (2026-11-05; sign-in off only) | Tests real recall rather than a familiar template. Never adds or infers a fact; checked on the server and approved by the caregiver; time-sensitive facts never reworded. |
| Facts from relatives through invite links | **Deferred** | The `source` field is ready; the links, the form and their review come later. |
| Spaced-retrieval schedule deciding when each card returns | **Keep, built** (Phase 3) | Decides which cards come back and when. Used for scheduling only. Intervals are placeholders for clinician review. |
| A daily target from the deck, with a chosen session length | **Keep, built** (2026-11-05) | A day's practice should be a meaningful session, sized to the family. Numbers are placeholders. |
| Reveal cards ("Tap to reveal") | **Keep, built** (2026-11-05) | Harder recall for someone who is doing well that day, with the photo always a tap away. Still to be tried with the person. |
| Include in practice, per person | **Keep, built** (2026-11-05) | Lets someone rest without losing their profile. |
| Archive and restore people, delete only once archived | **Keep, built** (2026-11-09) | Families change. Setting someone aside should cost nothing and be undoable, and losing them for good should take a deliberate second step. |
| Caregiver dashboard of practice completion | **Keep, built** (Phase 3) | Shows whether practice is happening, without judging answers. Always labelled "Practice activity, not a medical measure." |
| Caregiver overview: "Strong" or "Needs practice" per person | **Cut** (Phase 3) | Ranks by correctness, which the completion-only rule forbids. |
| Photo-only recognition card type | **Built** (2026-11-03, was deferred) | Built at the user's request as one of the four kinds of question; the caregiver can turn it off for any fact. Still to be tried with the person. |
| Picture-book mode | **Deferred** | A calm, read-only way to browse people might suit later, but it is a second loop with its own screens. |
| Payments | **Deferred** | Not a question for a prototype. |
| Machine learning | **Cut** | The schedule is a fixed set of steps; the loop doesn't need learning. |
| AI-generated stories | **Cut**, then replaced on 2026-11-04 by the bounded row above | Free AI stories could invent false memories; only sentences from the caregiver's facts, checked and approved, are allowed. |
| Multiple learning styles | **Cut** | Adds choices and settings, which works against one action per screen. |
| Accuracy or correctness dashboards | **Cut**, then a bounded caregiver-only exception on 2026-11-09 (Insights, below) | Scores invite medical readings and judge the person. Completion stays the dashboard's measure; Insights describe practice for the caregiver alone, never the person's screens, with no comparison to anyone else. |
| Caregiver insights and a daily Memory score | **Keep, built** (2026-11-09; with sign-in on since 2026-11-10) | Helps the caregiver see how practice is going and what might help next, without judging the person. See [Insights](#insights-2026-11-09) and [Insights with sign-in on](#insights-with-sign-in-on-2026-11-10). |
| A daily practice reminder on the person's phone | **Keep, built** (2026-11-13) | A cue to practice that the person controls, local to their phone. One calm sentence, at most once a day, off until they say yes. See [The daily reminder](#the-daily-reminder-2026-11-13). |
| Multiple persons per caregiver, multiple caregivers per family | **Deferred** | One caregiver and one person per family for now. |

**Cut list:** machine learning, free AI-generated stories (only the bounded AI sentences above are allowed), multiple learning styles, accuracy or correctness dashboards (apart from the caregiver-only Insights exception), the "Strong / Needs practice" overview. Unchanged on 2026-11-03: "repeat the weakest ones" is scheduling only (the lowest schedule step first) and never shown, so nothing on the cut list came back.
**Deferred:**
- the retention hook (the unfinished story)
- picture-book mode
- push notifications from a server (the local daily reminder is built)
- payments
- more than one person per caregiver
- more than one caregiver per family
- AI sentences with sign-in on (approved sentences would need server storage)
- sending the PIN by email (its disabled place is in Settings; it needs custom SMTP)
- invite links for relatives to contribute facts, and a public form
- asking the caregiver to confirm a fact that may change again after some months
- a separate on-phone draft of a step in progress (each step saves on the way out; only a closed app loses what was just typed)
- with sign-in on, the caregiver choosing who the person practices next (their login has no practice)

**Deferred from Phase 2:**
- taking a photo with the camera
- cropping photos

(Editing a saved person's name, relationship or photo, and adding facts to an existing person, were built on 2026-11-03.)

## Screens: 8 (budget 8)

Settings, the privacy notice, the person's login, Pair the person's phone, Change password, a person's details (People tab) and Practice more all open as sheets (modals), not screens. The welcome, the person's Create my account and sign-in, and the caregiver's sign-in, sign-up and password reset are steps within screen 1, as the questionnaire's sections are steps within screen 5.

| # | Screen | For | Route | Status |
| --- | --- | --- | --- | --- |
| 1 | Sign-in | Everyone, sign-in on (the default) | `src/app/sign-in.tsx`, `src/components/sign-in/` | **Built, in steps (2026-11-11).** A welcome with "I am practicing" and "I am a caregiver"; for the person, Create my account (the caregiver's email, then the PIN from the caregiver, then "You are all set"; see [Pairing the person's phone](#pairing-the-persons-phone-2026-11-11)) or Sign in, "Hello" with User ID, password and one Continue; the caregiver's Sign in or Create an account, "Check your email", and a forgotten password with the code from the email. See [Sign-in, on by default](#sign-in-on-by-default-2026-11-11). |
| 2 | Person home | Person | `src/app/index.tsx` | **Built.** The logo, a greeting, "About 8 minutes today", today's progress bar (cards finished of the day's target) and one tall Start, or Keep going part way through. **Aa** opens Text size, with the person's Reminders below it (since 2026-11-13); after the first completed session, a sheet asks once about a daily reminder; Caregiver opens only when held. Once the day is done: "All done today." and a gentle "Practice more", a sheet with "A mix of people" first and then everyone's picture cards. |
| 3 | Practice card | Person | `src/app/practice.tsx` | **Built.** The core loop: a Home icon and a slim progress bar on top, the photo and sentence as one card, the names pinned at the bottom, the hint in a soft yellow panel, success in a sage banner with one button, ready at once. Every kind of card shows the photo; a fact-first card shows its question where the sentence goes. A reveal card starts with a "?" tile in the photo's place, and always ends on the photo. |
| 4 | Caregiver dashboard | Caregiver | `src/app/caregiver/index.tsx` | **Built.** A compact header (the logo's mark and the tab's name) and a tab bar at the bottom, icons over short labels: **Today** (hero figure, three supporting figures, 7-day chart), **Trends** (the 30-day calendar and times practiced, as before), **Insights** (screen 8), **People** (Add a person, and everyone as picture cards, drafts and deselected people labelled; a tap opens the person's sheet: Profile X% complete or Draft, X% complete, Finish profile, Stories, Edit details, Practice with them now (sign-in off), Include in practice and Reveal cards, Hints, Archive. A long press starts editing, with a minus badge on every card and Done. Below the cards, a folded "Archived people" section with a count: muted cards with Restore, each opening a read-only sheet with Restore and Delete permanently), **Settings** (since 2026-11-12 in sections: Account (signed in as, change password, sign out), Linked phones (pair the person's phone, their login), Practice (session length, reveal cards, text size), Privacy and data (privacy policy, what the app stores, research use, the AI agreement where available, export my data), About, then Delete account apart). With sign-in off: Practice, Privacy and data, About and Back to the home screen. No developer controls in any build. |
| 5 | Add a person | Caregiver | `src/app/caregiver/add.tsx`, `src/components/questionnaire.tsx` | **Built.** Eight steps with one header (since 2026-11-12): Who they are (name, photo, relationship, one fact), Names and dates, Work and school, Family and home, Interests, Shared memories, Hints and recognition, Review, whose Continue leads on to approving stories at 100%. Opened with a person's id it edits them, at a step to resume from. Saves to the server, or with sign-in off to the phone. |
| 6 | Story preview and approval | Caregiver | `src/app/caregiver/review.tsx` | **Built.** The photo as the hero, then each fact's sentence with its kind and any memory photo; Approve (Confirm for a fact that may change), Edit or Skip; "Ways to ask" lists every phrasing with a checkbox, open on the next story to approve. Approve all and Done pinned at the bottom (since 2026-11-12), with Undo. (Removing the person from here is gone: archiving is on the People tab.) |
| 7 | Session wrap-up | Person | `WrapUp` in `src/components/practice-screen.tsx` | **Built.** The logo mark, "All done today." (or "Nice work."), who they spent time with (a count past 5 people), and the updated progress bar. |
| 8 | Insights | Caregiver | the dashboard's fifth tab, `src/components/insights.tsx` | **Built (since 2026-11-10 its own tab; before, a view under Trends).** The caregiver-only exception to completion only, with a pink brain icon. The Memory score as a ring in one hero card, the score ranges folded under it, then the score over time, what stands out, next steps, "How answers were found", answer speed, practice time, each person's cards and the score calendar with its day sheet and "What is this score?". |

The root layout (`src/app/_layout.tsx`) guards each group with `Stack.Protected`, so each role reaches only its own screens. The caregiver screens share a nested stack (`src/app/caregiver/_layout.tsx`, a layout rather than a screen) so that signing in always opens the dashboard first. On the person's home, holding the small Caregiver button for a second (and confirming) signs the person's phone out so the caregiver can sign in; with sign-in off it opens the dashboard instead.

## Data model (Supabase)

A **family group** is one caregiver and the one person they practice with; that person may sign in on several phones (a User ID login and a login per phone paired with a PIN). The caregiver's user id is the family id: every family row carries `caregiver_id`, and composite foreign keys stop a row from pointing into another family. All of it is in `supabase/schema.sql`.

| Table | Holds |
| --- | --- |
| `profiles` | One per login: `role` (caregiver or person), `display_name`, `caregiver_id` (for a person), `username` (the person's User ID; null for a paired phone), `consented_at` (a caregiver's sign-up consent, required). One User ID login per family, any number of paired phones. |
| `people` | The people on cards: name, relationship, `photo_path` in the private bucket, or `sample_portrait` for the bundled illustrations. `hint_letter`, `hint_fact`, `hint_relationship`, `hint_fewer`: which hint rungs practice may use (all on by default). `profile_step` (the furthest step of the questionnaire reached, 0 to 7), `best_clue` (voice, laugh, job, hobby or met), `not_applicable` (the questions marked "Not applicable"), `include_in_practice` (the caregiver's toggle, on by default), `in_deck` (complete, included and not archived; the app keeps it in step, since a rule can't see the percent), `reveal_ok` (false opts them out of reveal cards) and `archived_at` (when the caregiver archived them; null while active). |
| `cards` | One fact each: `fact_type`, the caregiver's words in `memory_text`, the template `sentence` with `{name}` as the blank, `status` (pending, approved or skipped), `time_sensitive` with `as_of` (the month it was true; required when time-sensitive) and `confirmed_at`, `source` (`caregiver`), `phrasings_off` (phrasings the caregiver turned off), `hint_ok` (false leaves the fact out of hints), and for a shared memory `memory_year` and `photo_path` (in the family's folder of the private bucket). |
| `sessions` | `started_at`, `completed_at`, `cards_completed`, and in `daily_goal` the day's target in effect (1 to 200), so a later change doesn't rewrite past days. `is_sample` marks development sample data. |
| `attempts` | Every finished card: `tries`, `first_try_correct`, `hints_used`. Used **only** for scheduling. |
| `attempt_records` | Insights (2026-11-10): one row per card shown, made on the person's phone as they leave it. Ids (the record's own, made on the phone; the family; the person's login; whose card; the card and how it was asked; the session), the shape, the kind of fact, template or AI, when it came up, each choice in order (`selected_at`, `selected_right`), how many were offered, the hint rungs, whether it ended on the right answer, active time and time to the first choice, the day's target, whether it came back after a hint, and `uploaded_at`, set by the server. No names, photos or words: the way it was asked must be a fixed shape id or an AI sentence's id. Kept 120 days. |
| `card_schedule` | Per card and person: `step` (0–5) and `due_at`. |
| `ai_settings`, `ai_usage_installs`, `ai_usage_days` | AI's limits, and nothing about content. One row of settings: `enabled` (the kill switch, off until turned on), `per_install_hour`, `per_install_day` and `global_day`. Counters against a hash of the install's token, by hour, and across every install, by day. Only the function reaches them, through `ai_take_request`; RLS is on with no policies. Install counters older than 36 hours go as it runs. |
| `pairings` | Pairing (2026-11-11): the family, an HMAC-SHA256 of the PIN keyed with the function's pepper (never the PIN), who created it, `expires_at` (15 minutes), `used_at` and wrong `failures`. A new PIN deletes the one waiting. The pair-phone function only. |
| `devices` | Each paired phone: its own person login (`person_user_id`), `name`, `paired_at`, `last_seen_at` and `revoked_at` (Remove phone). The caregiver reads their family's; the person's login reads none. |
| `pairing_settings`, `pairing_events` | The kill switch (`enabled`, on by default) and the limits (minutes a PIN lasts, the window, tries per email, per IP address, per PIN and across everyone, PINs an hour). Each try or PIN made, against a keyed hash of the email or IP address, never the address; gone after a day. The function only. |
| `daily_goal` | Practice settings, one row per family: `session_length` (short, standard or long; default standard) and `reveal_cards` (off, sometimes or often; default sometimes). `goal` is the old fixed target, no longer read. The day's target is worked out from the deck on the phone. |

- **Logins.** A caregiver signs up with their email. A trigger creates their profile, daily goal and 5 fictional sample people (June, Leo, Ruth, Omar, Mae), each with one approved story. The person's User ID login is made by the `manage-family` Edge Function with the server key. Their User ID maps to `<user id>@person.evermore.invalid`, a domain that can never receive mail. A paired phone's login is made by the `pair-phone` function, as `<uuid>@phone.evermore.invalid` with a random credential the phone keeps.
- **Photos.** They live at `photos/<caregiver_id>/<person id>.<ext>`, a private bucket. The app shows them through 1-hour signed URLs and caches them on the phone by path, so they still show offline. They are uploaded with `max-age=0`, so Supabase's CDN checks storage on every request and a deleted photo stops loading at once, even through a link already opened.
- **Resetting the person's login.** Supabase revokes their refresh tokens, so a signed-in phone keeps working until its access token expires (up to an hour), then asks for the new password.

## Row Level Security

- **Caregiver:** reads and writes only rows whose `caregiver_id` is their own id, plus photos in their own folder.
- **Person:** reads only approved cards of people in the deck (`in_deck`, `include_in_practice` and not archived, through `person_in_deck()`), those people, the practice settings, and the photos of those people and cards (`person_sees_photo()`), so nothing archived, drafted or deselected, even by listing the folder. Reads and writes only their own sessions, attempts and schedule rows. Can't write sample data, cards, people or the goal.
- **Card records** (`attempt_records`): the person's login may only insert its own rows, for its own family, and reads none back, not even its own. The caregiver's login may only read and delete its family's. Nobody may change one, and `uploaded_at` is the server's.
- **Paired phones** (2026-11-11): a paired phone's login is a person login like any other. Once removed (`devices.revoked_at`), `my_caregiver()` returns nothing for it, so every person rule refuses it at once. The caregiver reads their own family's `devices` and writes none; `pairings`, `pairing_events` and `pairing_settings` have no policies at all (service_role only). The person's phone may call `device_seen()`, which tells it only whether it was removed.
- **Profiles:** only the trigger and the Edge Function create them. A user can change only their own display name, never their role or family.
- **Correctness is write-only.** `attempts.tries`, `first_try_correct` and `hints_used` have no SELECT grant, so no screen, caregiver or person can read them through the API.
- **Signed out:** nothing.

`supabase/tests/live.test.mjs` ran 90 checks against the real project with only the publishable key when last run (before card records). It covers:
- sign-up and consent
- the private bucket and signed URLs
- the Edge Function
- person reads and writes, and write-only correctness
- a second caregiver blocked from every table and photo
- deletion of every row, photo and login
- card records (added 2026-11-10, not yet run): the person writes them and can't read them, a resend is refused, only the caregiver reads them, and deleting a person deletes theirs

`supabase/tests/rls.test.mjs` runs the schema in PGlite and checks 214 rules, the AI limits and card records among them: nobody but the function reaches them, each limit stops at its number, and the kill switch stops everything. Among them: caregiver B can't read, add to, change or delete caregiver A's data or photos; deleting a family removes every row; the person can't read a draft, a deselected or an archived person, their cards or their photos, or put any of them in the deck, archive or restore anyone; archiving keeps practice history, and deleting a person takes their facts, schedule, attempts and card records and keeps the day totals; card records are insert-only for the person, read and delete only for the caregiver, carry no free text, are refused when sent twice, and go past 121 days; the person can't read a fact that may change until it is confirmed, and can read but not change hint settings and turned-off phrasings; the schema runs twice without change; and it upgrades projects made with either earlier schema (`supabase/tests/schema-before-facts.sql`, `schema-before-profiles.sql`) keeping every card word for word with its practice history. `supabase/tests/rls-check.sql` repeats the cross-family check on the real project.

## Spaced retrieval (scheduling only)

- **Intervals** are in `src/config/schedule.ts`: within a session, a card that needed a hint comes back at expanding gaps of about 1, 2, 4 and 8 minutes (as cards, at most 8 a session; 2026-11-11), then 10 minutes, 1 day, 3 days, 7 days and 14 days. Day steps fall due at the start of that day. **Placeholders, must be reviewed by a speech-language pathologist before real use. Not clinically validated.**
- **Moving steps.** A first-try answer with no hint moves a card up one step. A hint moves it back one step, never below 0. A card practiced before it was due, to make up the day, can move back but never jumps ahead, so asking a fact several ways in a day doesn't rush it along. Tapping the "?" on a reveal card changes nothing.
- **The day's plan** (`planToday` in `src/lib/session.ts`): each person's share of the target, due facts first (most overdue first), then new approved ones, then those due soonest, so the target is always reachable; then laid out with due questions leading and people kept apart. See [Decisions changed for the study session](#decisions-changed-for-the-study-session-2026-11-05).
- **Practice more** (`planMore`): 10 cards from a mix of people, each with the cards on their lowest step first (a new card counts as just above step 0), ties to the one due soonest. **One person** (`planPerson`): their cards in the same order, round again until there are at least 3, at most 10 (`PERSON_PRACTICE` in `src/config/schedule.ts`). Both use words not yet used today, while any are left. Every card finished counts toward the day the same way, apart from those that came back after a hint.
- **Re-asks.** A card that ends on step 0 comes back once, a few cards later, if there's a place for it with the person's cards kept apart. Otherwise the review pass may take it.
- No countdowns, no machine learning, and nothing about the schedule is shown to anyone.

## Question variety

Each of the 29 kinds of fact can be asked in 4 to 6 fixed shapes (`phrasingsFor` in `src/lib/stories.ts`), of four kinds of question:

| Kind | What the person sees | Example |
| --- | --- | --- |
| Fill in the blank | The photo and a sentence with a blank. | "My friend, ______, loves the Riverton Otters." / "______'s favorite team is the Riverton Otters." |
| Fact first | The photo and a fact as a question. | "Who loves the Riverton Otters?" |
| Who is this | The photo, a fact, then "Who is this?" (question last since 2026-11-11). | "This person loves the Riverton Otters. Who is this?" |
| Photo only | The photo and "Who is this?" | |
| Reverse (AI only) | The photo, the name, and a sentence with the fact as the blank; the choices are facts. | "June enjoys ______." |

- **Only the caregiver's words.** The words around them are fixed per kind of fact ("is", "enjoys", "loves watching", "and I met"...); `scripts/check-logic.mjs` checks that no phrasing holds any other word. Shapes needing a relationship or a photo are left out without one, and "Who and I ...?" is never asked.
- **The photo is on every card**, whatever the kind, before and after the answer. Afterwards every kind reads back the approved sentence with the name filled in.
- **A fact that may change** leads with its month in every phrasing that states it: "As of May 2026, who is going to become a nurse?"
- **Rotation.** A person is never asked the same way twice in a row: within a session (re-asked cards included) or across sessions (the last phrasing per person is kept on the phone), and within a day no sentence comes back. The schedule still picks the cards; the phrasing never changes it.
- **Names rotate too** (2026-11-04). A person's card offers other names they weren't just shown, and the right name moves to a place it didn't have on their last card (and, when there's room, not where the card before had it), so the same person never gets the same three buttons in the same order twice in a row. The names each person last saw are kept on the phone with the last phrasing.
- **The caregiver's say.** Story approval lists every phrasing of a fact, open while it waits for approval, and each can be turned off (`cards.phrasings_off`), never all.
- **AI sentences, when turned on.** Approved ones join a card's phrasings through `src/lib/variants.ts`, as five shapes: one fact, two facts, fact to name, reverse, and a shared memory told as a moment. Everything above applies to them as it is, each can be turned off under Ways to ask, and an approved AI sentence comes before a fixed one when both fit. Each is used once a day, except the re-ask after a hint.

## Hints

The ladder (`hintAt` in `src/lib/stories.ts`) moves one rung per other name chosen, in a fixed order (`HINT_LADDER`, since 2026-11-11: meaningful cues first). Each rung is on unless the caregiver turns it off for that person (People tab), and a rung with nothing true and new to say is skipped. **The order is a design assumption for a clinician to review.**

1. **Another fact,** never the one the card already shows, and never one the caregiver left out: "This person enjoys gardening." A photo-only card shows no fact, so it may use its own. A best clue steers this rung: job, hobby or where we met tries that kind of fact first, and voice or laugh says "Think of their laugh."
2. **The relationship:** "This is your mom." Skipped when the card already says it ("My mom, ______, …"), and on a reverse card, where the name is given.
3. **The first letter:** "The name starts with S."
4. **Fewer names:** "Let's try with fewer names." The name just chosen is set aside, once, never leaving fewer than two.
5. **The answer:** after the last rung allowed (or one "Take your time." with every rung off), "It’s June." and that name's button shows selected. Both names stay; the person taps it, and the card ends on a success like any other. It isn't a setting, and records nothing new.

The newest rung leads and the first stays beside it ("This is your mom. This person enjoys gardening."). With every rung off the first hint is "Take your time."

## Offline

`src/data/practice-store.ts` keeps the person's approved deck, schedule and recent sessions in AsyncStorage, so practice works without a connection.

- **The outbox.** Every finished card queues three writes: the session, the attempt and the schedule row. These are sent in order when the connection returns, when the app comes to the front, and after each card.
- **AI.** Generate is replaced by a calm line with no connection. Approved sentences are on the phone, so practice doesn't change.
- **Refused writes.** Rows the server refuses (for example, a card the caregiver removed meanwhile) are dropped. Network problems and expired sessions are retried.
- **Card records** (2026-11-10) have their own queue on the person's phone (`src/data/attempt-sync.ts`): saved first, sent in batches when online, waiting longer after each try that can't go, and never dropped except when the server already has one or its person was deleted for good. See [Insights with sign-in on](#insights-with-sign-in-on-2026-11-10).

## Caregiver dashboard: completion only

The dashboard shows only completion: cards finished against the day's target. It is four tabs, so no page needs a long scroll.

| | Shows | Tab | How |
| --- | --- | --- | --- |
| a | Today's completion | Today | The one hero figure: cards finished of the day's target, capped at 100%, with "About 8 minutes today" under it. |
| b | Sessions | Today | Sessions finished in the last 7 days, and their average length, as list rows. |
| c | Last 4 weeks | Today | The average of daily completion, as a list row. Days before the account (or, with sign-in off, the phone's first practice) aren't counted. |
| d | Last 7 days | Today | Bars with direct labels and one dashed goal line (`react-native-svg`). |
| e | Last 30 days | Trends | A calendar with three neutral levels: no practice, some, goal met. No red, no "missed". |
| f | Times practiced this week | Trends | How many times each person's cards came up, three to a row. Engagement only. |
| i | Insights | Trends → Insights | The one exception to completion only, for the caregiver: how practice is going, from the records on the phone (sign-in off) or uploaded from the person's phone (sign-in on). See [Insights](#insights-2026-11-09). |
| g | The deck | People | Add a person, and each person as a picture card, with "Draft, X% complete" until complete, or "Not in practice" if deselected; a tap opens their sheet (stories, details, include in practice, reveal cards, hints, archive). A long press archives from the grid, with Undo; archived people wait in a folded section below, to restore or delete. |
| h | Controls | Settings | Session length, Reveal cards, the person's text size, who is signed in, the person's login, change password, privacy notice, sign out, delete account (the account rows show even when the family couldn't load). With sign-in off, Clear test data while there is any. |

- **Guardrails.** Every chart and the foot of every tab say "Practice activity, not a medical measure." The words diagnosis, decline, progression, severity and accuracy appear nowhere, and nothing says the Memory score diagnoses, tracks, predicts or compares. Empty states read "No practice yet."
- **Development data.** In development only, "Load 14 days of sample activity" and "Clear sample activity" write and remove `is_sample` sessions. The module is required only under `__DEV__` and isn't in release bundles.

## Example deck

Since 2026-11-13 the committed deck (`src/data/sample-deck.ts`) is the five fictional sample people with their illustrations. The user's real cards are in the gitignored `src/data/deck.local.ts` and `assets/photos/`, read only in development builds and only if present. They stay on the user's computer and phone only: never committed, uploaded, migrated or seeded. With sign-in off, the phone's family (`evermore.family.v1` in AsyncStorage) starts as a copy of them, all approved, each memory a "something about them" fact with the card id practice already used; the caregiver can then add, edit, archive and delete on the phone, and neither file ever changes. A person the caregiver deletes isn't copied back. Metro bundles the photos in both modes, so they travel from the dev server to the phone. The server seed has only fictional people, with illustrated portraits in `assets/sample-people/`.

Every approved sentence is one of two fixed templates filled with the caregiver's words, the second only without a relationship (add a person asks for one):

- `My {relationship}, {name}, {predicate}.`
- `{name} {predicate}.`

The predicate is the fact's words in its kind's fixed phrase ("is a nurse", "enjoys gardening", "and I met at church"); for "something about them" it is the words alone, as before.

## Retention hook (designed, not built)

- **For the person:** the wrap-up would end with one unfinished story for next time, made from a caregiver memory with a fixed template: "Tomorrow: who {memory}?"
- **For the caregiver:** the dashboard would show a person's chapter as unfinished until one more memory is added.
- No streaks, counts or penalties for missed days.

## Phases

- **Phase 0**, this record and `CLAUDE.md`: done.
- **Phase 1**, the core loop in Expo Go with the example deck: done.
- **Phase 2**, add a person, story preview and approval, on-device storage, and the caregiver people list: done.
- **Phase 3**, built and verified on 2026-11-03 against the live Supabase project, in the web build. Still unverified: the email code steps (they need custom SMTP) and a run on a phone in Expo Go. It covers:
  - Supabase accounts and role-based sign-in
  - the person's home with daily completion
  - spaced-retrieval scheduling
  - offline practice with sync
  - the completion-only caregiver dashboard
- **Redesign and sign-in switch**, 2026-11-03: the visual system in `DESIGN-UI.md`, the Text size setting, the dashboard tabs, and `AUTH_ENABLED` with a local-only mode. Checked in the web build at 375x667, 390x844 and 430x932 (and at the heights a real iPhone leaves after its insets), at Medium and Extra large text; sign-in checked against the live project with `AUTH_ENABLED` true. Still unverified: a run on a phone in Expo Go.
- **Pairing the person's phone**, 2026-11-11: the PIN and Linked phones in Settings, Create my account on the person's phone, the `pair-phone` function, the pairing tables and their rules, several person logins per family. Checked in PGlite (`rls.test.mjs`, `pairing.test.mjs` with the real function), against the in-memory Supabase (`check-auth.mjs`) and in the web build. Still unverified: the live project and two phones.
- **Sign-in on by default**, 2026-11-11: the welcome and both sign-ins as steps of screen 1, sign-up with Confirm email either way, a forgotten password, the session in secure storage, opening offline, sign-out that clears, and the account rows in Settings. Checked against the real supabase-js client and an in-memory stand-in for Supabase (`scripts/check-auth.mjs`), and in the web build against the same stand-in on localhost. Still unverified: the live project, email delivery (it needs custom SMTP), and two phones in Expo Go.
- **Insights with sign-in on**, 2026-11-10: the `attempt_records` table and its rules, the person's phone's upload queue and backfill, and the caregiver's Insights from the server with a copy on the phone. Checked in PGlite, against in-memory stand-ins, and in the web build against a local stand-in for Supabase, on two browser "devices". Still unverified: the live project (it needs the schema rerun) and two real phones.
- **AI sentences**, 2026-11-05: the `generate-questions` function and its limits, then the phone: masking, the consent, the queue and sentences in practice. Off by default, and mocked: not yet run against the live model or on a phone.
- **Study session**, 2026-11-05: the form polish, required markers and "Not applicable", the copy pass, the deck rule, the daily target with interleaving, and flip cards, then Next story ready at once with the day's length coming from its cards. Checked with sign-in off in the web build at 375x647, 390x763 and 430x839, Medium and Large, with a machine playing whole Standard days in real time, and in PGlite for the schema. Still unverified: Expo Go on a phone, and sign-in on against the live project.
- **Guided profile**, 2026-11-04: the questionnaire (`src/data/questionnaire.ts`), 19 new kinds of fact, autosave and resume, profile completion, memory years and photos, best clue and hint facts. Checked with sign-in off in the web build at 375x647, 390x763 and 430x839, Medium and Large, and in PGlite for the schema, including upgrades from both earlier schemas. Still unverified: Expo Go on a phone, and sign-in on against the live project.
- **Profiles, hints and question variety**, 2026-11-03, in four phases: (A) people as facts in two steps, editing, dated facts confirmed by the caregiver, and the family on the phone with sign-in off; (B) hint rungs per person; (C) question variety from fixed templates, with rotation and per-phrasing switches; (D) practicing one person again, or a mix. Checked with sign-in off in the web build (every screen at 375x647, 390x763 and 430x839, Medium, Large and Extra large) and in PGlite for the schema, including the upgrade. Still unverified: Expo Go on a phone, and sign-in on against the live project, which needs `supabase/schema.sql` run again first.
