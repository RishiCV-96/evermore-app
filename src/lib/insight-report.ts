import { ATTEMPTS_KEPT_DAYS, MEMORY_SCORE, SCORE_BANDS, type BandName } from '@/config/insights';
import { realOnly, type ExportOrigin, type ExportSource } from '@/lib/export';
import {
  attemptsInView,
  bandOf,
  bandsSentence,
  byDay,
  chanceOf,
  chanceText,
  dayInsight,
  foundGroups,
  minutesText,
  peopleInsights,
  personScore,
  recordDay,
  resolutionsOf,
  scoreFloor,
  scoreSentence,
  wholePercents,
  type DayInsight,
  type FoundGroup,
} from '@/lib/insights';
import { addStudyDays, DAY_START_TEXT } from '@/lib/study-day';
import { cappedMs, type CardAttempt } from '@/lib/attempts';
import { COMPACT_SCALE } from '@/theme/type-scale';
import { Colors } from '@/theme/colors';

// The readable report (Settings → Export my data → Report (PDF)): a calm, compact summary of practice
// the caregiver could share with a clinician. Every figure comes from the same pure functions as the
// Insights tab (src/lib/insights.ts), over the same card records, grouped by study day, so the report
// and Insights always agree. Archived people are counted and labelled; test data and the demo never
// are. It describes practice activity only: never a medical measure, never compared with anyone else.
// Pure, so scripts/check-export.mjs checks its figures and scripts/check-logic.mjs every word it says.

export type ReportWeek = {
  /** The study day the week starts on (a Monday), and the last one in it. */
  from: string;
  to: string;
  daysPracticed: number;
  cards: number;
  extraCards: number;
  found: FoundGroup[];
  /** The average of the week's daily Memory scores, on days that have one. */
  averageScore?: number;
  band?: BandName;
  scoredDays: number;
  activeMs: number;
};

export type ReportPerson = { id: string; name: string; archived: boolean; cards: number; found: FoundGroup[]; score?: number; band?: BandName };

export type Report = {
  madeOn: string;
  origin: ExportOrigin['from'];
  /** The first and last study day with any record. */
  range?: { from: string; to: string };
  /** Every study day with records, oldest first: the same figures as Insights. */
  days: DayInsight[];
  daysPracticed: number;
  /** Rounds of practice that began before the day's session was complete, and those after it. */
  sessions: number;
  extraRounds: number;
  extraCards: number;
  cards: number;
  activeMs: number;
  found: FoundGroup[];
  chance?: number;
  bandDays: Record<BandName, number>;
  people: ReportPerson[];
  mostReadily?: ReportPerson;
  mostSupport?: ReportPerson;
  weeks: ReportWeek[];
};

/** The records the report counts: everyone's, archived people's too, and never test data or the demo. */
export function reportRecords(source: Pick<ExportSource, 'people' | 'cards' | 'records'>) {
  return attemptsInView(realOnly(source).records, source.people, { includeArchived: true, demo: false });
}

/** The Monday on or before a study day's date. */
function weekStart(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addStudyDays(key, -((weekday + 6) % 7));
}

const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined);
const timeOf = (records: CardAttempt[]) => records.reduce((sum, record) => sum + cappedMs(record.activeMs), 0);

