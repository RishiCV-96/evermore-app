# Tandem privacy policy

> **Draft for review by a lawyer or privacy professional.** This is not legal advice, and it has not been reviewed. Every statement marked **[REVIEW n]** needs a lawyer's decision; the numbered notes are at the end. It must not claim compliance with any law or certification.
>
> Written from `src/lib/privacy-policy.ts` and `src/lib/consent.ts` by `node scripts/build-policy.mjs`: edit those, never this file. The facts behind it are in `docs/DATA-INVENTORY.md`.

**Version:** 2026-11-17 · **Effective date:** [Effective date to be added] · **Contact:** [Contact email to be added]

## What Tandem is, and is not

- Tandem helps a person with early memory loss keep recognizing the important people in their life. A caregiver adds those people, with photos and short stories, and the person practices with short fill-in-the-blank cards on their own phone.
- Tandem is a practice tool. It is not a medical device. It does not test for, treat or measure any health condition. What the caregiver sees under Insights is practice activity, not a medical measure. **[REVIEW 1]**
- There are two kinds of users. The caregiver makes the account, adds the people and agrees to this policy. The person practicing uses a phone the caregiver sets up for them, and is never asked to read legal text. **[REVIEW 2]**

## What we store

- Your account: your email address and your password. The password is stored scrambled, so nobody can read it.
- Your agreements: which version of this policy you agreed to and when, your confirmation that you may add information about the people you include, and your research choice with the date you made it.
- The people you add: their name, how they are related to the person practicing, a photo if you add one, and your answers about them. Answers can include a nickname, a birthday, work, home and family, interests and favorite things, how you met, and shared memories with a year and a photo. Some questions are optional, such as marital status and family situation. **[REVIEW 3]**
- The settings you choose for practice and for each person, and the practice sentences made from your words.
- The person’s login: the User ID and password you may create for them (the password stored scrambled). If a phone was linked to your account with an earlier version of the app, we also keep that phone’s own login, its name (the name the phone gives itself, which may include a first name) and when it was linked and last seen.
- How practice goes. For each session: when it started and ended, and how many cards were done. For each card practiced: when, how many tries it took and whether a hint was used, so the app knows when to ask it again. For your Insights, a record of each card shown: how it was asked, each answer chosen and when, the hints shown and the time on screen. These records hold no names, photos or words. **[REVIEW 4]**

## Who can see it

- You, the caregiver, can see everything about your family in the app.
- The person practicing sees only the people and stories you approved, with their photos. They never see Insights, scores or how their answers went, and they can’t see your agreements or your settings.
- Nobody else in the app. One family can never see another family’s information. The database itself enforces this, not only the app.
- The developer of Tandem can technically reach the stored information, including photos, through the hosting provider’s tools. It is not end-to-end encrypted. We only look at it to keep the service working, to fix a problem you report, to restore your data when you ask, or when the law requires it. **[REVIEW 5]**
- Our hosting provider, Supabase, stores and processes the information for us under its own terms. **[REVIEW 6]**

## What leaves your phone

- What you enter, and the person’s practice, is sent over an encrypted connection to Supabase, so it is the same on every phone and safe if a phone is lost.
- Emails about your account, such as confirming your address or resetting your password, are sent to you through Supabase’s email service. **[REVIEW 7]**
- AI questions, only if you turn them on (see “AI questions” below).
- Nothing else. Tandem has no analytics, advertising or crash-reporting tools.
- When a card is answered, the phone reads the sentence aloud with its own speech feature. **[REVIEW 8]**

## What we never do

- We don’t show ads.
- We don’t track you across other apps or websites.
- We don’t sell or rent your information, or share it for anyone’s marketing.
- We don’t use face recognition or AI on photos, and we never try to identify anyone from a photo.
- We don’t collect your location, your contacts, or anything from other apps.

## Photos

- Only the photos you pick are used. Each is made smaller (at most 1280 pixels on its long side) and stored in private storage.
- The app shows photos through links that stop working after an hour.
- The person practicing sees a photo only of someone in practice with an approved story.
- When you replace or remove a photo, or delete a person, the stored photo is deleted.

