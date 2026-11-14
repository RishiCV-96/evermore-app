import { calendarKey, lastDays } from '@/lib/activity';
import type { CardAttempt } from '@/lib/attempts';
import type { HintRung, PhrasingKind } from '@/lib/stories';

// Demo insights, for development only: eight weeks of made-up card records for the fictional sample
// people, so Trends → Insights can be tried out. Every record is test data and marked as the demo's,
// stays on the phone, and goes with Clear test data or when the demo is turned off. It never touches
// real practice. Pure and seeded, so scripts/check-logic.mjs can check what it makes.

export const DEMO_DAYS = 56;
/** The day's target on a demo day. */
const DEMO_GOAL = 30;
const SHAPES: PhrasingKind[] = ['blank', 'ask', 'who', 'photo'];
const RUNGS: HintRung[] = ['letter', 'relationship', 'fewer'];

/**
 * How each sample person's cards tend to go, first choice share at the start and at the end of the
 * eight weeks: some improving, some steady, one that needs more support.
 */
const PATTERNS: Record<string, { from: number; to: number }> = {
  june: { from: 0.5, to: 0.86 },
  leo: { from: 0.74, to: 0.76 },
  ruth: { from: 0.84, to: 0.86 },
  omar: { from: 0.6, to: 0.76 },
  mae: { from: 0.42, to: 0.46 },
};

/** A small seeded generator, so the demo is the same each time. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eight weeks of demo records ending today, for those of the sample people still in the family. */
export function demoAttempts(people: string[], today: Date, seed = 11): CardAttempt[] {
  const random = seeded(seed);
  const who = people.filter((id) => PATTERNS[id]);
  if (who.length === 0) return [];
  const records: CardAttempt[] = [];
  lastDays(today, DEMO_DAYS).forEach((date, index) => {
    const progress = index / (DEMO_DAYS - 1);
    const last = index === DEMO_DAYS - 1;
    const roll = random();
    // About one day in six without practice; nothing is made for it. Today is always a full day.
    if (roll < 0.16 && !last) return;
    // Days with too few cards for a score, partial days, and full days, some with a little extra.
    const kind = last ? 'full' : roll < 0.24 ? 'few' : roll < 0.38 ? 'partial' : 'full';
    const cards = kind === 'few' ? 4 + Math.floor(random() * 6) : kind === 'partial' ? 12 + Math.floor(random() * 12) : DEMO_GOAL + Math.floor(random() * 4);
    // Faster and slower days, and days tapped through quickly, short of the standard.
    const pace = random();
    const speed = pace < 0.2 ? 0.7 : pace > 0.8 ? 1.5 : 1;
    const quick = kind === 'full' && random() < 0.2;
    const start = new Date(date);
    start.setHours(9 + Math.floor(random() * 9), Math.floor(random() * 50), 0, 0);
    let clock = start.getTime();
    for (let at = 0; at < cards; at++) {
      const personId = who[at % who.length];
      const pattern = PATTERNS[personId];
      const firstShare = pattern.from + (pattern.to - pattern.from) * progress;
      const draw = random();
      const on = draw < firstShare ? 1 : draw < firstShare + (1 - firstShare) * 0.6 ? 2 : 3;
      const firstMs = Math.round((1800 + random() * 3600) * speed);
      const shownAt = clock;
      const picks = Array.from({ length: on }, (_, pick) => ({ at: new Date(shownAt + firstMs + pick * 1300).toISOString(), right: pick === on - 1 }));
      const activeMs = quick ? firstMs + (on - 1) * 1300 + 1200 : firstMs + (on - 1) * 1300 + 5000 + Math.round(random() * 3000);
      records.push({
        id: `demo-${calendarKey(date)}-${at}`,
        sessionId: `demo-${calendarKey(date)}`,
        personId,
        cardId: `demo-${personId}`,
        phrasingId: `demo-${SHAPES[at % SHAPES.length]}`,
        shape: SHAPES[at % SHAPES.length],
        factType: 'memory',
        source: 'template',
        shownAt: new Date(shownAt).toISOString(),
        selections: picks,
        choices: 3,
        hints: RUNGS.slice(0, on - 1),
        success: true,
        activeMs,
        firstSelectionMs: firstMs,
        goal: DEMO_GOAL,
        testData: true,
        demo: true,
      });
      clock += activeMs + 800;
      // A card that needed a hint comes back once, as in practice: it never counts toward the day.
      if (on > 1 && random() < 0.5) {
        const again = clock;
        const againMs = Math.round(1500 * speed);
        records.push({
          ...records[records.length - 1],
          id: `demo-${calendarKey(date)}-${at}-again`,
          shownAt: new Date(again).toISOString(),
          selections: [{ at: new Date(again + againMs).toISOString(), right: true }],
          hints: [],
          activeMs: againMs + 4000,
          firstSelectionMs: againMs,
          extra: true,
        });
        clock += againMs + 4800;
      }
    }
  });
  return records;
}
