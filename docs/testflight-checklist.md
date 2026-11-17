# TestFlight and App Review: privacy checklist

Written 2026-11-13. It covers only what relates to privacy. Apple changes its requirements, so **check each item against Apple's current documentation**; where this list wasn't sure, it says so. Checked against these pages on 2026-11-13:
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Provide test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information)
- [App Review information](https://developer.apple.com/help/app-store-connect/reference/app-review-information)

Never run `eas build` or `eas update` from this repository without first deciding how to keep the real family's cards and photos out (`CLAUDE.md`, Privacy; `.easignore` and `scripts/check-release.mjs` exist for this).

## 1. The privacy policy URL

- **App Store: required.** Guideline 5.1.1(i): "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner." The policy must say what data is collected, how, and all its uses; that third parties give equal protection; and how data is kept and deleted, and how a user can revoke consent or request deletion. The in-app link is done: Settings → Privacy and data → Privacy policy, the sign-up screen, and the person's first step.
- **TestFlight external testing: probably required; check.** Many developers report that App Store Connect asks for a privacy policy URL before a build goes to external testers. Apple's own "Provide test information" page names only the Beta App Description (required) and a Feedback Email, so this list couldn't confirm it. Have the URL ready either way. **Internal testing** (your own team in App Store Connect) needs no Beta App Review; check Apple's current TestFlight page to confirm.
- **No placeholders at review.** Guideline 2.1(a) asks for "fully functional URLs" with "placeholder text, empty websites, and other temporary content" removed. Before submitting, fill in `CONTACT`, `EFFECTIVE_DATE` and `REGION` in `src/lib/privacy-policy.ts` after legal review, run `node scripts/build-policy.mjs`, and host the new `docs/privacy-policy.html`.

## 2. Hosting the policy page

`docs/privacy-policy.html` is one self-contained file: no scripts, no fonts or images from elsewhere, light and dark. Two simple options:

1. **GitHub Pages, from a separate public repository** (free). Make a new public repository holding only `index.html` (a copy of `docs/privacy-policy.html`), and turn on Pages in its settings. **Don't publish this repository:** `src/data/deck.ts` holds the real family's cards. GitHub Pages from a *private* repository needs a paid GitHub plan (Pro, Team or Enterprise), which is the option that costs money.
2. **Netlify Drop or Cloudflare Pages** (free tiers). Drag the single file onto Netlify Drop, or upload it to a Cloudflare Pages project; both give an `https://` address on their own domain, and a custom domain if you have one. Check that the free tier's terms still suit you.

Either way, the URL must stay stable: App Store Connect and the app link to it. Update the page whenever `POLICY_VERSION` changes.

## 3. App Privacy answers

Fill in App Store Connect → App Privacy from `docs/app-store-privacy-answers.md`, after the **[REVIEW]** items there are settled. Apple asks for these before App Store submission. Whether TestFlight needs them first isn't confirmed here: check.

## 4. Account deletion

Guideline 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app." Done: Settings → Delete account, which deletes the whole family from the server straight away after "delete" is typed. Apple has rejected apps that only deactivate an account; Tandem deletes. Mention it in the review notes so the reviewer finds it.

## 5. A demo account for App Review

Guideline 2.1(a): "include demo account info (and turn on your back-end service!) if your app includes a login." The App Review information's sign-in fields say the demo account "must not expire".

- Make a **caregiver test account** on the real project for the reviewer: an email you control (not a `.invalid` address, since Confirm email may be on), a password you don't use elsewhere, and only the **fictional sample people** the server seeds (June, Leo, Ruth, Omar, Mae). Never the real family.
- Make two or three sample people complete, so practice works (two people is the minimum), and approve their stories.
- For the person's side, make a **User ID login** under Settings → The person's phone → Their login, and give the reviewer the User ID and password in the notes ("I am practicing", then the User ID and password, then Continue).
- Leave AI questions off. Don't change the account during review, and keep the Supabase project awake: a paused free-tier project fails sign-in. **[Check]** Supabase's current pausing rules for your plan.
- Agree to the current policy once on the demo account before you submit, so the reviewer isn't asked again (they may still see the sign-up agreements if they make their own account).

## 6. Review notes (draft to adapt)

> Tandem helps a person with early memory loss practice recognizing family and friends with short fill-in-the-blank cards made from a caregiver's own words and photos. It is a practice tool, not a medical device: it doesn't test for, treat or measure any condition, and every chart is labelled "Practice activity, not a medical measure."
>
> Two roles. The caregiver signs in with the demo caregiver account below: dashboard, people, stories, Settings. The person practicing signs in on their own phone: on the welcome, tap "I am practicing", type the User ID and password below, then tap Continue.
>
> Privacy: sign-up asks for agreement to the privacy policy and a confirmation that the caregiver may add the people they include (no account without both); research use is optional and off. The privacy policy is in Settings → Privacy and data. Account deletion: Settings → Delete account (type "delete"). Photos are stored privately and never analyzed. No ads, analytics or tracking. AI features are off in this version.

Apple's notes field holds up to 4000 bytes.

## 7. Things a reviewer may ask about

- **Guideline 1.4.1 (medical apps)** applies to apps "that could be used for diagnosing or treating patients", and asks apps to "remind users to check with a doctor". Tandem makes no medical claim. **[REVIEW]** Whether the store description, category (Health & Fitness, Medical or Lifestyle) and the "Memory score" name invite medical-app scrutiny, and whether to add a "talk to a doctor" line.
- **Guideline 5.1.3 (health data)**, if the Health data type is declared: no use for advertising or marketing, and for any future research, participant consent and an independent ethics review board.
- **Third-party information.** The caregiver enters information and photos of other people. The sign-up confirmation covers this. **[REVIEW]**

## 8. The privacy manifest (check)

Apple requires a privacy manifest (`PrivacyInfo.xcprivacy`) that declares "required reason" APIs. Expo writes it from `expo.ios.privacyManifests` in `app.json` at build time ([Expo's guide](https://docs.expo.dev/guides/apple-privacy/)), and Expo's own modules ship their manifests. **Not done in this change**: `app.json` has no `privacyManifests` yet. Before the first build, check Expo's current guide for SDK 58, and build once. Apple emails the developer about any reason that is missing. AsyncStorage and secure storage commonly need `NSPrivacyAccessedAPICategoryUserDefaults` (reason `CA92.1`) and file timestamps; confirm against the build's report rather than this list.

## 9. Joining the Apple Developer Program

1. An Apple Account with two-factor authentication turned on.
2. Enroll at <https://developer.apple.com/programs/enroll/> as an **individual** (your legal name is shown as the seller) or an **organization**, which needs a legal entity and a D-U-N-S number and takes longer to verify.
3. Pay the annual fee (US$99 a year in the United States; check the current price for your country).
4. In App Store Connect, accept the agreements. Free apps need the Free Apps agreement, which is in place by default. A "beta contract missing" error on TestFlight submission usually means an agreement is waiting in App Store Connect → Business.
5. Create the app record (bundle identifier, name), then upload a build. Uploading needs a build: `eas build` (which uploads the bundle to Expo, so see the warning at the top) or a local `npx expo run:ios --configuration Release` archive in Xcode.

## 10. Before every submission

- [ ] Policy reviewed by a lawyer; `CONTACT`, `EFFECTIVE_DATE`, `REGION` filled in; `node scripts/build-policy.mjs`; page hosted; URL in App Store Connect.
- [ ] If the words changed after any caregiver agreed: a new `POLICY_VERSION` (caregivers are asked again).
- [ ] `docs/DATA-INVENTORY.md` matches the build; `node scripts/check-privacy.mjs` passes.
- [ ] App Privacy answers entered from `docs/app-store-privacy-answers.md`.
- [ ] Demo accounts work on the real project, with sample people only.
- [ ] `node scripts/check-release.mjs` passes: no real photo, card or secret in the bundle.
- [ ] Privacy manifest checked.
