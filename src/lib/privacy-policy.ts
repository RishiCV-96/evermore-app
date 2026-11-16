import { POLICY_VERSION } from '@/lib/consent';

// The privacy policy, in one place: the app shows it (src/components/privacy-policy.tsx), and
// `node scripts/build-policy.mjs` writes it to docs/privacy-policy-draft.md (with every [REVIEW] note
// for the lawyer) and docs/privacy-policy.html (to host). scripts/check-privacy.mjs fails when those
// files are out of step with this one, or when this text changes without a new POLICY_VERSION.
//
// It must match what the app, supabase/schema.sql and the Edge Functions actually do, as recorded in
// docs/DATA-INVENTORY.md. Change both whenever data handling changes.
//
// DRAFT: not reviewed by a lawyer. It must never claim compliance with any law or certification.

export { POLICY_VERSION };

export const POLICY_TITLE = 'Evermore privacy policy';
export const DRAFT_LINE = 'Draft for review by a lawyer or privacy professional';
export const EFFECTIVE_DATE = '[Effective date to be added]';
export const CONTACT = '[Contact email to be added]';
export const REGION = '[Hosting region to be added]';

/** One statement. `review` is the lawyer's note: shown in the Markdown draft only, never in the app. */
export type PolicyPoint = { text: string; review?: string };
export type PolicySection = { id: string; heading: string; points: PolicyPoint[] };

