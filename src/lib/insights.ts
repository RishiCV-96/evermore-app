import { EARLY_READ_CARDS, MIN_CARDS_SHOWN, MEMORY_SCORE, SCORE_BANDS, SESSION_STANDARD, TREND, type BandName } from '@/config/insights';
import { SECONDS_PER_CARD, type RevealSetting, type SessionLength } from '@/config/schedule';
import { calendarKey } from '@/lib/activity';
import { dayOf, lastStudyDays } from '@/lib/study-day';
import { cappedMs, counted, resolvedOn, type CardAttempt, type Resolution } from '@/lib/attempts';

// The caregiver's insights: the one layer of pure functions every insights view reads, so no
// figure is worked out inside a component. Practice activity only: never a medical measure, never
// compared with anyone else, and never shown on the person's screens (see "Insights" in CLAUDE.md).
// Pure, so scripts/check-logic.mjs can check it against hand-worked figures. Every word a view
// shows from here is checked for the words the framework bans.

/** What the insights views read: every card's record (kept on this phone, or fetched from the server with sign-in on), and whether demo mode is on. */
export type InsightsData = { attempts: CardAttempt[]; demo: boolean };

export type InsightsOptions = {
  /** Archived people's practice, which stays on the phone, counted as well. */
  includeArchived: boolean;
  /** Demo mode: made-up attempts (test data) counted as well. */
  demo: boolean;
};

type Who = { id: string; archivedAt?: string };

/** The attempts a view counts: made-up ones only in demo mode, and archived people's only when asked for. */
export function attemptsInView(attempts: CardAttempt[], people: Who[], options: InsightsOptions) {
  const archived = new Set(people.filter((person) => person.archivedAt).map((person) => person.id));
  return attempts.filter((attempt) => (options.demo || !attempt.testData) && (options.includeArchived || !archived.has(attempt.personId)));
}

/** The study day a record counts toward: the one saved with it, or for an older record, the study day of when it was shown. */
export const recordDay = (attempt: Pick<CardAttempt, 'studyDay' | 'shownAt'>) => dayOf(attempt, attempt.shownAt);

