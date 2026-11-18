# App Store listing (draft)

Written 2026-11-17 for the first TestFlight build. Everything here is a draft to paste into App Store Connect. Lengths were counted against Apple's limits on that date; re-check any field App Store Connect shortens or refuses. The text between `<!-- store-copy -->` markers is what customers or reviewers read, and `scripts/check-store.mjs` checks that it makes no medical claim.

Tandem is a practice aid, not a medical device. Every word below describes what the app does (practice with cards) and never what it does for anyone's health.

## Name

"Tandem" is a placeholder pending trademark clearance (`src/config/brand.ts`). The App Store name must be unique across the store, and App Store Connect refuses one already in use. "Tandem" alone is likely taken: other apps, and at least one company that makes medical devices, use the word. Try these in order:

1. **Tandem** (6 of 30 characters)
2. **Tandem: Memory Practice** (23), the recommended fallback
3. **Tandem: Faces and Names** (23)
4. **Tandem Memory Cards** (19)

**The home-screen name stays "Tandem"** whichever store name you get. The home screen shows `app.json`'s `name`, which comes from `APP_NAME`. The store name is set only in App Store Connect, so nothing in the code changes. Apple expects the two to be close, and a store name that adds a short description after the brand name is a common pattern.

If you take a fallback, also use it as the name in App Store Connect's new-app form (`docs/RELEASE-STEPS.md` C6).

## Subtitle (30 characters)

<!-- store-copy -->
Practice the names you love
<!-- /store-copy -->

27 characters. Alternative: "Faces, names and short stories" (30).

## Promotional text (170 characters)

<!-- store-copy -->
Short, personal fill-in-the-blank stories about the people who matter most, made by a caregiver from their own words and photos, and practiced a few cards a day.
<!-- /store-copy -->

161 characters. It can be changed at any time without a new build.

## Description (up to 4000 characters)

<!-- store-copy -->
Tandem is a gentle way for someone with early memory loss to practice recognizing the people in their life, with short, personal stories.

A caregiver sets it up. They add the important people, each with a photo, how they are related, and a few things about them: what they love, where they live, a memory you share. Tandem turns those words into short fill-in-the-blank stories, such as "My aunt, ______, grows tomatoes and shares them every summer." The caregiver reads and approves every story before it is ever shown.

The person practicing gets a few cards a day on their own phone. Each card shows a large photo and one sentence with a blank, and two or three names to choose from. A choice that isn't the one gives a gentle hint and another try. There is no red, no "wrong" and no score, and every card ends with the full sentence read back. "I'm not sure" asks for a hint instead of guessing. When the day's cards are done, they can keep practicing as long as they like.

Made for older eyes and hands
• Very large text, high contrast and big buttons, with four text sizes
• One thing at a time, and nothing that hurries
• An optional daily reminder on the person's own phone, one gentle sentence, at a time they choose

For the caregiver
• Add people step by step, with a photo of each from your library
• Approve, edit or skip every story
• See whether the day's practice was finished, and, under Insights, how practice went over time, compared only with the same person's earlier practice
• Make the login for the person's phone

Private by design
• No ads, no tracking and no analytics
• Photos are stored privately and are never analyzed
• Export everything, or delete your account and all of its data, from Settings

Tandem is a practice tool, not a medical device. It does not test for, treat or measure any health condition.
<!-- /store-copy -->

About 1,800 characters. The example sentence is from the fictional sample people.

## Keywords (100 characters)

<!-- store-copy -->
caregiver,family,faces,photos,recall,stories,flashcards,loved ones,grandparent,relatives,reminder
<!-- /store-copy -->

97 characters, commas without spaces. Words already in the name or subtitle (practice, names, memory) are left out: Apple indexes those already. Condition names ("dementia", "Alzheimer's") are left out on purpose: they would frame the app as one for a medical condition (see Needs a decision, below).

## Category

**Recommended: primary Lifestyle, secondary Education.**

- **Lifestyle** is about family and everyday life, which is what Tandem is for, with no health framing.
- **Education** describes what the person does: practice with cards.
- **Not Medical.** Apple reviews medical apps more strictly (guideline 1.4.1, apps "that could be used for diagnosing or treating patients") and may ask for regulatory clearance. Tandem makes no such claim, so the category would only invite the question.
- **Not Health & Fitness for now.** Many caregivers would look there, but next to Insights and the Memory score it suggests the app measures health. Revisit after legal review (`src/lib/privacy-policy.ts` has the same question for the lawyer).

TestFlight doesn't need a category; App Store submission does.

## Age rating answers

Apple revised the questionnaire in 2025: answer it in App Store Connect → App Information → Age Rating, and check each question's current wording against these answers.

| Question | Answer | Why |
| --- | --- | --- |
| Violence (cartoon, realistic, prolonged), weapons | None | |
| Profanity or crude humor | None | |
| Mature or suggestive themes, sexual content, nudity | None | |
| Horror or fear themes | None | |
| Alcohol, tobacco or drug use or references | None | |
| Gambling, simulated gambling, contests, loot boxes | None / No | |
| Medical or treatment information | None | The app gives no medical information |
| Health or wellness topics | **Check** | Recommended Yes if the description's mention of memory loss counts; it may raise the rating, which is fine for this audience |
| Unrestricted web access | No | The privacy policy is shown inside the app |
| User-generated content | No | What a caregiver writes is shown only to their own family's two logins, never to other users |
| Messaging or chat | No | |
| Advertising | No | |
| Parental controls, age assurance | No | |

Expected rating: 4+ (or the lowest Apple offers), unless the health or wellness answer raises it.

