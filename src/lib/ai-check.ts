// The rules every AI sentence must pass, before anyone sees it. It may reorder and recombine a
// fact's words into another question shape, and nothing else: no new name, place, number, opinion
// or cause, and no word of the fact left out, so it can't soften or change what the fact says.
//
// The same code runs in two places: the Edge Function checks what the model wrote, and the phone
// checks it again with the real words back in. The function can't import from src/ when it is
// pasted into the dashboard, so scripts/sync-ai-check.mjs copies this file into it between
// markers, and scripts/check-logic.mjs fails if the copies differ. Keep this file free of imports.

export const NAME_TOKEN = '[NAME]';
export const BLANK_TOKEN = '____';

/** Question shapes. Each tests recall a different way. */
export const AI_SHAPES = ['one_fact', 'two_facts', 'fact_to_name', 'reverse', 'context'] as const;
export type AiShape = (typeof AI_SHAPES)[number];

export type CheckFact = { id: string; type: string; text: string };

/** One sentence as the model writes it, and as the app and the function pass it around. */
export type Proposed = { sentence: string; blank_answer_placeholder: string; fact_ids_used: string[]; shape: string };

export type CheckContext = {
  facts: CheckFact[];
  relationship?: string;
  /** On the phone, once words are restored: the person's real name, which counts as the answer. */
  name?: string;
};

const MOST_LETTERS = 160;
/** The prompt asks for 14 words or fewer (PLAIN_MOST_WORDS in src/lib/stories.ts); a little over is kept, longer is dropped. */
const MOST_WORDS = 16;

/** A reverse card's answer has to fit on a button. */
export const REVERSE_MOST_LETTERS = 24;

/**
 * The words each kind of fact brings with it: its fixed sentence, as PREDICATES in
 * src/lib/stories.ts words it. "enjoys" stays "enjoys", so a sentence can't strengthen it to "loves".
 * Kinds that always may change aren't here: time-sensitive facts are never reworded.
 */
export const FACT_WORDS: Record<string, string> = {
  memory: '',
  work: 'is',
  pastwork: 'worked as',
  field: 'has worked in',
  workplace: 'has worked or studied at',
  interest: 'enjoys',
  team: 'loves',
  show: 'loves watching',
  movie: 'loves the movie',
  food: 'loves',
  music: 'loves listening to',
  place: 'loves',
  habit: 'always',
  shared: 'and I',
  regular: 'and I always',
  holiday: 'and I had a holiday we',
  met: 'and I met',
  birthday: 'has a birthday on',
  nickname: 'goes by',
  calls: 'I call',
  known: 'and I have known each other',
  home: 'lives in',
  lives_with: 'lives with',
  partner: 'has a partner named',
  child: 'has a child named',
  pet: 'has',
};

/** Own keys only, so a kind called "constructor" isn't taken for one of these. */
export const isFactType = (type: string) => Object.keys(FACT_WORDS).includes(type);

/** The kinds a shared memory comes in, for the context shape. */
const MEMORY_TYPES = ['memory', 'shared', 'regular', 'holiday', 'met'];

/**
 * Kinds whose whole answer reads as something to fill in, and that other people's facts can stand
 * beside. Never lives_with: someone's household is not a choice to offer on another person's card.
 */
const REVERSE_TYPES = ['work', 'pastwork', 'field', 'workplace', 'interest', 'team', 'show', 'movie', 'food', 'music', 'place', 'home', 'pet', 'nickname'];

/** Small words that carry no claim. Nothing here negates, softens, adds a reason or sets a time. */
const FUNCTION_WORDS = new Set(
  'a an the and of in on at to for with from by as is are was were be has have had do did does who whose what which this that these those it its i me my we us our you your they them their person'.split(' '),
);

const TOKENS = /\[[^\]]*\]|_{2,}|[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|\S/gu;

/** A possessive on a placeholder or a blank belongs to it, and a curly apostrophe is an apostrophe. */
function tokensOf(text: string) {
  return text.replace(/’/g, "'").replace(/(\]|_)'s\b/g, '$1').match(TOKENS) ?? [];
}

const isPlaceholder = (token: string) => token.startsWith('[');
const isBlank = (token: string) => token.startsWith('__');
const isWord = (token: string) => /^[\p{L}\p{N}]/u.test(token);
const baseWord = (word: string) => word.toLowerCase().replace(/'s$/, '');

function wordsIn(text: string) {
  return tokensOf(text).filter((token) => isWord(token) || isPlaceholder(token));
}

const lowered = (tokens: string[]) => tokens.map((token) => (isPlaceholder(token) ? token : baseWord(token)));

/** Whether a fact can be asked as "name given, fill in the fact". */
export function canReverse(fact: CheckFact) {
  return REVERSE_TYPES.includes(fact.type) && fact.text.length <= REVERSE_MOST_LETTERS;
}

/** The shapes these facts can fully support. */
export function supportedShapes(facts: CheckFact[]): AiShape[] {
  if (facts.length === 0) return [];
  return [
    'one_fact',
    'fact_to_name',
    ...(facts.length >= 2 ? (['two_facts'] as const) : []),
    ...(facts.some((fact) => MEMORY_TYPES.includes(fact.type)) ? (['context'] as const) : []),
    ...(facts.some(canReverse) ? (['reverse'] as const) : []),
  ];
}

/** The name as [NAME], whole or in part, in any case. */
export function maskName(text: string, name?: string) {
  if (!name) return text;
  const parts = [name, ...name.split(/\s+/)].filter((part) => part.length > 1);
  return parts.reduce((out, part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), NAME_TOKEN);
  }, text);
}

