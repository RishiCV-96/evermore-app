# Tandem

Tandem helps a person with early memory loss keep recognizing the important people in their life, through short, personal fill-in-the-blank stories. A caregiver adds people and memories and approves each story. The person practices a few cards a day on their phone.

Tandem is a practice tool, not a medical device. The name is a placeholder pending trademark clearance; it lives in `src/config/brand.ts`, and the logo in `brand-kit/`. `DESIGN.md` has the design record and `CLAUDE.md` the rules every change follows.

## How it fits together

- **The app** runs in Expo Go (Expo SDK 58). It has 8 screens: sign-in (a welcome, the person's sign-in and the caregiver's forms, as steps), the person's home, practice, wrap-up, the caregiver dashboard, add a person, story approval, and Insights.
- **Sign-in is on by default** (see [Sign-in on or off](#sign-in-on-or-off)). For development without a server, `npm run start:local` opens straight on the person's home, practices the example deck, and keeps everything on the phone.
- **Supabase** holds the accounts, people, stories, practice activity and photos. Row Level Security keeps each family's data to itself. Photos are in a private bucket.
- **Two Edge Functions.** `manage-family` does the three things the app must not do with its public key: create the person's login, reset it, and delete a whole family. `generate-questions` writes AI questions, and is off until you turn it on (see [AI questions](#ai-questions)). The app calls each at the URL slug in `src/config/functions.ts`, which reads `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION` and `EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION` and otherwise uses the development project's slugs, `dynamic-api` and `clever-service`. The production project's functions are deployed with the CLI under their own names (`docs/RELEASE-STEPS.md`).
- **The look** follows `DESIGN-UI.md`: colors from the logo (`src/theme/colors.ts`), one type scale, and a **Text size** setting with four levels.

## Sign-in on or off

The switch is `AUTH_ENABLED` in `src/config/features.ts`. **Sign-in is on by default** (since 2026-11-11).

**On (the default).** The app opens on a welcome with two ways in: **I am practicing** (the person signs in with the User ID and password the caregiver makes) and **I am a caregiver** (sign in, or create an account). Everything lives in Supabase, so it needs `.env` (below) and the schema run. A phone that has signed in stays signed in, offline too, until someone signs it out.

**Off: the local-only mode, for development.** Start the app with `npm run start:local` (the same as `EXPO_PUBLIC_LOCAL_ONLY=1 npx expo start --clear`). No sign-in and no server:
- The app opens on the person's home and practices the family kept on the phone. It starts as a copy of the example deck: the five fictional sample people (`src/data/sample-deck.ts`) and, in development, your own cards from the gitignored `src/data/deck.local.ts` with photos from `assets/photos/` if you made them. Without the local file you get the sample people alone. Never put real people in a tracked file: see "Real data stays off git" in `CLAUDE.md`.
- Practice, the progress bar and the completion dashboard work from the phone's own storage. Nothing is sent anywhere; no Supabase client is even created. The one exception is [AI questions](#ai-questions), if you turn them on: they work only in this mode.
- Hold **Caregiver** (top right of the home screen) for a second to open the dashboard. **Settings → Back to the home screen** returns.
- On the dashboard's **People** tab, people can be added, edited, approved and archived, all on the phone. A photo you pick is copied into the app's own folder on the phone.

To go back to sign-in, stop the server (Ctrl+C) and run `npx expo start --clear`: Metro caches the value, so always clear it when switching. Practice saved in the local-only mode stays on the phone and isn't uploaded: it belongs to the family kept on the phone, which never goes to the server.

**Insights with sign-in on.** The person practices on their own phone, which uploads each card's record in the background; the caregiver's phone reads them under Trends → Insights. The person's login can only send records, never read them; only the caregiver's login reads them. `DESIGN.md` ("Insights with sign-in on") has the details.

## Set up Supabase (once)

### 1. Environment variables

Copy `.env.example` to `.env` and fill in both values from **Project Settings → API Keys** (or the **Connect** dialog):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<the publishable key (sb_publishable_…) or the legacy anon key>
```

Both values are meant to be public. **Never put a secret or `service_role` key in `.env` or anywhere in the app.** `.env` is gitignored. Restart `npx expo start` after changing it.

### 2. Run the schema

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` and choose **Run**.

This creates:
- the tables and their indexes
- the Row Level Security policies
- the sign-up trigger, which gives each new caregiver 5 fictional sample people
- the private `photos` bucket and its policies

It's safe to run again after changes, and it must be run again after any change to `supabase/schema.sql`: it upgrades the tables in place. The releases of 2026-11-03 and 2026-11-04 added the kind of each fact, whether it may change (with its month and the caregiver's confirmation), its source, the phrasings turned off, each person's hint settings, a memory's year and photo, which facts may be hints, and how far each profile is filled in. Every earlier card becomes a "something about them" fact, word for word, with its practice history. The Edge Function didn't change, so it doesn't need redeploying.

### 3. Auth settings

Under **Authentication**:

- **Password length.** Set the minimum password length to 8, to match the app.
- **While testing, turn off Confirm email** (**Sign In / Providers → Email**, then **Save**). Supabase's built-in email only reaches members of your Supabase team, a few emails an hour, and its templates can't be edited without custom SMTP. With Confirm email off, sign-up needs no email, and `supabase/tests/live.test.mjs` can create its test accounts. You can check the setting: `mailer_autoconfirm` is `true` at `<project URL>/auth/v1/settings`.
- **Before launch**, set up custom SMTP and turn Confirm email back on. See [Before launch](#before-launch).

### 4. Deploy the Edge Function

The function needs a secret key. You set it in Supabase yourself; it never goes in the app or in git.

1. **Make a secret key:** **Project Settings → API Keys → Secret keys → Add new secret key**. Copy it. It starts with `sb_secret_`.
2. **Store it as a function secret:** **Edge Functions → Secrets**. Add `EVERMORE_SECRET_KEY` with that value. It must be the secret key: with the publishable key the function can tell who is calling but can't read the tables, so every action fails. (If the project still has the legacy `service_role` key, the function falls back to Supabase's built-in `SUPABASE_SERVICE_ROLE_KEY` and this step is optional.)
3. **Deploy with the CLI, naming the function** (the way for any new project, production included). The name is the folder under `supabase/functions/`, and it becomes the URL slug, so the URL is `/functions/v1/manage-family`:
   ```bash
   npx supabase login
   npx supabase functions deploy manage-family --project-ref <project-ref> --no-verify-jwt
   ```
   `--no-verify-jwt` is needed because the function checks the caller's session itself. (The dashboard's **Deploy a new function → Via editor** also works, but its editor may make up a slug of its own, as it did for the development project.)