## App Privacy answers

Enter them from `docs/app-store-privacy-answers.md`. Cross-checked against this build on 2026-11-17:

| Data type | Collected | Matches the build? |
| --- | --- | --- |
| Email Address | Yes | Yes: the caregiver's sign-in, and the confirmation and reset codes |
| Name | Yes | Yes: the people the caregiver adds, and the person's first name on Their login |
| Health | **[REVIEW]**, recommended Yes | Yes: card records and the Memory score describe memory practice |
| Photos or Videos | Yes | Yes: photos picked from the library. The camera is never used: its permission string exists only because the photo picker requires it, and says so |
| Other User Content | Yes | Yes: profile answers and stories |
| User ID | Yes | Yes: the account ID and the person's User ID |
| Product Interaction | Yes | Yes: sessions and card records, shown to the caregiver as Insights |
| Device ID, Location, Contacts, Diagnostics, Purchases, Financial, Audio, Browsing, Search, anything from the camera or microphone | No | Yes: PIN pairing (the only device names) was removed; no crash or analytics SDK; reminders never leave the phone; read-aloud makes no audio file |
| Tracking | No | Yes: no ads, analytics or attribution, and no tracking prompt |

Everything collected is **linked to the user** and used for **App Functionality** only. Two things to settle first:
- **Custom SMTP** (needed before other testers, `docs/RELEASE-STEPS.md` A8) changes none of these answers, but the policy must name the provider.
- The **[REVIEW]** items in `docs/app-store-privacy-answers.md` still need your decision.

## Support contact

Use **tandemsupport26@gmail.com** (`SUPPORT_EMAIL` in `src/config/brand.ts`, the same address the privacy policy gives) as TestFlight's **Feedback Email**, App Review's contact email, and the store's support contact.

## Beta App Description (TestFlight)

<!-- store-copy -->
Tandem helps a caregiver make short, personal fill-in-the-blank stories about the important people in someone's life, from their own words and photos, so that person can practice recognizing them a few cards a day. This is an early test. Every new account starts with five fictional sample people. Tandem is a practice tool, not a medical device. It does not test for, treat or measure any health condition.
<!-- /store-copy -->

## What to Test (TestFlight)

<!-- store-copy -->
Thank you for trying Tandem. Please try both sides:

1. As a caregiver: tap "I am a caregiver", create an account with an email you can read, and confirm it with the code from the email. Five fictional sample people are there to start with.
2. Finish two people (open one, tap Resume profile), or add someone new under People. Approve their stories.
3. Make the person's login: Settings, The person's phone, Their login.
4. As the person practicing (on a second phone, or after signing out): tap "I am practicing", sign in with that User ID, and practice a few cards. Try a name that isn't the one, and "I'm not sure".
5. Back as the caregiver: look at Today, Trends and Insights.
6. Try Text size, the daily reminder (on the person's phone), and Export my data.

Tell us anything that is confusing, hard to read or slow, and anything that breaks. Take a screenshot in the app to send feedback through TestFlight.

When you have finished, you can delete your account and everything in it: Settings, Delete account.
<!-- /store-copy -->

## Review notes (App Review and Beta App Review)

Fill in the four placeholders before submitting. Apple's notes field holds up to 4000 bytes; this is about 1,600.

<!-- store-copy -->
Tandem lets a caregiver make short fill-in-the-blank practice cards about family and friends, from their own words and photos, for a person with early memory loss. It is a practice tool, not a medical device. It does not test for, treat or measure any health condition. Every chart says "Practice activity, not a medical measure."

There are two roles, each with its own login.

Caregiver (demo account): on the welcome, tap "I am a caregiver", then "Sign in".
Email: [DEMO CAREGIVER EMAIL]
Password: [DEMO CAREGIVER PASSWORD]
The dashboard has Today, Trends, Insights, People and Settings. The people in this account are fictional samples.

Person practicing: sign out first (Settings, Sign out), or use a second device. On the welcome, tap "I am practicing".
User ID: [DEMO USER ID]
Password: [DEMO PERSON PASSWORD]
Then tap Continue, and Start. To return to the welcome, hold "Caregiver" on the person's home and confirm.

Privacy: sign-up asks the caregiver to agree to the privacy policy and confirm they may add the people they include; no account is made without both. Research use is optional and off. The privacy policy is in Settings, Privacy and data. Photos are picked from the library, stored privately and never analyzed. The app never opens the camera or microphone: their permission strings are there only because the photo picker requires them, and nothing ever asks for either. No ads, analytics or tracking. AI features are not in this version. The daily reminder is a local notification on the person's phone, off until they say yes.

Account deletion: Settings, Delete account (last on the tab). Type "delete" to confirm. It deletes the account, every person, photo, story and practice record, and the person's login, from the server straight away.

Contact: tandemsupport26@gmail.com
<!-- /store-copy -->

## Needs a decision

- **The name.** Trademark clearance for "Tandem" is still pending, and the word is used by other apps and by a medical-device maker. A store name with a description after it ("Tandem: Memory Practice") avoids a clash in the store but not in trademark law.
- **Condition words in the keywords** ("dementia", "Alzheimer's"): they would help caregivers find the app, and invite the medical-app questions above. Left out for now.
- **"Memory score" in the listing.** Left out of the description (it says "how practice went"). The checklist's **[REVIEW]** on whether the name invites medical scrutiny still stands.
- **Support URL and marketing URL.** App Store submission needs a support URL (a web page); TestFlight doesn't. The support email is set: tandemsupport26@gmail.com (`SUPPORT_EMAIL` in `src/config/brand.ts`).