export const POLICY: PolicySection[] = [
  {
    id: 'about',
    heading: 'What Evermore is, and is not',
    points: [
      {
        text: 'Evermore helps a person with early memory loss keep recognizing the important people in their life. A caregiver adds those people, with photos and short stories, and the person practices with short fill-in-the-blank cards on their own phone.',
      },
      {
        text: 'Evermore is a practice tool. It is not a medical device. It does not test for, treat or measure any health condition. What the caregiver sees under Insights is practice activity, not a medical measure.',
        review: 'Whether the app’s purpose and its Insights (including the “Memory score”) could make it a medical device or a regulated health app in any market where it is offered, and whether this statement may be made.',
      },
      {
        text: 'There are two kinds of users. The caregiver makes the account, adds the people and agrees to this policy. The person practicing uses a phone the caregiver sets up for them, and is never asked to read legal text.',
        review: 'Consent on behalf of a person with memory loss: whether the caregiver’s confirmation is enough, what wording is right, and whether the person (or a legal representative) must agree separately in some places.',
      },
    ],
  },
  {
    id: 'store',
    heading: 'What we store',
    points: [
      { text: 'Your account: your email address and your password. The password is stored scrambled, so nobody can read it.' },
      {
        text: 'Your agreements: which version of this policy you agreed to and when, your confirmation that you may add information about the people you include, and your research choice with the date you made it.',
      },
      {
        text: 'The people you add: their name, how they are related to the person practicing, a photo if you add one, and your answers about them. Answers can include a nickname, a birthday, work, home and family, interests and favorite things, how you met, and shared memories with a year and a photo. Some questions are optional, such as marital status and family situation.',
        review: 'These answers are about third parties and can be sensitive (family situation, relationships, places). Whether any of it is sensitive or special-category information under laws that may apply.',
      },
      { text: 'The settings you choose for practice and for each person, and the practice sentences made from your words.' },
      {
        text: 'The person’s login: the User ID and password you may create for them (the password stored scrambled). If a phone was linked to your account with an earlier version of the app, we also keep that phone’s own login, its name (the name the phone gives itself, which may include a first name) and when it was linked and last seen.',
      },
      {
        text: 'How practice goes. For each session: when it started and ended, and how many cards were done. For each card practiced: when, how many tries it took and whether a hint was used, so the app knows when to ask it again. For your Insights, a record of each card shown: how it was asked, each answer chosen and when, the hints shown and the time on screen. These records hold no names, photos or words.',
        review: 'Practice records describe one person’s memory practice. Whether they are health information under laws that may apply, and what that requires.',
      },
    ],
  },
  {
    id: 'who',
    heading: 'Who can see it',
    points: [
      { text: 'You, the caregiver, can see everything about your family in the app.' },
      {
        text: 'The person practicing sees only the people and stories you approved, with their photos. They never see Insights, scores or how their answers went, and they can’t see your agreements or your settings.',
      },
      { text: 'Nobody else in the app. One family can never see another family’s information. The database itself enforces this, not only the app.' },
      {
        text: 'The developer of Evermore can technically reach the stored information, including photos, through the hosting provider’s tools. It is not end-to-end encrypted. We only look at it to keep the service working, to fix a problem you report, to restore your data when you ask, or when the law requires it.',
        review: 'This statement of developer access and its limits; who “we” is (an individual or a company), and whether written access rules are needed.',
      },
      {
        text: 'Our hosting provider, Supabase, stores and processes the information for us under its own terms.',
        review: 'Whether a data processing agreement with Supabase is in place, and whether its subprocessors and hosting locations must be listed.',
      },
    ],
  },
  {
    id: 'leaves',
    heading: 'What leaves your phone',
    points: [
      { text: 'What you enter, and the person’s practice, is sent over an encrypted connection to Supabase, so it is the same on every phone and safe if a phone is lost.' },
      {
        text: 'Emails about your account, such as confirming your address or resetting your password, are sent to you through Supabase’s email service.',
        review: 'If a separate email provider is set up later (custom SMTP), it must be named here.',
      },
      { text: 'AI questions, only if you turn them on (see “AI questions” below).' },
      { text: 'Nothing else. Evermore has no analytics, advertising or crash-reporting tools.' },
      {
        text: 'When a card is answered, the phone reads the sentence aloud with its own speech feature.',
        review: 'On some Android phones the speech engine is a separate app from the phone maker or Google; whether it sends text off the phone depends on that engine.',
      },
    ],
  },
  {
    id: 'never',
    heading: 'What we never do',
    points: [
      { text: 'We don’t show ads.' },
      { text: 'We don’t track you across other apps or websites.' },
      { text: 'We don’t sell or rent your information, or share it for anyone’s marketing.' },
      { text: 'We don’t use face recognition or AI on photos, and we never try to identify anyone from a photo.' },
      { text: 'We don’t collect your location, your contacts, or anything from other apps.' },
    ],
  },
  {
    id: 'photos',
    heading: 'Photos',
    points: [
      { text: 'Only the photos you pick are used. Each is made smaller (at most 1280 pixels on its long side) and stored in private storage.' },
      { text: 'The app shows photos through links that stop working after an hour.' },
      { text: 'The person practicing sees a photo only of someone in practice with an approved story.' },
      { text: 'When you replace or remove a photo, or delete a person, the stored photo is deleted.' },
    ],
  },
  {
    id: 'ai',
    heading: 'AI questions',
    points: [
      { text: 'AI questions are off unless the caregiver turns them on, and the app asks for your agreement before anything is sent.' },
      {
        text: 'When they are on, and only when you tap Generate, one person’s approved facts are sent as text to an AI service, Anthropic, to write new practice sentences. Their name and any other names are replaced with placeholders first. Photos are never sent, and facts that may change, such as a job, are never sent.',
        review: 'AI questions are not available in the current version when signed in. If they are offered, confirm this description still matches.',
      },
      {
        text: 'Evermore keeps none of what is sent, only a count of requests to limit cost. Anthropic may keep the data for a short time under its own terms, and says it does not use it to train its models.',
        review: 'Confirm Anthropic’s current API data retention and training terms, and whether a data processing agreement is needed.',
      },
      { text: 'Every AI sentence waits for your approval before the person sees it. You can turn AI questions off at any time in Settings, or for one person.' },
      {
        text: 'To limit cost and misuse, the phone makes a random code that is not linked to your account. Our server keeps only a scrambled form of it, with a count of requests, for about a day and a half.',
      },
    ],
  },
  {
    id: 'research',
    heading: 'Research (your choice)',
    points: [
      {
        text: 'When you create an account, and at any time in Settings, you can choose whether de-identified information may be used for research to improve Evermore. De-identified means names, photos, your words and account details are removed.',
      },
      { text: 'It is off unless you turn it on. Saying no changes nothing in the app. You can change your choice at any time.' },
      {
        text: 'Today, no information is used for research. Before any research use begins, we will update this policy to say what is used, by whom and how.',
        review: 'Research with health-related practice data may need ethics review, a stricter definition of de-identification, and agreement from or on behalf of the person practicing, not only the caregiver.',
      },
    ],
  },
  {
    id: 'exports',
    heading: 'Exports and files you save',
    points: [
      { text: 'Export my data, in Settings, makes a file of your family’s information, and of their photos if you choose. It is made only when you ask, on your phone, and goes only where you send it.' },
      { text: 'Files you save or send elsewhere, such as to email, cloud storage or a computer, are not deleted when you delete your account. Delete them where you keep them.' },
    ],
  },
  {
    id: 'reminders',
    heading: 'Reminders',
    points: [
      {
        text: 'The person can choose a daily practice reminder on their own phone. The phone makes and shows it by itself. Nothing about it is sent to us or anyone else, and it never includes a name or a photo.',
      },
    ],
  },
  {
    id: 'delete',
    heading: 'Exporting and deleting your data',
    points: [
      { text: 'To get a copy: Settings, then Privacy and data, then Export my data.' },
      { text: 'To remove one person: archive them on the People tab, then open Archived people, choose them and Delete permanently. Their photos, stories and practice records are deleted.' },
      { text: 'To sign the person’s phone out: give Their login a new password in Settings. The phone is asked to sign in again.' },
      {
        text: 'To delete everything: Settings, then Delete account. It deletes your account, every person, photo, story and practice record, your agreement records, and every login of the person practicing, from our servers straight away. It can’t be undone.',
        review: 'Whether agreement records should be kept for a time after an account is deleted, as evidence of consent.',
      },
      {
        text: 'Copies may remain in the hosting provider’s backups for a limited time before they expire.',
        review: 'Confirm the backup retention of the Supabase plan in use, and state it.',
      },
      { text: 'Signing out removes the copies kept on that phone. Everything in your account stays.' },
      {
        text: `You can also ask us for a copy of your information, or to correct or delete it: ${CONTACT}.`,
        review: 'How access, correction and deletion requests are handled, and any rights that apply depending on where users live.',
      },
    ],
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    points: [
      { text: 'Your account, people, photos, stories, settings and practice sessions: until you delete them or your account.' },
      { text: 'The card records behind Insights: 120 days.' },
      {
        text: 'The notes that decide when a card comes back (tries and hints): until that fact, that person or your account is deleted.',
        review: 'Sessions and these scheduling notes have no time limit today. Decide whether they should.',
      },
      { text: 'A phone linked with an earlier version of the app: its name and dates, until you delete your account.' },
    ],
  },
  {
    id: 'security',
    heading: 'Keeping it safe',
    points: [
      {
        text: 'Information travels over encrypted connections. Supabase stores it encrypted.',
        review: 'Confirm encryption at rest for this Supabase project and plan.',
      },
      { text: 'The database lets each login reach only its own family’s information. Photos are in private storage.' },
      { text: 'Sign-ins are kept in the phone’s secure storage. Passwords are stored only in scrambled form.' },
      {
        text: 'No system is perfectly secure, and we can’t promise perfect safety. If something happens that affects your information, we will tell you as the law requires.',
        review: 'Breach notification duties that may apply, and to whom.',
      },
    ],
  },
  {
    id: 'where',
    heading: 'Where it is stored',
    points: [
      {
        text: `With Supabase, in this region: ${REGION}. If you live somewhere else, your information is stored outside your country.`,
        review: 'International transfers, and whether any transfer safeguards are needed.',
      },
    ],
  },
  {
    id: 'children',
    heading: 'Children',
    points: [
      {
        text: 'Evermore is for adults. A caregiver may add family members of any age, such as a grandchild, with their photo and stories. Please only add people you have the right to add.',
        review: 'Information about children entered by an adult caregiver, and whether any age rules apply to it.',
      },
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    points: [
      {
        text: 'If we change this policy, its version date changes and the caregiver is asked to read it and agree again before continuing. Nothing you entered is lost while you decide.',
      },
    ],
  },
  {
    id: 'contact',
    heading: 'Contact',
    points: [{ text: `Questions or requests: ${CONTACT}.`, review: 'Who the contact is, and any legally required contact details.' }],
  },
];

/** "What the app stores": the plain version of docs/DATA-INVENTORY.md, for Settings. */
export const WHAT_WE_STORE: { heading: string; points: string[] }[] = [
  {
    heading: 'In your account, on our server',
    points: [
      'Your email, your password (scrambled) and your agreements.',
      'The people you add: names, relationships, photos, answers and stories.',
      'Practice sessions, and notes on each card that decide when it comes back.',
      'Card records for Insights, kept 120 days.',
      'The person’s login (its User ID, with the password scrambled).',
    ],
  },
  {
    heading: 'On this phone',
    points: [
      'Your sign-in, in the phone’s secure storage.',
      'A copy of your family and Insights, so they open without internet.',
      'Your text size.',
    ],
  },
  {
    heading: 'On the person’s phone',
    points: [
      'Their sign-in, in secure storage.',
      'The approved stories and photos, so practice works without internet.',
      'Practice waiting to be sent.',
      'Their reminder setting, on that phone only.',
    ],
  },
  {
    heading: 'Never',
    points: ['Your location or contacts.', 'Anything for ads or tracking.', 'Any analysis of faces in photos.'],
  },
];

/** Every statement's text, in order: what the version fingerprint covers. */
export function policyText() {
  return [POLICY_TITLE, ...POLICY.flatMap((section) => [section.heading, ...section.points.map((point) => point.text)])].join('\n');
}
