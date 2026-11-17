# Brand audit: from Evermore to Tandem

Written 2026-11-16, on the branch `brand-tandem`, before any code changed. "Tandem" is a placeholder name pending trademark clearance. It lists every trace of the old name and decides what changes.

The brand kit (`./brand-kit`, from `tandem-brand-kit.zip`, 20 files) is the source of truth for the logo, icons and favicon. Its SVGs hold no scripts, links or embedded images: only circles, clip paths, masks and the outlined wordmark.

**What the kit has, and what was made from it.** The reversed logo and the navy app icon use lighter tints on Ink (pink `#F27BB0`, sky `#A5D2F5`, sun `#F9D66B`, wordmark white), not the six base colors. The kit has no reversed stacked logo and no Android adaptive foreground, so both are composed from the kit's own shapes and colors (the stacked layout with the reversed colors; the mark with a safe-zone margin), never redrawn.

## Decisions already made (2026-11-16)

- **The brand kit:** the designer's files, copied as they are into `./brand-kit`. Nothing is rebuilt from the guide image.
- **Pinks stay caregiver-side.** The hard rule in `CLAUDE.md` holds: Rose and Deep Rose never appear on a person-facing screen. On caregiver screens, links and small accents become Deep Rose, and the Insights pinks move to Rose and Deep Rose. Person screens use Ink, Sky, Mist and Sun, plus the logo's own colors in the logo itself.
- **Main buttons are Ink with white text** (13.9:1), on both sides. Progress bars were Sky on a Mist track; since the follow-up the same day, Ink (person) or Deep Rose (caregiver), outline and fill.

## How the search was done

- `git grep -i -P "(?<![a-z])ever[ -]?more"` over every tracked file, so "Evermore", "EverMore", "Ever more", "Ever-more" and "evermore" all match. The lookbehind stops "never more" from matching: a plain `ever[ -]?more` matched comments in `src/lib/queue.ts:76` and `src/lib/insight-scale.ts:41`, which are not the name.
- Untracked files: none outside `.gitignore`.
- Ignored files, outside `node_modules`, `.git`, `brand-kit` and the private files (`deck.local.ts`, the denylist, `assets/photos/`): `.env`, `.expo/` and `expo-env.d.ts` don't contain the name. `.expo/web/cache/` holds a built copy of the old favicon, which is a cache and is rebuilt.
- Images were checked by eye, since grep can't read them (listed below).
- No existing text says "tandem", so nothing collides with the new name.

## Front-facing: change

Each of these becomes a value from `src/config/brand.ts` (`APP_NAME`, `APP_NAME_LOWER`, `TAGLINE`, `SUPPORT_EMAIL`, `POLICY_CONTACT`), or new art from the kit.

### App config and images

