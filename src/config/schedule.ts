// Spaced-retrieval intervals and session length: when a card comes back, and how many a day.
//
// PLACEHOLDERS, must be reviewed by a speech-language pathologist before real use. None of these
// numbers is clinically validated, and nothing in the app may present them as if they were.
//
// Each card sits on a step. Finishing it on the first try with no hint moves it up one step;
// a hint or another name first moves it back one step, never below 0. The step decides when
// the card is next due. Nothing here is shown to the person: there are no countdowns.


/**
 * When a study day begins, in the device's local time: 05:30. A study day runs from 05:30:00 to
 * 05:29:59 the next morning and is named for the date it began on, so 02:00 on Nov 13 belongs to
 * study day Nov 12. It decides only which day practice counts toward and when a new daily session
 * begins; it never limits practice. Configurable here, and only here: studyDayKey in
 * src/lib/study-day.ts is the one place it is used. A design choice that a speech-language
 * pathologist must review, like the other numbers in this file.
 */
export const DAY_START_HOUR = 5;
export const DAY_START_MINUTE = 30;

/** Steps 1 and up: how long until the card is due again. Day steps count in study days, not hours. */
export const STEP_INTERVALS = [
  { step: 0, minutes: 0 }, // again in this session (see REASK_AFTER_CARDS), and due next time
  { step: 1, minutes: 10 },
  { step: 2, days: 1 },
  { step: 3, days: 3 },
  { step: 4, days: 7 },
  { step: 5, days: 14 },
] as const;

export const TOP_STEP = STEP_INTERVALS.length - 1;

export type SessionLength = 'short' | 'standard' | 'long';

/**
 * A day's practice, as the caregiver's "Session length" sets it: about `perPerson` questions for
 * each person in the deck. `least` keeps a small deck's day meaningful and `most` keeps a large
 * deck's day bearable, so Standard is 8 to 12 minutes for most families. The day is smaller only
 * when the deck has too few different questions, because nothing is repeated to fill it.
 *
 * The length of a day comes from its number of cards, never from locking a button: see
 * SECONDS_PER_CARD. If a real Standard day runs under about 8 minutes, raise `perPerson` for
 * Standard, and Long in proportion.
 */
export const SESSION_LENGTHS: Record<SessionLength, { perPerson: number; least: number; most: number }> = {
  short: { perPerson: 2, least: 20, most: 30 },
  standard: { perPerson: 3, least: 36, most: 45 },
  long: { perPerson: 5, least: 60, most: 75 },
};

export const DEFAULT_SESSION_LENGTH: SessionLength = 'standard';

export const SESSION_LENGTH_CHOICES: { value: SessionLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'standard', label: 'Standard' },
  { value: 'long', label: 'Long' },
];

/**
 * An average card, in seconds, for someone who stays for the read-back. Worked out from the phone's
 * deck, which averages 8.7 words on a card and 13.5 read back: reading them at about 2.5 words a
 * second and taking in the photo, choosing a name, the voice at its 0.9 rate, and the tap on. An
 * estimate until a real day is timed: nothing enforces it, and someone tapping straight on is faster.
 */
export const CARD_SECONDS = { read: 5, choose: 3, readBack: 5, moveOn: 1 };

/** The estimate behind "About 8 minutes today": cards times this. */
export const SECONDS_PER_CARD = CARD_SECONDS.read + CARD_SECONDS.choose + CARD_SECONDS.readBack + CARD_SECONDS.moveOn;

/** The same person's cards are at least this many cards apart. A deck of fewer people can't manage it. */
export const CARDS_APART = 4;

/**
 * Within a session: a card that needed a hint comes back at these expanding gaps, in minutes, the
 * way spaced-retrieval training is usually described (published examples include 1, 3 and 6, or
 * 1, 2 and 4 minutes). A first-try answer moves it to the next gap; another hint starts again at
 * the first; a gap past the end of the session ends it. PLACEHOLDERS: a speech-language
 * pathologist must confirm them. Practice counts in cards, so each gap becomes cards at
 * SECONDS_PER_CARD (about 4, 9, 17 and 34), never closer than the person's cards are kept apart.
 */
export const SAME_SESSION_MINUTES = [1, 2, 4, 8];