/** Everything the report shows. `madeOn` is the study day it was made on. */
export function reportOf(source: Pick<ExportSource, 'origin' | 'people' | 'cards' | 'records'>, madeOn: string): Report {
  const records = reportRecords(source);
  const days = [...byDay(records)].map(([key, theirs]) => dayInsight(key, theirs));
  const practiced = days.filter((day) => day.cards > 0);
  const resolutions = resolutionsOf(records);
  const rounds = new Set(records.map((record) => record.sessionId));
  const extraRounds = new Set(records.filter((record) => record.extraPractice).map((record) => record.sessionId));
  const bandDays = Object.fromEntries(SCORE_BANDS.map((band) => [band.name, days.filter((day) => day.band === band.name).length])) as Record<BandName, number>;

  const names = new Map(source.people.map((person) => [person.id, person]));
  const people: ReportPerson[] = peopleInsights(records)
    .filter((person) => names.has(person.personId))
    .map((person) => {
      const known = names.get(person.personId)!;
      const scored = personScore(person);
      return { id: person.personId, name: known.name, archived: Boolean(known.archivedAt), cards: person.cards, found: foundGroups(person.resolutions), score: scored?.score, band: scored?.band };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.cards - a.cards || a.name.localeCompare(b.name));
  const scored = people.filter((person) => person.score !== undefined);
  const spread = scored.length >= 2 && scored[0].score !== scored[scored.length - 1].score;

  const weeks = new Map<string, CardAttempt[]>();
  for (const record of records) {
    const start = weekStart(recordDay(record));
    weeks.set(start, [...(weeks.get(start) ?? []), record]);
  }
  const byKey = new Map(days.map((day) => [day.key, day]));
  return {
    madeOn,
    origin: source.origin.from,
    range: days.length ? { from: days[0].key, to: days[days.length - 1].key } : undefined,
    days,
    daysPracticed: practiced.length,
    sessions: rounds.size - extraRounds.size,
    extraRounds: extraRounds.size,
    extraCards: practiced.reduce((sum, day) => sum + day.extraPractice.cards, 0),
    cards: resolutions.cards,
    activeMs: timeOf(records),
    found: foundGroups(resolutions),
    chance: chanceOf(records),
    bandDays,
    people,
    mostReadily: spread ? scored[0] : undefined,
    mostSupport: spread ? scored[scored.length - 1] : undefined,
    weeks: [...weeks]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([from, theirs]) => {
        const keys = Array.from({ length: 7 }, (_, index) => addStudyDays(from, index));
        const inWeek = keys.flatMap((key) => (byKey.get(key) ? [byKey.get(key)!] : []));
        const scores = inWeek.flatMap((day) => (day.score === undefined ? [] : [day.score]));
        const averageScore = average(scores);
        return {
          from,
          to: keys[6],
          daysPracticed: inWeek.filter((day) => day.cards > 0).length,
          cards: resolutionsOf(theirs).cards,
          extraCards: inWeek.reduce((sum, day) => sum + day.extraPractice.cards, 0),
          found: foundGroups(resolutionsOf(theirs)),
          averageScore,
          band: averageScore === undefined ? undefined : bandOf(averageScore),
          scoredDays: scores.length,
          activeMs: timeOf(theirs),
        };
      }),
  };
}

// ---------------------------------------------------------------------------------------
// The page, as HTML for expo-print
// ---------------------------------------------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = (key: string) => key.split('-').map(Number);
/** "November 13, 2026". */
export const longDate = (key: string) => `${MONTHS[parts(key)[1] - 1]} ${parts(key)[2]}, ${parts(key)[0]}`;
/** "Nov 13". */
const shortDay = (key: string) => `${MONTHS[parts(key)[1] - 1].slice(0, 3)} ${parts(key)[2]}`;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** The words every report carries. */
export const REPORT_NOTES = {
  personal: 'This report contains personal information: the names of your family and how practice went. Share it carefully, only with people you trust, such as a clinician.',
  medical: 'Practice activity, not a medical measure.',
  studyDay: `Every figure is grouped by study day: a day runs from ${DAY_START_TEXT} to just before ${DAY_START_TEXT} the next morning.`,
  placeholders: 'Spacing intervals, session lengths and the day’s start time are placeholders, still to be reviewed by a speech-language pathologist.',
  kept: `Card records are kept for ${ATTEMPTS_KEPT_DAYS} days, so this report covers at most the last ${ATTEMPTS_KEPT_DAYS} days.`,
  score: `${scoreSentence()} A day needs at least ${MEMORY_SCORE.minCards} cards for a score. It summarizes one day of practice, is affected by sleep, mood and the time of day, and is compared only with the same person’s own history.`,
  phoneCopy: 'Made from this phone’s copy while the server couldn’t be reached, so it may be missing the newest practice.',
} as const;

/** Whole percentages for the three ways, or none below the minimum of cards. */
function foundCells(found: FoundGroup[]) {
  if (found.some((group) => group.share === undefined)) return found.map(() => '–');
  return wholePercents(found.map((group) => group.share!)).map((value) => `${value}%`);
}

const BAND_FILL = [Colors.background, Colors.pinkTint, Colors.pink1, Colors.pink2];

