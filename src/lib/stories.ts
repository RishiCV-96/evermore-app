// Story building for the app. It imports only the two import-free text modules (src/lib/wording.ts and,
// through it, src/lib/grammar.ts), so it can still be checked in plain Node.
//
// Every word practice shows comes from the caregiver's fields placed into fixed sentence shapes.
// Nothing here writes new words about a person. Two wordings exist (Fact.wording): version 1, the
// original shapes below, kept exactly for every card approved or in use before 2026-11-18; and version
// 2, the fluent frames in src/lib/wording.ts, for new and edited drafts (docs/SENTENCE-AUDIT.md).
import { askMetV2, askV2, callsV2, favoriteV2, hasWords, sentenceV2, thisPersonV2 } from '@/lib/wording';

/** One person as a deck (src/data/sample-deck.ts, or the gitignored src/data/deck.local.ts) lists them. */
export type Person = {
  id: string;
  name: string;
  /** Who they are to the person practicing, as the caregiver typed it ("mom", "older sister"). */
  relationship?: string;
  /** 1 to 3 memories, each finishing a sentence about the person. */
  memories: string[];
};

/**
 * The kinds of fact a caregiver can give (the questions are in src/data/questionnaire.ts).
 * "memory" is the free sentence ending every person starts with. Keep in step with
 * cards_fact_type_check in supabase/schema.sql.
 */
export const FACT_TYPES = [
  'memory',
  'work',
  'pastwork',
  'field',
  'workplace',
  'plans',
  'interest',
  'team',
  'show',
  'movie',
  'food',
  'music',
  'place',
  'habit',
  'shared',
  'regular',
  'holiday',
  'met',
  'birthday',
  'nickname',
  'calls',
  'known',
  'home',
  'lives_with',
  'partner',
  'child',
  'pet',
  'marital',
  'situation',
] as const;
export type FactType = (typeof FACT_TYPES)[number];

/** One fact about a person: the caregiver's words, and what kind of fact they are. */
export type Fact = {
  type: FactType;
  /** The caregiver's words, tidied but never rewritten. */
  text: string;
  /** It may stop being true (a job, a plan), so it shows only with its date and once confirmed. */
  timeSensitive: boolean;
  /** YYYY-MM-DD, the month a time-sensitive fact was true. */
  asOf?: string;
  /** The year of a shared memory, if the caregiver gave one. */
  year?: number;
  /** The card's id, when it has one: wording 2 chooses its variant from it, so it never changes. */
  id?: string;
  /** Which wording the card's sentences use: 1 (missing) the original shapes, 2 the fluent ones. */
  wording?: number;
};

/** Whether a fact uses the fluent wording (version 2). Missing means version 1. */
export const usesWordingTwo = (fact: Pick<Fact, 'wording'>) => (fact.wording ?? 1) >= 2;

/** The hints the caregiver can turn off for a person, as stored (supabase/schema.sql lists the same set). */
export const HINT_RUNGS = ['letter', 'fact', 'relationship', 'fewer'] as const;
export type HintRung = (typeof HINT_RUNGS)[number];

/**
 * The order hints come in: meaningful cues first (another fact, the relationship), then the
 * spelling cue, then fewer names. After the last one allowed, the answer itself (see hintAt).
 * A design assumption, not a validated order: docs/QUESTION-AUDIT.md lists it for clinician review.
 */
export const HINT_LADDER: readonly HintRung[] = ['fact', 'relationship', 'letter', 'fewer'];
export type Hints = Record<HintRung, boolean>;
export const ALL_HINTS: Hints = { letter: true, fact: true, relationship: true, fewer: true };

/** What the caregiver says helps most in recognizing someone. It steers the fact hint. */
export const BEST_CLUES = ['voice', 'laugh', 'job', 'hobby', 'met'] as const;
export type BestClue = (typeof BEST_CLUES)[number];