/** The gaps above, in cards: how many cards come between, at SECONDS_PER_CARD. */
export const SAME_SESSION_CARDS = SAME_SESSION_MINUTES.map((minutes) => Math.max(1, Math.round((minutes * 60) / SECONDS_PER_CARD)));

/** At most this many cards come back within one session, so a day with many hints can't grow long. */
export const SAME_SESSION_MOST = 8;

/**
 * Cue fading: the cue levels (cueLevel in src/lib/stories.ts: 0 the relationship and a fact, 1
 * one fact, 2 the face alone, 3 the name given and the fact recalled) practice prefers for a card
 * on each schedule step, from `fromStep` up. Rich cues while a card is new or needed a hint,
 * leaner ones as it is answered first time again and again. A preference, never a lock: the
 * ways closest to the band win among those the day's other rules allow. PLACEHOLDERS: a
 * speech-language pathologist must confirm them.
 */
export const CUE_FADING = [
  { fromStep: 0, least: 0, most: 0 },
  { fromStep: 1, least: 0, most: 1 },
  { fromStep: 2, least: 1, most: 2 },
  { fromStep: 3, least: 1, most: 3 },
] as const;

/** The final review pass: at most this many of the cards that needed hints. */
export const REVIEW_PASS = { most: 4 };

/**
 * How long after the right name is chosen a tap on Next is ignored, so the tap that chose the name
 * can't also skip the read-back. Next never looks any different: this is the only pause, and tuning
 * it here tunes it everywhere.
 */
export const NEXT_TAP_GUARD_MS = 350;

export type RevealSetting = 'off' | 'sometimes' | 'often';

/** How often an eligible card starts behind the "?" (src/lib/reveal.ts): about 1 in 4 by default. */
export const REVEAL_CHANCE: Record<RevealSetting, number> = { off: 0, sometimes: 0.25, often: 0.5 };

export const DEFAULT_REVEAL_CARDS: RevealSetting = 'sometimes';

export const REVEAL_CHOICES: { value: RevealSetting; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'The photo always shows from the start.' },
  { value: 'sometimes', label: 'Sometimes', hint: 'Now and then the photo starts behind a “?”.' },
  { value: 'often', label: 'Often', hint: 'More often, the photo starts behind a “?”.' },
];

/**
 * The wrap-up's "Today you saw": the faces and names of at most this many people from the session,
 * seen again with nothing to do (incidental re-exposure). A design assumption: where and how many
 * need a clinician's review.
 */
export const TODAY_YOU_SAW = { most: 6 };

/** Practice more: a mix of this many cards, once today's target is met. */
export const PRACTICE_MORE = { cards: 10 };

/** Practicing one person: at least this many cards (their facts again, asked other ways), at most `most`. */
export const PERSON_PRACTICE = { least: 3, most: 10 };

/**
 * Someone restored after a day or more in the archive: this many of their overdue cards stay due,
 * and the rest come back this many a day over the next days, longest overdue first, so their first
 * day back isn't all catch-up. About a Standard day's share for one person.
 */
export const RETURN_DUE_PER_DAY = 3;

/**
 * The person's daily practice reminder (src/lib/reminders.ts): a local notification on their own
 * phone, at most one a study day, off until they say yes. The default time, 9:00 local, and the
 * range the person may choose from, in steps. PLACEHOLDERS: a clinician should confirm the default
 * time, that one reminder a day (and no follow-up) is right, and the wording (REMINDER_TEXT). Every
 * time here falls after the study day's 05:30 start and before midnight, so a reminder always
 * belongs to the study day of the date it fires on.
 */
export const REMINDER_HOUR = 9;
export const REMINDER_MINUTE = 0;

/** The earliest and latest reminder the person can choose, as minutes after midnight: 06:00 to 21:00. */
export const REMINDER_EARLIEST = 6 * 60;
export const REMINDER_LATEST = 21 * 60;

/** Earlier and Later move the time by this many minutes. */
export const REMINDER_STEP_MINUTES = 30;

/**
 * How many days' reminders are scheduled ahead, at most one each. Notifications can't look at the
 * app's state when they fire, so the set is rebuilt whenever the app opens, comes to the front, the
 * day's session is completed and a new study day begins. A small set keeps reminding someone who
 * doesn't open the app for a day or two, and bounds a phone that was signed out or removed while
 * closed to this many more before it next opens and cancels them.
 */
export const REMINDER_DAYS_AHEAD = 3;