/** The Memory score over the report's days: soft pink bands, a point for each scored day, and nothing for a day without one. */
function scoreChart(report: Report) {
  const width = 540;
  const height = 170;
  const left = 92;
  const right = 8;
  const top = 8;
  const bottom = 22;
  const floor = scoreFloor();
  const y = (value: number) => top + ((100 - value) / (100 - floor)) * (height - top - bottom);
  const first = report.range?.from;
  const span = first && report.range ? Math.max(1, dayIndex(first, report.range.to)) : 1;
  const x = (key: string) => left + (first ? (dayIndex(first, key) / span) * (width - left - right) : 0);
  const bands = SCORE_BANDS.map((band, index) => {
    const from = Math.max(band.from, floor);
    const to = SCORE_BANDS[index + 1]?.from ?? 100;
    return `<rect x="${left}" y="${y(to)}" width="${width - left - right}" height="${y(from) - y(to)}" fill="${BAND_FILL[index]}"/><text x="${left - 6}" y="${(y(to) + y(from)) / 2 + 4}" text-anchor="end" class="axis">${escape(band.name)}</text>`;
  }).join('');
  const scored = report.days.filter((day) => day.score !== undefined);
  const line = scored.length > 1 ? `<polyline fill="none" stroke="${Colors.pink4}" stroke-width="1.5" points="${scored.map((day) => `${x(day.key).toFixed(1)},${y(day.score!).toFixed(1)}`).join(' ')}"/>` : '';
  const dots = scored.map((day) => `<circle cx="${x(day.key).toFixed(1)}" cy="${y(day.score!).toFixed(1)}" r="2.6" fill="${Colors.pinkInk}"/>`).join('');
  const edges = report.range ? `<text x="${left}" y="${height - 6}" class="axis">${shortDay(report.range.from)}</text><text x="${width - right}" y="${height - 6}" text-anchor="end" class="axis">${shortDay(report.range.to)}</text>` : '';
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Memory score by study day">${bands}${line}${dots}${edges}</svg>`;
}

function dayIndex(from: string, to: string) {
  const [a, b] = [from, to].map((key) => Date.UTC(parts(key)[0], parts(key)[1] - 1, parts(key)[2]));
  return Math.round((b - a) / 86_400_000);
}

/** "36 min", or "3 h 36 min" from an hour up. */
export function durationText(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : minutesText(ms);
}

const stat = (label: string, value: string) => `<div class="stat"><div class="value">${escape(value)}</div><div class="label">${escape(label)}</div></div>`;

