import {
  CARDS_APART,
  CUE_FADING,
  DEFAULT_SESSION_LENGTH,
  NEXT_TAP_GUARD_MS,
  PERSON_PRACTICE,
  PRACTICE_MORE,
  REVIEW_PASS,
  SAME_SESSION_CARDS,
  SECONDS_PER_CARD,
  SESSION_LENGTHS,
  TODAY_YOU_SAW,
  type SessionLength,
} from '@/config/schedule';
import { REVERSE_MOST_LETTERS } from '@/lib/ai-check';
import type { SavedCard } from '@/lib/facts';
import { hasPhoto, type PhotoFields } from '@/lib/photo-fields';
import { deckOf, type ProfilePerson } from '@/lib/profile';
import { buildQueue, needMostFirst, personQueue, type Schedule } from '@/lib/queue';
import { ALL_HINTS, answerOf, cueLevel, phrasingsFor, phrasingsOn, roundFor, sentenceFor, type BestClue, type Card, type Fact, type Hints, type Phrasing, type PhrasingKind, type Round } from '@/lib/stories';
import { isAiPhrasing } from '@/lib/variants';

// The day's practice: how many cards a deck calls for, what they ask and in what order, and how
// long that should take. Pure, so scripts/check-logic.mjs can check it. Nothing here is ever
// shown except the target and the estimate; the order, and why, stay internal.

export type PracticePerson = PhotoFields & {
  id: string;
  name: string;
  relationship?: string;
  /** Which hints practice may give. Missing on a phone copy saved before hints. */
  hints?: Hints;
  /** What helps most in recognizing them. It steers the fact hint. */
  bestClue?: BestClue;
  /** False when the caregiver opted them out of reveal cards. */
  revealOk?: boolean;
};

/**
 * An approved card: the sentence the caregiver approved, the fact it says, the phrasings they
 * turned off, whether it may be a hint, and a shared memory's photo.
 */
export type DeckCard = PhotoFields & {
  id: string;
  personId: string;
  sentence: string;
  fact?: Fact;
  phrasingsOff?: string[];
  hintOk?: boolean;
  /** Approved AI sentences for this card. See src/lib/variants.ts. */
  variants?: Phrasing[];
};

/**
 * The fixed phrasings the caregiver left on for a card, plus approved variants (none: see
 * src/lib/variants.ts). Story approval lists the same ones, made by the same function.
 */
function phrasingsOf(card: DeckCard, person: PracticePerson): Phrasing[] {
  // A phone copy saved before facts has only the approved sentence.
  if (!card.fact) return [{ id: 'saved', kind: 'blank', ask: card.sentence, reveal: card.sentence }];
  const every = [...phrasingsFor({ relationship: person.relationship, hasPhoto: hasPhoto(person), name: person.name }, card.fact), ...(card.variants ?? [])];
  return phrasingsOn(every, card.phrasingsOff);
}

/**
 * A reverse card offers other people's facts of the same kind in place of names. Without two, it
 * can't be asked. Anything also true of this person is left out, so a true answer is never treated
 * as the wrong one, and so is a fact that may change, which only ever appears dated.
 */
function withOthers(cards: Card[]) {
  const others = (card: Card) => {
    const lower = (text: string) => text.toLowerCase();
    const theirs = new Set(cards.flatMap((other) => (other.personId === card.personId && other.fact ? [lower(other.fact.text)] : [])));
    const fits = (other: Card) => other.fact?.type === card.fact?.type && !other.fact?.timeSensitive && (other.fact?.text.length ?? Infinity) <= REVERSE_MOST_LETTERS;
    const texts = cards.filter(fits).flatMap((other) => (other.fact && !theirs.has(lower(other.fact.text)) ? [other.fact.text] : []));
    return [...new Map(texts.map((text) => [lower(text), text])).values()];
  };
  return cards.map((card) => {
    if (!card.phrasings.some((phrasing) => phrasing.fill)) return card;
    const phrasings = card.phrasings.flatMap((phrasing) => {
      if (!phrasing.fill) return [phrasing];
      const offered = others(card);
      return offered.length >= 2 ? [{ ...phrasing, fill: { ...phrasing.fill, others: offered } }] : [];
    });
    return { ...card, phrasings };
  });
}