/** Attempts by study day (YYYY-MM-DD), oldest day first. */
export function byDay(attempts: CardAttempt[]) {
  const days = new Map<string, CardAttempt[]>();
  for (const attempt of attempts) {
    const key = recordDay(attempt);
    const day = days.get(key);
    if (day) day.push(attempt);
    else days.set(key, [attempt]);
  }
  return new Map([...days].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Keeps the last result for the same arguments. Views ask on every render, and what they pass
 * changes only when practice does, so the figures are worked out once per change.
 */
export function memoLast<A extends unknown[], R>(fn: (...args: A) => R) {
  let last: { args: A; result: R } | undefined;
  return (...args: A): R => {
    if (last && last.args.length === args.length && last.args.every((arg, index) => Object.is(arg, args[index]))) return last.result;
    const result = fn(...args);
    last = { args, result };
    return result;
  };
}

// ---------------------------------------------------------------------------------------
// The figures
// ---------------------------------------------------------------------------------------

export type Resolutions = { cards: number; counts: Record<Resolution, number> };
export type Shares = Record<Resolution, number>;

/** How the day's cards among these were found: on the first choice, the second, or the third or later. */
export function resolutionsOf(attempts: CardAttempt[]): Resolutions {
  const counts: Record<Resolution, number> = { 1: 0, 2: 0, 3: 0 };
  for (const attempt of attempts) {
    const on = counted(attempt) ? resolvedOn(attempt) : undefined;
    if (on) counts[on] += 1;
  }
  return { cards: counts[1] + counts[2] + counts[3], counts };
}

/** Those as shares of the cards, from MIN_CARDS_SHOWN cards up. None from fewer. */
export function sharesOf({ cards, counts }: Resolutions): Shares | undefined {
  if (cards < MIN_CARDS_SHOWN) return undefined;
  return { 1: counts[1] / cards, 2: counts[2] / cards, 3: counts[3] / cards };
}

/** The chance of choosing the right answer first at random: 1 in the number offered, averaged over these cards. */
export function chanceOf(attempts: CardAttempt[]) {
  const offered = attempts.filter(counted).map((attempt) => attempt.choices).filter((choices) => choices > 0);
  return offered.length ? offered.reduce((sum, choices) => sum + 1 / choices, 0) / offered.length : undefined;
}

/** What choosing at random would score on a card with this many answers offered: each choice equally likely to be the one. */
export function chanceScore(choices: number) {
  const places = Array.from({ length: choices }, (_, index) => MEMORY_SCORE.points[Math.min(index + 1, 3) as Resolution]);
  return Math.round((100 * places.reduce((sum, points) => sum + points, 0)) / choices);
}

/** Every card ends on the right answer, so no day can score below this: every card on the third choice or later. */
export const scoreFloor = () => Math.round(100 * MEMORY_SCORE.points[3]);

/** What choosing at random would score over these cards, from how many answers each offered. Three answers each if there are none. */
export function chanceScoreOf(attempts: CardAttempt[]) {
  const offered = attempts.filter(counted).map((attempt) => attempt.choices).filter((choices) => choices > 1);
  if (offered.length === 0) return chanceScore(3);
  return Math.round(offered.reduce((sum, choices) => sum + chanceScore(choices), 0) / offered.length);
}

/** The day's Memory score, 0 to 100, or none below MEMORY_SCORE.minCards cards. */
export function memoryScore({ cards, counts }: Resolutions) {
  if (cards < MEMORY_SCORE.minCards) return undefined;
  const points = counts[1] * MEMORY_SCORE.points[1] + counts[2] * MEMORY_SCORE.points[2] + counts[3] * MEMORY_SCORE.points[3];
  return Math.round((100 * points) / cards);
}

/** The band a score falls in (SCORE_BANDS). */
export function bandOf(score: number): BandName {
  return [...SCORE_BANDS].reverse().find((band) => score >= band.from)!.name;
}

/** The middle value, from MIN_CARDS_SHOWN values up. None from fewer. */
export function median(values: number[]) {
  if (values.length < MIN_CARDS_SHOWN) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The middle time to the first choice over these cards. A record from before times were kept has none, and is left out. */
export function medianFirstChoice(attempts: CardAttempt[]) {
  return median(attempts.filter((attempt) => counted(attempt) && attempt.firstSelectionMs !== undefined).map((attempt) => cappedMs(attempt.firstSelectionMs!)));
}

export type StandardStatus = 'met' | 'about' | 'short' | 'partial';
export type Standard = { activeMs: number; expectedMs: number; ratio: number; status: StandardStatus };

/** A day's practice time against the standard for its target (SESSION_STANDARD). A day not finished is partial, whatever its time. */
export function againstStandard(activeMs: number, goal: number, cards: number): Standard | undefined {
  if (!goal) return undefined;
  const expectedMs = goal * SECONDS_PER_CARD * 1000;
  const ratio = activeMs / expectedMs;
  const status: StandardStatus = cards < goal ? 'partial' : ratio >= SESSION_STANDARD.met ? 'met' : ratio >= SESSION_STANDARD.about ? 'about' : 'short';
  return { activeMs, expectedMs, ratio, status };
}

export type DayInsight = {
  key: string;
  date: Date;
  /** The day's cards that were resolved: re-asks and cards left unanswered don't count. */
  cards: number;
  resolutions: Resolutions;
  shares?: Shares;
  score?: number;
  band?: BandName;
  chance?: number;
  medianFirstMs?: number;
  /** Every card's active time that day, each counted for at most ACTIVE_TIME.cardCapMs. */
  activeMs: number;
  /** The day's own session against the standard: extra practice is left out, so it can't change it. */
  standard?: Standard;
  /** Extra practice: resolved cards from rounds begun once the day's session was complete, and their time. Counted in everything but the standard. */
  extraPractice: { cards: number; activeMs: number };
  /** Whose cards came up, by person id, in the order they first did. */
  people: string[];
};

const dateOf = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Everything one day's records say. */
export function dayInsight(key: string, attempts: CardAttempt[]): DayInsight {
  const resolutions = resolutionsOf(attempts);
  const score = memoryScore(resolutions);
  const timeOf = (some: CardAttempt[]) => some.reduce((sum, attempt) => sum + cappedMs(attempt.activeMs), 0);
  const activeMs = timeOf(attempts);
  const session = attempts.filter((attempt) => !attempt.extraPractice);
  const extra = attempts.filter((attempt) => attempt.extraPractice);
  const goal = Math.max(0, ...attempts.map((attempt) => attempt.goal ?? 0));
  return {
    key,
    date: dateOf(key),
    cards: resolutions.cards,
    resolutions,
    shares: sharesOf(resolutions),
    score,
    band: score === undefined ? undefined : bandOf(score),
    chance: chanceOf(attempts),
    medianFirstMs: medianFirstChoice(attempts),
    activeMs,
    standard: againstStandard(timeOf(session), goal, resolutionsOf(session).cards),
    extraPractice: { cards: resolutionsOf(extra).cards, activeMs: timeOf(extra) },
    people: [...new Set(attempts.filter(counted).map((attempt) => attempt.personId))],
  };
}

/** The last `count` study days, oldest first, ending on `today`. */
export function lastDayKeys(today: string, count: number) {
  return lastStudyDays(today, count);
}

export type TrendLabel = 'improving' | 'steady' | 'support';
export type Trend = { label: TrendLabel; early: boolean; recent: number; earlier: number; recentCards: number; earlierCards: number };

/**
 * How practice is going against the person's own earlier practice: the mean points per card over
 * the last TREND.windowDays against the window before. None without enough cards and days; a change
 * only when it is big enough and at least twice its standard error.
 */
export function trendOf(attempts: CardAttempt[], today: string): Trend | undefined {
  const keys = lastDayKeys(today, TREND.windowDays * 2);
  const earlierKeys = new Set(keys.slice(0, TREND.windowDays));
  const recentKeys = new Set(keys.slice(TREND.windowDays));
  const pointsIn = (window: Set<string>) =>
    attempts.flatMap((attempt) => {
      const on = counted(attempt) && window.has(recordDay(attempt)) ? resolvedOn(attempt) : undefined;
      return on ? [MEMORY_SCORE.points[on]] : [];
    });
  const recent = pointsIn(recentKeys);
  const earlier = pointsIn(earlierKeys);
  const practiceDays = new Set(attempts.filter((attempt) => counted(attempt)).map(recordDay).filter((key) => recentKeys.has(key) || earlierKeys.has(key)));
  if (recent.length < TREND.minCards || earlier.length < TREND.minCards || practiceDays.size < TREND.minDays) return undefined;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = (values: number[], at: number) => values.reduce((sum, value) => sum + (value - at) ** 2, 0) / (values.length - 1);
  const [recentMean, earlierMean] = [mean(recent), mean(earlier)];
  const error = Math.sqrt(variance(recent, recentMean) / recent.length + variance(earlier, earlierMean) / earlier.length);
  const change = recentMean - earlierMean;
  const real = Math.abs(change) >= TREND.minChange && Math.abs(change) >= 2 * error;
  return {
    label: real ? (change > 0 ? 'improving' : 'support') : 'steady',
    early: recent.length < EARLY_READ_CARDS || earlier.length < EARLY_READ_CARDS,
    recent: Math.round(100 * recentMean),
    earlier: Math.round(100 * earlierMean),
    recentCards: recent.length,
    earlierCards: earlier.length,
  };
}

/** The words for a trend. Never anything about the person beyond their practice. */
export const TREND_WORDS: Record<TrendLabel, string> = {
  improving: 'Gently improving',
  steady: 'Steady',
  support: 'Needed more support lately',
};

/** "Extra practice": the cards from rounds begun once the day's session was complete, and their minutes. */
export function extraPracticeText({ cards, activeMs }: { cards: number; activeMs: number }) {
  const minutes = Math.max(1, Math.round(activeMs / 60_000));
  return `${cards} ${cards === 1 ? 'card' : 'cards'} · ${minutes} min`;
}

/** The words for practice time against the standard. Neutral, and a day not finished is partial, never a failure. */
export const STANDARD_WORDS: Record<StandardStatus, string> = {
  met: 'Met the standard',
  about: 'About the standard',
  short: 'Short of the standard',
  partial: 'Partial: some cards left for later',
};

export type PersonInsight = { personId: string; cards: number; resolutions: Resolutions; shares?: Shares; medianFirstMs?: number; early: boolean };

/** Each person whose cards came up in these records: how their cards were found, and the middle time to a first choice. */
export function peopleInsights(attempts: CardAttempt[]): PersonInsight[] {
  const byPerson = new Map<string, CardAttempt[]>();
  for (const attempt of attempts.filter(counted)) byPerson.set(attempt.personId, [...(byPerson.get(attempt.personId) ?? []), attempt]);
  return [...byPerson].map(([personId, theirs]) => {
    const resolutions = resolutionsOf(theirs);
    return { personId, cards: resolutions.cards, resolutions, shares: sharesOf(resolutions), medianFirstMs: medianFirstChoice(theirs), early: resolutions.cards < EARLY_READ_CARDS };
  });
}

// ---------------------------------------------------------------------------------------
// What stands out, and what the caregiver might do
// ---------------------------------------------------------------------------------------

export type StepTarget = { person: string } | { setting: 'session-length' | 'reveal-cards' };
export type NextStep = { text: string; target?: StepTarget };

type FamilyLike = {
  people: { id: string; name: string; archivedAt?: string }[];
  cards: { personId: string; status: string }[];
  revealCards: RevealSetting;
  sessionLength: SessionLength;
};

/** A person at least this far below the rest on first choices, over enough cards, is worth a look. */
const SUPPORT_SHARE = 0.5;
/** Fewer approved stories than this gives practice little to work with. */
const FEW_STORIES = 3;

/**
 * Up to three plain observations about the last two weeks. Each one is about practice only, and
 * compares the person only with their own earlier practice.
 */
export function observationsOf(recentDays: DayInsight[], trend: Trend | undefined, people: PersonInsight[], names: Map<string, string>) {
  const out: string[] = [];
  const practiced = recentDays.filter((day) => day.cards > 0);
  if (trend) {
    const early = trend.early ? ' This is an early read.' : '';
    if (trend.label === 'improving') out.push(`Practice has been gently improving over the last two weeks, compared with the two weeks before.${early}`);
    if (trend.label === 'steady') out.push(`Practice over the last two weeks has been steady, compared with the two weeks before.${early}`);
    if (trend.label === 'support') out.push(`Cards needed more support over the last two weeks than in the two weeks before. Hints are there for exactly this.${early}`);
  }
  const all = resolutionsOf([]);
  for (const day of practiced) for (const on of [1, 2, 3] as const) all.counts[on] += day.resolutions.counts[on];
  all.cards = all.counts[1] + all.counts[2] + all.counts[3];
  const shares = sharesOf(all);
  if (shares && all.cards >= 20 && shares[1] >= 0.6) out.push('Most answers in the last two weeks were found right away.');
  const timed = practiced.filter((day) => day.standard).slice(-7);
  const met = timed.filter((day) => day.standard!.status === 'met').length;
  const partial = timed.filter((day) => day.standard!.status === 'partial').length;
  if (timed.length >= 3) out.push(`Practice time met the standard on ${met} of the last ${timed.length} days of practice.`);
  if (partial >= 2) out.push(`${partial} recent days were partial: some of the day’s cards were left for later.`);
  const unscored = practiced.filter((day) => day.score === undefined).length;
  if (unscored >= 2) out.push(`${unscored} recent days had fewer than ${MEMORY_SCORE.minCards} cards, so they have no score.`);
  const needing = mostSupport(people);
  if (needing && names.get(needing.personId)) out.push(`${names.get(needing.personId)}’s cards needed the most support in the last two weeks.`);
  return out.slice(0, 3);
}

/** The person whose cards were found first least often, if that is clearly below the rest and well counted. */
function mostSupport(people: PersonInsight[]) {
  const wellCounted = people.filter((person) => person.shares && person.cards >= 10);
  if (wellCounted.length < 2) return undefined;
  const lowest = wellCounted.reduce((low, person) => (person.shares![1] < low.shares![1] ? person : low));
  return lowest.shares![1] < SUPPORT_SHARE ? lowest : undefined;
}

/** Up to three things the caregiver could do, each opening the person's sheet or the setting it means. */
export function nextStepsOf(recentDays: DayInsight[], people: PersonInsight[], family: FamilyLike): NextStep[] {
  const steps: NextStep[] = [];
  const names = new Map(family.people.map((person) => [person.id, person.name]));
  const needing = mostSupport(people);
  if (needing && names.get(needing.personId)) steps.push({ text: `Look over ${names.get(needing.personId)}’s photo and hints`, target: { person: needing.personId } });
  const stories = (id: string) => family.cards.filter((card) => card.personId === id && card.status === 'approved').length;
  const few = people.map((person) => person.personId).find((id) => names.get(id) && stories(id) < FEW_STORIES && !family.people.find((person) => person.id === id)?.archivedAt);
  if (few) steps.push({ text: `Add more stories about ${names.get(few)}`, target: { person: few } });
  const timed = recentDays.filter((day) => day.standard).slice(-7);
  if (family.sessionLength !== 'short' && timed.filter((day) => day.standard!.status === 'partial').length >= 3) {
    steps.push({ text: 'A shorter session length might fit better', target: { setting: 'session-length' } });
  }
  const scored = recentDays.filter((day) => day.score !== undefined).slice(-5);
  if (family.revealCards === 'off' && scored.length >= 3 && scored.filter((day) => day.band === 'Strong').length >= 3) {
    steps.push({ text: 'Reveal cards could add a gentle challenge', target: { setting: 'reveal-cards' } });
  }
  return steps.slice(0, 3);
}

// ---------------------------------------------------------------------------------------
// Everything a view needs, worked out once per change
// ---------------------------------------------------------------------------------------

export type ChartDay = { key: string; date: Date; day?: DayInsight };

export type InsightsView = {
  /** Every day with records, by key. */
  days: Map<string, DayInsight>;
  /** The most recent day with any of the day's cards. */
  latest?: DayInsight;
  /** The last 30 days and the last 14, oldest first, for the charts. */
  month: ChartDay[];
  fortnight: ChartDay[];
  /** The last 14 days together. */
  recent: { resolutions: Resolutions; shares?: Shares; chance?: number; medianFirstMs?: number; early: boolean };
  /** What random guessing would score, from the answers offered in the records shown. */
  chanceScore: number;
  trend?: Trend;
  people: PersonInsight[];
  observations: string[];
  steps: NextStep[];
  /** Any records at all, before or after the filters. */
  anyRecords: boolean;
};

/** Everything the insights views show. Memoized: the arguments change only when practice or a filter does. */
export const insightsFor = memoLast((attempts: CardAttempt[], family: FamilyLike, includeArchived: boolean, demo: boolean, today: string): InsightsView => {
  const shown = attemptsInView(attempts, family.people, { includeArchived, demo });
  const days = new Map([...byDay(shown)].map(([key, theirs]) => [key, dayInsight(key, theirs)]));
  const chart = (count: number) => lastDayKeys(today, count).map((key) => ({ key, date: dateOf(key), day: days.get(key) }));
  const fortnight = chart(14);
  const recentKeys = new Set(fortnight.map((day) => day.key));
  const recentAttempts = shown.filter((attempt) => recentKeys.has(recordDay(attempt)));
  const resolutions = resolutionsOf(recentAttempts);
  const people = peopleInsights(recentAttempts);
  const trend = trendOf(shown, today);
  const names = new Map(family.people.map((person) => [person.id, person.name]));
  const recentDays = fortnight.flatMap((day) => (day.day ? [day.day] : []));
  return {
    days,
    latest: [...days.values()].reverse().find((day) => day.cards > 0),
    month: chart(30),
    fortnight,
    recent: { resolutions, shares: sharesOf(resolutions), chance: chanceOf(recentAttempts), medianFirstMs: medianFirstChoice(recentAttempts), early: resolutions.cards < EARLY_READ_CARDS },
    chanceScore: chanceScoreOf(shown),
    trend,
    people,
    observations: observationsOf(recentDays, trend, people, names),
    steps: nextStepsOf(recentDays, people, family),
    anyRecords: attempts.length > 0,
  };
});

// ---------------------------------------------------------------------------------------
// Numbers and words as the views show them, and what each chart says to a screen reader
// ---------------------------------------------------------------------------------------

/** "9 min", or "40 s" under a minute. */
export function minutesText(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 1 ? `${minutes} min` : `${Math.round(ms / 1000)} s`;
}

/** "3.2 s". */
export const secondsText = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** "62%". */
export const percentText = (share: number) => `${Math.round(100 * share)}%`;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Today", "Yesterday", or "Tuesday, November 4". */
export function dayName(key: string, today: string) {
  if (key === today) return 'Today';
  if (key === lastDayKeys(today, 2)[0]) return 'Yesterday';
  const date = dateOf(key);
  return `${WEEKDAY[date.getDay()]}, ${MONTH[date.getMonth()]} ${date.getDate()}`;
}

/** "Last updated today at 3:42 PM", "yesterday at 9:05 AM", or "on November 4 at 8:30 PM": when Insights were last fetched, with sign-in on. */
export function updatedText(at: string, now: Date) {
  const date = new Date(at);
  // A clock time, described by the calendar: not a study-day decision.
  const key = calendarKey(date);
  const today = calendarKey(now);
  const day = key === today ? 'today' : key === lastDayKeys(today, 2)[0] ? 'yesterday' : `on ${monthDay(key)}`;
  const hours = date.getHours();
  return `Last updated ${day} at ${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** "Nov 4", for chart edges. */
export function shortDate(key: string) {
  const date = dateOf(key);
  return `${MONTH[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/** "9 min of about 8 min". */
export const timeAgainst = (standard: Standard) => `${minutesText(standard.activeMs)} of about ${minutesText(standard.expectedMs)}`;

/** What the score chart shows, in words. */
export function scoreSummary(days: ChartDay[], today: string) {
  const scored = days.flatMap((one) => (one.day?.score !== undefined ? [one.day] : []));
  if (scored.length === 0) return 'Memory score, last 30 days: no day had enough cards for a score yet.';
  const scores = scored.map((day) => day.score!);
  const last = scored[scored.length - 1];
  return `Memory score, last 30 days: ${scored.length} ${scored.length === 1 ? 'day' : 'days'} with a score, from ${Math.min(...scores)} to ${Math.max(...scores)}. ${dayName(last.key, today)}: ${last.score}, ${last.band}.`;
}

/** What the chart of how answers were found shows, in words. */
export function foundSummary(recent: InsightsView['recent']) {
  if (!recent.shares) return 'How answers were found, last 14 days: not enough cards yet.';
  const chance = chanceText(recent.chance) ? ` ${chanceText(recent.chance)}` : '';
  const [right, second, help] = foundGroups(recent.resolutions);
  return `How answers were found, last 14 days: ${percentText(right.share!)} right away (${right.count}), ${percentText(second.share!)} on a second try (${second.count}), ${percentText(help.share!)} with help (${help.count}).${chance}`;
}

/** What the answer speed chart shows, in words. */
export function speedSummary(days: ChartDay[]) {
  const timed = days.flatMap((one) => (one.day?.medianFirstMs !== undefined ? [one.day.medianFirstMs] : []));
  if (timed.length === 0) return 'Answer speed, last 14 days: not enough cards yet.';
  return `Answer speed, last 14 days: the middle time to the first choice ranged from ${secondsText(Math.min(...timed))} to ${secondsText(Math.max(...timed))} across ${timed.length} ${timed.length === 1 ? 'day' : 'days'}.`;
}

/** What the practice time chart shows, in words. */
export function timeSummary(days: ChartDay[]) {
  const timed = days.flatMap((one) => (one.day?.standard ? [one.day.standard] : []));
  if (timed.length === 0) return 'Practice time, last 14 days: no practice yet.';
  const count = (status: StandardStatus) => timed.filter((standard) => standard.status === status).length;
  return `Practice time, last 14 days, against the standard: met on ${count('met')}, about on ${count('about')}, short of on ${count('short')}, and ${count('partial')} partial ${count('partial') === 1 ? 'day' : 'days'}.`;
}

// ---------------------------------------------------------------------------------------
// The score calendar
// ---------------------------------------------------------------------------------------

/** A month (YYYY-MM) as weeks of day keys, Monday first, with null before the 1st and after the last day. */
export function monthWeeks(month: string) {
  const [year, number] = month.split('-').map(Number);
  const leading = (new Date(year, number - 1, 1).getDay() + 6) % 7;
  const length = new Date(year, number, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(leading).fill(null), ...Array.from({ length }, (_, index) => calendarKey(new Date(year, number - 1, index + 1)))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/** The month `by` months before (negative) or after. */
export function shiftMonth(month: string, by: number) {
  const [year, number] = month.split('-').map(Number);
  return calendarKey(new Date(year, number - 1 + by, 1)).slice(0, 7);
}

/** "November 2026". */
export function monthName(month: string) {
  const [year, number] = month.split('-').map(Number);
  return `${MONTH[number - 1]} ${year}`;
}

/** The earliest month with any records shown, so the calendar goes back as far as there is something to see. */
export function earliestMonth(view: InsightsView, today: string) {
  const first = [...view.days.keys()][0];
  return (first ?? today).slice(0, 7);
}

/** How a day looks on the score calendar: no practice, too few cards for a score, or its band. */
export type CellKind = 'none' | 'few' | BandName;

export function cellKind(day: DayInsight | undefined): CellKind {
  if (!day || day.cards === 0) return 'none';
  return day.band ?? 'few';
}

/** What a screen reader hears for a day on the score calendar. */
export function cellLabel(key: string, day: DayInsight | undefined) {
  const when = monthDay(key);
  const kind = cellKind(day);
  if (kind === 'none') return `${when}: no practice`;
  if (kind === 'few') return `${when}: ${day!.cards} ${day!.cards === 1 ? 'card' : 'cards'}, not enough for a score`;
  return `${when}: Memory score ${day!.score}, ${kind}`;
}

/** "6, 60%": a count, with its share once there are enough cards for one. */
export function countAndShare(count: number, share: number | undefined) {
  return share === undefined ? String(count) : `${count}, ${percentText(share)}`;
}

// ---------------------------------------------------------------------------------------
// Stepping through days in the day sheet
// ---------------------------------------------------------------------------------------

/**
 * The days the day sheet steps through, oldest first: every calendar day, practiced or not, from the
 * earliest with any record shown to today. Never a day after today; just today when nothing is shown.
 */
export function pagerDays(view: Pick<InsightsView, 'days'>, today: string) {
  const first = [...view.days.keys()][0];
  const start = first && first < today ? first : today;
  const [year, month, day] = start.split('-').map(Number);
  const keys: string[] = [];
  for (let offset = 0; ; offset++) {
    // Built from the date's parts, so a clock change never skips or repeats a day.
    const key = calendarKey(new Date(year, month - 1, day + offset));
    if (key > today) break;
    keys.push(key);
  }
  return keys;
}

/** The day `by` days from `key` within those days (1 the next, -1 the one before), or none past either end. */
export function stepDay(days: string[], key: string, by: number) {
  const index = days.indexOf(key);
  return index < 0 ? undefined : days[index + by];
}

/** "Nov 7", or "Today" and "Yesterday": the position hint between the day sheet's arrows. */
export function dayHint(key: string, today: string) {
  const name = dayName(key, today);
  return name === 'Today' || name === 'Yesterday' ? name : shortDate(key);
}

/** "November 4". */
export function monthDay(key: string) {
  const date = dateOf(key);
  return `${MONTH[date.getMonth()]} ${date.getDate()}`;
}

/** The bands in words, from SCORE_BANDS: "Getting started below 65, Building from 65, Steady from 80 and Strong from 90". */
export function bandsSentence() {
  const parts = SCORE_BANDS.map((band, index) => (index === 0 ? `${band.name} below ${SCORE_BANDS[1].from}` : `${band.name} from ${band.from}`));
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------------------
// The score range key
// ---------------------------------------------------------------------------------------

/** What each band means, in plain words: about how cards were found that day, and nothing else. */
export const BAND_MEANINGS: Record<BandName, string> = {
  'Getting started': 'Many answers were found on a second try or with help. Close to what choosing at random would score, so a day here says little on its own. Hints and familiar photos help on days like this.',
  Building: 'Some answers were found right away, and others with a little more help.',
  Steady: 'Most answers were found right away.',
  Strong: 'Nearly every answer was found right away.',
};

/** The one line under the chance marker. */
export const CHANCE_LINE = 'This is about what random guessing would score, so it is not a sign of recall.';

type Band = { readonly name: BandName; readonly from: number };
export type KeyBand = { name: BandName; from: number; to: number; range: string; spoken: string; start: number; width: number; meaning: string };
export type ScoreKey = { bands: KeyBand[]; breaks: { value: number; at: number }[]; chance: { value: number; at: number }; summary: string };

/**
 * The key to the Memory score's ranges, drawn on the same scale as the score chart (the floor to
 * 100). Every cutoff comes from the bands given, SCORE_BANDS unless a check passes others, so the key
 * can never disagree with the bands. `at`, `start` and `width` are percentages of the bar.
 */
export function scoreKey(chance: number, bands: readonly Band[] = SCORE_BANDS, floor = scoreFloor()): ScoreKey {
  const at = (value: number) => (100 * (Math.min(Math.max(value, floor), 100) - floor)) / (100 - floor);
  const keyBands = bands.map((band, index) => {
    const next = bands[index + 1];
    const to = next ? next.from - 1 : 100;
    const range = index === 0 ? `below ${next.from}` : next ? `${band.from} to ${to}` : `${band.from} to 100`;
    const start = at(index === 0 ? floor : band.from);
    return { name: band.name, from: band.from, to, range, spoken: `${band.name}, ${range}`, start, width: at(next ? next.from : 100) - start, meaning: BAND_MEANINGS[band.name] };
  });
  return {
    bands: keyBands,
    breaks: bands.slice(1).map((band) => ({ value: band.from, at: at(band.from) })),
    chance: { value: chance, at: at(chance) },
    summary: `Memory score ranges: ${keyBands.map((band) => band.spoken).join('; ')}. Random guessing would score about ${chance}.`,
  };
}

/** How a day's score is worked out, in words, from MEMORY_SCORE. */
export const scoreSentence = () =>
  `Each of the day’s cards earns points for how its answer was found: ${MEMORY_SCORE.points[1]} right away, ${MEMORY_SCORE.points[2]} on a second try, and ${MEMORY_SCORE.points[3]} with help. The score is the average, out of 100.`;

// ---------------------------------------------------------------------------------------
// The score ring's words
// ---------------------------------------------------------------------------------------

/** "today", "yesterday" or "Tuesday, November 4", inside a sentence. */
export function dayInSentence(key: string, today: string) {
  const name = dayName(key, today);
  return name === 'Today' || name === 'Yesterday' ? name.toLowerCase() : name;
}

/** What a screen reader hears for the ring: "Memory score 87 out of 100, Steady, today", or why there is no score. */
export function ringSpoken(day: Pick<DayInsight, 'key' | 'cards' | 'score' | 'band'> | undefined, today: string) {
  if (!day || day.cards === 0) return day ? `Memory score, ${dayInSentence(day.key, today)}: no practice` : 'Memory score: no practice yet';
  if (day.score === undefined) return `Memory score, ${dayInSentence(day.key, today)}: ${ringEmptyLine(day)}`;
  return `Memory score ${day.score} out of 100, ${day.band}, ${dayInSentence(day.key, today)}`;
}

/** Under an empty ring: "Needs 10 cards, 4 to go", or "No practice yet". Never a score from too few cards. */
export function ringEmptyLine(day: Pick<DayInsight, 'cards' | 'score'> | undefined) {
  if (!day || day.cards === 0) return 'No practice yet';
  const left = Math.max(0, MEMORY_SCORE.minCards - day.cards);
  return `Needs ${MEMORY_SCORE.minCards} cards, ${left} to go`;
}

// ---------------------------------------------------------------------------------------
// How answers were found, in plain words
// ---------------------------------------------------------------------------------------

export type FoundGroup = { on: Resolution; label: string; count: number; share?: number };

/**
 * The three ways an answer is found, in the words every view uses: right away (the first name
 * chosen), on a second try (one other name first, then usually a first hint), and with help (a third
 * try or later, after more hints). Whether the "?" of a reveal card was tapped is never recorded (the
 * hard rules), so it is not one of them.
 */
export const FOUND_LABELS: Record<Resolution, string> = { 1: 'Right away', 2: 'On a second try', 3: 'With help' };

/** The three groups with their counts, and their shares once there are MIN_CARDS_SHOWN cards. Shares add up to 1. */
export function foundGroups(resolutions: Resolutions): FoundGroup[] {
  const shares = sharesOf(resolutions);
  return ([1, 2, 3] as const).map((on) => ({ on, label: FOUND_LABELS[on], count: resolutions.counts[on], share: shares?.[on] }));
}

/** Whole percentages that add up to exactly 100, largest remainder first, so the three labels never read 99% or 101%. */
export function wholePercents(shares: number[]) {
  const raw = shares.map((share) => share * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

/** One plain sentence above the bar, from the shares of the last two weeks. Never "wrong", never a judgment. */
export function foundHeadline(shares: Shares | undefined) {
  if (!shares) return `How answers were found shows once there are ${MIN_CARDS_SHOWN} cards.`;
  if (shares[1] >= 0.6) return 'Most answers were found right away in the last two weeks.';
  if (shares[1] >= 0.4) return 'Many answers were found right away, and the rest on a second try or with help.';
  return 'Many answers took a second try or some help in the last two weeks. Hints are there for exactly this.';
}

/**
 * The chance line in words: "Choosing at random would find about 1 in 3 answers right away." From
 * the answers the records actually offered (1 in 2 in a two-person family); none without records.
 */
export function chanceText(chance: number | undefined) {
  if (chance === undefined || !(chance > 0) || chance >= 1) return undefined;
  const oneIn = Math.round(1 / chance);
  return oneIn >= 2 ? `Choosing at random would find about 1 in ${oneIn} answers right away.` : undefined;
}

/**
 * The Memory score of one person's cards over the last two weeks, on their page: the same points and
 * the same minimum of cards as a day's score, over that person's cards instead of one day's. Never
 * from fewer than MEMORY_SCORE.minCards cards.
 */
export function personScore(person: Pick<PersonInsight, 'resolutions'>) {
  const score = memoryScore(person.resolutions);
  return score === undefined ? undefined : { score, band: bandOf(score) };
}
