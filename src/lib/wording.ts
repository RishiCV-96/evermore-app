// Wording version 2 (since 2026-11-18, docs/SENTENCE-AUDIT.md): fluent fill-in-the-blank sentences.
//
// Each kind of fact has a sentence frame with named slots and bridge words, like a Mad Lib, in two or
// three variants. A card's variant is chosen from a stable hash of its id, so it reads the same every
// time. Before a caregiver's words fill a slot they are fitted to it (fitWords): an echoed opening ("A
// time we …") or their own pronoun ("She …", "They always …") goes, a verb agrees ("say" → "says"), a
// bare noun gets its article, and a list gets the plural frame. Only grammar words change: never a fact.
//
// Version 1 (the original frames in src/lib/stories.ts) is kept exactly for every card approved or in
// use before then; a card says which it uses (Fact.wording). Import-free but for the grammar helper.
import { cleanSentence, gerund, isPlural, joinList, lowerOrdinaryFirst, possessive, splitList, thirdPerson, withArticle, wordsIn } from '@/lib/grammar';
import type { Fact, FactType } from '@/lib/stories';

/** The wording new drafts get. */
export const WORDING_LATEST = 2;

/** The blank, as in src/lib/stories.ts (BLANK). scripts/check-sentences.mjs checks they agree. */
const BLANK = '{name}';

/** Sentences longer than this fall back to a shorter variant when there is one (typical answers fit). */
export const MOST_WORDS = 16;

type About = { relationship?: string; name?: string };

/** The subject of a sentence in its three places: "My aunt, ____," at the start, "my aunt, ____," inside, "My aunt ____’s". */
type Who = { start: string; mid: string; poss: string };

/** The relationship as it sits after "My": no article of its own ("the neighbor" → "neighbor"), a lower-case first letter. */
export function relationshipWords(relationship?: string) {
  const words = (relationship ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(my|the|a|an)\s+/i, '');
  return words ? `${words[0].toLowerCase()}${words.slice(1)}` : '';
}

function whoOf(about: About): Who {
  const relationship = relationshipWords(about.relationship);
  // A name that already holds the relationship ("Grandma Rose", a grandma) needn't say it twice.
  const said = relationship && about.name && about.name.toLowerCase().split(/\s+/).includes(relationship.toLowerCase().split(/\s+/).pop()!);
  if (!relationship || said) return { start: BLANK, mid: BLANK, poss: possessive(BLANK) };
  return { start: `My ${relationship}, ${BLANK},`, mid: `my ${relationship}, ${BLANK},`, poss: `My ${relationship} ${possessive(BLANK)}` };
}

/** "This person" in the same three places, for "Who is this?" cards and the fact hint. */
const THIS_PERSON: Who = { start: 'This person', mid: 'this person', poss: 'This person’s' };

// ---------------------------------------------------------------------------------------
// Fitting the caregiver's words to a slot
// ---------------------------------------------------------------------------------------

const ADVERB = /^(always|never|often|usually|still|also|really|sometimes)\s+/i;
const BASE_VERBS = new Set(
  (
    'hum say sing tell make cook laugh talk call ask give go do have read watch play whistle dance smile hug bring bake wear walk eat ' +
    'drink take get keep carry write sit stand sleep wake hide forget remember greet wave clap joke tease check fix clean worry love like ' +
    'enjoy grow knit paint visit help teach run own drive work live'
  ).split(' '),
);
const STATES = new Set('late early happy cheerful busy kind funny calm quiet loud ready cold hungry tired on'.split(' '));
const HOBBY_VERBS = new Set('knit paint bake cook read fish swim dance sing sew draw hike walk run garden play golf bike camp'.split(' '));
const DOING_VERBS = new Set('teaches works runs owns drives manages sells fixes cleans builds helps writes designs cooks bakes makes cares delivers repairs serves leads'.split(' '));
const PAST_VERBS = /^(\w+ed|taught|ran|drove|sold|built|wrote|made|owned|led|kept|grew|flew|went|spent|took|saw|met|got|had|did|came|left|found|lost|won|ate|sang|gave|threw)$/i;
const STARTS_A_CLAUSE = /^(our|my|the|a|an|it|there|everyone|everybody|nobody|they|his|her|their|this|that|grandma|grandpa)\b/i;
/** A verb somewhere in the words: a clause ("our car broke down"), not just a thing ("a picnic"). */
const HAS_VERB =
  /\b(\w+ed|was|were|is|are|am|had|has|have|went|came|broke|fell|got|took|made|saw|ran|left|caught|found|lost|won|ate|sang|gave|threw|drove|flew|sat|stood|bought|brought|told|said|met|did|became|began|kept|grew|swam|rode|wrote|spent|stayed|played|danced|laughed|cried|sang|slept|woke|knew|thought|felt|heard|built|paid|sold|won)\b/i;