## AI questions

- AI questions are off unless the caregiver turns them on, and the app asks for your agreement before anything is sent.
- When they are on, and only when you tap Generate, one person’s approved facts are sent as text to an AI service, Anthropic, to write new practice sentences. Their name and any other names are replaced with placeholders first. Photos are never sent, and facts that may change, such as a job, are never sent. **[REVIEW 9]**
- Tandem keeps none of what is sent, only a count of requests to limit cost. Anthropic may keep the data for a short time under its own terms, and says it does not use it to train its models. **[REVIEW 10]**
- Every AI sentence waits for your approval before the person sees it. You can turn AI questions off at any time in Settings, or for one person.
- To limit cost and misuse, the phone makes a random code that is not linked to your account. Our server keeps only a scrambled form of it, with a count of requests, for about a day and a half.

## Research (your choice)

- When you create an account, and at any time in Settings, you can choose whether de-identified information may be used for research to improve Tandem. De-identified means names, photos, your words and account details are removed.
- It is off unless you turn it on. Saying no changes nothing in the app. You can change your choice at any time.
- Today, no information is used for research. Before any research use begins, we will update this policy to say what is used, by whom and how. **[REVIEW 11]**

## Exports and files you save

- Export my data, in Settings, makes a file of your family’s information, and of their photos if you choose. It is made only when you ask, on your phone, and goes only where you send it.
- Files you save or send elsewhere, such as to email, cloud storage or a computer, are not deleted when you delete your account. Delete them where you keep them.

## Reminders

- The person can choose a daily practice reminder on their own phone. The phone makes and shows it by itself. Nothing about it is sent to us or anyone else, and it never includes a name or a photo.

## Exporting and deleting your data

- To get a copy: Settings, then Privacy and data, then Export my data.
- To remove one person: archive them on the People tab, then open Archived people, choose them and Delete permanently. Their photos, stories and practice records are deleted.
- To sign the person’s phone out: give Their login a new password in Settings. The phone is asked to sign in again.
- To delete everything: Settings, then Delete account. It deletes your account, every person, photo, story and practice record, your agreement records, and every login of the person practicing, from our servers straight away. It can’t be undone. **[REVIEW 12]**
- Copies may remain in the hosting provider’s backups for a limited time before they expire. **[REVIEW 13]**
- Signing out removes the copies kept on that phone. Everything in your account stays.
- You can also ask us for a copy of your information, or to correct or delete it: [Contact email to be added]. **[REVIEW 14]**

## How long we keep it

- Your account, people, photos, stories, settings and practice sessions: until you delete them or your account.
- The card records behind Insights: 120 days.
- The notes that decide when a card comes back (tries and hints): until that fact, that person or your account is deleted. **[REVIEW 15]**
- A phone linked with an earlier version of the app: its name and dates, until you delete your account.

## Keeping it safe

- Information travels over encrypted connections. Supabase stores it encrypted. **[REVIEW 16]**
- The database lets each login reach only its own family’s information. Photos are in private storage.
- Sign-ins are kept in the phone’s secure storage. Passwords are stored only in scrambled form.
- No system is perfectly secure, and we can’t promise perfect safety. If something happens that affects your information, we will tell you as the law requires. **[REVIEW 17]**

## Where it is stored

- With Supabase, in this region: [Hosting region to be added]. If you live somewhere else, your information is stored outside your country. **[REVIEW 18]**

## Children

- Tandem is for adults. A caregiver may add family members of any age, such as a grandchild, with their photo and stories. Please only add people you have the right to add. **[REVIEW 19]**

## Changes to this policy

- If we change this policy, its version date changes and the caregiver is asked to read it and agree again before continuing. Nothing you entered is lost while you decide.

## Contact

- Questions or requests: [Contact email to be added]. **[REVIEW 20]**

## The agreements in the app

Shown to the caregiver only. Nothing is ticked for them, and no account is made without both required boxes.