/** Every approved card as practice shows it, with the ways the caregiver lets it be asked. */
export function cardsOf(people: PracticePerson[], cards: DeckCard[]): Card[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const built = cards.flatMap((card) => {
    const person = byId.get(card.personId);
    return person
      ? [
          {
            id: card.id,
            personId: person.id,
            answer: person.name,
            relationship: person.relationship,
            fact: card.fact,
            hints: person.hints ?? ALL_HINTS,
            phrasings: phrasingsOf(card, person),
            hintOk: card.hintOk,
            bestClue: person.bestClue,
            revealOk: person.revealOk !== false && hasPhoto(person),
          },
        ]
      : [];
  });
  // A card whose every way to ask would show the answer has nothing to ask.
  return withOthers(built).filter((card) => card.phrasings.length > 0);
}

/** What a family's people and facts give practice: the deck, as the person's screens read it. */
export function practiceFrom<P extends PracticePerson & { inDeck?: boolean; includeInPractice?: boolean }>(
  people: P[],
  facts: SavedCard[],
  about: (person: P) => ProfilePerson,
  variantsFor: (card: SavedCard, person: P) => Phrasing[] = () => [],
) {
  const deck = deckOf(people, facts, about);
  const byId = new Map(deck.people.map((person) => [person.id, person]));
  const cards: DeckCard[] = deck.cards.flatMap((card) => {
    const person = byId.get(card.personId);
    if (!person) return [];
    const { type, text, timeSensitive, asOf, year, wording, phrasingsOff, hintOk, photoUri, photoPath, photoUrl } = card;
    // The card's id and wording travel with its fact: wording 2 picks its variant from the id.
    const fact = { type, text, timeSensitive, asOf, year, id: card.id, wording };
    return [{ id: card.id, personId: card.personId, sentence: sentenceFor(person, card), fact, phrasingsOff, hintOk, photoUri, photoPath, photoUrl, variants: variantsFor(card, person) }];
  });
  return { people: deck.people, cards };
}

/** One question asked today, kept on the phone so nothing repeats after a stop and a resume. */
export type AskedToday = {
  personId: string;
  cardId: string;
  /** The question: see sentenceKey. */
  key: string;
  kind: PhrasingKind;
  /** It came back after a hint, so it doesn't count toward the day. */
  extra?: boolean;
};

export type TodayLog = {
  day: string;
  asked: AskedToday[];
  /** Who was in the deck, and the target, when today's target was last worked out (goalToday). */
  deck?: string[];
  goal?: number;
  /** Someone left the deck today, so the target can't grow past this until someone joins. */
  most?: number;
};

/**
 * What makes a question the same question: its words. "Who is this?" says nothing by itself, so
 * it is a question about whose photo it shows.
 */
export function sentenceKey(personId: string, phrasing: Phrasing) {
  return phrasing.kind === 'photo' ? `${personId}: ${phrasing.ask}` : phrasing.ask;
}

const peopleIn = (cards: { personId: string }[]) => [...new Set(cards.map((card) => card.personId))];

/** How many different questions the deck has for each person. A sentence two people share counts once. */
function questionsPerPerson(deck: Card[]) {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const card of deck) {
    for (const phrasing of card.phrasings) {
      const key = sentenceKey(card.personId, phrasing);
      if (seen.has(key)) continue;
      seen.add(key);
      counts.set(card.personId, (counts.get(card.personId) ?? 0) + 1);
    }
  }
  return counts;
}

/** Shares `total` out evenly, one each in turn, capping anyone with too few and filling from the others. */
function shareOut(available: Map<string, number>, total: number, order: string[]) {
  const share = new Map(order.map((id) => [id, 0]));
  let left = total;
  while (left > 0) {
    const open = order.filter((id) => share.get(id)! < (available.get(id) ?? 0));
    if (open.length === 0) break;
    for (const id of open.slice(0, left)) share.set(id, share.get(id)! + 1);
    left = total - [...share.values()].reduce((sum, count) => sum + count, 0);
  }
  return share;
}

/** How far apart one person's cards can be, with this many people. */
const spacingFor = (people: number) => Math.min(CARDS_APART, Math.max(people, 1));

/** How far apart a session from this deck keeps one person's cards. */
export const spacingIn = (deck: Card[]) => spacingFor(peopleIn(deck).length);

/** One person's own session: their cards follow each other, by choice. */
export const ONE_PERSON_SPACING = 1;

