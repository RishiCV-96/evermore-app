# Release steps: the first TestFlight build

Written 2026-11-17 for the `testflight-prep` branch. These are the steps you run yourself, with your own logins, in order. Each says what you should see, and what to do if it fails. Nothing here was run against Supabase, Expo or Apple when it was written: the commands and screens are from their documentation and this repository's code, so if a screen reads differently, trust the screen and check the linked page.

Use `npx eas-cli@latest` wherever Expo's docs say `eas` (`AGENTS.md`). Never paste a key, password or token into a chat.

**What a production build is.** Sign-in on (`AUTH_ENABLED`: `eas.json` pins `EXPO_PUBLIC_LOCAL_ONLY` to `"0"`), AI questions off (`AI_VARIANTS_ENABLED = false`), no developer flag (`EXPO_PUBLIC_CLEAR_TEST_DATA` works only in development builds), and only the five fictional sample people. Your real cards and photos can't reach it three ways over: they load only when `__DEV__` is true, which a release never is; `.easignore` keeps the files out of the upload; and `npm test` fails if either changes (`scripts/check-store.mjs` checks the upload, `scripts/check-release.mjs` the bundles).

## What you need first

- The Apple Developer Program, with its agreements accepted in App Store Connect → Business (`docs/testflight-checklist.md` §9).
- One Expo account that will own the project. Pick it once and keep it: the project, its build numbers and its credentials live under that account.
- The production Supabase project, with its URL and publishable key at hand (**Project Settings → API Keys**).
- This branch merged, `npm install` run, and `npm test` passing.

## The production environment variables

The app reads exactly these four, all `EXPO_PUBLIC_` (inlined into the app, so public by design). Create them in the EAS **production** environment (Part C, step 4), and the same four in `.env.local` for the gate test (Part B).

| Name | Value it needs | Visibility on EAS |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | The production project's URL, `https://<production-ref>.supabase.co` | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The production project's **publishable** key (`sb_publishable_…`, or the legacy anon key). Never the secret or service-role key | Sensitive |
| `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION` | `manage-family` | Plain text |
| `EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION` | `generate-questions` | Plain text |

Never create `EXPO_PUBLIC_LOCAL_ONLY` or `EXPO_PUBLIC_CLEAR_TEST_DATA` on EAS. Without the two function variables the app calls the development project's slugs (`dynamic-api`, `clever-service`), which don't exist in production: Their login and Delete account would fail. Without the URL or key the app stops at launch with a message naming them.

## Part A. The production Supabase project

### A1. Run the schema

**SQL Editor → New query**, paste the whole of `supabase/schema.sql` (`pbcopy < supabase/schema.sql`), **Run**.
- **You should see** "Success. No rows returned".
- **If it fails**, the message names the line. Rerunning is safe: the file is written to be run again.

### A2. Auth settings

**Authentication → Sign In / Providers → Email** (older dashboards: **Providers → Email**):
- **Minimum password length**: 8, as the app asks.
- **Email OTP Length**: 6. The app asks for the 6-digit code.
- **Email OTP Expiration**: 3600 seconds (an hour). The code template's words say an hour; change both together.

### A3. The function's secret key

1. **Project Settings → API Keys → Secret keys → Add new secret key**. Copy it (it starts `sb_secret_`).
2. **Edge Functions → Secrets → Add**: name `EVERMORE_SECRET_KEY`, value the key. It goes only here: never in the app, `.env`, EAS or git.

### A4. Deploy manage-family with the CLI, by name

From this folder:

```bash
npx supabase login
npx supabase functions deploy manage-family --project-ref <production-ref> --no-verify-jwt
```

- **You should see** the deploy finish and name `manage-family`. In the dashboard, **Edge Functions → manage-family → Details** shows a URL ending `/functions/v1/manage-family`, and "Verify JWT" off. That last part is what `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION` must say.
- **If the URL ends in anything else** (the dashboard editor makes up slugs), set the variable to that last part instead.
- **If the deploy is refused**, check the project ref (the part before `.supabase.co`) and that `npx supabase login` used the account that owns the project.

### A5. generate-questions: not needed for this build