/**
 * How a card asks:
 *   blank    the photo and a sentence with a blank for the name ("My friend, ___, loves ...")
 *   ask      the photo and a fact as a question ("Who loves ...?")
 *   who      the photo, "Who is this?" and a fact about them
 *   photo    the photo and "Who is this?" alone
 *   reverse  the photo and the name, with a blank for the fact ("June enjoys ___."). Only an
 *            approved AI sentence asks this way.
 */
export type PhrasingKind = 'blank' | 'ask' | 'who' | 'photo' | 'reverse';

/** One way to ask a card. Every one is a fixed shape filled with the caregiver's words. */
export type Phrasing = {
  /** The shape, the same for every fact ("my-rel", "ask"...), so practice can vary it per person. */
  id: string;
  kind: PhrasingKind;
  /** What the card shows before the answer. A "blank" card has BLANK where the name goes. */
  ask: string;
  /** The whole sentence read back after the answer, with BLANK for the name. */
  reveal: string;
  /** An AI sentence: the facts it says, so a hint never repeats them. */
  factIds?: string[];
  /** A reverse card: the blank is the fact, and these are what's offered, in place of names. */
  fill?: { answer: string; others: string[] };
  /** How much it gives away, 0 (richest) to 3 (leanest). See cueLevel. */
  cue?: number;
};

export type Card = {
  id: string;
  personId: string;
  answer: string;
  relationship?: string;
  /** The fact the card is about. Missing on a phone copy saved before facts. */
  fact?: Fact;
  /** The hints the caregiver allows for this person. */
  hints: Hints;
  /** The ways practice may ask it, as the caregiver left them on. Never empty. */
  phrasings: Phrasing[];
  /** False when the caregiver doesn't want this fact used as a hint. */
  hintOk?: boolean;
  /** What the caregiver says helps most in recognizing this person. */
  bestClue?: BestClue;
  /** This person can have reveal cards: they have a photo, and the caregiver didn't opt them out. */
  revealOk?: boolean;
};

/**
 * A card ready to practice: the answer and two other names, in random order, the way it is
 * asked this time, and for the fact hint, another of the person's facts (never one the card
 * already shows).
 */
export type Round = Card & {
  choices: string[];
  phrasing: Phrasing;
  clue?: string;
  /** It came back after a hint: a few cards later, or in the final review pass. */
  again?: 'reask' | 'review';
  /** A reveal card: the photo starts behind a "?". Decided as the card comes up (src/lib/reveal.ts). */
  reveal?: boolean;
};

export const BLANK = '{name}';

// What follows the name in each kind of fact. The caregiver's words fill {text}; the words
// around them are fixed, so the app cannot invent anything about a person.
const PREDICATES: Record<FactType, string> = {
  memory: '{text}',
  work: 'is {text}',
  pastwork: 'worked as {text}',
  field: 'has worked in {text}',
  workplace: 'has worked or studied at {text}',
  plans: 'is {text}',
  interest: 'enjoys {text}',
  team: 'loves {text}',
  show: 'loves watching {text}',
  movie: 'loves the movie {text}',
  food: 'loves {text}',
  music: 'loves listening to {text}',
  place: 'loves {text}',
  habit: 'always {text}',
  shared: 'and I {text}',
  regular: 'and I always {text}',
  holiday: 'and I had a holiday we {text}',
  met: 'and I met {text}',
  birthday: 'has a birthday on {text}',
  nickname: 'goes by {text}',
  calls: '', // Worded its own way: see OWN_SHAPES.
  known: 'and I have known each other {text}',
  home: 'lives in {text}',
  lives_with: 'lives with {text}',
  partner: 'has a partner named {text}',
  child: 'has a child named {text}',
  pet: 'has {text}',
  marital: 'is {text}',
  situation: 'is {text}',
};