4. **Tell the app the slug.** The app calls the slug in `src/config/functions.ts`: `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION` if it is set, otherwise **`dynamic-api`**, the slug the dashboard editor gave the development project's function (its dashboard shows the name manage-family, but the URL is `/functions/v1/dynamic-api`). For a project deployed with the CLI, add `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION=manage-family` to `.env` (and, for a store build, to the EAS environment: `docs/RELEASE-STEPS.md`). The function's **Details** page shows its URL; the slug is its last part.

### 4b. If you deployed pair-phone before

PIN pairing was removed on 2026-11-16 (`docs/PIN-REMOVAL-PLAN.md`): the person's phone signs in with Their login only. If an earlier release had you deploy it, delete the function **`hyper-function`** under **Edge Functions**, and the secret **`PAIRING_PEPPER`** under **Edge Functions → Secrets**. The pairing tables stay in the schema until you drop them by hand (`HANDOFF.md` has the optional SQL).

### 5. Check it against the real project

`node supabase/tests/live.test.mjs` checks the live project with only the publishable key, the way the app does. It creates test caregivers on the reserved `caregiver.evermore.invalid` domain, which can't receive mail, and checks:
- sign-up and consent
- the private photos and signed URLs
- the Edge Function
- that one family can't reach another
- that deleting an account removes every row, photo and login