/** Words that start a thing, not an action: "a picnic", "the park", "an early riser". */
const STARTS_A_THING = /^(a|an|the|one|our|my|his|her|their)\s/i;
/** A capital that isn't the keyboard's (job and hobby fields never capitalize): a language or nation, a holiday. */
const PROPER_FIRST_WORDS = new Set(
  'english french spanish german italian chinese japanese korean greek irish scottish welsh mexican american canadian indian thai polish russian dutch swedish norwegian latin hebrew arabic christmas easter thanksgiving bible catholic jewish christian muslim sunday monday tuesday wednesday thursday friday saturday'.split(' '),
);
const MONTH = /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;
const PREPOSITION = /^(at|in|on|through|thanks to|via|when|while|after|before|during|since|because|by|near|from|outside|inside|over|under|across)\b/i;

/**
 * "Nurse at the clinic" → "nurse at the clinic", "Golf" → "golf": a capital on only the first word of an
 * answer to a field whose keyboard never adds one (a job, a hobby) is the typist's, not a name's. Kept: a
 * second capital ("Red Cross volunteer"), all capitals ("IT"), and languages, nations and holidays.
 */
export function lowerTypedCapital(text: string) {
  const words = text.split(/\s+/);
  const first = words[0] ?? '';
  if (!/^\p{Lu}\p{Ll}/u.test(first) || PROPER_FIRST_WORDS.has(first.toLowerCase().replace(/[^a-z]/g, ''))) return text;
  if (words.slice(1).some((word) => /^\p{Lu}/u.test(word))) return text;
  return `${first[0].toLowerCase()}${text.slice(1)}`;
}

/** "accountants" → "accountant", "secretaries" → "secretary", "nurses" → "nurse": a job held by one person. */
export function singular(phrase: string) {
  if (!isPlural(phrase)) return phrase;
  const words = phrase.split(' ');
  const last = words.pop()!;
  const one = /[^aeiou]ies$/i.test(last) && last.length > 4 ? `${last.slice(0, -3)}y` : /(ches|shes|xes|sses)$/i.test(last) ? last.slice(0, -2) : last.slice(0, -1);
  return [...words, one].join(' ');
}

/** Tidy as stories.ts does, and drop end marks a question can't keep (? and ! too). Quotes stay. */
function tidy(text: string) {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  // An initialism keeps its last period ("J.J."): it is part of the word, not the end of a sentence.
  return /\b\p{Lu}\.$/u.test(trimmed) ? trimmed : trimmed.replace(/[\s.,;:!?]+$/, '');
}

/** The caregiver's own subject goes ("She loves", "They always say", "I call"); a verb after they/I/we agrees with one person. */
function withoutSubject(text: string) {
  const match = /^(she|he|they|i|we)\s+/i.exec(text);
  if (!match) return text;
  const rest = text.slice(match[0].length);
  if (/^(she|he)$/i.test(match[1])) return rest;
  // "they always say" → "always says": the first verb, after any adverb, agrees.
  const adverb = ADVERB.exec(rest)?.[0] ?? '';
  const after = rest.slice(adverb.length);
  const verb = after.match(/^[a-z]+/i)?.[0];
  return verb ? `${adverb}${thirdPerson(verb)}${after.slice(verb.length)}` : rest;
}