- **Summary shown on Create an account:** “Tandem keeps your email, the people you add with their photos and stories, and how practice goes. You can see all of it. The person practicing sees only the stories you approve. It is stored with our hosting provider, Supabase. Tandem’s developer can technically reach it to keep the service running. No ads, no tracking, and nothing is sold. Tandem is a practice tool, not a medical device.” **[REVIEW 21]**
- **Required box 1:** “I have read and agree to the privacy policy.”
- **Required box 2:** “I’m adding photos and details about other people. I have the right to do this, and the person I’m helping (or whoever is legally responsible for them) knows I’m using Tandem.” **[REVIEW 22]**
- **Optional box (unticked):** “Optional: Tandem may use de-identified information (no names, photos, words or account details) for research to improve the app. You can change this at any time in Settings. Saying no changes nothing in the app.” **[REVIEW 23]**
- **Asked again when the policy changes:** “Tandem’s privacy policy has changed. Please read it and agree to keep using Tandem. Everything you added is still here.”
- **The one sentence on the person’s phone:** “Your caregiver set this up for you.” **[REVIEW 24]**

## Notes for the reviewer

1. **What Tandem is, and is not.** Whether the app’s purpose and its Insights (including the “Memory score”) could make it a medical device or a regulated health app in any market where it is offered, and whether this statement may be made.
2. **What Tandem is, and is not.** Consent on behalf of a person with memory loss: whether the caregiver’s confirmation is enough, what wording is right, and whether the person (or a legal representative) must agree separately in some places.
3. **What we store.** These answers are about third parties and can be sensitive (family situation, relationships, places). Whether any of it is sensitive or special-category information under laws that may apply.
4. **What we store.** Practice records describe one person’s memory practice. Whether they are health information under laws that may apply, and what that requires.
5. **Who can see it.** This statement of developer access and its limits; who “we” is (an individual or a company), and whether written access rules are needed.
6. **Who can see it.** Whether a data processing agreement with Supabase is in place, and whether its subprocessors and hosting locations must be listed.
7. **What leaves your phone.** If a separate email provider is set up later (custom SMTP), it must be named here.
8. **What leaves your phone.** On some Android phones the speech engine is a separate app from the phone maker or Google; whether it sends text off the phone depends on that engine.
9. **AI questions.** AI questions are not available in the current version when signed in. If they are offered, confirm this description still matches.
10. **AI questions.** Confirm Anthropic’s current API data retention and training terms, and whether a data processing agreement is needed.
11. **Research (your choice).** Research with health-related practice data may need ethics review, a stricter definition of de-identification, and agreement from or on behalf of the person practicing, not only the caregiver.
12. **Exporting and deleting your data.** Whether agreement records should be kept for a time after an account is deleted, as evidence of consent.
13. **Exporting and deleting your data.** Confirm the backup retention of the Supabase plan in use, and state it.
14. **Exporting and deleting your data.** How access, correction and deletion requests are handled, and any rights that apply depending on where users live.
15. **How long we keep it.** Sessions and these scheduling notes have no time limit today. Decide whether they should.
16. **Keeping it safe.** Confirm encryption at rest for this Supabase project and plan.
17. **Keeping it safe.** Breach notification duties that may apply, and to whom.
18. **Where it is stored.** International transfers, and whether any transfer safeguards are needed.
19. **Children.** Information about children entered by an adult caregiver, and whether any age rules apply to it.
20. **Contact.** Who the contact is, and any legally required contact details.
21. **Summary shown on Create an account.** Whether this short summary is accurate and enough before an account is made.
22. **Required box 2.** Consent on behalf of a person with memory loss: whether this confirmation is the right wording, whether “knows” is enough or their agreement (or a legal representative’s) is needed, and whether the other people added (family members, children) need anything.
23. **Optional box (unticked).** Whether a research choice may be collected before any research exists, and the definition of de-identified.
24. **The one sentence on the person’s phone.** Whether the person practicing must be told more, and how, given memory loss.
