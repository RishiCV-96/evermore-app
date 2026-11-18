// The grammar rules sentences are built with, in one place (docs/SENTENCE-AUDIT.md). Import-free,
// like src/lib/stories.ts, so it can be checked in plain Node. Every rule here only fits words the
// caregiver typed into a sentence: an article, a verb ending, a capital, spacing and punctuation. None
// adds, removes or changes a fact.

const VOWEL_SOUND_EXCEPTIONS = /^(hour|honest|honor|honour|heir)/i; // "an hour"
const CONSONANT_SOUND_EXCEPTIONS = /^(uni|use|usu|uti|eu|one|once|ewe|u[bcdfgklmnprstvz][aeiou])/i; // "a university", "a one", "a ukulele"

/** "a" or "an" for the word that follows, by its sound. */
export function articleFor(word: string) {
  const first = word.trim().replace(/^["“‘']/, '');
  if (VOWEL_SOUND_EXCEPTIONS.test(first)) return 'an';
  if (CONSONANT_SOUND_EXCEPTIONS.test(first)) return 'a';
  return /^[aeiou]/i.test(first) ? 'an' : 'a';
}

/** Words that already say which one: a phrase starting with one needs no article. */
const DETERMINERS =
  /^(a|an|the|my|your|his|her|their|our|its|this|that|these|those|some|any|no|every|each|one|two|three|four|five|six|seven|eight|nine|ten|many|several|lots|\d+)\b/i;

/** The phrase with "a" or "an" in front, unless it already has a determiner, is a name, or is a plural. */
export function withArticle(phrase: string) {
  const text = phrase.trim();
  if (!text || DETERMINERS.test(text) || /^[A-Z]/.test(text) || isPlural(text)) return text;
  return `${articleFor(text)} ${text}`;
}

/** A rough plural: the last word ends in s (but not ss, us or is: "glass", "bus", "tennis"). */
export function isPlural(phrase: string) {
  const last = phrase.trim().split(/\s+/).pop() ?? '';
  return /[^su']s$/i.test(last) && !/(ss|us|is)$/i.test(last);
}

/** "June’s", "Charles’s", "the blank’s". The app's apostrophe is the curly one. */
export function possessive(name: string) {
  return `${name}’s`;
}

/** "A", "A and B", "A, B, and C". */
export function joinList(items: string[]) {
  const list = items.map((item) => item.trim()).filter(Boolean);
  if (list.length < 3) return list.join(' and ');
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

/** The items of a list as typed: "Noah, Ava and Liam" → three. A single item comes back alone. */
export function splitList(text: string) {
  return text
    .split(/\s*,\s*(?:and\s+)?|\s+and\s+|\s*&\s*/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

const IRREGULAR_THIRD: Record<string, string> = { be: 'is', have: 'has', do: 'does', go: 'goes', say: 'says' };

/** A verb for one person: "say" → "says", "hum" → "hums", "carry" → "carries", "fix" → "fixes". */
export function thirdPerson(verb: string) {
  const lower = verb.toLowerCase();
  if (IRREGULAR_THIRD[lower]) return IRREGULAR_THIRD[lower];
  if (/[^aeiou]y$/i.test(verb)) return `${verb.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh|o)$/i.test(verb)) return `${verb}es`;
  return `${verb}s`;
}

/** A verb as an activity: "paint" → "painting", "knit" → "knitting", "bake" → "baking", "tie" → "tying". */
export function gerund(verb: string) {
  if (/ing$/i.test(verb)) return verb;
  if (/ie$/i.test(verb)) return `${verb.slice(0, -2)}ying`;
  if (/[^aeiouy]e$/i.test(verb) && !/^(be|see)$/i.test(verb)) return `${verb.slice(0, -1)}ing`;
  // One short syllable ending consonant-vowel-consonant doubles its last letter: knit, swim, jog, run, shop.
  if (/^[^aeiou]*[aeiou][bdgklmnprt]$/i.test(verb)) return `${verb}${verb.slice(-1)}ing`;
  return `${verb}ing`;
}

/** The first letter as a capital. A blank ({name}) or a quote mark is left as it is. */
export function capitalizeFirst(text: string) {
  return text.replace(/^(["“‘']?)(\p{Ll})/u, (_, quote: string, letter: string) => `${quote}${letter.toUpperCase()}`);
}

/**
 * Ordinary words that start what a caregiver typed only because they started typing there: the first
 * word goes to lower case inside a sentence ("Loves to bake" → "loves to bake"). Names and titles
 * ("Paris", "The Wizard of Oz") are never in it, so they keep their capitals.
 */
const ORDINARY_FIRST_WORDS = new Set(
  (
    'a an the some my our your his her their this that these those always never often usually still also just really very ' +
    'loves love likes like enjoys enjoy has have had is was are were goes go went makes make made gets get got takes take took ' +
    'plays play played works work worked lives live lived says say said tells tell told sings sing sang hums hum laughs laugh ' +
    'cooks cook cooked bakes bake baked grows grow grew reads read knits knit paints paint walks walk walked drives drive drove ' +
    'calls call called talks talk talked turned spent visited stayed moved met watched watches watch wears wear keeps keep ' +
    'knows know brings bring brought gives give gave helps help helped teaches teach taught runs run ran owns own'
  ).split(' '),
);

/** "Loves to bake" → "loves to bake". Anything not an ordinary first word keeps its capital. */
export function lowerOrdinaryFirst(text: string) {
  const first = text.match(/^[\p{L}’']+/u)?.[0];
  if (!first || first === first.toLowerCase() || first.length < 1) return text;
  if (!/^\p{Lu}\p{Ll}*$/u.test(first) || !ORDINARY_FIRST_WORDS.has(first.toLowerCase())) return text;
  return `${first.toLowerCase()}${text.slice(first.length)}`;
}

/**
 * The finishing pass every sentence goes through: one space between words, none before punctuation,
 * no doubled punctuation ("?." → "?", ",," → ","), a capital first letter, and exactly one end mark.
 */
export function cleanSentence(text: string, end: '.' | '?' = '.') {
  let out = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
  // A trailing comma, colon or semicolon before the end goes; any end marks already there give way to one,
  // except the period of an initialism ("J.J."), which is part of the word.
  out = out.replace(/[\s,;:]+$/, '');
  const initialism = /\b\p{Lu}\.$/u.test(out);
  if (!initialism) out = out.replace(/[.?!]+(["”’)]?)$/, '$1');
  out = out.replace(/([.?!])\s*[.?!]+(?!\p{L})/gu, '$1').replace(/,\s*([.?!])/g, '$1');
  if (initialism) return capitalizeFirst(end === '.' ? out : `${out}${end}`);
  const closing = out.match(/["”’)]$/)?.[0] ?? '';
  const body = closing ? out.slice(0, -1) : out;
  // A statement's period goes inside a closing quote ("… easy."); a question mark goes outside it ("… easy"?),
  // because the quoted words aren't the question.
  return capitalizeFirst(end === '?' ? `${out}?` : `${body}${end}${closing}`);
}

/** The words of a sentence, for counting: "it’s" and "Mary-Kate" are one word each, the blank one. */
export function wordsIn(sentence: string, blank = '{name}') {
  return sentence.split(blank).join(' name ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

/** Whether a word is an ordinary one that would never be capitalized inside a sentence ("Loves", "The"). */
export const isOrdinaryWord = (word: string) => ORDINARY_FIRST_WORDS.has(word.toLowerCase());