AI questions are off, and need sign-in off, so no production build can call it. Don't deploy it to production yet: nothing then needs `ANTHROPIC_API_KEY`. If you deploy it anyway, use its name (`npx supabase functions deploy generate-questions --project-ref <production-ref> --no-verify-jwt`) and leave `ai_settings.enabled` false, as the schema leaves it. Set `EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION=generate-questions` either way, so the variable is right on the day it is used.

### A6. Email: what the built-in sender can and can't do

- It **only reaches members of your Supabase team**, about two emails an hour.
- Its templates can't be edited until custom SMTP is set up, and they hold a **link, not a code**:
  - **Confirm signup**: the link works. It confirms the address in the browser (the page it opens may not load; that's fine), and the app's **Continue** then signs in.
  - **Reset password**: fails. The app asks for a 6-digit code the email doesn't contain (`docs/FORGOT-PASSWORD.md`).

### A7. Confirm email for the first night

**Authentication → Sign In / Providers → Email → Confirm email.** For tonight's gate test, with only your own team address signing up, either setting works:
- **Off** is simpler: sign-up needs no email, which leaves the hour's few emails for the reset test.
- **On** also works with a team address: tap the link in the email, come back, tap **Continue**.

**It must be on before anyone else signs up**, and that needs A8 first. With it off, anyone can create an account with an address they don't own. With it on and the built-in sender, nobody outside your team can confirm, so they can't sign in at all.

### A8. Before any other tester signs up (internal or external)

1. **Custom SMTP**: **Authentication → Emails → SMTP Settings** (a provider such as Resend, Postmark, Amazon SES or Brevo, with a verified sender domain).
2. **Templates with the code**: **Authentication → Emails → Templates**. In **Reset Password** and in **Confirm signup**, put `{{ .Token }}` where the link was, and take `{{ .ConfirmationURL }}` out. `docs/FORGOT-PASSWORD.md` has a template to copy.
3. **Rate limit**: **Authentication → Rate Limits → emails per hour**, set to what testers will need.
4. **Confirm email on.**
5. **The SMTP provider is a new third party** that receives caregivers' email addresses. Name it in `docs/DATA-INVENTORY.md` and the privacy policy (`src/lib/privacy-policy.ts`), give the policy a new `POLICY_VERSION` (`src/lib/consent.ts`), run `node scripts/build-policy.mjs`, and host the new page. Caregivers who agreed to the old version are asked again.

## Part B. The production gate test (Expo Go, before any build)

This proves the production project works with this code before anything is built. Use only invented people and photos of objects, never a real person: this is the real production database.

### B1. Point the app at production

Create `.env.local` in this folder (it overrides `.env`; both are gitignored and never uploaded):

```
EXPO_PUBLIC_SUPABASE_URL=https://<production-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<production publishable key>
EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION=manage-family
EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION=generate-questions
```

Then:

```bash
git check-ignore -v .env.local   # should print a .gitignore line ending in .env.local
git status --short               # should not list .env.local
npx expo start --clear
```

- **You should see** the QR code. Scan it with the iPhone's Camera, on the same Wi-Fi. The app opens on the welcome: **I am practicing** and **I am a caregiver**.
- **If it says the app needs `EXPO_PUBLIC_SUPABASE_URL`**, a name in `.env.local` is misspelled, or the server was started without `--clear`.

### B2. Sign up

**I am a caregiver → Create an account.** Use an email address that belongs to your Supabase team, and a password of at least 8 characters (typed twice). Tick both required boxes (the privacy policy, and that you may add the people you include). Leave research unticked. Tap **Create account**.
- **You should see**, with Confirm email off, the caregiver dashboard. With it on, "Check your email": open the email on the phone, tap its link, come back to the app, and tap **Continue**.
- **If it fails** with a calm "couldn't create the account" message, check that A1 ran. The database refuses any account without both agreements.

### B3. Add a fictional person

**People → Add a person.** Use an invented name (for example "Wren") and relationship. For the photo, tap **Not applicable**, or pick a photo of an object. Add one interest and one shared memory, then **Review → Continue**, and approve each story.
- **You should see** them on People with no "Draft" label.

### B4. A second person, so practice can start

Practice needs at least two people in the deck. The five sample people start as drafts. Open **June**, tap **Resume profile**, add an interest and a shared memory, **Review → Continue**, and approve her stories.
- **You should see** June without "Draft" too.

### B5. The person's login

**Settings → The person's phone → Their login** (the sheet is titled "Make their login"). Type a first name, an invented User ID (for example `gate.test`) and a password, and save.
- **You should see** "Saved. On their phone, choose “I am practicing” and sign in with User ID “gate.test”…", and the row then shows the User ID.
- **If it says something didn't work on the server**, the function call failed: check `EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION` against the function's URL (A4) and the `EVERMORE_SECRET_KEY` secret (A3), then restart with `--clear`. The function's **Logs** say `401 signed-out`, `403 caregivers-only`, or `500 server-cannot-read` for a wrong or missing secret.

### B6. Practice one card

**Settings → Sign out**, then **I am practicing**. On **Hello**, type the User ID and password and tap **Continue**. On the home, tap **Start**, then tap a name.
- **You should see** a photo and a sentence with a blank, then, on the right name, the full sentence read back. Leave the session there.
- To return to the caregiver: on the person's home, hold **Caregiver** and confirm. That signs the person out.

### B7. Request a password reset (expected to fail for now)

**I am a caregiver → Sign in → Forgot password?** Type your address, then **Send code**.
- **You should see** "If that email has an account, we have sent a code." The email, if it arrives within the hour's limit, holds a link and no code, so the reset can't finish in the app. **This is expected** until custom SMTP and the `{{ .Token }}` template (A8). Go back and sign in with your password.

### B8. Delete the account

Signed in as the caregiver: **Settings → Delete account**. Optionally **Export my data first**. Type `delete`, then tap **Delete everything**.
- **You should see** the app return to the welcome.
- **Check in the dashboard**: **Authentication → Users** no longer lists your address or `gate.test@person.evermore.invalid`; **Storage → photos** has no folder for the account; **Table Editor → people** has none of its rows. `supabase/tests/leftovers.sql` lists anything left behind.
- **If it fails** with a server message, it is the same function as B5: check the slug and the secret.

### B9. Why the dashboard's "Create user" can never make a caregiver

The rule `on_auth_user_created` runs `public.handle_new_user()` for every new login. It refuses, and takes the whole sign-up with it, unless the login's metadata says `agreed_policy` and `agreed_responsibility` are true and gives a dated `policy_version`. Only the app's sign-up sends that metadata. The dashboard's **Authentication → Users → Add user → Create new user** form can't, so Supabase answers with a database error and makes nothing. Make every caregiver, the App Review demo included, through the app.

### B10. Put development back

```bash
rm .env.local
npx expo start --clear
```

`.env.local` overrides `.env` for everything run in this folder, `npm test` and exports included, so don't leave production values in it.

## Part C. Expo, the build and TestFlight

### C1. Check the code once more

```bash
npm test
```

- **You should see** `All 15 suites passed`. `check-store.mjs` prints the upload's size (about 240 files, under 5 MB) and that the screenshot folders are left out.
- **If anything fails**, stop: don't build until it passes.

### C2. Log in to Expo

```bash
npx eas-cli@latest login
```

Use the one account you chose. `npx eas-cli@latest whoami` shows it.

### C3. Create the EAS project

```bash
npx eas-cli@latest init
```

- **You should see** it offer to create the project `@<your account>/evermore`. Say yes. It adds `owner` and `extra.eas.projectId` to `app.json`. Neither is secret: commit that change.
- The slug `evermore` stays, on purpose (`docs/BRAND-AUDIT.md`): it is an internal identifier, never shown.

### C4. Create the production variables

Use the table above. One at a time, with your real values:

```bash
npx eas-cli@latest env:set production --name EXPO_PUBLIC_SUPABASE_URL --value "https://<production-ref>.supabase.co" --visibility plaintext
npx eas-cli@latest env:set production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<production publishable key>" --visibility sensitive
npx eas-cli@latest env:set production --name EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION --value manage-family --visibility plaintext
npx eas-cli@latest env:set production --name EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION --value generate-questions --visibility plaintext
npx eas-cli@latest env:list production
```

- **You should see** exactly those four names listed for production. (The project's page on expo.dev, under **Environment variables**, does the same without the values passing through your shell history.)
- Never use `secret` visibility for these: EAS can't use a secret variable in the app's code. If you ever make preview builds, create the same four in the **preview** environment too.

### C5. Build

```bash
npx eas-cli@latest build --platform ios --profile production
```

The first time, it asks to log in to your Apple account (Apple ID, password, the two-factor code), and offers to register the bundle identifier `com.rishiverma.memorypractice`, a distribution certificate and a provisioning profile. Say yes to each. It initializes the remote build number (starting at 1; every later build raises it).
- **You should see** the upload's size (a few MB), a line listing the four variables loaded from the production environment, then a build page link. A build takes about 15 to 30 minutes and ends with an `.ipa`.
- **If the upload is 20 MB or more**, the screenshot folders weren't left out: stop and check `.easignore`.
- **If it says the bundle identifier isn't available**, another developer has it. Choose another neutral one, change `app.json` (both platforms) and `BUNDLE_ID` in `scripts/check-store.mjs`, and rerun `npm test`.
- **If it says an agreement is missing**, accept it in App Store Connect → Business.
- **If the build log names a missing variable**, recheck C4.

### C6. The app in App Store Connect

**Apps → + → New App**: iOS, the name (`docs/app-store-listing.md` has options and a fallback if "Tandem" is taken), English (U.S.), bundle ID `com.rishiverma.memorypractice`, any SKU (for example `memorypractice-ios`), Full Access. Then **App Information** shows its **Apple ID**, a number.

Put that number, and your Team ID (developer.apple.com → Membership), in `eas.json` in place of the two `REPLACE_WITH_…` placeholders. Neither is secret. Or delete both lines and EAS asks each time. Never write your Apple ID email, a password or an App Store Connect key into the file: EAS asks for the Apple ID, or reads `EXPO_APPLE_ID` from your shell.

### C7. Submit to TestFlight

```bash
npx eas-cli@latest submit --platform ios --profile production
```

Choose the build from C5.
- **You should see** the upload finish. App Store Connect then processes the build (5 to 30 minutes) and emails you. It won't ask about encryption: `ITSAppUsesNonExemptEncryption` is false.
- **If the email lists ITMS-90683** (a missing purpose string, such as the camera's): Apple's scan saw the image picker's camera code, which the app never opens. Add a calm camera string to the `expo-image-picker` plugin in `app.json` in place of `false`, update `scripts/check-store.mjs` to match, and build again.
- **If it lists ITMS-91053** (a missing API declaration): add the type and reason it names to `ios.privacyManifests` in `app.json`, and build again.

### C8. Internal testers

They must be users of your App Store Connect team (up to 100). Add them in **Users and Access**, then **TestFlight → Internal Testing → +**: make a group, add them, and add the build. No review is needed. Each gets an email, and installs through the TestFlight app. `docs/TESTER-GUIDE.md` is the note to send. **Do A8 before anyone but you signs up.**

### C9. External testers (family and friends)

**TestFlight → External Testing → +**: make a group, then invite by email or with a public link. The first build for an external group goes to **Beta App Review** (often about a day), and needs, under **Test Information**:
- **Beta App Description** and **Feedback Email**.
- **A privacy policy URL**: a public page serving `docs/privacy-policy.html` (`docs/testflight-checklist.md` §2). Fill in its placeholders first.
- **Sign-in information**: a demo caregiver account that doesn't expire. Make it in the app on production, with an address you control and a password used nowhere else. Complete two sample people, make Their login, and agree to the current policy. Put both logins in the review notes (`docs/app-store-listing.md`).
- **What to Test** (`docs/app-store-listing.md`).

A8 must be done first, and `SUPPORT_EMAIL` in `src/config/brand.ts` filled in (and the policy's contact, with a new policy version), so testers have somewhere to write.

## Every later build

1. `npm test`.
2. `npx eas-cli@latest build --platform ios --profile production` (the build number rises by itself).
3. `npx eas-cli@latest submit --platform ios --profile production`.
4. Add the build to your TestFlight groups.

If the database changed, rerun `supabase/schema.sql` in production first. If `manage-family` changed, deploy it again with the A4 command.