Then it deletes every account it made, and finishes a run that stopped early the next time. It needs Confirm email off.

To check by hand that families are kept apart, open `supabase/tests/rls-check.sql`, fill in two caregiver ids, and run it in the SQL Editor: every count must be 0. `supabase/tests/leftovers.sql` lists any test accounts or photos left behind.

## AI questions

AI can write new question sentences from a person's approved facts. It is off by default, and needs no sign-in. Everything it writes waits for the caregiver's approval. `CLAUDE.md` has the rules, and `src/config/features.ts` the switch.

**What leaves the phone:** one person's approved facts, as text, when the caregiver taps Generate, with every name replaced by a placeholder. Never a photo, their real name, test data or a fact that may change. The function stores none of it. The server keeps only usage counters, against a hash of a random token.

You need a Supabase project and an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). Do these in order. Keys go only into the Supabase dashboard, never into the app, `.env`, git or a chat.

1. **Run the schema.** In a terminal: `pbcopy < ~/evermore-expo/supabase/schema.sql`. In Supabase open **SQL Editor → New snippet**, paste, and choose **Run**. This adds the limits tables, with AI switched off. It's safe to run again.
2. **Copy the function.** In a terminal: `pbcopy < ~/evermore-expo/supabase/functions/generate-questions/index.ts`.
3. **Deploy it.** In Supabase open **Edge Functions → Deploy a new function → Via editor**. Name it `generate-questions`, replace everything in the editor with what you copied, and deploy. Or, from this folder, with the CLI and its name: `npx supabase functions deploy generate-questions --project-ref <project-ref> --no-verify-jwt` (then skip step 4).
4. **Turn Verify JWT off.** On the function's **Details** tab, turn **off** "Verify JWT" (it may read "Enforce JWT verification"), then save. AI has no login, so the function makes its own checks.
5. **Check the URL.** The function's page shows its URL. The development project's ends in `/functions/v1/clever-service`, the default of `GENERATE_QUESTIONS_FUNCTION` in `src/config/functions.ts`. If it ends in anything else (a CLI deploy ends in `generate-questions`), set `EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION` to that last part in `.env`.
6. **Add the key.** Open **Edge Functions → Secrets**. Add a secret named `ANTHROPIC_API_KEY` and paste your key as its value there. The function also uses the `EVERMORE_SECRET_KEY` secret from [Deploy the Edge Function](#4-deploy-the-edge-function), or Supabase's built-in key if the project has one.
7. **Set a spending limit at Anthropic.** In the Anthropic Console, set a monthly spend limit you're comfortable with. This is the backstop behind the cap below.
8. **Set the limits and turn it on.** In the SQL Editor, choose **New snippet**, paste this, and choose **Run**:
   ```sql
   update public.ai_settings set enabled = true, global_day = 20, per_install_hour = 5, per_install_day = 20, updated_at = now();
   ```
   `global_day` is the spending ceiling: requests a day across every install. It starts at 20 for testing. A request costs about $0.09 at the very most, so 20 a day can't pass about $1.80 a day. A usual one costs far less. Raise it when you're ready.
9. **Turn it on in the app.** In `src/config/features.ts`, change `export const AI_VARIANTS_ENABLED = false;` to `true`, then run `npx expo start --clear`.
10. **Try it.** Hold **Caregiver**, open **People**, and open a sample person such as June. Approve their stories if they wait for approval. Tap **Generate new questions** and agree. New sentences appear under **To review**.

**To turn it off:**
- **At once, for everyone (the kill switch):** run this in a new snippet. The app then says "New questions are turned off for now." Sentences already approved stay in practice, because they're on the phone.
  ```sql
  update public.ai_settings set enabled = false, updated_at = now();
  ```
- **To change the ceiling:** run `update public.ai_settings set global_day = 50, updated_at = now();` with the number you want.
- **On a phone:** **Settings → AI questions → Off**, or untick **AI questions** on one person's sheet. Their sentences leave practice and are kept.
- **In the app altogether:** set `AI_VARIANTS_ENABLED` back to `false`. Nothing about AI shows, and approved sentences stay out of practice.

**If it doesn't work:** "New questions couldn't be written just now" means the function reached the model and it failed. Open the function's **Logs** and find the line starting `generate-questions failed`. "New questions are turned off for now" means `enabled` is false, or the key or limits table can't be read. Logs never hold anyone's facts.

**After changing the function:** repeat steps 2 and 3, pasting over the old code. The model is the one constant `MODEL` at the top of the file.

## Run it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. Connect your phone to the same Wi-Fi as your computer.
3. In this folder, run `npm install` (first time only), then `npx expo start`.
4. Scan the QR code: on iPhone with the Camera app, on Android from inside Expo Go.

On iPhone, turn off silent mode to hear each sentence read aloud.

If the phone can't reach the computer, `npx expo start --tunnel` works too, but it relays the app through a tunnel service. While sign-in is off the bundle carries the family photos, so prefer the same Wi-Fi.

### Try it with sign-in off

1. The home screen opens with "Hello." and today's progress. Tap **Aa** to try the four text sizes.
2. Tap **Start**. Choose other names to see the hints, one more each time (another fact, the relationship, the first letter, fewer names, then the answer itself), then the right one: the name fills in, the sentence is read aloud, and the soft banner offers **Next story**. Cards are asked in different ways: a sentence with a blank, a question about them, "Who is this?" with a fact, or the photo alone.
3. Practice to the wrap-up. A day is a real session: about 3 questions per person, "About 8 minutes today". The read-back stays until you tap **Next story**, which is ready as soon as the right name is chosen. Stop at any card with the Home icon and pick up with **Keep going**. Once the day's session is done, the home says "Nice work. You can keep practicing, or come back in the morning." and **Keep practicing** offers a mix, or one person again, at any hour. A new study day begins at 05:30.
4. Hold **Caregiver** for a second. The dashboard opens on **Today**; look through **Trends**, **People** and **Settings**, where **Session length**, **Reveal cards** and the text size can change.
5. On **People**, tap **Add a person**: a name is enough to save a draft. **Continue** goes through the guided profile, one section per step, with **Finish later** at the top and **Back** and **Continue** pinned at the bottom; answers save as you type. A person joins practice by themselves at 100%: a name, a photo, a relationship, one interest and one shared memory, each answered or marked **Not applicable**, all marked with an asterisk. Below that they stay a **Draft** in the People tab and never appear in practice. Review lists whatever is still needed as links, and then each story still needs approving. A fact that may change, like a job or a plan, shows with its month once you **Confirm** it.
6. Tap someone's picture: **Profile X% complete** says how much of the form is done, **Resume profile** picks up where you left off, **Stories** lists every way each fact can be asked (turn any off), **Edit details** changes them, the **Hints** checkboxes choose their hints, **Practice with them now** hands the phone over straight into their cards, **Include in practice** takes them out of practice while keeping their profile (the People tab then says **Not in practice**), **Reveal cards** lets their photo start behind a "?", and **Archive** sets them aside with everything kept (Undo, or **Restore** under **Archived people**). **Delete permanently** is only on an archived person's sheet, and works once you type “delete”.
7. The 7 real example people start with made-up answers so they reach 100%, each tagged **Test data**. They stay on the phone. No control in the app removes them: start once with `EXPO_PUBLIC_CLEAR_TEST_DATA=1 npm run start:local` (development only), and those people go back to their real percentage and leave practice until their profile is finished. The 5 fictional sample people have ordinary facts, which stay. The real people and their photos exist in development builds only.
8. **Settings → Back to the home screen** hands the phone back.

### Try it with sign-in on

1. The welcome shows **I am practicing** and **I am a caregiver**. Tap **I am a caregiver**, then **Create an account**: email, password (tap **Show** to see it; the hint under it encourages a longer one) and the same again, then tick the consent statement. With Confirm email off the dashboard opens at once, with 5 sample people, all drafts until their profiles are finished, so the person sees no stories before that. With it on, "Check your email": open the link in the email, come back and tap **Continue** (or enter the code, if the email has one).
2. **Settings** starts with "Signed in as" and your email. Sign out, then sign in with a wrong password: "That email and password didn’t match." After five misses in a row, sign-in pauses for a minute.
3. **Forgot password?** emails a 6-digit code (the same calm answer for any address). Type it with a new password. This needs custom SMTP and the code in the Reset password template (see [Before launch](#before-launch) and `docs/FORGOT-PASSWORD.md`, which has why it fails without them); it isn't verified against the live project yet.
4. On the dashboard, open **Settings → The person's phone → Their login**. Give a first name, a User ID such as `rose.m`, and a password.
5. **Settings → Sign out**, tap **I am practicing**, and sign in with that User ID and password: "Hello", then **Continue**. The phone stays signed in from then on; holding **Caregiver** on the person's home (and confirming) signs it out.
6. Tap **Start** and practice until the wrap-up. The progress bar on the home screen moves up.
7. Turn on airplane mode, practice a few cards, then turn it off. The cards reach the server, which you can check on the caregiver dashboard.
8. Sign in as the caregiver again (or use a second phone): **Trends → Insights** shows the person's practice, with "Last updated" at the top and the Memory score once a day has 10 cards. Pull down to fetch again.
9. **Settings** is Account, The person's phone (Their login), Practice, Privacy and data (with **Export my data**: a data file of everything, a report as a PDF, and photos as a zip if you tick Include photos), About, and **Delete account** last and apart. There are no developer controls in the app.
10. **People** shows each person as a picture card; tap one for their profile, stories (and the ways each is asked), details, hints, or to archive them. **Add a person** works as with sign-in off, saving to Supabase and the private photo bucket.
11. **Settings → Delete account** removes every photo, row, card record and every login, once you type “delete”. **Export my data** is offered first.

## The schedule

`src/config/schedule.ts` sets when cards come back:

| Step | Comes back |
| --- | --- |
| 0 | 2 to 3 cards later, in the same session |
| 1 | 10 minutes |
| 2 | 1 day |
| 3 | 3 days |
| 4 | 7 days |
| 5 | 14 days |

A first-try answer with no hint moves a card up a step. A hint moves it back one step, never below 0.

**These intervals are placeholders and must be reviewed by a speech-language pathologist before real use.**

## Checks

```bash
npx tsc --noEmit
npx expo lint
node scripts/check-logic.mjs                # schedule, queues, completion, facts, phrasings, hints, the questionnaire, the phone's family, local practice, palette, type scale
node scripts/sync-ai-check.mjs              # copies src/lib/ai-check.ts into the generate-questions function
node supabase/tests/function.test.mjs       # the generate-questions function, with a mocked model
node scripts/check-sync.mjs                 # card records with sign-in on: the person's upload queue and the caregiver's Insights, against stand-ins
node scripts/check-export.mjs               # Export my data: the full history in pages, nothing secret, offline, the person's login refused, the report against Insights
node scripts/check-auth.mjs                 # sign-in: the forms, Confirm email either way, the session in secure storage, sign-out, the person's sign-in with Their login, Forgot password with a code, against an in-memory Supabase
node supabase/tests/rls.test.mjs            # the schema's Row Level Security and its upgrade, in PGlite, the unused pairing tables included
node supabase/tests/records.test.mjs        # card records through the schema: the same Insights from the server as from the phone
node supabase/tests/live.test.mjs           # the real project: needs .env and Confirm email off
npx expo export --platform ios --platform android --output-dir /tmp/evermore-check
```

## Before launch

Testing ran with **Confirm email** off and without custom email, so the email code steps (confirming a new account, and resetting a password) are not verified yet. Before real use:

1. **Set up custom SMTP.** In **Authentication → Emails → SMTP settings**, enter your email provider's SMTP details. Supabase's built-in email only reaches your Supabase team, about 2 messages an hour, and its templates can't be edited until custom SMTP is on. Then raise **Authentication → Rate Limits → Rate limit for sending emails**. A provider is a new third party: add it to the data inventory and the policy.
2. **Put the code in the email templates.** The app asks for the 6-digit code, not a link (a link can't open the app in Expo Go). In **Authentication → Emails → Templates**, put `{{ .Token }}` in both **Confirm signup** and **Reset password**, and take the link out. `docs/FORGOT-PASSWORD.md` has a full template, and the OTP length (6) and expiry (one hour) to keep.
3. **Turn Confirm email back on:** **Authentication → Sign In / Providers → Email → Confirm email**, then **Save**. `mailer_autoconfirm` at `<project URL>/auth/v1/settings` should then be `false`.
4. **Test both email flows on a phone:**
   - sign up with a real address and enter the code
   - use **Forgot password?** and set a new password with the code
5. **Remove test accounts:** run `supabase/tests/leftovers.sql` in the SQL Editor.
6. **Get the two reviews** the app already flags: legal review of the privacy policy (`docs/privacy-policy-draft.md`, every `[REVIEW]` note numbered at the end), and a speech-language pathologist's review of the schedule intervals.
7. **Rerun `supabase/schema.sql`** after 2026-11-13: it adds the `consents` table and a sign-up trigger that refuses an account without both agreements. Existing caregivers are asked to agree to the policy the next time they open the app.
8. **Host the policy page** and fill in its placeholders: `docs/testflight-checklist.md`.

## Privacy

- Tandem has no analytics or ad SDKs and never sells or shares data. It runs no AI or face recognition on photos.
- AI questions are off by default. Turned on, one person's approved facts go to an AI service (Anthropic) when the caregiver taps Generate, as text, with every name replaced by a placeholder, after a one-time consent. Tandem stores none of it, and the caregiver approves every sentence before it reaches practice. See [AI questions](#ai-questions).
- Photos are in a private bucket, shown only through signed links that expire after an hour.
- The 7 example family photos in `assets/photos/` stay on this computer and your phone. The folder is gitignored. In the local-only mode the app shows them, so Metro bundles them and the dev server sends them to the phone; they are in the bundle with sign-in on too, though never shown. Don't run `eas update` or `eas build` while they are there, and prefer the same Wi-Fi to `--tunnel`.
- With sign-in on, each card's practice record is uploaded from the person's phone for the caregiver's Insights: ids, how the card was asked, each answer chosen and when, the hints and the time on the card, never a name, a photo or anyone's words. The person's login can send them but never read them; only the caregiver's login reads them. They are kept 120 days, and go with the person or the account when deleted. Test data stays on the phone.
- With sign-in off, everything is kept only on the phone: the people and facts the caregiver adds (photos are copied into the app's own folder), and practice, of which only completion is kept (which cards were finished and when) plus the last way each person was asked.
- The privacy policy is a **draft that needs legal review**: one source (`src/lib/privacy-policy.ts`), shown in the app and written to `docs/privacy-policy-draft.md` and `docs/privacy-policy.html` by `node scripts/build-policy.mjs`. It rests on `docs/DATA-INVENTORY.md`; change both whenever data handling changes.
- No account is made without the caregiver's agreement to the policy and confirmation that they may add the people they include. Research use is a separate choice, optional and off. Agreements are versioned records on the server, and a new policy version asks every caregiver again.