/** The report as one HTML page, in the caregiver's compact type and the Memory score's pinks. */
export function reportHtml(report: Report) {
  const type = COMPACT_SCALE;
  const found = foundCells(report.found);
  const chance = chanceText(report.chance);
  const people = report.people
    .map((person) => {
      const cells = foundCells(person.found);
      return `<tr><td>${escape(person.name)}${person.archived ? ' <span class="muted">(archived)</span>' : ''}</td><td class="num">${person.cards}</td><td class="num">${cells[0]}</td><td class="num">${cells[1]}</td><td class="num">${cells[2]}</td><td class="num">${person.score === undefined ? '–' : `${person.score} <span class="muted">${escape(person.band!)}</span>`}</td></tr>`;
    })
    .join('');
  const weeks = report.weeks
    .map((week) => {
      const cells = foundCells(week.found);
      return `<tr><td class="week">${shortDay(week.from)} – ${shortDay(week.to)}</td><td class="num">${week.daysPracticed}</td><td class="num">${week.cards}${week.extraCards ? ` <span class="muted">(${week.extraCards} extra)</span>` : ''}</td><td class="num">${cells[0]}</td><td class="num">${cells[1]}</td><td class="num">${cells[2]}</td><td class="num">${week.averageScore === undefined ? '–' : `${week.averageScore} <span class="muted">${escape(week.band!)}</span>`}</td><td class="num">${durationText(week.activeMs)}</td></tr>`;
    })
    .join('');
  const range = report.range ? (report.range.from === report.range.to ? longDate(report.range.from) : `${longDate(report.range.from)} to ${longDate(report.range.to)}`) : 'No practice recorded yet';
  const readily = report.mostReadily && report.mostSupport
    ? `<p>Found most readily: <b>${escape(report.mostReadily.name)}</b> (${report.mostReadily.score}, ${escape(report.mostReadily.band!)}). Needed the most support: <b>${escape(report.mostSupport.name)}</b> (${report.mostSupport.score}, ${escape(report.mostSupport.band!)}). Each person is compared only with the rest of their own family’s practice.</p>`
    : '';
  const body = report.range
    ? `
  <div class="stats">
    ${stat('Study days practiced', String(report.daysPracticed))}
    ${stat('Sessions', String(report.sessions))}
    ${stat('Extra practice', report.extraRounds ? `${report.extraRounds} ${report.extraRounds === 1 ? 'round' : 'rounds'}, ${report.extraCards} cards` : 'None')}
    ${stat('Cards practiced', report.cards.toLocaleString('en-US'))}
    ${stat('Time practicing', durationText(report.activeMs))}
  </div>

  <h2>Memory score over time</h2>
  ${scoreChart(report)}
  <p class="small">Days in each band: ${SCORE_BANDS.map((band) => `${escape(band.name)} ${report.bandDays[band.name]}`).join(', ')}. Days with no score are left out, and nothing counts against them. Bands: ${escape(bandsSentence())}.</p>
  <p class="small">${escape(REPORT_NOTES.score)}</p>

  <h2>How answers were found</h2>
  <table class="found"><tr>${report.found.map((group, index) => `<td><div class="value">${found[index]}</div><div class="label">${escape(group.label)} <span class="muted">(${group.count})</span></div></td>`).join('')}</tr></table>
  ${chance ? `<p class="small">${escape(chance)}</p>` : ''}

  <h2>People</h2>
  <table>
    <tr><th>Person</th><th class="num">Cards</th><th class="num">Right away</th><th class="num">Second try</th><th class="num">With help</th><th class="num">Memory score</th></tr>
    ${people}
  </table>
  ${readily}
  <p class="small">A person’s Memory score is worked out over all of their cards in this report, the same way as a day’s, from at least ${MEMORY_SCORE.minCards} cards.</p>

  <h2>Week by week</h2>
  <table>
    <tr><th>Week</th><th class="num">Days</th><th class="num">Cards</th><th class="num">Right away</th><th class="num">Second try</th><th class="num">With help</th><th class="num">Average daily score</th><th class="num">Time</th></tr>
    ${weeks}
  </table>`
    : `<p>No practice has been recorded yet. Once the person practices, the report fills in.</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evermore practice report</title>
<style>
  @page { margin: 36px; }
  body { font-family: 'Atkinson Hyperlegible', -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: ${Colors.text}; background: ${Colors.background}; font-size: ${type.caption}px; line-height: 1.4; margin: 0; }
  h1 { font-size: ${type.title}px; margin: 0 0 2px; color: ${Colors.text}; }
  h2 { font-size: ${type.body}px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 2px solid ${Colors.pink2}; page-break-after: avoid; }
  p { margin: 4px 0; }
  .muted, .label, .axis { color: ${Colors.textMuted}; }
  .small { font-size: ${type.caption - 2}px; }
  .axis { font-size: 9px; font-family: inherit; fill: ${Colors.textMuted}; }
  .notice { background: ${Colors.pinkTint}; border-left: 4px solid ${Colors.pink3}; padding: 8px 10px; margin: 10px 0; }
  .stats { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .stat { flex: 1 1 70px; background: ${Colors.surface}; padding: 6px 8px; }
  .value { font-size: ${type.body}px; font-weight: bold; color: ${Colors.text}; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { text-align: left; padding: 3px 4px; border-bottom: 1px solid ${Colors.divider}; vertical-align: top; }
  th { font-weight: bold; color: ${Colors.textMuted}; }
  .num { text-align: right; white-space: nowrap; }
  th.num { white-space: normal; }
  .week { white-space: nowrap; }
  table.found td { width: 33%; border: 0; background: ${Colors.pinkTint}; padding: 6px 8px; }
  table.found { border-spacing: 6px 0; border-collapse: separate; margin: 0 -6px; width: calc(100% + 12px); }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid ${Colors.divider}; page-break-inside: avoid; }
</style></head>
<body>
  <h1>Evermore practice report</h1>
  <p class="muted">Made on ${longDate(report.madeOn)}. Study days: ${escape(range)}.</p>
  <div class="notice">${escape(REPORT_NOTES.personal)}${report.origin === 'phone-copy' ? `<br>${escape(REPORT_NOTES.phoneCopy)}` : ''}</div>
  ${body}
  <footer class="small">
    <p><b>${escape(REPORT_NOTES.medical)}</b></p>
    <p>${escape(REPORT_NOTES.studyDay)}</p>
    <p>${escape(REPORT_NOTES.placeholders)}</p>
    <p>${escape(REPORT_NOTES.kept)}</p>
  </footer>
</body></html>`;
}