| File | Line | What it is | Decision |
|---|---|---|---|
| `app.json` | 3 | `"name": "Evermore"`: the name under the home screen icon, in the phone's Settings and the notification header | front-facing, change |
| `app.json` | 7 | `icon`: `assets/images/icon.png` | front-facing, change (the kit's 1024 navy icon) |
| `app.json` | 11–12 | Android adaptive icon: background `#A9D8F5` (old sky), foreground `android-icon-foreground.png` | front-facing, change (the mark with a safe zone, on Ink) |
| `app.json` | 17 | `web.favicon`: `favicon.png` | front-facing, change (the kit's favicon) |
| `app.json` | 23–27 | Splash: white background, `splash-icon.png` at 120 wide | front-facing, change (Mist with the stacked logo; a dark variant on Ink with the reversed logo) |
| `assets/images/icon.png` | (image) | Old app icon: brain, claw and yellow orb on sky blue | front-facing, change |
| `assets/images/android-icon-foreground.png` | (image) | Old adaptive icon foreground | front-facing, change |
| `assets/images/favicon.png` | (image) | Old favicon | front-facing, change |
| `assets/images/splash-icon.png` | (image) | Old splash art | front-facing, change |
| `assets/images/logo-wordmark.png` | (image) | Old landscape logo with the word "EVERMORE" in the art | front-facing, change (replaced by `<TandemLogo />`) |
| `assets/images/logo-mark.png` | (image) | Old mark (brain and claw) on the dashboard header and the wrap-up | front-facing, change |
| `assets/images/photo-placeholder.png` | (image) | Neutral person silhouette in light blues, no brand | not the name, leave |

### Screens, messages and accessibility labels

| File | Line | What it is | Decision |
|---|---|---|---|
| `src/components/logo.tsx` | 49 | Logo `accessibilityLabel="Evermore"` (welcome, sign-in, Hello, create account, person's home) | front-facing, change |
| `src/components/logo.tsx` | 7 | Comment: "The landscape Evermore logo" | comment in a guarded file, change |
| `src/app/caregiver/index.tsx` | 105 | Dashboard header mark, `accessibilityLabel="Evermore"` | front-facing, change |
| `src/components/sign-in/welcome.tsx` | 52 | "…create one to set up Evermore for someone you care for." | front-facing, change |
| `src/components/sign-in/welcome.tsx` | 54 | "Evermore is a practice tool, not a medical device." | front-facing, change |
| `src/components/sign-in/caregiver-sign-in.tsx` | 79 | "Evermore is a practice tool, not a medical device." | front-facing, change |
| `src/components/reminders.tsx` | 133–134 | The person's calm line when reminders are off: "…then Notifications, then Evermore." The name must match `app.json`'s, since it tells them where to look in the phone's Settings | front-facing, change |
| `src/components/ai-questions.tsx` | 127 | AI consent: "Evermore keeps none of it…" | front-facing, change |
| `src/components/export-data.tsx` | 176 | "Evermore can’t read an export back…" | front-facing, change |
| `src/lib/auth-form.ts` | 152 | `OFFLINE`: "We couldn’t reach Evermore…" | front-facing, change |
| `src/lib/auth-form.ts` | 199 | "Evermore can’t send email to that address yet…" | front-facing, change |
| `src/lib/load-problem.ts` | 28, 36 | "…until Evermore’s server is updated…" | front-facing, change |
| `src/lib/export.ts` | 114 | `RESTORE_WORDS`: "Evermore can’t read this file back…" | front-facing, change |
| `src/lib/export.ts` | 118 | Export file names: `evermore-data-….json`, `evermore-report-….pdf`, `evermore-photos-….zip` | front-facing, change (`tandem-…`) |
| `src/lib/export.ts` | 116 | Comment giving those file names | comment, change with them |
| `src/lib/export.ts` | 150, 343 | `app: 'Evermore'` in the data file's header (the full file and this phone's copy) | front-facing, change (the format number stays 2) |
| `src/lib/export.ts` | 409 | `EXPORT_PROBLEM['server-update']`: "…until Evermore’s server is updated…" | front-facing, change |
| `src/lib/insight-report.ts` | 292, 318 | Report PDF `<title>` and `<h1>`: "Evermore practice report". The footer (322–327) doesn't name the app | front-facing, change |
| `src/lib/save-file.ts` | 32 | Share sheet title: "Save your Evermore export" | front-facing, change |
| `src/lib/supabase.ts` | 14 | Error shown to a developer when `.env` lacks the Supabase values | developer-facing, change |
| `src/theme/colors.ts` | 1 | Comment: "Evermore's palette, from the logo (logo-wordmark.png)". The comments below it describe the old logo's claw, orb and brain | comment, change with the palette (step 2) |
| `src/lib/stories.ts` | 1 | Comment: "Story building for Evermore." | comment in a guarded file, change |
| `src/components/insight-brain.tsx` | 5 | Comment: "drawn for Evermore in the spirit of the brain in its logo" | comment, change (see "Needs my decision") |
| `src/lib/local-practice.ts` | 25 | Comment: "When this phone first opened Evermore" | comment in a guarded file, change |

### Consent and the privacy policy (step 6: a new `POLICY_VERSION`)

| File | Line | What it is | Decision |
|---|---|---|---|
| `src/lib/consent.ts` | 24, 26, 28 | `SIGN_UP_SUMMARY` on Create an account | front-facing, change |
| `src/lib/consent.ts` | 36 | `AGREE_RESPONSIBILITY`: "…knows I’m using Evermore." | front-facing, change |
| `src/lib/consent.ts` | 40 | Research box: "Optional: Evermore may use de-identified information…" | front-facing, change |
| `src/lib/consent.ts` | 50 | `PolicyGate` words: "Evermore’s privacy policy has changed…" | front-facing, change |
| `src/lib/privacy-policy.ts` | 15 | `POLICY_TITLE`: "Evermore privacy policy" | front-facing, change |
| `src/lib/privacy-policy.ts` | 28, 31, 34, 75, 94, 132, 146, 238 | Policy heading and body text | front-facing, change |
| `scripts/policy-source.mjs` | 102, 120 | The policy HTML's `<title>` and `<h1>`, written into `docs/privacy-policy.html` | front-facing (generated page), change |
| `docs/privacy-policy-draft.md` | 1, 9, 11, 12, 29, 37, 59, 65, 108, 122, 124, 125, 126, 131, 132 | Generated from the two files above by `node scripts/build-policy.mjs` | front-facing, regenerate |
| `docs/privacy-policy.html` | 7, 25, 29, 31, 32, 53, 63, 91, 99, 156 | The page to host, generated the same way | front-facing, regenerate |
| `docs/app-store-privacy-answers.md` | 19, 45 | Draft answers for App Store Connect | front-facing, change |

### Docs others read

| File | Line | What it is | Decision |
|---|---|---|---|
| `README.md` | 1, 3, 5, 220, 221 | Title, description, privacy summary | front-facing, change |
| `README.md` | 70, 110 | The `EVERMORE_SECRET_KEY` secret's name | internal identifier, leave (see below) |
| `README.md` | 86 | The test domain `caregiver.evermore.invalid` | internal identifier, leave |
| `README.md` | 105, 106 | Paths `~/evermore-expo/…` (an old folder name, now `~/evermore-clean`) | internal path, leave and report |
| `README.md` | 200 | Example temp folder `/tmp/evermore-check` | internal, leave |
| `docs/testflight-checklist.md` | 32, 46, 56 | Review notes and the App Store description draft | front-facing, change |
| `docs/FORGOT-PASSWORD.md` | 53, 56 | The Reset password email template to paste into Supabase: "Reset your Evermore password", "Type it in the Evermore app…" | front-facing (an email), change in the file; Supabase itself is updated by hand |
| `docs/FORGOT-PASSWORD.md` | 32 | Quotes the `OFFLINE` message | change with it |
| `docs/FORGOT-PASSWORD.md` | 42 | The domain `person.evermore.invalid` | internal identifier, leave |

### Tests that assert the old front-facing text (change with it)

| File | Line | What it asserts |
|---|---|---|
| `scripts/check-logic.mjs` | 3302 | The logo reads as "Evermore" (and 3298 reads `logo-wordmark.png`'s size, 2916 and 3305 the logo files) |
| `scripts/check-logic.mjs` | 3584 | The data file's name |
| `scripts/check-logic.mjs` | 879 | `KEEPS_ITS_CAPITAL` lets "Evermore" keep its capital in the sentence-case check (add the brand name) |
| `scripts/check-logic.mjs` | 2039 | Assertion message only ("promises only what Evermore controls") |
| `scripts/check-export.mjs` | 506–508 | The three export file names |
| `scripts/check-privacy.mjs` | 80 | The policy page's `<title>` |

## Internal identifiers: leave and report

None of these is shown to anyone. Each is left as it is, and listed in the guard's allowlist (step 7).

| Identifier | Where | What changing it would break |
|---|---|---|
| Expo slug `evermore` | `app.json:4` | The Expo and EAS project link (`@owner/evermore`), and any update channel or build tied to it. EAS would treat it as a new project. |
| URL scheme `evermore` | `app.json:8` | Deep links `evermore://…`: the OS registration and any Supabase redirect URL on the allowlist. Forgot password now uses a code, not a link, so little uses it today. |
| Bundle ID and Android package | not set in `app.json` | Nothing is set yet (Expo Go). Choose them once the name clears trademark: after the first App Store or Play upload they can't change without a new app listing. |
| npm name `evermore-expo` | `package.json:2`, `package-lock.json:2, 8` | Nothing at runtime (the package is private). Renaming changes the lockfile and nothing else. |
| Folder `~/evermore-clean` (and the old `~/evermore-expo`) | paths in `README.md`, `HANDOFF.md`, `CLAUDE.md` | Every documented command path, and Claude Code's project memory, which is keyed by the folder path. |
| Storage keys `evermore.*` | `src/data/account.ts:77` (`profile`), `src/data/attempt-sync.ts:22, 25` (`recordQueue`, `recordBackfill`), `src/data/insights-store.ts:31` (`insightsCache`), `src/data/local-store.ts:42, 43` (`local`, `family`), `src/data/practice-store.ts:93` (`practice`), `src/data/reminders.ts:23` (`reminders`), `src/data/study-clock.ts:14` (`studyDay`), `src/data/text-size.ts:17` (`textSize`), `src/lib/attempts.ts:171–172` (`attempts`), `src/lib/install-token.ts:7` and `.web.ts:4` (`installToken`), `src/lib/notifier.web.ts:6` (`reminderStandIn`) | Every phone would lose what it saved: the local-only family, **practice and card records not yet sent** (the outbox and record queue), the text size, reminder settings and the offline profile. The study clock would restart, so a day could be handed out twice. A new install token resets AI rate counting. Needs a migration that reads the old keys. Also named in `docs/DATA-INVENTORY.md` (49–88, 122), which `scripts/check-privacy.mjs` checks against the code. |
| `evermore.device.v1` (an earlier build's credential) | `src/lib/session-storage.ts:130`, `.web.ts:35` | `forgetOlderCredential` deletes this exact key at sign-out. Renaming it would leave old credentials on phones forever. |
| Reminder ids `evermore.reminder.<study day>` | `src/lib/reminders.ts:28` | Reminders already scheduled under the old id would be orphaned: a phone could get two reminders a day for up to 3 days, until it opens. |
| Reserved domain `person.evermore.invalid` | `src/data/account.ts:35`, `supabase/functions/manage-family/index.ts:13`, `scripts/fakes/supabase-server.mjs:23` | Every existing person login is `<User ID>@person.evermore.invalid` in Supabase Auth. Changing it breaks sign-in on every person's phone, and the app and the function must change together (with a redeploy). |
| Reserved domains `caregiver.evermore.invalid`, `phone.evermore.invalid` | `supabase/tests/live.test.mjs:32, 34`, `supabase/tests/leftovers.sql:3–36`, docs | Test accounts and old paired-phone logins. `leftovers.sql` finds them by these domains. |
| User metadata flag `evermore_person` | `supabase/schema.sql:727`, `manage-family/index.ts:79`, `scripts/fakes/supabase-server.mjs:201, 571`, schema test fixtures | The sign-up trigger uses it to make a person profile instead of a caregiver. Existing users carry it. Changing it means a schema rerun and a function redeploy (out of scope: no Supabase changes). |
| Trigger message `evermore: a caregiver account needs both agreements` | `supabase/schema.sql:736` | A database error, never shown (the app has its own words). Changing it means rerunning the schema in Supabase. |
| Schema and function comments | `supabase/schema.sql:1`, `manage-family/index.ts:1, 7`, test fixtures `schema-before-*.sql:5` | Nothing, but editing the function means a redeploy, and the schema a rerun. Leave until the name is final. |
| Secret `EVERMORE_SECRET_KEY` | `manage-family/index.ts:29`, `generate-questions/index.ts:406`, `README.md` | Set in the Supabase dashboard. Renaming it in code breaks both functions until a secret of the new name is added and both are redeployed. |
| Function slugs `dynamic-api`, `clever-service` | `src/config/functions.ts` | Don't contain the name. Listed only so nothing renames them. |
| `EVERMORE_DENYLIST` env var | `scripts/denylist.mjs:27, 30`, `scripts/check-no-real-data.test.mjs:28–104` | The guard's self-test points it at a scratch file. Renaming is harmless if done in both places. |
| Temp folder and file names | `scripts/check-release.mjs:70`, `scripts/check-no-real-data.test.mjs:16`, `supabase/tests/live.test.mjs:97` | Nothing. |
| Test account prefix `evermore-test-` | `supabase/tests/live.test.mjs:2, 106–156` | `leftovers.sql` and people reading the Auth list rely on it. Rename both together if ever. |
| Storage keys and domains in tests | `scripts/check-auth.mjs` 496–1003, 1084, 1105–1109; `check-sync.mjs` 86–388; `check-reminders.mjs` 212–342; `check-export.mjs` 143, 284, 375; `check-logic.mjs:3054`; `check-privacy.mjs:103`; `supabase/tests/rls.test.mjs` 26–799, `records.test.mjs:54`, `live.test.mjs:235` | They assert the identifiers above and change only with them. |
| `'evermore'` and `'evermore1'` in the guessable-password list | `src/lib/auth-form.ts:100–101`, `scripts/check-auth.mjs:184, 199` | Removing them would rate those passwords as stronger. Leave (see "Needs my decision" about adding the new name). |
| `scripts/private-denylist.example.txt` | 13 | A developer note ("isn't from Evermore's code"). Not in the guard's scope. Leave until the name is final. |
| Developer docs | `CLAUDE.md` (7, 76, 95, 98, 123, 140, 162, 179, 181, 182, 188, 207, 213, 215, 218, 255, 298, 305, 311, 316, 317), `DESIGN.md` (1, 3, 28, 191, 272, 297, 387, 396, 586, 684), `DESIGN-UI.md` (1, 3, 11, 13, 14, 22, 38, 49, 421, 434), `HANDOFF.md` (3, 21, 44, 55, 110, 167, 222–257, 535–1663; 53 lines), `docs/DATA-INVENTORY.md`, `docs/QUESTION-AUDIT.md` (3, 10), `docs/STUDY-DAY-AUDIT.md` (3, 73), `docs/PIN-REMOVAL-PLAN.md` (15) | Project history and rules for developers, never shown to users. Most mentions are storage keys, domains and folder paths. Rewording them is a separate job once the name clears; `DESIGN-UI.md`'s logo section (434) does change in step 3, since it describes the logo component. |

## Needs my decision

Each is left as the safest default, so nothing waits on it:

1. **The Insights brain icon** (`src/components/insight-brain.tsx`) was drawn to echo the old logo's brain. Left as it is (only its comment changed). The new mark also reads as a brain: redraw the icon from it?
2. **The person's home** shows the logo above Start, as before (`logo-home`, now the new logo). Keep it, or remove it to keep that screen plainer?
3. **The wrap-up** shows the mark above "All done", as it showed the old mark (decorative, hidden from screen readers). Keep it, or drop it?
4. ~~**The guessable-password list**~~ Decided 2026-11-16: `tandem` and `tandem1` are in it, beside the old name. On their own both are under the 8-character minimum and already refused; the list catches them when spaces make them long enough ("tan dem 1").
5. **Dark mode.** The dark splash (Ink, reversed logo) is configured, but `app.json` keeps `"userInterfaceStyle": "light"`, so phones show the light splash until the app supports dark mode. Switching to `"automatic"` would also turn system alerts, pickers and the status bar dark: a behavior change, left out of this task.
6. **Developer docs.** `CLAUDE.md`, `DESIGN.md`, `DESIGN-UI.md` and `HANDOFF.md` still call the project Evermore in their headings and history; only the rules that changed were updated. Rename them now, or after trademark clearance?
7. ~~**The progress bar**~~ Decided 2026-11-16: no longer Sky on Mist. The empty track is a 2-point outline (1.5 on the caregiver's compact bar) and the filled part solid, in one color: Ink on the person's screens (13.90:1 on white) and Deep Rose on the caregiver's (5.21:1), given by `useProgressColor()` (`src/theme/accent.tsx`). Both pairs are in `MARK_PAIRS`, checked at 3:1.
8. **Deep Rose on every caregiver tab.** The selected tab, section headings, Close and info icons are now Deep Rose on the caregiver's screens, so Insights' pink is no longer unique among the tabs. Keep, or give the completion tabs (Today, Trends) the ink-blue?
9. **`POLICY_VERSION` is 2026-11-17, not today's date.** 2026-11-16 was already in force on main and may have been agreed to, and the database accepts only a date, so a new date is the only way to ask every caregiver again. If no caregiver has seen 2026-11-16 yet, it could instead be amended (`node scripts/build-policy.mjs --amend`) and kept at today's date.

## The screen walk

`docs/brand-screenshots/` has 96 screenshots (12 screens, 375x647 and 430x839, Large and Extra large, light and dark) from a build made from a `git archive` copy, so no real data could be in them. Every logo was checked for its proportions, being wholly on screen, not covered, and its wordmark's contrast (13.9:1 everywhere): no problem found. The folder's README has the sizes.

## Only a phone can check

- The home screen icon on iOS and Android, including the Android adaptive mask (circle, squircle) and themed icons (no monochrome icon is set, so Android 13+ themed mode shows the full-color icon).
- The splash: Expo Go shows the app icon instead of the splash, so it needs a release build (TestFlight or a development build). The dark splash shows only if `userInterfaceStyle` becomes `automatic`.
- The name under the icon and in the phone's Settings ("Tandem"), and the reminder help line that tells the person to open Settings, then Notifications, then Tandem: the name must match what the phone shows.
- The reminder itself: its text has no app name ("Your practice is ready whenever you are."), but the system shows the app's name and icon above it.
- The share sheet title ("Save your Tandem export") and the exported file names (`tandem-data-….json`, `tandem-report-….pdf`, `tandem-photos-….zip`).
- The logo's rendering through `react-native-svg` on iOS and Android (checked on web only).

## To do by hand afterwards

- **Supabase:** rerun nothing (no schema or function changed). In Authentication → Emails, update the **Reset password** and **Confirm signup** templates and their subjects to say Tandem (`docs/FORGOT-PASSWORD.md` has the new reset template), and set the **sender name** to Tandem once custom SMTP is set up.
- **The hosted privacy policy:** upload the new `docs/privacy-policy.html` (version 2026-11-17) wherever the old page is hosted. Caregivers are asked to agree again on their next fresh check.
- **App Store Connect and TestFlight:** the app name, subtitle, description and review notes (`docs/testflight-checklist.md`), and the privacy answers (`docs/app-store-privacy-answers.md`). Choose the bundle identifier and Android package only once the name clears trademark: they can't change after the first upload.
- **The support email and policy contact:** set `SUPPORT_EMAIL` and `POLICY_CONTACT` in `src/config/brand.ts` when a real address exists, then `node scripts/build-policy.mjs` (a new `POLICY_VERSION` if the policy has been shown).
- **Trademark:** "Tandem" is a placeholder. A rename is `src/config/brand.ts`, `app.json`'s name, a new kit in `brand-kit/` with `node scripts/make-brand-assets.mjs`, the policy with a new version, and the docs above.

## Colors and contrast ratios

`src/theme/colors.ts` now has the six brand colors as `Brand`, and every existing token maps to the nearest of them or a tint derived from them:

| Token | Before | Now | Role |
|---|---|---|---|
| `text` | `#1C2F4D` | Ink `#1F2B4D` | Headlines and body text |
| `primary` | `#3E6FB0` | Ink `#1F2B4D` | Filled buttons (white text), selected fills, chart bars |
| `primaryDark` | `#2B5791` | `#2F4A7A` (Ink lifted toward Sky) | Pressed buttons; links and figures on the person's side |
| `surface` | `#EAF5FC` | Mist `#EAF3FB` | Answer buttons, fields, notices |
| `accent` | `#FFD93B` | Sun `#F7C948` | Behind the filled-in name; never text |
| `sky` | `#A9D8F5` | Sky `#8EC5F2` | "Some practice" days, shapes; never text |
| `skySoft` | `#D3E9F8` | `#C6E2F9` (Sky at half) | Pressed surfaces |
| `accentSoft` | `#FFEEA7` | `#FCE9B6` (Sun at 40%) | The hint panel |
| `softSuccess` / `onSoftSuccess` | sage `#D8E6CA` / `#2F5A2A` | `#D2E8FA` / Ink | The success banner (the brand has no green) |
| `deepRose` | (new) | Deep Rose `#B0467F` | Links and small accents on caregiver screens only |
| `pinkDeep` | `#C4578A` | Rose `#E8629C` | The score ring's arc (a shape, never under text) |
| `pink4`, `pinkInk`, `pinkTint`, `pink1`–`pink3`, `textMuted`, `divider`, `blueGray` | | unchanged | `pink4` stays lighter than Rose (Ink on Rose is 4.41:1) and `pinkInk` deeper than Deep Rose (Deep Rose on `pink1` is 4.28:1), so both keep 4.5:1 |

**How Deep Rose stays off the person's screens.** Shared components (Sheet, the form rows, the policy link, password Show) read `useAccent()` (`src/theme/accent.tsx`). Its default is the ink-blue `primaryDark`, and only `src/app/caregiver/_layout.tsx` gives it Deep Rose. No file a person's screen reaches names a pink, and `scripts/check-logic.mjs` now counts `Colors.deepRose` and `Brand.rose`/`Brand.deepRose` as pinks in that check. The sign-in screen is shared by both roles, so its caregiver forms keep the ink-blue. Big figures on Today and Trends stay ink-blue too, so completion never shares the Memory score's pink.

Every text and mark pair the app draws (`TEXT_PAIRS`, `MARK_PAIRS`), before and after, checked by `scripts/check-logic.mjs`:

| Kind | Text or mark | On | Before | Now | Pair | AA |
|---|---|---|---|---|---|---|
| Text | `text` #1F2B4D | `background` #FFFFFF | 13.43:1 | **13.90:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `surface` #EAF3FB | 12.13:1 | **12.38:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `skySoft` #C6E2F9 | 10.74:1 | **10.36:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `sky` #8EC5F2 | 8.85:1 | **7.56:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `accent` #F7C948 | 9.75:1 | **8.87:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `accentSoft` #FCE9B6 | 11.54:1 | **11.56:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `softSuccess` #D2E8FA | 10.29:1 | **11.03:1** | changed | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `background` #FFFFFF | 6.68:1 | **6.68:1** | same | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `surface` #EAF3FB | 6.03:1 | **5.95:1** | changed | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `skySoft` #C6E2F9 | 5.34:1 | **4.98:1** | changed | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `divider` #D3E0EC | 4.98:1 | **4.98:1** | same | pass (4.5:1) |
| Text | `primaryDark` #2F4A7A | `background` #FFFFFF | 7.30:1 | **8.82:1** | changed | pass (4.5:1) |
| Text | `primaryDark` #2F4A7A | `surface` #EAF3FB | 6.60:1 | **7.86:1** | changed | pass (4.5:1) |
| Text | `primaryDark` #2F4A7A | `skySoft` #C6E2F9 | 5.84:1 | **6.57:1** | changed | pass (4.5:1) |
| Text | `onPrimary` #FFFFFF | `primary` #1F2B4D | 5.12:1 | **13.90:1** | changed | pass (4.5:1) |
| Text | `onPrimary` #FFFFFF | `primaryDark` #2F4A7A | 7.30:1 | **8.82:1** | changed | pass (4.5:1) |
| Text | `onSoftSuccess` #1F2B4D | `softSuccess` #D2E8FA | 6.15:1 | **11.03:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `pinkTint` #FFF0F5 | 12.18:1 | **12.60:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `pink1` #FFE1EC | 11.02:1 | **11.41:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `pink2` #FFB8D2 | 8.34:1 | **8.63:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `pink3` #F192B6 | 6.09:1 | **6.31:1** | changed | pass (4.5:1) |
| Text | `text` #1F2B4D | `pink4` #E07AA5 | 4.80:1 | **4.96:1** | changed | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `pinkTint` #FFF0F5 | 6.06:1 | **6.06:1** | same | pass (4.5:1) |
| Text | `textMuted` #4D5D76 | `pink1` #FFE1EC | 5.48:1 | **5.48:1** | same | pass (4.5:1) |
| Text | `pinkInk` #A3416F | `background` #FFFFFF | 5.93:1 | **5.93:1** | same | pass (4.5:1) |
| Text | `pinkInk` #A3416F | `surface` #EAF3FB | 5.35:1 | **5.28:1** | changed | pass (4.5:1) |
| Text | `pinkInk` #A3416F | `pinkTint` #FFF0F5 | 5.37:1 | **5.37:1** | same | pass (4.5:1) |
| Text | `pinkInk` #A3416F | `pink1` #FFE1EC | 4.86:1 | **4.86:1** | same | pass (4.5:1) |
| Text | `onPrimary` #FFFFFF | `pinkInk` #A3416F | 5.93:1 | **5.93:1** | same | pass (4.5:1) |
| Text | `deepRose` #B0467F | `background` #FFFFFF | new | **5.21:1** | changed | pass (4.5:1) |
| Text | `deepRose` #B0467F | `surface` #EAF3FB | new | **4.64:1** | changed | pass (4.5:1) |
| Mark | `pinkInk` #A3416F | `background` #FFFFFF | 5.93:1 | **5.93:1** | same | pass (3:1) |
| Mark | `pinkInk` #A3416F | `pinkTint` #FFF0F5 | 5.37:1 | **5.37:1** | same | pass (3:1) |
| Mark | `pinkInk` #A3416F | `pink1` #FFE1EC | 4.86:1 | **4.86:1** | same | pass (3:1) |
| Mark | `pinkInk` #A3416F | `pink2` #FFB8D2 | 3.68:1 | **3.68:1** | same | pass (3:1) |
| Mark | `text` #1F2B4D | `pink1` #FFE1EC | 11.02:1 | **11.41:1** | changed | pass (3:1) |
| Mark | `text` #1F2B4D | `pink2` #FFB8D2 | 8.34:1 | **8.63:1** | changed | pass (3:1) |
| Mark | `text` #1F2B4D | `pink3` #F192B6 | 6.09:1 | **6.31:1** | changed | pass (3:1) |
| Mark | `text` #1F2B4D | `pink4` #E07AA5 | 4.80:1 | **4.96:1** | changed | pass (3:1) |

Other pairs worth knowing:

| Pair | Colors | Ratio |
|---|---|---|
| Progress bar, person's screens (home, card, wrap-up): Ink outline and fill | `#1F2B4D` on white | **13.90:1** (fill on white, outline on white, and fill against the empty track's white inside) |
| Progress bar, caregiver's screens (Add a person): Deep Rose outline and fill | `#B0467F` on white | **5.21:1** (the same three edges) |
| Before (replaced 2026-11-16): Sky fill on a Mist track | `#8EC5F2` on `#EAF3FB`; Mist on white | 1.64:1 and 1.07:1 |
| Rose on white | `#E8629C` on white | 3.15:1: shapes only, never text |
| Ink on Rose | `#1F2B4D` on `#E8629C` | 4.41:1: why `pink4` isn't Rose |
| Deep Rose on `pink1` | `#B0467F` on `#FFE1EC` | 4.28:1: why `pinkInk` isn't Deep Rose |
| Deep Rose checkmark on pressed `skySoft` | `#B0467F` on `#C6E2F9` | 3.88:1: an icon, over 3:1 |
| Logo wordmark on the splash | Ink on Mist | 12.38:1 |
| Reversed wordmark on the dark splash | white on Ink | 13.90:1 |