/** Whether these shares can be laid out with each person's cards `apart` from each other. */
function canSpace(shares: number[], apart: number) {
  const total = shares.reduce((sum, count) => sum + count, 0);
  const most = Math.max(...shares, 0);
  return (most - 1) * apart + shares.filter((count) => count === most).length <= total;
}

/** The most cards up to `wanted` that the deck can give with no repeats and its people kept apart. */
function reachable(counts: Map<string, number>, wanted: number) {
  const order = [...counts.keys()];
  const apart = spacingFor(order.length);
  for (let target = wanted; target > 0; target--) {
    const shares = [...shareOut(counts, target, order).values()];
    if (shares.reduce((sum, count) => sum + count, 0) === target && canSpace(shares, apart)) return target;
  }
  return 0;
}

/** Practice needs at least this many people in the deck, so every card offers a real choice of names. */
export const MIN_PEOPLE = 2;

/** Whether a deck has enough people to practice with. */
export const enoughPeople = (cards: { personId: string }[]) => peopleIn(cards).length >= MIN_PEOPLE;

/** About `perPerson` questions for each of this many people, within the session's limits. */
function wantedFor(people: number, length: SessionLength) {
  const { perPerson, least, most } = SESSION_LENGTHS[length];
  return Math.min(Math.max(perPerson * people, least), most);
}

/** The day's target: about `perPerson` questions for each person, within the session's limits, never with repeats. None with fewer than two people. */
export function dailyTarget(deck: Card[], length: SessionLength = DEFAULT_SESSION_LENGTH) {
  if (!enoughPeople(deck)) return 0;
  return reachable(questionsPerPerson(deck), wantedFor(peopleIn(deck).length, length));
}

/**
 * Today's target, and today's log with it, to keep. When someone leaves the deck during the day
 * (archived, deselected, back to a draft), the cards they finished still count, their remaining
 * cards go and nobody else makes them up, and the target can't grow again that day: a smaller deck
 * can allow more, because fewer people need less spacing. So the progress bar never moves back, and
 * never passes the end. When someone joins (restored, added, finished), the day grows by their
 * share, as it always has. Cards that came back after a hint never count, so the target can't tell
 * how answers went.
 */
export function goalToday(deck: Card[], length: SessionLength, log: TodayLog | undefined, day: string): { goal: number; log: TodayLog } {
  const today: TodayLog = log?.day === day ? log : { day, asked: [] };
  const here = peopleIn(deck);
  const target = dailyTarget(deck, length);
  const counted = today.asked.filter((one) => !one.extra);
  const gone = counted.filter((one) => !here.includes(one.personId));
  const withTheirs = target && gone.length ? Math.min(target + gone.length, wantedFor(here.length + peopleIn(gone).length, length)) : target;
  const joined = today.deck !== undefined && here.some((id) => !today.deck!.includes(id));
  const left = today.deck !== undefined && today.deck.some((id) => !here.includes(id));
  const most = joined ? undefined : left ? today.goal : today.most;
  let goal = withTheirs;
  // Nobody left to practice with: a day already begun keeps its target, so the bar stays where it was.
  if (most !== undefined && target === 0) goal = counted.length ? most : 0;
  // Under a ceiling the day ends at the cards already done, rather than past them.
  else if (most !== undefined) goal = Math.max(Math.min(withTheirs, most), Math.min(counted.length, most));
  return { goal, log: { ...today, deck: here, goal, most } };
}

/** The whole-minute estimate: cards times the average time per card. */
export function estimatedMinutes(cards: number) {
  return cards > 0 ? Math.max(1, Math.round((cards * SECONDS_PER_CARD) / 60)) : 0;
}

