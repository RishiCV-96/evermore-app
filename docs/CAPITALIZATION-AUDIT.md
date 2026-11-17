# Capitalization audit

Written 2026-11-17 on `ui-polish`, before any other change in the UI polish pass (`docs/UI-POLISH-PLAN.md`).

**The rule:** sentence case everywhere: the first word and proper nouns only. Exceptions are the app's name (Tandem), proper nouns and brand names (iPhone, iOS, VoiceOver, Apple, Supabase, Anthropic), and established acronyms (PDF, AI, ID). No Title Case, and no capitals typed into a string for emphasis: if uppercase is ever wanted, it comes from a style.

## Result

**No string needed a change.** Sentence case has been the app's rule since 2026-11-03 (`DESIGN-UI.md`, "Capitalization"), and `scripts/check-logic.mjs` already fails on any `label=` or `title=` in a screen, and anything in `src/data/questionnaire.ts`, that isn't sentence case. This audit covered the rest of what a person or caregiver can read, and found nothing those checks had missed.

## What was checked

| Where | How | Found |
|---|---|---|
| Every string literal and JSX text in `src/` (screens, components, `src/lib`, `src/data`): titles, section headers, buttons, tab labels, field labels, placeholders, menu items, toasts, empty states, error and failure messages, accessibility labels and hints | A scanner over every quoted string and every JSX text node, single- and multi-line, flagging any capitalized word after the first that doesn't follow a full stop or colon and isn't a proper noun or acronym, and any word of four or more capitals | Only false positives: type names in code, sentences that name a control (below), proper nouns in examples ("the Otters", "Mercy Hospital", "Rome"), and date templates |
| Alerts (`confirm()` in `src/lib/confirm.ts`): titles, messages and confirm buttons | Read each of the six calls | All sentence case ("Sign out on this phone?", "Leave without saving?", "Take it back", "Save new password") |
| The daily reminder | `REMINDER_TEXT` | "Your practice is ready whenever you are." No title. |
| Styles that change case | `textTransform`, `toUpperCase` | None for words. `toUpperCase` makes a name's initial on the caregiver's placeholder avatar, the first letter of a picker value for display (`displayValue`), and the letter in the first-letter hint: each a single letter, by design. |
| The privacy policy (`src/lib/privacy-policy.ts`) and agreements (`src/lib/consent.ts`) | Every heading and sentence | All sentence case. Not changed in any case: a change of any character changes the policy's fingerprint and its version (your decision of 2026-11-17). |
| `docs/app-store-privacy-answers.md`, `docs/testflight-checklist.md` (the reviewer and tester notes; there is no separate tester guide) | Headings and bold labels | Sentence case. Apple's own field names stay as Apple writes them (below). |

Not touched, as the brief says: file names, storage keys, route names and code identifiers.

## Changed

None.

## Needs my decision

1. **Control names inside a sentence keep their capital.** When a sentence names a button, row or band, its first word is capitalized so it reads as the label on screen, for example:
   - "Type a few words, or choose Skip." (story approval)
   - "Open the link in the email, then tap Continue." (sign-up)
   - "… counted in With help" (Insights)
   - "Getting started below 65, Building from 65, Steady from 80 and Strong from 90" (Insights, the score's bands)
   - "… choose “I am practicing” and sign in with the User ID and password from Settings, Their login." (Caregiver on the person's home)
   - In the policy: "Settings, then Privacy and data, then Export my data", "give Their login a new password in Settings".

   I read this as consistent with sentence case (the named label is itself sentence case) and changed nothing. If you'd rather lowercase them, everything outside the policy can change; the policy items would need a new version.

2. **Two strings name a control that isn't there now** (wording, not case, so not changed):
   - `src/data/account.ts`, the `already-has-person` message: "There is already a login for the person. Use Reset instead." Since 2026-11-16 the sheet is "Their login" and gives it a new password; there is no Reset control.
   - `docs/testflight-checklist.md`, review notes: "tap “I am practicing”, then Sign in with the User ID below." The person's Hello screen's button is **Continue**.

3. **Apple's field names in the App Store drafts** keep Apple's capitals because they must match App Store Connect exactly: "Contact Info → Email Address", "User Content → Other User Content", "Usage Data → Product Interaction", and the section name "App Privacy".