// The two sentence shapes every fact can take. "^" marks where "As of May 2026, " goes for a
// time-sensitive fact, or "In 1987, " for a memory with a year.
const WITH_RELATIONSHIP = '^My {relationship}, {name}, {predicate}.';
const NAME_FIRST = '^{name} {predicate}.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "May 2026" for an as-of date (YYYY-MM-DD). */
export function asOfLabel(asOf: string) {
  const [year, month] = asOf.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

/**
 * Fills a shape in one pass, so words the caregiver typed are never read as slots. The name
 * stays as BLANK. A time-sensitive fact leads with its date ("As of May 2026, my friend, ..."),
 * and a memory with its year ("In 1987, my friend, ...").
 */
function fill(shape: string, about: { relationship?: string }, fact: Fact) {
  const withPredicate = shape.replace('{predicate}', PREDICATES[fact.type]);
  const lead = fact.timeSensitive && fact.asOf ? `As of ${asOfLabel(fact.asOf)}, ` : fact.year ? `In ${fact.year}, ` : '';
  const slots: Record<string, string> = {
    name: BLANK,
    relationship: about.relationship ?? '',
    text: fact.text,
  };
  return withPredicate
    .replace(/\^(I )?(.)/, (_, pronoun: string | undefined, first: string) =>
      // "I" stays a capital after the lead: "As of May 2026, I call ...".
      lead ? `${lead}${pronoun ?? ''}${pronoun ? first : first.toLowerCase()}` : `${pronoun ?? ''}${first}`,
    )
    .replace(/\{(\w+)\}/g, (slot, key: string) => slots[key] ?? slot);
}

/** The sentence a fact makes, with BLANK for the name. The one the caregiver approves. */
export function sentenceFor(about: { relationship?: string; name?: string }, fact: Fact) {
  if (usesWordingTwo(fact)) return sentenceV2(about, fact);
  return fill(shapeOf(fact.type, about.relationship ? 'my-rel' : 'name'), about, fact);
}

// ---------------------------------------------------------------------------------------
// Phrasings: the other fixed shapes a fact can be asked in. Each id is one shape; the words
// around the caregiver's are fixed, so a phrasing can never say more than the fact.
// ---------------------------------------------------------------------------------------

type Shape = { kind: PhrasingKind; ask: string; needs?: 'relationship' | 'photo' };

/** Every question card ends with its question, just above the names; a "who" card gives its fact first. */
const WHO_IS_THIS = ' Who is this?';

const SHAPES: Record<string, Shape> = {
  'my-rel': { kind: 'blank', ask: WITH_RELATIONSHIP, needs: 'relationship' },
  name: { kind: 'blank', ask: NAME_FIRST },
  favorite: { kind: 'blank', ask: '^{name}’s {favorite} is {text}.' },
  ask: { kind: 'ask', ask: '^Who {predicate}?' },
  whose: { kind: 'ask', ask: '^Whose {favorite} is {text}?' },
  'ask-met': { kind: 'ask', ask: '^Who did you meet {text}?' },
  who: { kind: 'who', ask: `^This person {predicate}.${WHO_IS_THIS}`, needs: 'photo' },
  photo: { kind: 'photo', ask: 'Who is this?', needs: 'photo' },
};

// A kind of fact whose sentence doesn't follow the name words these shapes its own way.
const OWN_SHAPES: Partial<Record<FactType, Record<string, string>>> = {
  calls: {
    'my-rel': '^I call my {relationship}, {name}, {text}.',
    name: '^I call {name} {text}.',
    ask: '^Who do you call {text}?',
    who: `^You call this person {text}.${WHO_IS_THIS}`,
  },
};

function shapeOf(type: FactType, id: string) {
  return OWN_SHAPES[type]?.[id] ?? SHAPES[id].ask;
}

/** The shapes each kind of fact can take, in the order story approval lists them: 3 to 6 each. */
const STATED = ['my-rel', 'name', 'who', 'photo'];
const ASKED = ['my-rel', 'name', 'ask', 'who', 'photo'];
const FAVORED = ['my-rel', 'name', 'favorite', 'ask', 'who', 'photo'];

const PHRASINGS: Record<FactType, string[]> = {
  memory: ASKED,
  work: ASKED,
  pastwork: ASKED,
  field: ASKED,
  workplace: ASKED,
  plans: ASKED,
  interest: ASKED,
  team: FAVORED,
  show: FAVORED,
  movie: FAVORED,
  food: FAVORED,
  music: FAVORED,
  place: FAVORED,
  habit: ASKED,
  shared: STATED,
  regular: STATED,
  holiday: STATED,
  met: ['my-rel', 'name', 'ask-met', 'who', 'photo'],
  birthday: ['my-rel', 'favorite', 'whose', 'who', 'photo'],
  nickname: ASKED,
  calls: ASKED,
  known: STATED,
  home: ASKED,
  lives_with: ASKED,
  partner: ['my-rel', 'name', 'favorite', 'whose', 'who', 'photo'],
  child: ASKED,
  pet: ASKED,
  // Stated, never asked: "Who is widowed?" is not a gentle question.
  marital: STATED,
  situation: STATED,
};

const FAVORITES: Partial<Record<FactType, string>> = {
  team: 'favorite team',
  show: 'favorite show',
  movie: 'favorite movie',
  food: 'favorite food',
  music: 'favorite music',
  place: 'favorite place',
  birthday: 'birthday',
  partner: 'partner',
};

/**
 * How much a way to ask gives away, for cue fading (CUE_FADING in src/config/schedule.ts):
 * 0 the relationship and a fact, 1 one fact, 2 the face alone, 3 the name given and the fact
 * recalled. An AI sentence carries its own (src/lib/variants.ts).
 */
const CUE_LEVELS: Record<string, number> = { 'my-rel': 0, name: 1, favorite: 1, ask: 1, whose: 1, 'ask-met': 1, who: 1, photo: 2 };

export function cueLevel(phrasing: Pick<Phrasing, 'id' | 'kind' | 'cue'>) {
  return phrasing.cue ?? CUE_LEVELS[phrasing.id] ?? { blank: 1, ask: 1, who: 1, photo: 2, reverse: 3 }[phrasing.kind];
}

/** Whether these words say the name: the whole name or any part of it longer than a letter, as a word, in any case. */
export function saysName(words: string, name: string) {
  const parts = [name, ...name.split(/\s+/)].filter((part) => part.length > 1);
  const lower = words.toLowerCase();
  return parts.some((part) => {
    const at = (from: number): boolean => {
      const found = lower.indexOf(part.toLowerCase(), from);
      if (found < 0) return false;
      const before = lower[found - 1];
      const after = lower[found + part.length];
      const edge = (char: string | undefined) => char === undefined || !/[\p{L}\p{N}]/u.test(char);
      return (edge(before) && edge(after)) || at(found + 1);
    };
    return at(0);
  });
}

/**
 * Every way a fact can be asked for this person, in a fixed order. A shape that needs a
 * relationship or a photo is left out without one. A fact that may change keeps its month in
 * every shape that states it ("As of May 2026, who is ...?"), so no phrasing claims it is
 * still true today.
 */
export function phrasingsFor(about: { relationship?: string; hasPhoto: boolean; name?: string }, fact: Fact): Phrasing[] {
  if (usesWordingTwo(fact)) return phrasingsTwo(about, fact);
  const reveal = sentenceFor(about, fact);
  return PHRASINGS[fact.type].flatMap((id) => {
    const shape = SHAPES[id];
    if (shape.needs === 'relationship' && !about.relationship) return [];
    if (shape.needs === 'photo' && !about.hasPhoto) return [];
    // "Who and I went ...?" can't be asked: a memory that continues "and ..." or "with ..."
    // only fills a blank.
    if (id === 'ask' && fact.type === 'memory' && /^(and |with |& |,|')/i.test(fact.text)) return [];
    const ask = fill(shapeOf(fact.type, id).replace('{favorite}', FAVORITES[fact.type] ?? ''), about, fact);
    // A question that already says the name (the caregiver typed it into the fact) would give the answer away.
    if (about.name && saysName(ask.replace(BLANK, ' '), about.name)) return [];
    return [{ id, kind: shape.kind, ask, reveal: shape.kind === 'blank' ? ask : reveal, cue: CUE_LEVELS[id] }];
  });
}

/** The same shapes in wording 2: the same ids, kinds and cue levels, so turning one off, cue fading and rotation work as before. */
function phrasingsTwo(about: { relationship?: string; hasPhoto: boolean; name?: string }, fact: Fact): Phrasing[] {
  // A fact with no words gives no card at all (cardsOf drops a card with nothing to ask), never "My aunt, ____, works as."
  if (!hasWords(fact)) return [];
  const reveal = sentenceFor(about, fact);
  return PHRASINGS[fact.type].flatMap((id) => {
    const shape = SHAPES[id];
    if (shape.needs === 'relationship' && !about.relationship) return [];
    if (shape.needs === 'photo' && !about.hasPhoto) return [];
    if (id === 'ask' && fact.type === 'memory' && /^(and |with |& |,|')/i.test(fact.text)) return [];
    const ask = shapeTwo(id, about, fact);
    if (ask === undefined) return [];
    // A card that already says the name anywhere outside the blank would give the answer away.
    if (about.name && saysName(ask.split(BLANK).join(' '), about.name)) return [];
    return [{ id, kind: shape.kind, ask, reveal: shape.kind === 'blank' ? ask : reveal, cue: CUE_LEVELS[id] }];
  });
}

function shapeTwo(id: string, about: { relationship?: string; name?: string }, fact: Fact) {
  const favorite = FAVORITES[fact.type] ?? '';
  switch (id) {
    case 'my-rel':
      return sentenceV2(about, fact);
    case 'name':
      return sentenceV2({ name: about.name }, fact);
    case 'favorite':
      return favoriteV2(fact, favorite, false);
    case 'whose':
      return favoriteV2(fact, favorite, true);
    case 'ask':
      return fact.type === 'calls' ? callsV2(fact, true) : askV2(fact, about);
    case 'ask-met':
      return askMetV2(fact);
    case 'who':
      return `${fact.type === 'calls' ? callsV2(fact, false) : thisPersonV2(fact, about)}${WHO_IS_THIS}`;
    case 'photo':
      return 'Who is this?';
    default:
      return undefined;
  }
}

/** The phrasings practice may use: the ones the caregiver left on, or the first if every one is off. */
export function phrasingsOn(every: Phrasing[], off: string[] = []) {
  const on = every.filter((phrasing) => !off.includes(phrasing.id));
  return on.length ? on : every.slice(0, 1);
}

/** The phrasing to use next: never the one(s) to avoid (what this person saw just before), when there is another. */
export function choosePhrasing(options: Phrasing[], avoid: (string | undefined)[], random = Math.random) {
  const fresh = options.filter((phrasing) => !avoid.includes(phrasing.id));
  const pool = fresh.length ? fresh : options;
  return pool[Math.floor(random() * pool.length)];
}

export function fillBlank(story: string, name: string) {
  return story.replace(BLANK, () => name);
}

/** What fills this card's blank: the person's name, or on a reverse card the fact. */
export const answerOf = (round: Pick<Round, 'answer' | 'phrasing'>) => round.phrasing.fill?.answer ?? round.answer;

// Tidy what the caregiver typed without adding a word: extra spaces go, a leading "my" on
// the relationship goes (the template already says "My"), and end punctuation on a memory
// goes (the template ends the sentence).
export function tidyName(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

export function tidyRelationship(text: string) {
  return tidyName(text).replace(/^my\s+/i, '');
}

export function tidyMemory(text: string) {
  return tidyName(text).replace(/[\s.,;:!]+$/, '');
}

/** A fact said about the person, for the fact hint: "This person enjoys gardening." */
export function clueFor(fact: Fact) {
  if (usesWordingTwo(fact)) return fact.type === 'calls' ? callsV2(fact, false) : thisPersonV2(fact);
  return fill(shapeOf(fact.type, 'who').replace(WHO_IS_THIS, ''), {}, fact);
}

/** The kinds of fact a best clue points to, tried first for the fact hint. */
const CLUE_FACTS: Record<BestClue, FactType[]> = {
  voice: [],
  laugh: [],
  job: ['work', 'pastwork', 'field', 'workplace'],
  hobby: ['interest'],
  met: ['met'],
};

/**
 * What the fact hint says on this round. It only says what the caregiver gave: their best clue
 * ("Think of their laugh."), or a fact they allow as a hint that the card doesn't show. That
 * is the person's next fact after this card, so each card hints something else, unless the
 * best clue points to one. A photo-only card shows no fact, so it can hint its own.
 */
function clueOf(card: Card, phrasing: Phrasing, deck: Card[]) {
  if (card.bestClue === 'voice' || card.bestClue === 'laugh') return `Think of their ${card.bestClue}.`;
  const theirs = deck.filter((other) => other.personId === card.personId);
  const at = theirs.findIndex((other) => other.id === card.id);
  const others = [...theirs.slice(at + 1), ...theirs.slice(0, Math.max(at, 0))].filter(
    (other) => other.id !== card.id && other.fact?.text !== card.fact?.text && !phrasing.factIds?.includes(other.id),
  );
  const usable = [...(phrasing.kind === 'photo' ? [card] : []), ...others].filter((other) => other.fact && other.hintOk !== false);
  const best = card.bestClue ? usable.find((other) => CLUE_FACTS[card.bestClue!].includes(other.fact!.type)) : undefined;
  const hint = (best ?? usable[0])?.fact;
  return hint ? clueFor(hint) : undefined;
}

/** Whether the card's own words already say the relationship ("My aunt, ______, ..."), so the hint would only repeat it. */
function saysRelationship(round: Round) {
  const relationship = round.relationship?.toLowerCase();
  return Boolean(relationship) && round.phrasing.ask.toLowerCase().includes(`my ${relationship}`);
}

/** The rungs a round can use, in the ladder's order: allowed for the person, and with something true and new to say. */
export function hintLadder(round: Round): HintRung[] {
  const has: Record<HintRung, boolean> = {
    letter: answerOf(round).length > 0,
    fact: round.clue !== undefined,
    // Not on a reverse card either, where the name is given and the answer is a fact.
    relationship: Boolean(round.relationship) && !saysRelationship(round) && !round.phrasing.fill,
    // Setting a name aside must still leave a choice of two.
    fewer: round.choices.length > 2,
  };
  return HINT_LADDER.filter((rung) => round.hints[rung] && has[rung]);
}

/**
 * The gentle hint after `misses` other names, one rung further each time. The newest rung
 * leads, and the first stays beside it ("This is your mom. This person enjoys gardening.").
 * Each hint comes from what the caregiver typed. `fewer` is true once the ladder has reached
 * "fewer names": one other name is set aside. After the last rung (or one "Take your time."
 * with every rung off) the hint says the answer and `show` is true, so the card shows which
 * one it is: nobody is left choosing between names, and every card ends on a success.
 */
export function hintAt(round: Round, misses: number) {
  const ladder = hintLadder(round);
  const say: Record<HintRung, string> = {
    letter: round.phrasing.fill ? `It starts with ${answerOf(round)[0].toUpperCase()}.` : `The name starts with ${round.answer[0]}.`,
    fact: round.clue ?? '',
    relationship: `This is your ${round.relationship}.`,
    fewer: 'Let’s try with fewer names.',
  };
  const fewer = ladder.slice(0, misses).includes('fewer');
  if (misses > Math.max(ladder.length, 1)) return { lead: `It’s ${answerOf(round)}.`, detail: '', fewer, show: true };
  if (ladder.length === 0) return { lead: 'Take your time.', detail: '', fewer: false, show: false };
  const newest = ladder[Math.min(misses, ladder.length) - 1];
  return {
    lead: newest === ladder[0] ? 'Take your time.' : say[newest],
    detail: say[ladder[0]],
    fewer,
    show: false,
  };
}

/**
 * Where a hint step lands: a rung of the ladder, "wait" ("Take your time." when every rung is off),
 * or "answer" (the hint says the answer). Card records keep it for each "I'm not sure" tap
 * (src/lib/attempts.ts), and supabase/schema.sql lists the same set for help_steps.
 */
export const HINT_STEPS = [...HINT_LADDER, 'wait', 'answer'] as const;
export type HintStep = (typeof HINT_STEPS)[number];

/** The step the hint is on after `misses` steps (each other answer chosen, or each "I'm not sure"). */
export function hintStep(round: Round, misses: number): HintStep {
  if (hintAt(round, misses).show) return 'answer';
  const ladder = hintLadder(round);
  return ladder.length === 0 ? 'wait' : ladder[Math.min(misses, ladder.length) - 1];
}

/**
 * The words of the quiet "I'm not sure" control under the names. It starts the same hint ladder a
 * different name would, with nothing chosen. The last tap, the one that shows the answer, says so.
 * The calm line replaces "Take your time." when a help tap brought the first hint.
 */
export const NOT_SURE = {
  label: 'I’m not sure',
  spoken: 'I’m not sure. Show me a hint.',
  last: 'Show me',
  lastSpoken: 'Show me the answer.',
  calm: 'That is okay. Here is a little help.',
} as const;

/** What a person's last card looked like: how it asked, and the names in the order shown. */
export type Seen = { phrasing?: string; choices?: string[] };

/**
 * The answer and up to two other names, so the buttons can't be learned by pattern. Names
 * this person wasn't just shown come first, and the right name moves to a place it didn't
 * have on this person's card just before (or after); when there's room, also not the place it
 * had on the card before this one, whoever it was for. So a person never gets the same names
 * in the same order twice in a row.
 */
export function chooseNames(answer: string, names: string[], avoid: (string[] | undefined)[], previous?: number, random = Math.random) {
  const shown = avoid.filter((choices): choices is string[] => Boolean(choices));
  const recent = new Set(shown.flat());
  const others = shuffle([...new Set(names)].filter((name) => name !== answer), random);
  const ordered = [...others.filter((name) => !recent.has(name)), ...others.filter((name) => recent.has(name))];
  // Names unlike the answer and unlike each other first; alike ones only if nothing else is left.
  const picked: string[] = [];
  for (const name of ordered) if (picked.length < 2 && ![answer, ...picked].some((other) => soundsAlike(name, other))) picked.push(name);
  for (const name of ordered) if (picked.length < 2 && !picked.includes(name)) picked.push(name);
  const places = Array.from({ length: picked.length + 1 }, (_, i) => i);
  const theirs = shown.map((choices) => choices.indexOf(answer)).filter((at) => at >= 0);
  const fresh = places.filter((at) => !theirs.includes(at));
  const best = fresh.filter((at) => at !== previous);
  const pool = best.length ? best : fresh.length ? fresh : places;
  const at = pool[Math.floor(random() * pool.length)];
  return [...picked.slice(0, at), answer, ...picked.slice(at)];
}

/**
 * The cards in the order the schedule chose, each with up to two other names from the deck
 * and a way to ask it. `last` is what each person saw most recently (kept on the phone), so
 * nobody gets the same phrasing, or the same names in the same order, twice in a row, in
 * this session or across sessions.
 */
export function makeRounds(cards: Card[], deck: Card[], last: Record<string, Seen> = {}, random = Math.random): Round[] {
  const seen = { ...last };
  let previous: number | undefined;
  return cards.map((card) => {
    const round = roundFor(card, deck, { before: seen[card.personId], previous }, random);
    seen[card.personId] = { phrasing: round.phrasing.id, choices: round.choices };
    previous = round.choices.indexOf(answerOf(round));
    return round;
  });
}

/**
 * The names a card may offer. "Who enjoys gardening?" has no single answer if two people do, so
 * someone else with the same fact isn't offered, unless that would leave too few names to choose from.
 */
function namesToOffer(card: Card, phrasing: Phrasing, deck: Card[]) {
  const names = deck.map((other) => other.answer);
  if (phrasing.kind === 'photo' || !card.fact) return names;
  const sameFact = deck.filter((other) => other.personId !== card.personId && other.fact?.text === card.fact?.text).map((other) => other.answer);
  const others = names.filter((name) => name !== card.answer && !sameFact.includes(name));
  return new Set(others).size > 0 ? names.filter((name) => !sameFact.includes(name)) : names;
}

/**
 * One card with names and a phrasing unlike this person's cards just before and after it
 * (`avoid`), and the right name away from `previous`, where the card before had it. `deck` is
 * every card in practice: the other names, and the person's other facts for the fact hint.
 */
export function roundFor(
  card: Card,
  deck: Card[],
  avoid: { before?: Seen; after?: Seen; previous?: number } = {},
  random = Math.random,
): Round {
  const phrasing = choosePhrasing(card.phrasings, [avoid.before?.phrasing, avoid.after?.phrasing], random);
  const shown = [avoid.before?.choices, avoid.after?.choices];
  const choices = phrasing.fill
    ? chooseNames(phrasing.fill.answer, phrasing.fill.others, shown, avoid.previous, random)
    : chooseNames(card.answer, namesToOffer(card, phrasing, deck), shown, avoid.previous, random);
  return { ...card, choices, phrasing, clue: clueOf(card, phrasing, deck) };
}

/** A name as it sounds, roughly: lowercase letters, common sound-alike spellings folded together. */
function soundOf(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck|q/g, 'k')
    .replace(/c(?=[aou]|$)/g, 'k')
    .replace(/c/g, 's')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/([^aeiou])h/g, '$1')
    .replace(/(.)\1+/g, '$1');
}

/** Letters to change, add or remove to turn one word into the other. */
function editDistance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

/**
 * Two names easy to confuse, so not offered side by side: the same first letter (which would also
 * leave the letter hint nothing to tell apart), or spelled within a letter or two of each other
 * once common sound-alike spellings are folded (Kathy and Cathy, Jon and John). First names count.
 */
export function soundsAlike(a: string, b: string) {
  const [first, second] = [a, b].map((name) => name.trim().split(/\s+/)[0]);
  if (!first || !second) return false;
  if (first[0].toLowerCase() === second[0].toLowerCase()) return true;
  const [x, y] = [soundOf(first), soundOf(second)];
  if (!x || !y) return false;
  if (x[0] === y[0]) return true;
  return editDistance(x, y) <= (Math.min(x.length, y.length) <= 3 ? 1 : 2);
}

/** The guide for a calm sentence: about this many words or fewer. Story approval notes a longer one to the caregiver. */
export const PLAIN_MOST_WORDS = 14;

/** Words in a sentence, the blank counting as one. */
export function wordCount(sentence: string) {
  return sentence.replace(BLANK, ' name ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** The fixed words of every shape, without the caregiver's words, for checking their length. */
export function templateFrames() {
  const frames: { id: string; words: string }[] = [];
  for (const type of FACT_TYPES) {
    for (const id of PHRASINGS[type]) {
      const shape = shapeOf(type, id).replace('{favorite}', FAVORITES[type] ?? '').replace('{predicate}', PREDICATES[type]);
      frames.push({ id: `${type}/${id}`, words: shape.replace(/\^/g, '').replace(/\{(text|relationship|name)\}/g, ' ') });
    }
  }
  return frames;
}

/** "Nora", "Nora and Milo", "Nora, Milo, and Leo". */
export function listNames(names: string[]) {
  if (names.length < 3) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
}