/** What makes two sentences the same sentence: the words and where the blank falls, not case or punctuation. */
export function sentenceWords(sentence: string) {
  return lowered(tokensOf(sentence).filter((token) => isWord(token) || isPlaceholder(token) || isBlank(token))).join(' ');
}

/** Why a sentence fails, or null if it passes. */
export function checkSentence(item: Proposed, context: CheckContext): string | null {
  const { shape, fact_ids_used: ids, blank_answer_placeholder: answer } = item;
  if (!(AI_SHAPES as readonly string[]).includes(shape)) return 'bad-shape';
  if (typeof item.sentence !== 'string' || !Array.isArray(ids) || typeof answer !== 'string') return 'bad-shape';

  const facts = context.facts.map((fact) => ({ ...fact, text: maskName(fact.text, context.name) }));
  const cited = ids.map((id) => facts.find((fact) => fact.id === id));
  if (cited.length === 0 || cited.some((fact) => !fact)) return 'unknown-fact';
  if (new Set(ids).size !== ids.length || cited.length !== (shape === 'two_facts' ? 2 : 1)) return 'fact-count';
  const used = cited as CheckFact[];
  if (used.some((fact) => !isFactType(fact.type))) return 'unknown-fact';
  if (shape === 'context' && !MEMORY_TYPES.includes(used[0].type)) return 'shape-unsupported';
  if (shape === 'reverse' && !canReverse(used[0])) return 'shape-unsupported';

  const sentence = maskName(item.sentence.trim(), context.name);
  const tokens = tokensOf(sentence);
  if (sentence.length > MOST_LETTERS || tokens.filter(isWord).length > MOST_WORDS) return 'too-long';

  const punctuation = tokens.filter((token) => !isWord(token) && !isPlaceholder(token) && !isBlank(token));
  if (punctuation.some((mark) => !",.?'-".includes(mark))) return 'bad-punctuation';
  const last = tokens[tokens.length - 1];
  if (last !== '.' && last !== '?') return 'bad-punctuation';
  if (tokens.slice(0, -1).some((token) => token === '.' || token === '?')) return 'bad-punctuation';

  // The answer: the blank holds it, and it appears nowhere else.
  const names = tokens.filter((token) => token === NAME_TOKEN).length;
  const blanks = tokens.filter(isBlank).length;
  if (shape === 'reverse') {
    if (names !== 1 || blanks !== 1) return 'blank';
    if (answer !== `[FACT:${used[0].id}]`) return 'bad-answer';
  } else {
    if (names > 0) return 'answer-leak';
    if (answer !== NAME_TOKEN) return 'bad-answer';
    if (blanks !== (shape === 'fact_to_name' ? 0 : 1)) return 'blank';
    if (shape === 'fact_to_name' && !(/^who(se)?$/i.test(tokens[0] ?? '') && last === '?')) return 'shape-unsupported';
  }

  const factTokens = used.flatMap((fact) => wordsIn(fact.text));
  const relationship = wordsIn(context.relationship ?? '');
  const given = lowered(used.flatMap((fact) => wordsIn(FACT_WORDS[fact.type])));
  const allowed = new Set([...FUNCTION_WORDS, ...lowered(factTokens), ...lowered(relationship), ...given]);
  const asTyped = new Set([...factTokens, ...relationship].map((token) => token.replace(/'s$/, '')));

  for (const [index, token] of tokens.entries()) {
    if (isPlaceholder(token)) {
      if (token !== NAME_TOKEN && !asTyped.has(token)) return 'bad-placeholder';
    } else if (isWord(token)) {
      const capital = index > 0 && token !== 'I' && /^\p{Lu}/u.test(token);
      if (!allowed.has(baseWord(token))) return /\p{N}/u.test(token) ? 'new-number' : capital ? 'new-name' : 'new-word';
      if (capital && !asTyped.has(token.replace(/'s$/, ''))) return 'new-name';
    }
  }

  // Every word that says something stays, so leaving a word out can't soften a fact. A reverse
  // card is the other way round: the fact's words are the answer, so none may show.
  const shown = new Set(lowered(tokens));
  const content = lowered(factTokens).filter((word) => !FUNCTION_WORDS.has(word));
  if (shape === 'reverse') return content.some((word) => shown.has(word) && !given.includes(word)) ? 'answer-leak' : null;
  return content.every((word) => shown.has(word)) ? null : 'dropped-fact';
}

/** The sentences that pass, in order, with no sentence twice. Rejected ones are dropped silently. */
export function validSentences(items: unknown[], context: CheckContext, shapes: readonly string[] = AI_SHAPES) {
  const seen = new Set<string>();
  return items.filter((item): item is Proposed => {
    if (!item || typeof item !== 'object') return false;
    const proposed = item as Proposed;
    if (!shapes.includes(proposed.shape) || checkSentence(proposed, context) !== null) return false;
    const key = sentenceWords(maskName(proposed.sentence, context.name));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