/** "____ and I" already says who: the words' own "we", "I", "June and I" or "me and June" go. */
function withoutOurselves(text: string, name?: string) {
  let out = text;
  if (name) out = out.replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+and\\s+(I|me)\\s+`, 'i'), '');
  return out.replace(/^(we|i|you and i|me and \S+)\s+/i, '');
}

/** What a caregiver's words became, and which shape of answer they are. */
type Fitted = { text: string; shape: string };

/** A name used as a form of address is capitalized: "grandma" → "Grandma", "doc" → "Doc". One word only. */
const nameCapital = (text: string) => (/^\p{Ll}[\p{L}’'-]*$/u.test(text) ? `${text[0].toUpperCase()}${text.slice(1)}` : text);

/** Fits what the caregiver typed to the slot its kind of fact has. Only grammar words change. */
export function fitWords(type: FactType, typed: string, name?: string): Fitted {
  let text = tidy(typed);
  switch (type) {
    case 'memory':
    case 'situation':
    case 'lives_with': {
      text = lowerOrdinaryFirst(withoutSubject(text));
      if (type === 'situation') text = text.replace(/^is\s+/i, '');
      if (type === 'lives_with') {
        text = text.replace(/^lives with\s+/i, '').replace(/^lives\s+(?=alone\b|by\s)/i, '');
        // "alone", "by herself": no one to live with.
        if (/^(alone|by (herself|himself|themselves|myself))\b/i.test(text)) return { text, shape: 'alone' };
      }
      // "an early riser", "always cheerful": a thing or a state, not an action, so it takes "is".
      const first = text.match(/^[a-z]+/i)?.[0]?.toLowerCase() ?? '';
      if (type === 'memory' && ((STARTS_A_THING.test(text) && !HAS_VERB.test(text)) || STATES.has(first) || /^(very|so|always|still)\s+\w+$/i.test(text) && STATES.has(text.split(' ')[1]?.toLowerCase()))) {
        return { text, shape: 'state' };
      }
      return { text, shape: 'plain' };
    }
    case 'habit': {
      text = lowerTypedCapital(lowerOrdinaryFirst(withoutSubject(text))).replace(/^always\s+/i, '');
      const first = text.match(/^[a-z]+/i)?.[0]?.toLowerCase() ?? '';
      if (STATES.has(first)) return { text, shape: 'state' };
      if (BASE_VERBS.has(first)) text = `${thirdPerson(first)}${text.slice(first.length)}`;
      return { text, shape: 'verb' };
    }
    case 'interest': {
      text = lowerTypedCapital(lowerOrdinaryFirst(withoutSubject(text))).replace(/^enjoys\s+/i, '');
      const toVerb = /^to\s+/i.test(text);
      if (toVerb) text = text.replace(/^to\s+/i, '');
      const first = text.match(/^[a-z]+/i)?.[0] ?? '';
      if ((toVerb || (HOBBY_VERBS.has(first.toLowerCase()) && first === first.toLowerCase() && !/ing$/i.test(first))) && first) {
        text = `${gerund(first)}${text.slice(first.length)}`;
      }
      return { text, shape: 'plain' };
    }
    case 'work':
    case 'pastwork': {
      text = lowerTypedCapital(lowerOrdinaryFirst(withoutSubject(text))).replace(/^(is|was|works as|worked as)\s+/i, '');
      const first = text.match(/^[a-z]+/i)?.[0] ?? '';
      if (type === 'work' && DOING_VERBS.has(first.toLowerCase())) return { text, shape: 'doing' };
      if (type === 'pastwork' && PAST_VERBS.test(first)) return { text, shape: 'doing' };
      if (/(ed|ing)$/i.test(first) && !/^(red)$/i.test(first)) return { text, shape: 'state' };
      // One person holds one job: "accountants" → "an accountant". A list of jobs ("farmer and carpenter") stays.
      const one = /\band\b|,/.test(text) ? text : singular(text);
      return { text: withArticle(one), shape: 'role' };
    }
    case 'plans':
      text = lowerTypedCapital(lowerOrdinaryFirst(withoutSubject(text))).replace(/^is\s+/i, '').replace(/^(planning|plans|going) to\s+/i, '').replace(/^to\s+/i, '');
      if (/^\w+ing\b/i.test(text)) return { text, shape: 'doing' };
      // "a trip to Maine": a thing being planned, not a verb.
      return { text, shape: STARTS_A_THING.test(text) ? 'thing' : 'base' };
    case 'field':
      return { text: lowerTypedCapital(text), shape: 'plain' };
    case 'team':
      // "Otters" is a team's name in the plural: "the Otters". No capital at all ("baseball") is a sport, not a team.
      if (!/\p{Lu}/u.test(text)) return { text, shape: 'sport' };
      return { text: /^[A-Z]\w*s$/.test(text) ? `the ${text}` : text, shape: 'plain' };
    case 'show':
      // "game shows" is a kind of show, not one: never "favorite show is game shows".
      return { text, shape: /^[a-z]/.test(text) && isPlural(text) ? 'kind' : 'plain' };
    case 'movie':
      text = text.replace(/^the movie\s+/i, '');
      return { text, shape: /^[a-z]/.test(text) && isPlural(text) ? 'kind' : 'title' };
    case 'place': {
      if (/^\w+ing\b/i.test(text)) return { text, shape: 'doing' };
      // "beaches" is a kind of place; "park" needs "the" ("loves going to the park").
      if (/^[a-z]/.test(text) && isPlural(text)) return { text, shape: 'kind' };
      if (/^[a-z][a-z ]*$/.test(text) && !STARTS_A_THING.test(text) && !/^(home|downtown|church|school|work|outside|abroad|camp)$/i.test(text)) return { text: `the ${text}`, shape: 'plain' };
      return { text, shape: 'plain' };
    }
    case 'shared': {
      text = withoutOurselves(text.replace(/^(a|the|one) time\s+(when\s+|that\s+)?/i, ''), name);
      // "a picnic": a thing that happened, with no verb, so it is remembered rather than done.
      if (STARTS_A_THING.test(text) && !HAS_VERB.test(text)) return { text: lowerOrdinaryFirst(text), shape: 'thing' };
      if (STARTS_A_CLAUSE.test(text)) {
        // A whole clause ("our car came to life and we had to save the world"): its own "we" is "____ and I".
        return /\bwe\b/i.test(text) ? { text, shape: 'clause-we' } : { text, shape: 'clause' };
      }
      return { text: lowerOrdinaryFirst(text), shape: 'verb' };
    }
    case 'regular': {
      const place = /^(the|a) place\s+(where\s+)?we\s+(always\s+)?(used to\s+)?(went|go)(\s+to)?(\s+(was|is))?\s+/i.exec(text);
      if (place) text = `went to ${text.slice(place[0].length)}`;
      text = lowerOrdinaryFirst(withoutOurselves(text, name).replace(/^always\s+/i, ''));
      // "camping" → "went camping"; "the park" → "went to the park": what the question ("NAME and I always…") means.
      if (/^\w+ing\b/i.test(text) && !HAS_VERB.test(text.split(' ').slice(1).join(' '))) text = `went ${text}`;
      else if (STARTS_A_THING.test(text) && !HAS_VERB.test(text)) text = `went to ${text}`;
      return { text, shape: 'verb' };
    }
    case 'holiday': {
      text = lowerOrdinaryFirst(withoutOurselves(text.replace(/^(a|the|one) holiday\s+(when\s+|that\s+)?/i, ''), name));
      if (/^spent\s+(at|in|on|by|near|with)\b/i.test(text)) text = text.replace(/^spent\s+/i, '');
      if (/^(at|in|on|by|near|with)\b/i.test(text)) return { text, shape: 'where' };
      const first = text.match(/^[a-z]+/i)?.[0] ?? '';
      if (PAST_VERBS.test(first) && first === first.toLowerCase()) return { text, shape: 'verb' };
      return { text, shape: 'what' };
    }
    case 'met':
      text = withoutOurselves(text.replace(/^(we|you and i|i)\s+(first\s+)?met\s+/i, '').replace(/^(first\s+)?met\s+/i, ''), name);
      // "school" → "at school": a bare place needs its preposition.
      if (text && !PREPOSITION.test(text)) text = `at ${text}`;
      // "when we were 5" is said by "I": it can't become "Who did you meet when we were 5?"
      return { text, shape: /\b(we|our|us)\b/i.test(text) ? 'ours' : 'plain' };
    case 'known': {
      text = text.replace(/^(we|we've|we have)\s+(have\s+)?known each other\s+/i, '');
      // "all our lives" belongs with "each other", never "I have known June all our lives".
      return { text: /^\d/.test(text) ? `for ${text}` : text, shape: /\b(we|our|us)\b/i.test(text) ? 'ours' : 'plain' };
    }
    case 'home':
      return { text: text.replace(/^(lives\s+)?in\s+/i, ''), shape: 'plain' };
    case 'birthday':
      // A month alone is "in May"; a day is "on March 3".
      return { text: /^(in|on)\s+/i.test(text) ? text : `${MONTH.test(text) ? 'in' : 'on'} ${text}`, shape: 'plain' };
    case 'nickname':
      return { text: nameCapital(text.replace(/^(goes by|is called|called)\s+/i, '')), shape: 'plain' };
    case 'calls':
      return { text: nameCapital(text.replace(/^i call (her|him|them)\s+/i, '')), shape: 'plain' };
    case 'partner':
    case 'child': {
      const names = splitList(text);
      if (type === 'child' && /^[a-z0-9]/.test(text)) return { text, shape: 'count' };
      return names.length > 1 ? { text: joinList(names), shape: 'many' } : { text, shape: 'one' };
    }
    case 'pet':
      if (/^[A-Z][\w’'-]*$/.test(text)) return { text, shape: 'named' };
      // "Rex and Bella": two names, so two pets.
      if (splitList(text).length > 1 && splitList(text).every((one) => /^[A-Z][\w’'-]*$/.test(one))) return { text: joinList(splitList(text)), shape: 'named-many' };
      return { text: withArticle(lowerOrdinaryFirst(text)), shape: 'plain' };
    default:
      return { text, shape: 'plain' };
  }
}

// ---------------------------------------------------------------------------------------
// The frames: sentences (for blank cards, the approved sentence and "Who is this?") and the
// predicate that follows "Who" in a question card. {t} is the fitted words.
// ---------------------------------------------------------------------------------------

type Frame = (w: Who, t: string, year?: number) => string;
type Frames = { sentences: Frame[]; asks?: string[]; noAsk?: boolean };

/** A sentence from a predicate: "My aunt, ____, enjoys gardening." */
const say = (predicate: string): Frame => (w, t) => `${w.start} ${predicate.replace('{t}', t)}`;

function framesFor(type: FactType, { text, shape }: Fitted): Frames {
  const t = text;
  const once = !/\b(every|always|each|often|usually|whenever)\b/i.test(t);
  switch (type) {
    case 'memory':
      if (shape === 'state') return { sentences: [say('is {t}'), (w) => `I know that ${w.mid} is ${t}`], asks: ['is {t}'] };
      return { sentences: [say('{t}'), (w) => `I know that ${w.mid} ${t}`], asks: ['{t}'] };
    case 'situation':
    case 'marital':
      return { sentences: [say('is {t}')], asks: ['is {t}'] };
    case 'lives_with':
      if (shape === 'alone') return { sentences: [say('lives {t}')], asks: ['lives {t}'] };
      return { sentences: [say('lives with {t}'), say('shares a home with {t}')], asks: ['lives with {t}', 'shares a home with {t}'] };
    case 'habit':
      return shape === 'state' ? { sentences: [say('is always {t}')], asks: ['is always {t}'] } : { sentences: [say('always {t}')], asks: ['always {t}'] };
    case 'interest':
      return { sentences: [say('enjoys {t}'), say('likes {t}')], asks: ['enjoys {t}', 'likes {t}'] };
    case 'work':
      if (shape === 'doing') return { sentences: [say('{t}')], asks: ['{t}'] };
      if (shape === 'state') return { sentences: [say('is {t}')], asks: ['is {t}'] };
      return { sentences: [say('works as {t}'), say('is {t}')], asks: ['works as {t}', 'is {t}'] };
    case 'pastwork':
      if (shape === 'doing') return { sentences: [say('{t}')], asks: ['{t}'] };
      return { sentences: [say('worked as {t}'), say('used to work as {t}')], asks: ['worked as {t}', 'used to work as {t}'] };
    case 'field':
      return { sentences: [say('has worked in {t}'), say('has had a career in {t}')], asks: ['has worked in {t}', 'has had a career in {t}'] };
    case 'workplace':
      return { sentences: [say('has worked or studied at {t}'), say('spent time working or studying at {t}')], asks: ['has worked or studied at {t}'] };
    case 'plans':
      if (shape === 'doing') return { sentences: [say('is {t}')], asks: ['is {t}'] };
      if (shape === 'thing') return { sentences: [say('is planning {t}')], asks: ['is planning {t}'] };
      return { sentences: [say('is planning to {t}'), say('plans to {t}')], asks: ['is planning to {t}', 'plans to {t}'] };
    case 'team':
      if (shape === 'sport') return { sentences: [say('loves {t}'), say('is a fan of {t}')], asks: ['loves {t}', 'is a fan of {t}'] };
      return { sentences: [say('loves {t}'), say('is a fan of {t}'), say('cheers for {t}')], asks: ['loves {t}', 'is a fan of {t}', 'cheers for {t}'] };
    case 'show':
      return { sentences: [say('loves watching {t}'), say('likes to watch {t}')], asks: ['loves watching {t}', 'likes to watch {t}'] };
    case 'movie':
      if (shape === 'kind') return { sentences: [say('loves {t}'), say('loves watching {t}')], asks: ['loves {t}', 'loves watching {t}'] };
      return { sentences: [say('loves the movie {t}'), say('is a fan of the movie {t}')], asks: ['loves the movie {t}', 'is a fan of the movie {t}'] };
    case 'food':
      return { sentences: [say('loves {t}'), say('loves to eat {t}')], asks: ['loves {t}', 'loves to eat {t}'] };
    case 'music':
      return { sentences: [say('loves listening to {t}'), say('enjoys listening to {t}')], asks: ['loves listening to {t}', 'enjoys listening to {t}'] };
    case 'place':
      if (shape === 'doing') return { sentences: [say('loves {t}'), say('enjoys {t}')], asks: ['loves {t}', 'enjoys {t}'] };
      return { sentences: [say('loves {t}'), say('loves going to {t}')], asks: ['loves {t}', 'loves going to {t}'] };
    case 'shared':
      if (shape === 'clause-we') {
        const ours = (w: Who) => t.replace(/\bwe\b/i, `${w.mid} and I`);
        return { sentences: [(w, _t, year) => (year ? `In ${year}, there was a time when ${ours(w)}` : `There was a time when ${ours(w)}`)] };
      }
      if (shape === 'clause') return { sentences: [(w, _t, year) => `${year ? `In ${year}, there` : 'There'} was a time when ${t}, with ${w.mid} and me`] };
      if (shape === 'thing') return { sentences: [(w, _t, year) => `I remember ${t} with ${w.mid}${year ? ` in ${year}` : ''}`] };
      return {
        sentences: [
          (w, _t, year) => (year ? `In ${year}, ${w.mid} and I ${t}` : `There was a time when ${w.mid} and I ${t}`),
          (w, _t, year) => (year ? `Back in ${year}, ${w.mid} and I ${t}` : `I remember when ${w.mid} and I ${t}`),
          ...(once ? [(w: Who, _t: string, year?: number) => (year ? `In ${year}, ${w.mid} and I once ${t}` : `${w.start} and I once ${t}`)] : []),
        ],
      };
    case 'regular':
      return { sentences: [(w, _t, year) => (year ? `In ${year}, ${w.mid} and I always ${t}` : `${w.start} and I always ${t}`)] };
    case 'holiday': {
      const lead = (w: Who, year?: number) => (year ? `In ${year}, ${w.mid}` : w.start);
      if (shape === 'where') return { sentences: [(w, _t, year) => `${lead(w, year)} and I spent a holiday ${t}`, (w, _t, year) => `${year ? `In ${year}, on` : 'On'} one holiday, ${w.mid} and I were ${t}`] };
      if (shape === 'verb') return { sentences: [(w, _t, year) => `${lead(w, year)} and I ${t} on a holiday`, (w, _t, year) => `${year ? `In ${year}, on` : 'On'} one holiday, ${w.mid} and I ${t}`] };
      return { sentences: [(w, _t, year) => `${lead(w, year)} and I spent ${t} together`] };
    }
    case 'met':
      return { sentences: [(w) => `${w.start} and I met ${t}`, (w) => `I met ${w.mid} ${t}`], asks: [], ...(shape === 'ours' ? { noAsk: true } : {}) };
    case 'known':
      if (shape === 'ours') return { sentences: [(w) => `${w.start} and I have known each other ${t}`] };
      return { sentences: [(w) => `${w.start} and I have known each other ${t}`, (w) => `I have known ${w.mid} ${t}`] };
    case 'home':
      return { sentences: [say('lives in {t}'), (w) => `${w.poss} home is in ${t}`], asks: ['lives in {t}'] };
    case 'birthday':
      return { sentences: [(w) => `${w.poss} birthday is ${t}`, say('was born {t}')] };
    case 'nickname':
      return { sentences: [say('goes by {t}'), say('is also called {t}')], asks: ['goes by {t}', 'is also called {t}'] };
    case 'calls':
      return { sentences: [(w) => `I call ${w.mid} ${t}`, (w) => `My name for ${w.mid} is ${t}`] };
    case 'partner':
      if (shape === 'many') return { sentences: [say('has partners named {t}')] };
      return { sentences: [(w) => `${w.poss} partner is ${t}`, (w) => `${w.start} and ${t} are partners`] };
    case 'child':
      if (shape === 'count') return { sentences: [say('has {t}')], asks: ['has {t}'] };
      if (shape === 'many') return { sentences: [say('has children named {t}'), say('is the parent of {t}')], asks: ['has children named {t}', 'is the parent of {t}'] };
      return { sentences: [say('has a child named {t}'), say('is the parent of {t}')], asks: ['has a child named {t}', 'is the parent of {t}'] };
    case 'pet':
      if (shape === 'named') return { sentences: [say('has a pet named {t}')], asks: ['has a pet named {t}'] };
      if (shape === 'named-many') return { sentences: [say('has pets named {t}')], asks: ['has pets named {t}'] };
      return { sentences: [say('has {t}'), say('takes care of {t}')], asks: ['has {t}', 'takes care of {t}'] };
    default:
      return { sentences: [say('{t}')], asks: ['{t}'] };
  }
}

// ---------------------------------------------------------------------------------------
// Choosing a variant, and the finished words
// ---------------------------------------------------------------------------------------

/** A stable number from a card's id (FNV-1a), so its variant never changes between sessions. */
export function variantSeed(id: string | undefined) {
  let hash = 0x811c9dc5;
  for (const char of id ?? '') {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The date a sentence leads with, if any: "As of May 2026, " for a fact that may change. */
function asOfLead(fact: Fact) {
  if (!fact.timeSensitive || !fact.asOf) return '';
  const [year, month] = fact.asOf.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `As of ${months[month - 1]} ${year}, `;
}

/**
 * Puts a lead in front, with the sentence's first letter in lower case. Every frame starts with a fixed
 * word ("My", "There", "Who", "This"), the blank or "I", so no name is ever lowered: "I" and the blank stay.
 */
function lead(prefix: string, sentence: string) {
  if (!prefix || /^(I\b|I’|\{name\})/.test(sentence)) return `${prefix}${sentence}`;
  return `${prefix}${sentence[0].toLowerCase()}${sentence.slice(1)}`;
}

/** The fitted words, or what was typed when fitting would leave nothing (only "A time we" typed). */
function fitted2(fact: Fact, name?: string): Fitted {
  const fitted = fitWords(fact.type, fact.text, name);
  return fitted.text.trim() ? fitted : { text: tidy(fact.text), shape: fitted.shape };
}

/** The kinds whose year is part of the sentence frame itself (the memories with a year). */
const YEAR_IN_FRAME: FactType[] = ['shared', 'regular', 'holiday'];

/** All of a fact's sentences, before a variant is chosen, for one subject. */
function sentencesOf(fact: Fact, who: Who, name?: string) {
  const fitted = fitted2(fact, name);
  const frames = framesFor(fact.type, fitted);
  const year = YEAR_IN_FRAME.includes(fact.type) ? fact.year : undefined;
  const yearLead = !YEAR_IN_FRAME.includes(fact.type) && fact.year ? `In ${fact.year}, ` : '';
  return { fitted, frames, sentences: frames.sentences.map((frame) => cleanSentence(lead(asOfLead(fact) || yearLead, frame(who, fitted.text, year)))) };
}

/** Which variant: the card's own, or the shortest when its own would run past MOST_WORDS. */
function pick(options: string[], id?: string) {
  const chosen = variantSeed(id) % options.length;
  if (wordsIn(options[chosen]).length <= MOST_WORDS) return chosen;
  const lengths = options.map((option) => wordsIn(option).length);
  return lengths.indexOf(Math.min(...lengths));
}

/** Whether a fact has any words to build a sentence from. A fact with none gives no sentence and no card. */
export const hasWords = (fact: Pick<Fact, 'text'>) => Boolean(fact.text?.replace(/[\s.,;:!?"“”'‘’]+/g, ''));

/** The approved sentence in wording 2, with the blank for the name; empty for a fact with no words. */
export function sentenceV2(about: About, fact: Fact) {
  if (!hasWords(fact)) return '';
  const { sentences } = sentencesOf(fact, whoOf(about), about.name);
  return sentences[pick(sentences, fact.id)];
}

/** "This person …", for a "Who is this?" card and the fact hint: the same variant as the card's sentence. */
export function thisPersonV2(fact: Fact, about: About = {}) {
  if (!hasWords(fact)) return '';
  const own = sentencesOf(fact, whoOf(about), about.name).sentences;
  const theirs = sentencesOf(fact, THIS_PERSON, about.name).sentences;
  // "I know that this person …" over a photo reads oddly: "This person …" says it.
  return theirs[pick(own, fact.id)].replace(/^I know that this person\b/, 'This person');
}

/** The words after "Who" in a question card, or undefined when this kind of fact isn't asked that way. */
export function askV2(fact: Fact, about: About = {}) {
  if (!hasWords(fact)) return undefined;
  const fitted = fitted2(fact, about.name);
  const asks = framesFor(fact.type, fitted).asks;
  if (!asks?.length) return undefined;
  const own = sentencesOf(fact, whoOf(about), about.name).sentences;
  const predicate = asks[pick(own, fact.id) % asks.length].replace('{t}', fitted.text);
  return cleanSentence(lead(asOfLead(fact), `Who ${predicate}`), '?');
}

/** "____’s favorite food is lasagna." and "Whose favorite food is lasagna?" */
export function favoriteV2(fact: Fact, favorite: string, whose: boolean) {
  // A birthday keeps its own "on March 3" (fitWords adds it); everything else reads "is the Otters".
  if (!hasWords(fact)) return undefined;
  const { text, shape } = fitted2(fact);
  // "Favorite place is going to the beach", "favorite movie is old westerns", "favorite team is baseball" and
  // "partner is Sam and Alex" don't fit: not asked this way.
  if (shape === 'doing' || shape === 'kind' || shape === 'sport' || shape === 'many') return undefined;
  return whose ? cleanSentence(lead(asOfLead(fact), `Whose ${favorite} is ${text}`), '?') : cleanSentence(lead(asOfLead(fact), `${possessive(BLANK)} ${favorite} is ${text}`));
}

/** "Who did you meet at church?" */
export function askMetV2(fact: Fact) {
  if (!hasWords(fact)) return undefined;
  const fitted = fitted2(fact);
  // "Who did you meet when we were 5?" mixes "you" and "we": that card is asked another way.
  if (fitted.shape === 'ours') return undefined;
  return cleanSentence(`Who did you meet ${fitted.text}`, '?');
}

/** "Who do you call Nana?" and "You call this person Nana." */
export function callsV2(fact: Fact, ask: boolean) {
  if (!hasWords(fact)) return undefined;
  const { text } = fitted2(fact);
  return ask ? cleanSentence(`Who do you call ${text}`, '?') : cleanSentence(`You call this person ${text}`);
}