/** "About 8 minutes". */
export function minutesLabel(cards: number) {
  const minutes = estimatedMinutes(cards);
  return `About ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Once the day's session is finished, on the home and the wrap-up. Optional, calm words: never that
 * practice is over or closed, never a time or a countdown. Keep practicing is always on the home.
 */
export const AFTER_THE_DAY = { title: 'Nice work.', line: 'You can keep practicing, or come back in the morning.' };

/** The calm line for today: the day ahead, or what's left of it. Nothing once it's done. */
export function todayLine(goal: number, completed: number) {
  const left = goal - completed;
  if (left <= 0) return undefined;
  return completed > 0 ? `${minutesLabel(left)} left today` : `${minutesLabel(goal)} today`;
}

/**
 * Whether a tap on Next counts: any tap does, except in the instant after the right name was chosen,
 * which is that same finger. It looks only at the clock, so no kind of card, hint or flip can hold
 * Next back.
 */
export function nextTapCounts(answeredAt: number, tappedAt: number) {
  return tappedAt - answeredAt >= NEXT_TAP_GUARD_MS;
}

/** Today's log, or an empty one once the day has changed. */
export function askedOn(log: TodayLog | undefined, day: string) {
  return log?.day === day ? log.asked : [];
}

/**
 * Notes a question in the log of the study day its round belongs to. A round begun before 05:30 and
 * still going after it belongs to the day before: it never writes into, or wipes, the new day's log.
 */
export function logAsked(log: TodayLog | undefined, day: string, asked: AskedToday): TodayLog | undefined {
  if (log && log.day > day) return log;
  return { ...(log?.day === day ? log : {}), day, asked: [...askedOn(log, day), asked] };
}

type Planned = { card: Card; phrasing: Phrasing; rank: number };

type Picking = {
  /** Questions taken today, or by this plan. */
  used: Set<string>;
  /** Facts asked already today. */
  factsAsked: Set<string>;
  /** What each person has been asked today, so a day uses different shapes. */
  kinds: Map<string, Set<PhrasingKind>>;
  /** The way each person was last asked: nobody is asked the same way twice in a row. */
  lastWay: Map<string, string | undefined>;
  /** Each card's schedule step, for cue fading. */
  schedule: Schedule;
  random: () => number;
};

function pickingFrom(asked: AskedToday[], last: Record<string, { phrasing?: string }>, schedule: Schedule, random: () => number): Picking {
  const kinds = new Map<string, Set<PhrasingKind>>();
  for (const { personId, kind } of asked) kinds.set(personId, new Set([...(kinds.get(personId) ?? []), kind]));
  return { used: new Set(asked.map((one) => one.key)), factsAsked: new Set(asked.map((one) => one.cardId)), kinds, lastWay: new Map(Object.entries(last).map(([id, seen]) => [id, seen.phrasing])), schedule, random };
}

/**
 * Cue fading: of these ways to ask, the ones closest to the cue levels CUE_FADING prefers for a
 * card on this step. Rich cues while it is new or needed a hint, leaner as it is answered first time.
 */
export function nearestCue<P extends Phrasing>(options: P[], step: number): P[] {
  const band = [...CUE_FADING].reverse().find((one) => step >= one.fromStep) ?? CUE_FADING[0];
  const distance = (phrasing: P) => {
    const level = cueLevel(phrasing);
    return level < band.least ? band.least - level : level > band.most ? level - band.most : 0;
  };
  const best = Math.min(...options.map(distance));
  return options.filter((phrasing) => distance(phrasing) === best);
}

/** A way to ask a card that hasn't been asked today, in a shape this person hasn't had, if there is one. */
function pickPhrasing(card: Card, picking: Picking) {
  const { used, kinds, lastWay, schedule, random } = picking;
  const fresh = card.phrasings.filter((phrasing) => !used.has(sentenceKey(card.personId, phrasing)));
  const lastly = lastWay.get(card.personId);
  const newWay = fresh.filter((phrasing) => phrasing.id !== lastly);
  const newShape = newWay.filter((phrasing) => !kinds.get(card.personId)?.has(phrasing.kind));
  // An approved AI sentence comes before a fixed one when both fit.
  const tier = [newShape.filter(isAiPhrasing), newWay.filter(isAiPhrasing), newShape, newWay, fresh].find((one) => one.length);
  // Within what the day's rules allow, the cue that fits the card's step.
  const pool = tier && nearestCue(tier, schedule[card.id]?.step ?? 0);
  return pool?.[Math.floor(random() * pool.length)];
}

function take(card: Card, phrasing: Phrasing, picking: Picking) {
  picking.used.add(sentenceKey(card.personId, phrasing));
  picking.kinds.set(card.personId, new Set([...(picking.kinds.get(card.personId) ?? []), phrasing.kind]));
  picking.lastWay.set(card.personId, phrasing.id);
}

/**
 * One person's questions: different facts first, due ones leading, then round their facts again
 * in other shapes. `rank` says how early each should come: due, then new, then the rest.
 */
function questionsFor(cards: Card[], count: number, schedule: Schedule, now: Date, picking: Picking) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  // A fact already asked today waits behind the ones that haven't been, even if it is due again.
  const scheduled = buildQueue(cards.map((card) => card.id), schedule, now, cards.length);
  const order = [...scheduled.filter((id) => !picking.factsAsked.has(id)), ...scheduled.filter((id) => picking.factsAsked.has(id))];
  const rankOf = (id: string) => (picking.factsAsked.has(id) ? 3 : 0) + (!schedule[id] ? 1 : new Date(schedule[id].dueAt).getTime() <= now.getTime() ? 0 : 2);
  const planned: Planned[] = [];
  for (let round = 0; planned.length < count; round++) {
    const before = planned.length;
    for (const id of order) {
      if (planned.length >= count) break;
      const card = byId.get(id)!;
      const phrasing = pickPhrasing(card, picking);
      if (!phrasing) continue;
      take(card, phrasing, picking);
      planned.push({ card, phrasing, rank: rankOf(id) + round * 3 });
    }
    if (planned.length === before) break;
  }
  return planned;
}

/** Whether the cards left can still all be placed `apart`, always taking whoever has most left. */
function canFinish(left: Map<string, number>, lastAt: Map<string, number>, from: number, apart: number) {
  const counts = new Map(left);
  const seen = new Map(lastAt);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  for (let position = from; position < from + total; position++) {
    let next: string | undefined;
    for (const [id, count] of counts) {
      if (count === 0 || position - (seen.get(id) ?? -Infinity) < apart) continue;
      const better = next === undefined || count > counts.get(next)! || (count === counts.get(next)! && (seen.get(id) ?? -Infinity) < (seen.get(next) ?? -Infinity));
      if (better) next = id;
    }
    if (next === undefined) return false;
    counts.set(next, counts.get(next)! - 1);
    seen.set(next, position);
  }
  return true;
}

/**
 * Lays the people's questions out so the same person's cards stay apart: due questions first,
 * then new ones, and otherwise whoever has most left. Ties are random, so people don't come round
 * in the same order. A card goes next only if the rest of the day can still be kept apart after
 * it. `recent` is who was asked just before, so spacing holds across a resume.
 */
function interleave(lists: Map<string, Planned[]>, recent: string[], random: () => number) {
  const waiting = new Map([...lists].filter(([, items]) => items.length).map(([id, items]) => [id, [...items]]));
  const apart = spacingFor(Math.max(new Set([...lists.keys(), ...recent]).size, lists.size));
  const lastAt = new Map<string, number>();
  recent.forEach((id, index) => lastAt.set(id, index - recent.length));
  const gap = (id: string, position: number) => position - (lastAt.get(id) ?? -Infinity);
  const total = [...waiting.values()].reduce((sum, items) => sum + items.length, 0);
  const placed: Planned[] = [];
  for (let position = 0; position < total; position++) {
    const people = [...waiting.keys()].filter((id) => waiting.get(id)!.length);
    const widest = Math.max(...people.map((id) => gap(id, position)));
    // Nobody far enough apart yet: whoever was seen longest ago.
    const open = people.filter((id) => gap(id, position) >= Math.min(apart, widest));
    const counts = new Map(people.map((id) => [id, waiting.get(id)!.length]));
    const fits = (id: string) =>
      canFinish(new Map(counts).set(id, counts.get(id)! - 1), new Map(lastAt).set(id, position), position + 1, apart);
    const preferred = shuffled(open, random).sort(
      (a, b) => waiting.get(a)![0].rank - waiting.get(b)![0].rank || counts.get(b)! - counts.get(a)!,
    );
    const id = preferred.find(fits) ?? [...preferred].sort((a, b) => counts.get(b)! - counts.get(a)!)[0];
    placed.push(waiting.get(id)!.shift()!);
    lastAt.set(id, position);
  }
  return placed;
}

function shuffled<T>(items: T[], random: () => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const asRounds = (planned: Planned[]) => planned.map(({ card, phrasing }) => ({ ...card, phrasings: [phrasing] }));

const groupBy = (deck: Card[]) => {
  const byPerson = new Map<string, Card[]>();
  for (const card of deck) byPerson.set(card.personId, [...(byPerson.get(card.personId) ?? []), card]);
  return byPerson;
};

type TodayPlan = {
  deck: Card[];
  schedule: Schedule;
  now: Date;
  /** The whole day's target. */
  goal: number;
  /** How many of it are done. */
  completed: number;
  asked: AskedToday[];
  /** The way each person was last asked. */
  last?: Record<string, { phrasing?: string }>;
  random?: () => number;
};

/**
 * What's left of today, in order, each card narrowed to the one way it will be asked. Everyone
 * gets their share of the day, whatever has been done already; someone with too few questions is
 * capped and the others make up the rest. No question is asked twice.
 */
export function planToday({ deck, schedule, now, goal, completed, asked, last = {}, random = Math.random }: TodayPlan) {
  const left = goal - completed;
  if (left <= 0 || !enoughPeople(deck)) return [];
  const byPerson = groupBy(deck);
  const people = [...byPerson.keys()];
  const counted = asked.filter((one) => !one.extra);
  const askedOf = (id: string) => counted.filter((one) => one.personId === id).length;

  // Those with something due come first, so a day smaller than the deck starts with them.
  const isDue = (id: string) => byPerson.get(id)!.some((card) => schedule[card.id] && new Date(schedule[card.id].dueAt) <= now);
  const order = [...people.filter(isDue), ...people.filter((id) => !isDue(id))];
  const dayShares = shareOut(questionsPerPerson(deck), goal, order);

  const picking = pickingFrom(asked, last, schedule, random);
  const stillOpen = new Map(
    people.map((id) => {
      const keys = new Set(byPerson.get(id)!.flatMap((card) => card.phrasings.map((phrasing) => sentenceKey(id, phrasing))));
      return [id, [...keys].filter((key) => !picking.used.has(key)).length];
    }),
  );
  const fair = new Map(people.map((id) => [id, Math.min(Math.max(dayShares.get(id)! - askedOf(id), 0), stillOpen.get(id)!)]));
  const counts = shareOut(fair, left, order);
  // Anyone short: the others make up the rest, as far as they have questions left.
  const short = left - [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (short > 0) {
    const spare = new Map(people.map((id) => [id, stillOpen.get(id)! - counts.get(id)!]));
    for (const [id, more] of shareOut(spare, short, order)) counts.set(id, counts.get(id)! + more);
  }

  const lists = new Map(people.map((id) => [id, questionsFor(byPerson.get(id)!, counts.get(id)!, schedule, now, picking)]));
  return asRounds(interleave(lists, asked.slice(-(CARDS_APART - 1)).map((one) => one.personId), random));
}

/** Questions a person hasn't been asked today first, then the rest, for extra practice. */
function askFresh(queue: Card[], asked: AskedToday[], last: Record<string, { phrasing?: string }>, schedule: Schedule, random: () => number) {
  const picking = pickingFrom(asked, last, schedule, random);
  return queue.flatMap((card) => {
    const phrasing =
      pickPhrasing(card, picking) ?? card.phrasings[Math.floor(random() * card.phrasings.length)];
    take(card, phrasing, picking);
    return [{ card, phrasing, rank: 0 }];
  });
}

type ExtraPlan = Omit<TodayPlan, 'goal' | 'completed'>;

/** Practice more: a mix of people, each with the cards that need it most, kept apart and in new words if any are left. */
export function planMore({ deck, schedule, asked, last = {}, random = Math.random }: ExtraPlan) {
  if (!enoughPeople(deck)) return [];
  const byId = new Map(deck.map((card) => [card.id, card]));
  const neediest = needMostFirst(deck.map((card) => card.id), schedule, deck.length).map((id) => byId.get(id)!);
  const order = peopleIn(neediest);
  const theirs = (personId: string) => neediest.filter((card) => card.personId === personId);
  const share = shareOut(new Map(order.map((id) => [id, theirs(id).length])), PRACTICE_MORE.cards, order);
  const queue = order.flatMap((id) => theirs(id).slice(0, share.get(id)));
  const lists = new Map<string, Planned[]>();
  for (const item of askFresh(queue, asked, last, schedule, random)) lists.set(item.card.personId, [...(lists.get(item.card.personId) ?? []), item]);
  return asRounds(interleave(lists, asked.slice(-(CARDS_APART - 1)).map((one) => one.personId), random));
}

/** One person's cards: theirs alone, so it is the one session where they follow each other. The other names still come from the deck, so it needs two people too. */
export function planPerson(personId: string, { deck, schedule, asked, last = {}, random = Math.random }: ExtraPlan) {
  if (!enoughPeople(deck)) return [];
  const theirs = deck.filter((card) => card.personId === personId);
  const byId = new Map(theirs.map((card) => [card.id, card]));
  const queue = personQueue(theirs.map((card) => card.id), schedule, PERSON_PRACTICE.least, PERSON_PRACTICE.most).map((id) => byId.get(id)!);
  return asRounds(askFresh(queue, asked, last, schedule, random));
}

const lastIndexOf = (rounds: { personId: string }[], personId: string) => rounds.map((round) => round.personId).lastIndexOf(personId);

/**
 * Where to ask a card again within the session: `gap` is which of the expanding gaps
 * (SAME_SESSION_CARDS, about 1, 2, 4 and 8 minutes) it is on, 0 straight after a hint. At least
 * that many cards later, or `apart` from the person's other cards if that is further, give or take
 * one. Null when no such place is left (or the gaps have run out), and then the final review pass
 * may take it.
 */
export function reaskSpot(rounds: { personId: string }[], current: number, apart: number, random = Math.random, gap = 0) {
  if (gap >= SAME_SESSION_CARDS.length) return null;
  const { personId } = rounds[current];
  const least = Math.max(SAME_SESSION_CARDS[gap] - 1, apart - 1);
  const first = current + 1 + least + Math.floor(random() * 2);
  if (rounds.length - current - 1 < least) return null;
  for (let spot = Math.min(first, rounds.length); spot <= rounds.length; spot++) {
    const before = lastIndexOf(rounds.slice(0, spot), personId);
    const after = rounds.slice(spot).findIndex((round) => round.personId === personId);
    if (spot - before >= apart && (after === -1 || after + 1 >= apart)) return spot;
  }
  return null;
}

/**
 * The final review pass: cards that needed hints, the ones not asked again yet first, as many as
 * fit a short pass with each person's cards still `apart`. Anything left is due next time.
 */
export function reviewPass<R extends Pick<Round, 'id' | 'personId'>>(rounds: R[], hinted: string[], reasked: string[], apart: number) {
  const order = [...hinted.filter((id) => !reasked.includes(id)), ...hinted.filter((id) => reasked.includes(id))];
  const waiting = [...new Set(order)].flatMap((id) => rounds.find((round) => round.id === id) ?? []);
  const laid: R[] = [...rounds];
  const chosen: R[] = [];
  let found = true;
  while (found && chosen.length < REVIEW_PASS.most) {
    found = false;
    for (const round of waiting) {
      if (chosen.includes(round) || laid.length - lastIndexOf(laid, round.personId) < apart) continue;
      chosen.push(round);
      laid.push(round);
      found = true;
      break;
    }
  }
  return chosen;
}

/**
 * A card asked again after a hint, another way if there is one left today, with names unlike this
 * person's cards around it. Coming back after a hint is the one time a sentence may repeat.
 */
export function askedAgain(round: Round, rounds: Round[], deck: Card[], asked: AskedToday[], position: number, again: NonNullable<Round['again']>, random = Math.random): Round {
  const whole = deck.find((card) => card.id === round.id) ?? round;
  const used = new Set([...asked.map((one) => one.key), ...rounds.map((other) => sentenceKey(other.personId, other.phrasing))]);
  const fresh = whole.phrasings.filter((phrasing) => !used.has(sentenceKey(whole.personId, phrasing)));
  const seen = (other?: Round) => (other ? { phrasing: other.phrasing.id, choices: other.choices } : undefined);
  const theirs = (other: Round) => other.personId === round.personId;
  const previous = rounds[position - 1];
  // Back on step 0 after a hint, so the richest cue it has left.
  const card = { ...whole, phrasings: nearestCue(fresh.length ? fresh : whole.phrasings, 0) };
  const avoid = { before: seen(rounds.slice(0, position).findLast(theirs)), after: seen(rounds.slice(position).find(theirs)), previous: previous?.choices.indexOf(answerOf(previous)) };
  return { ...roundFor(card, deck, avoid, random), again };
}

/**
 * The people "Today you saw" shows: everyone whose card came up and who has a photo, in the order
 * they first came up, so the earliest faces and names come back after the longest gap. Everyone,
 * however their cards went, so it says nothing about the answers.
 */
export function todayYouSaw(rounds: Pick<Round, 'personId' | 'answer'>[], faces: Record<string, unknown>) {
  const people = new Map<string, string>();
  for (const round of rounds) if (!people.has(round.personId) && faces[round.personId]) people.set(round.personId, round.answer);
  return [...people].slice(0, TODAY_YOU_SAW.most).map(([personId, name]) => ({ personId, name }));
}
