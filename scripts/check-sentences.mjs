// Every sentence the app builds from a caregiver's answers, checked (`npm test`; docs/SENTENCE-AUDIT.md):
//
//   1. Wording version 1 (every card approved or in use before 2026-11-18) is byte-for-byte what it was.
//   2. The grammar helper's rules (src/lib/grammar.ts).
//   3. Wording version 2, table-driven: every kind of fact × every fictional answer (scripts/
//      sentence-inputs.mjs) × every relationship (and none) × no lead, a year and an as-of month × a
//      photo or none × several card ids (so every variant comes up), through the approved sentence,
//      every phrasing and the fact hint. Each must have no unresolved placeholder, no double space, no
//      a/an error, an end mark, no repeated word, no doubled punctuation, no dangling bridge word, no
//      ordinary word capitalized mid-sentence, no pronoun the caregiver didn't type, exactly one blank
//      on a blank card (none elsewhere), and never the answer outside the blank. Typical answers also
//      stay within 16 words and a plain reading level. Long answers are never cut.
//   4. Each check is shown to fail on a planted bad sentence.
//   5. Your three examples, the hint ladder, the variants' stability, and where wording 2 is set.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DUMP_FACTS } from './dump-sentences.mjs';
import { ANSWERS, CARD_IDS, LEADS, NAMES, RELATIONSHIPS } from './sentence-inputs.mjs';
import { versionOneFingerprint } from './sentence-fingerprint.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${root}src/${specifier.slice(2)}.ts`).href, context);
    return next(specifier, context);
  },
});
const stories = await import('@/lib/stories');
const questionnaire = await import('@/data/questionnaire');
const grammar = await import('@/lib/grammar');
const wording = await import('@/lib/wording');
const inRepo = (path) => readFileSync(`${root}${path}`, 'utf8');
const { BLANK } = stories;

let passed = 0;
const check = (name, run) => {
  run();
  passed += 1;
  console.log(`PASS  ${name}`);
};

// ---- 1. Version 1 never changes ----

/** Recorded from src/lib/stories.ts on 2026-11-18, before wording 2 existed. */
const VERSION_ONE = { count: 22398, sha256: '589e9d38b99a04f0e4489cc748b7fedc58fd5aae06c07ad438fcd4af4fd8fd6a' };
check(`wording 1 is exactly what it was: ${VERSION_ONE.count} sentences, phrasings and hints`, () => {
  assert.deepEqual(versionOneFingerprint(stories), VERSION_ONE, 'a version-1 sentence changed: every card approved before 2026-11-18 would read differently');
});
check('a card with no wording is version 1, and the blank is the same in both', () => {
  assert.equal(stories.usesWordingTwo({}), false);
  assert.equal(stories.usesWordingTwo({ wording: 1 }), false);
  assert.equal(stories.usesWordingTwo({ wording: 2 }), true);
  assert.equal(wording.WORDING_LATEST, 2);
  assert.ok(inRepo('src/lib/wording.ts').includes(`const BLANK = '${BLANK}';`), 'wording.ts uses the same blank as stories.ts');
});

// ---- 2. The grammar helper ----

check('grammar: a/an by sound, articles, plurals, possessives and lists', () => {
  for (const [word, article] of [['apple', 'an'], ['nurse', 'a'], ['engineer', 'an'], ['hour', 'an'], ['honest', 'an'], ['university', 'a'], ['one', 'a'], ['old cat', 'an'], ['useful', 'a'], ['umbrella', 'an'], ['"easy"', 'an']]) assert.equal(grammar.articleFor(word), article, word);
  assert.equal(grammar.withArticle('nurse'), 'a nurse');
  assert.equal(grammar.withArticle('engineer'), 'an engineer');
  for (const kept of ['a nurse', 'the Otters', 'two cats', 'Rex', 'my dog', 'cats']) assert.equal(grammar.withArticle(kept), kept);
  assert.equal(grammar.isPlural('two cats'), true);
  assert.equal(grammar.isPlural('glass'), false);
  assert.equal(grammar.possessive('Charles'), 'Charles’s');
  assert.equal(grammar.possessive(BLANK), `${BLANK}’s`);
  assert.deepEqual([grammar.joinList(['Noah']), grammar.joinList(['Noah', 'Ava']), grammar.joinList(['Noah', 'Ava', 'Liam'])], ['Noah', 'Noah and Ava', 'Noah, Ava, and Liam']);
  assert.deepEqual(grammar.splitList('Noah, Ava and Liam'), ['Noah', 'Ava', 'Liam']);
  assert.deepEqual(grammar.splitList('Noah & Ava'), ['Noah', 'Ava']);
  assert.deepEqual(grammar.splitList('Noah'), ['Noah']);
});
check('grammar: verbs for one person, activities, capitals and cleanup', () => {
  for (const [verb, one] of [['say', 'says'], ['hum', 'hums'], ['carry', 'carries'], ['fix', 'fixes'], ['go', 'goes'], ['have', 'has'], ['watch', 'watches'], ['play', 'plays']]) assert.equal(grammar.thirdPerson(verb), one, verb);
  for (const [verb, doing] of [['paint', 'painting'], ['knit', 'knitting'], ['bake', 'baking'], ['tie', 'tying'], ['swim', 'swimming'], ['read', 'reading'], ['garden', 'gardening'], ['see', 'seeing']]) assert.equal(grammar.gerund(verb), doing, verb);
  assert.equal(grammar.lowerOrdinaryFirst('Loves to bake'), 'loves to bake');
  for (const kept of ['Paris in spring', 'The Wizard of Oz', 'Junie']) assert.equal(grammar.lowerOrdinaryFirst(kept), kept === 'The Wizard of Oz' ? 'the Wizard of Oz' : kept);
  assert.equal(grammar.capitalizeFirst('my aunt'), 'My aunt');
  assert.equal(grammar.capitalizeFirst(`${BLANK} loves`), `${BLANK} loves`);
  assert.equal(grammar.cleanSentence('loves  jokes?'), 'Loves jokes.');
  assert.equal(grammar.cleanSentence('loves jokes ,'), 'Loves jokes.');
  assert.equal(grammar.cleanSentence('says "it is easy"'), 'Says "it is easy."');
  assert.equal(grammar.cleanSentence('who says "it is easy"', '?'), 'Who says "it is easy"?');
  assert.equal(grammar.cleanSentence('goes by J.J.'), 'Goes by J.J.');
  assert.equal(grammar.cleanSentence('who goes by J.J.', '?'), 'Who goes by J.J.?');
  assert.equal(grammar.wordsIn(`My aunt, ${BLANK}, isn’t Mary-Kate.`).length, 5);
});

// ---- 3. The problems a sentence can have ----

const ORDINARY_CAPITAL = (word) => grammar.isOrdinaryWord(word) && word !== 'I';
const PRONOUNS = /\b(he|she|him|her|his|hers|himself|herself)\b/i;
const DANGLING = /\b(and|or|who|when|where|with|because|which|so|after|that|of|to|the|a|an|is|in|on|at|for|by|named|than|as|always|once|enjoys|likes|watching|planning|about|from|into)[.?!]["”’)]?$|\band I[.?!]$|,\s*(and|who|when|with)\s*[,.?!]|\b(when|who|with|and)\s*,/i;
/** Syllables in a word, roughly (vowel groups, a silent final e). */
const syllablesIn = (word) => Math.max(1, (word.toLowerCase().replace(/(?<=[^aeiouy])e$/, '').match(/[aeiouy]+/g) ?? []).length);
/**
 * A plain reading level for short card sentences: on average no more than 2.5 syllables a word (the count is rough and runs high), and no
 * more than one long word (4 syllables or more). Grade formulas such as Flesch–Kincaid mislead on
 * sentences this short ("Who grows tomatoes every summer?" would rate grade 10), so this is simpler.
 */
function hardToRead(sentence) {
  const words = grammar.wordsIn(sentence).filter((word) => word !== 'name');
  const syllables = words.map(syllablesIn);
  const average = syllables.reduce((sum, n) => sum + n, 0) / Math.max(words.length, 1);
  const long = syllables.filter((n) => n >= 4).length;
  return average > 2.5 || long > 1 ? `average ${average.toFixed(1)} syllables, ${long} long words` : '';
}

/**
 * Every problem in one finished sentence. `kind` is the phrasing's kind ("blank" needs exactly one
 * blank; any other none); `typed` is the caregiver's answer; `name` the answer the card asks for.
 */
/** Kinds of fact whose answers are names or titles, so a capital the caregiver typed stays ("The Wizard of Oz"). */
const TITLES = new Set(['movie', 'show', 'music', 'team', 'workplace', 'home', 'place', 'nickname', 'calls', 'partner', 'child', 'pet', 'birthday', 'holiday']);

/**
 * The copy editor's classes found in docs/SENTENCE-DUMP.md (2026-11-18), each a pattern a wrong sentence
 * has and a right one never does. Every one is planted below to show it fails.
 */
const PROPER_ADJECTIVES = /^(English|French|Spanish|German|Italian|Chinese|Japanese|Korean|Greek|Irish|Mexican|American|Indian|Thai|Polish|Russian|Latin|Christmas|Easter|Thanksgiving|Bible|Catholic|Jewish|Sunday)$/;
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const COPY_EDIT = [
  ['missing verb before a thing', (s) => /(?:\{name\}|\b[Pp]erson),? (?:a|an|the) /.test(s)],
  ['a thing said as a clause', (s) => /\btime when (?:a|an) \w+(?: \w+)?, with\b/.test(s)],
  ['a plural job for one person', (s) => /\b(?:works as|worked as|work as|is|was) (?:[a-z]+ )?[a-z]*(?:ants|ers|ors|ists|ians|nurses)[.?]$/.test(s)],
  ['a typed capital mid-sentence', (s, type) => ['work', 'pastwork', 'field', 'interest', 'plans', 'habit'].includes(type) && [...s.matchAll(/\b(?:works as|worked as|work as|is|enjoys|likes|career in|worked in|always|planning to|plans to) (?:an? )?(\p{Lu}\p{Ll}+)(?! \p{Lu})/gu)].some(([, word]) => !PROPER_ADJECTIVES.test(word))],
  ['a bare noun with no article', (s) => /\b(?:loves going to|loves|has|met|takes care of) (?:park|dog|cat|school|church|beach|lake|store|garden|farm|library|bank|office|bird)[.?]/.test(s)],
  ['a month needs "in"', (s) => new RegExp(`\\bon (?:${MONTHS})[.?]`).test(s)],
  ['"you" and "we" in one sentence', (s) => /\byou\b[^.?]*\b(?:we|our|us)\b/i.test(s)],
  ['"I" with "our"', (s) => /(?<!and )\bI have known (?!each other)[^.?]*\bour\b/.test(s)],
  ['a name in lower case', (s) => /\b(?:call|goes by|also called) (?:[^.?]*?(?:\{name\}|this person),? )?\p{Ll}[\p{L}]*[.?]$/u.test(s) || /\bMy name for [^.?]* is \p{Ll}[\p{L}]*[.?]$/u.test(s)],
  ['a favorite that is a kind, not one', (s) => /\bfavorite (?:team|show|place) is (?!the\b|an?\b|home\b|downtown\b)\p{Ll}/u.test(s)],
  ['an activity with no verb', (s) => /\balways (?:the|a|an|\w+ing)\b/.test(s)],
  ['"lives with" alone', (s) => /\bwith (?:alone|herself|himself|themselves)\b/.test(s)],
  ['"I know that this person"', (s) => /^I know that this person\b/.test(s)],
  ['"planning to" a thing', (s) => /\b(?:planning|plans) to (?:a|an|the)\b/.test(s)],
  ['two pets said as one', (s) => /\bhas \p{Lu}\w+ and \p{Lu}\w+[.?]$/u.test(s)],
  ['two partners as one', (s) => /\bpartner is [^.?]* and /.test(s)],
];

function problemsIn(sentence, { kind = 'blank', typed = '', name = 'June', typical = false, type = 'memory' } = {}) {
  const found = [];
  for (const [problem, test] of COPY_EDIT) if (test(sentence.replace(/ Who is this\?$/, ''), type)) found.push(problem);
  const statement = sentence.replace(/ Who is this\?$/, '');
  if (/\{(?!name\})[^}]*\}|\^|\[(NAME|PERSON_\d+|FACT[^\]]*)\]/.test(sentence)) found.push('unresolved placeholder');
  if (/ {2,}/.test(sentence)) found.push('double space');
  for (const [, article, next] of sentence.matchAll(/\b([Aa]n?) ([A-Za-z"“][\w’'-]*)/g)) {
    if (next === BLANK.slice(1)) continue;
    if (article.toLowerCase() !== grammar.articleFor(next)) found.push(`a/an ("${article} ${next}")`);
  }
  if (!/[.?!]["”’)]?$/.test(sentence)) found.push('no end punctuation');
  const words = grammar.wordsIn(sentence).map((word) => word.toLowerCase());
  // Initials ("J.J.") aren't repeated words.
  for (let i = 1; i < words.length; i++) if (words[i] === words[i - 1] && words[i].length > 1) found.push(`repeated word ("${words[i]}")`);
  if (/[.?!,;:]\s*[.?!,;:]/.test(sentence.replace(/\b\p{Lu}\.(?=\p{Lu}\.)/gu, '').replace(/\b\p{Lu}\.\?$/u, '?'))) found.push('doubled punctuation');
  if (DANGLING.test(statement)) found.push('dangling bridge word');
  for (const [, word] of statement.matchAll(/(?<=[\p{Ll},] )(\p{Lu}[\p{Ll}’']*)/gu)) {
    if (ORDINARY_CAPITAL(word) && !(TITLES.has(type) && typed.includes(word))) found.push(`capital mid-sentence ("${word}")`);
  }
  if (PRONOUNS.test(sentence) && !PRONOUNS.test(typed)) found.push('a pronoun the caregiver didn’t type');
  const blanks = sentence.split(BLANK).length - 1;
  if (kind === 'blank' && blanks !== 1) found.push(blanks ? 'blank twice' : 'blank missing');
  if (kind !== 'blank' && blanks) found.push('a blank on a card that has none');
  if (stories.saysName(sentence.split(BLANK).join(' '), name) && !stories.saysName(typed, name)) found.push('the answer outside the blank');
  if (typical && grammar.wordsIn(statement).length > wording.MOST_WORDS) found.push(`over ${wording.MOST_WORDS} words (${grammar.wordsIn(statement).length})`);
  if (typical && hardToRead(statement)) found.push(`reading level (${hardToRead(statement)})`);
  return found;
}

// ---- 4. Each check fails on a planted bad sentence (and the good one passes) ----

check('each check fails on a planted bad sentence', () => {
  const planted = [
    ['{text} loves to bake.', 'unresolved placeholder'],
    [`My aunt,  ${BLANK}, loves to bake.`, 'double space'],
    [`${BLANK} eats a apple.`, 'a/an'],
    [`${BLANK} is an nurse.`, 'a/an'],
    [`${BLANK} loves to bake`, 'no end punctuation'],
    [`${BLANK} loves loves to bake.`, 'repeated word'],
    [`${BLANK} laughs at jokes?.`, 'doubled punctuation'],
    [`${BLANK} and I.`, 'dangling bridge word'],
    [`${BLANK} loves to bake with.`, 'dangling bridge word'],
    [`My friend, ${BLANK}, Loves to bake.`, 'capital mid-sentence'],
    [`${BLANK} loves her garden.`, 'a pronoun the caregiver didn’t type'],
    ['My aunt loves to bake.', 'blank missing'],
    [`${BLANK} and ${BLANK} love to bake.`, 'blank twice'],
    [`${BLANK} loves June’s garden.`, 'the answer outside the blank'],
    [`My aunt, ${BLANK}, loves to bake bread and cakes for the whole family every single Sunday morning.`, 'over 16 words'],
    [`${BLANK} contemplates multidimensional philosophical considerations.`, 'reading level'],
  ];
  for (const [sentence, problem] of planted) {
    const found = problemsIn(sentence, { typical: true });
    assert.ok(found.some((one) => one.startsWith(problem)), `"${sentence}" should fail "${problem}", found: ${found.join('; ') || 'nothing'}`);
  }
  // The copy editor's classes (docs/SENTENCE-DUMP.md): each "before" sentence fails, its fixed sentence passes.
  const before = [
    [`${BLANK} an early riser.`, `${BLANK} is an early riser.`, 'missing verb before a thing', 'memory'],
    [`There was a time when a picnic, with ${BLANK} and me.`, `I remember a picnic with ${BLANK}.`, 'a thing said as a clause', 'shared'],
    [`${BLANK} works as accountants.`, `${BLANK} works as an accountant.`, 'a plural job for one person', 'work'],
    [`${BLANK} works as Nurse at the clinic.`, `${BLANK} works as a nurse at the clinic.`, 'a typed capital mid-sentence', 'work'],
    [`${BLANK} loves going to park.`, `${BLANK} loves going to the park.`, 'a bare noun with no article', 'place'],
    [`${BLANK} and I met school.`, `${BLANK} and I met at school.`, 'a bare noun with no article', 'met'],
    [`${BLANK}’s birthday is on May.`, `${BLANK}’s birthday is in May.`, 'a month needs "in"', 'birthday'],
    ['Who did you meet when we were 5?', 'Who did you meet at school?', '"you" and "we" in one sentence', 'met'],
    [`I have known ${BLANK} all our lives.`, `${BLANK} and I have known each other all our lives.`, '"I" with "our"', 'known'],
    [`I call ${BLANK} grandma.`, `I call ${BLANK} Grandma.`, 'a name in lower case', 'calls'],
    [`${BLANK}’s favorite team is baseball.`, `${BLANK}’s favorite team is the Otters.`, 'a favorite that is a kind, not one', 'team'],
    [`${BLANK} and I always camping.`, `${BLANK} and I always went camping.`, 'an activity with no verb', 'regular'],
    [`${BLANK} lives with alone.`, `${BLANK} lives alone.`, '"lives with" alone', 'lives_with'],
    ['I know that this person grows tomatoes. Who is this?', 'This person grows tomatoes. Who is this?', '"I know that this person"', 'memory'],
    [`${BLANK} is planning to a trip to Maine.`, `${BLANK} is planning a trip to Maine.`, '"planning to" a thing', 'plans'],
    [`${BLANK} is planning to to visit Spain.`, `${BLANK} is planning to visit Spain.`, 'repeated word', 'plans'],
    [`${BLANK} has Rex and Bella.`, `${BLANK} has pets named Rex and Bella.`, 'two pets said as one', 'pet'],
    [`${BLANK}’s partner is Sam and Alex.`, `${BLANK}’s partner is Sam.`, 'two partners as one', 'partner'],
    [`${BLANK} works as.`, `${BLANK} works as a nurse.`, 'dangling bridge word', 'work'],
  ];
  for (const [bad, good, problem, type] of before) {
    const found = problemsIn(bad, { type });
    assert.ok(found.some((one) => one.startsWith(problem)), `"${bad}" should fail "${problem}", found: ${found.join('; ') || 'nothing'}`);
    const fixed = problemsIn(good, { type, kind: good.includes(BLANK) ? 'blank' : 'ask' });
    assert.deepEqual(fixed, [], `"${good}" should pass`);
  }
  assert.equal(COPY_EDIT.filter(([problem]) => !before.some(([, , planted]) => planted === problem)).length, 0, 'every copy-edit class is planted');
  assert.deepEqual(problemsIn(`My aunt, ${BLANK}, loves to bake bread.`, { typical: true }), [], 'a good sentence passes');
  assert.deepEqual(problemsIn('Who loves to bake bread?', { kind: 'ask', typical: true }), []);
});

// ---- 5. Every template, every variant, every input ----

/** Relationships typed as the picker offers them: the word limit and reading level apply with these. */
const TYPICAL_RELATIONSHIPS = ['friend', 'aunt', 'Grandma', 'older sister', 'step-dad', undefined];

const failures = [];
let sentences = 0;
const seen = new Map();
for (const type of stories.FACT_TYPES) {
  // The answers of the dump (docs/SENTENCE-DUMP.md) too, as typed: the empty ones are checked apart, below.
  const answers = [...ANSWERS[type], ...DUMP_FACTS[type].filter((one) => one.trim()).map((one) => [one, false])];
  for (const [typed, typical] of answers) {
    for (const relationship of RELATIONSHIPS) {
      // The optional parts a fact of this kind can really have: a year only on a memory that asks for one,
      // a month only on a fact that may change. Each is tried both filled and empty.
      const question = questionnaire.questionFor(type);
      const leads = LEADS.filter((one) => (!one.year || question.input === 'memory') && (!one.asOf || question.changes));
      for (const leadOf of leads) {
        for (const id of CARD_IDS) {
          for (const hasPhoto of [true, false]) {
            const fact = { type, text: typed, timeSensitive: false, ...leadOf, id, wording: 2 };
            const about = { relationship, hasPhoto, name: 'June' };
            const where = `${type} "${typed}"${relationship ? `, ${relationship}` : ''}${leadOf.year ? ', 2002' : ''}${leadOf.asOf ? ', as of May' : ''}, ${id}`;
            const outputs = [
              ['sentence', 'blank', stories.sentenceFor(about, fact)],
              ...stories.phrasingsFor(about, fact).flatMap((phrasing) => [
                [phrasing.id, phrasing.kind, phrasing.ask],
                ...(phrasing.reveal !== phrasing.ask ? [[`${phrasing.id} read-back`, 'blank', phrasing.reveal]] : []),
              ]),
              ['fact hint', 'hint', stories.clueFor(fact)],
            ];
            for (const [shape, kind, sentence] of outputs) {
              sentences += 1;
              if (shape === 'photo') continue;
              const problems = problemsIn(sentence, { kind, typed, type, typical: typical && TYPICAL_RELATIONSHIPS.includes(relationship) });
              if (problems.length) failures.push(`${where} [${shape}]: "${sentence}" — ${problems.join('; ')}`);
              if (shape === 'sentence') seen.set(`${type}|${typed}|${relationship}|${JSON.stringify(leadOf)}`, (seen.get(`${type}|${typed}|${relationship}|${JSON.stringify(leadOf)}`) ?? new Set()).add(sentence));
            }
          }
        }
      }
    }
  }
}
check(`wording 2: ${sentences} sentences, phrasings and hints, every optional part filled and empty, with no problem`, () => {
  if (process.env.SENTENCE_FAILURES) {
    const kinds = {};
    for (const failure of failures) for (const problem of failure.split(' — ')[1].split('; ')) kinds[problem.replace(/ \(.*$/, '')] = (kinds[problem.replace(/ \(.*$/, '')] ?? 0) + 1;
    console.log(kinds);
    for (const kind of Object.keys(kinds)) console.log([...new Set(failures.filter((one) => one.includes(kind)).map((one) => one.replace(/, (sample|card|f3b1)[^ ]* \[/, ' [')))].slice(0, 4).join('\n'));
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} problems`);
});

check('an empty answer gives no sentence and no card, in every kind of fact', () => {
  for (const type of stories.FACT_TYPES) {
    for (const typed of ['', '   ', '.']) {
      const fact = { type, text: typed, timeSensitive: false, id: 'card-a', wording: 2 };
      assert.equal(stories.sentenceFor({ relationship: 'aunt', name: 'June' }, fact), '', `${type} "${typed}"`);
      assert.deepEqual(stories.phrasingsFor({ relationship: 'aunt', hasPhoto: true, name: 'June' }, fact), [], `${type} "${typed}": no phrasing, so cardsOf drops the card`);
    }
  }
});

check('the hint ladder still works on wording 2: the same order, and each hint’s fact stands apart from the card', () => {
  const card = (id, type, text) => ({ id, personId: 'june', answer: 'June', relationship: 'aunt', hints: stories.ALL_HINTS, hintOk: true, fact: { type, text, timeSensitive: false, id, wording: 2 }, phrasings: [] });
  const deck = [card('a', 'interest', 'gardening'), card('b', 'food', 'lasagna'), { ...card('c', 'memory', 'loves cats'), personId: 'leo', answer: 'Leo' }, { ...card('d', 'memory', 'reads'), personId: 'ruth', answer: 'Ruth' }];
  deck[0].phrasings = stories.phrasingsFor({ relationship: 'aunt', hasPhoto: true, name: 'June' }, deck[0].fact);
  deck[1].phrasings = stories.phrasingsFor({ relationship: 'aunt', hasPhoto: true, name: 'June' }, deck[1].fact);
  const round = stories.roundFor({ ...deck[0], phrasings: deck[0].phrasings.filter((one) => one.id === 'name') }, deck, {}, () => 0);
  assert.deepEqual(stories.hintLadder(round), ['fact', 'relationship', 'letter', 'fewer'], 'the same rungs in the same order');
  assert.ok(/^This person loves (to eat )?lasagna\.$/.test(round.clue), `the fact hint is another fact, said on its own: ${round.clue}`);
  assert.ok(!round.clue.includes(BLANK) && !round.phrasing.ask.includes('lasagna'), 'and not one the card already says');
  assert.deepEqual([1, 2, 3, 4, 5].map((misses) => stories.hintStep(round, misses)), ['fact', 'relationship', 'letter', 'fewer', 'answer']);
});

check('a card reads the same every time, and different cards get different variants', () => {
  const fact = (id) => ({ type: 'shared', text: 'got lost in Rome', timeSensitive: false, id, wording: 2 });
  for (const id of CARD_IDS) assert.equal(stories.sentenceFor({ relationship: 'aunt', name: 'June' }, fact(id)), stories.sentenceFor({ relationship: 'aunt', name: 'June' }, fact(id)), id);
  const variety = [...seen.values()].filter((set) => set.size > 1).length;
  assert.ok(variety > 50, `answers that read more than one way across cards: ${variety}`);
  const kinds = new Set([...seen.entries()].filter(([, set]) => set.size > 1).map(([key]) => key.split('|')[0]));
  assert.ok(kinds.size >= 20, `kinds of fact with more than one variant: ${kinds.size} (${[...kinds].join(', ')})`);
});

check('your three examples read correctly in wording 2', () => {
  const two = (type, text, relationship, extra = {}) => stories.sentenceFor({ relationship, name: 'June' }, { type, text, timeSensitive: false, wording: 2, id: 'card-a', ...extra });
  assert.ok(/^(There was a time when|I remember when) \{name\} and I had to go into this arena and fight each other\.$|^\{name\} and I once had to go into this arena and fight each other\.$/.test(two('shared', 'A time we had to go into this arena and fight each other')), two('shared', 'A time we had to go into this arena and fight each other'));
  assert.equal(two('shared', 'A time our car came to life and we had to save the world', undefined, { year: 2002 }), 'In 2002, there was a time when our car came to life and {name} and I had to save the world.');
  assert.equal(two('habit', 'They always say its not that easy', 'wife'), 'My wife, {name}, always says its not that easy.', 'the typo stays: the caregiver fixes it on story approval');
});

check('names: possessives, apostrophes, hyphens and a title that is also the relationship', () => {
  for (const name of NAMES) {
    const filled = stories.fillBlank(stories.sentenceFor({ relationship: 'grandma', name }, { type: 'interest', text: 'gardening', timeSensitive: false, wording: 2, id: 'card-a' }), name);
    assert.ok(!/grandma.*grandma/i.test(filled), `no "my grandma, Grandma Rose": ${filled}`);
    const favorite = stories.phrasingsFor({ hasPhoto: true, name }, { type: 'food', text: 'lasagna', timeSensitive: false, wording: 2, id: 'card-a' }).find((one) => one.id === 'favorite');
    assert.equal(stories.fillBlank(favorite.ask, name), `${name}’s favorite food is lasagna.`);
  }
  // The answer typed into the words: no card that says it outside the blank is offered.
  const says = stories.phrasingsFor({ relationship: 'aunt', hasPhoto: true, name: 'June' }, { type: 'memory', text: 'loves the song about June bugs', timeSensitive: false, wording: 2, id: 'card-a' });
  assert.ok(says.every((one) => !stories.saysName(one.ask.split(BLANK).join(' '), 'June')), 'never the answer outside the blank');
});

// ---- 6. Where wording 2 is set, and where it isn't ----

check('new and edited drafts get wording 2; approved, in-use and deck cards keep version 1', () => {
  const store = inRepo('src/data/family-store.ts');
  assert.ok(/function factColumns[\s\S]*?wording: WORDING_LATEST/.test(store), 'the server store writes wording 2 for every new or edited fact');
  assert.ok(/wording: row\.wording \?\? 1/.test(store) && /wording: row\.wording \?\? 1/.test(inRepo('src/data/practice-store.ts')), 'both stores read a missing wording as version 1');
  const family = inRepo('src/lib/local-family.ts');
  assert.ok(/function newCard[\s\S]*?wording: WORDING_LATEST/.test(family) && /function reworded[\s\S]*?wording: WORDING_LATEST/.test(family), 'the phone writes wording 2 for new and edited facts');
  assert.ok(!/wording/.test(/export function seedFamily[\s\S]*?\n}\n/.exec(family)[0]), 'the example deck (the sample people and the local deck) is copied as version 1');
  const schema = inRepo('supabase/schema.sql');
  assert.ok(/add column wording smallint not null default 1/.test(schema), 'the schema adds wording, default 1');
  assert.ok(/update public\.cards set wording = 2 where status = 'pending'/.test(schema), 'once, when it first appears: drafts waiting for approval move to wording 2');
});

check('the version-1 check itself fails when one version-1 sentence changes', () => {
  const changed = { ...stories, sentenceFor: (about, fact) => (fact.type === 'pet' ? `${stories.sentenceFor(about, fact)} ` : stories.sentenceFor(about, fact)) };
  assert.notDeepEqual(versionOneFingerprint(changed), VERSION_ONE);
});

{
  const families = await import('@/lib/local-family');
  const deck = [{ id: 'june', name: 'June', relationship: 'aunt', memories: ['grows tomatoes and shares them every summer'] }];
  let family = families.seedFamily(families.EMPTY_FAMILY, deck);
  assert.equal(family.cards[0].wording, undefined, 'a deck card is copied as version 1');
  family = { ...family, cards: [...family.cards, { ...family.cards[0], id: 'june-9', status: 'pending', wording: undefined }] };
  family = families.rewordWaitingDrafts(family);
  assert.deepEqual(family.cards.map((card) => [card.status, card.wording ?? 1]), [['approved', 1], ['pending', 2]], 'only the waiting draft moves');
  const again = families.rewordWaitingDrafts({ ...family, cards: [...family.cards, { ...family.cards[0], id: 'june-10', status: 'pending', wording: undefined }] });
  assert.equal(again.cards[2].wording, undefined, 'and only once: a later version-1 draft stays as it is');
  const added = families.saveFacts(family, 'june', [{ type: 'food', text: 'lasagna', timeSensitive: false, id: 'new-1' }], () => 'x');
  assert.equal(added.cards.find((card) => card.id === 'new-1').wording, 2, 'a new draft is wording 2');
  const edited = families.editCard(family, 'june-0', { type: 'memory', text: 'grows beans', timeSensitive: false });
  assert.deepEqual([edited.cards[0].wording, edited.cards[0].status], [2, 'pending'], 'an edited card is a wording-2 draft');
  const moved = families.moveToNewWording(family, 'june');
  assert.equal(moved.moved, 1);
  assert.deepEqual([moved.family.cards[0].wording, moved.family.cards[0].status], [2, 'pending'], 'moving on purpose: the approved card waits for approval in the new wording');
  assert.equal(families.moveToNewWording(moved.family, 'june').moved, 0, 'nothing left to move');
  passed += 1;
  console.log('PASS  the phone: drafts waiting move to wording 2 once, approved and deck cards stay 1, new and edited drafts are 2, and a person moves on purpose');
}

check('the Add a person labels show the sentence being finished, as text only', () => {
  const q = questionnaire;
  const relabeled = { habit: 'NAME always…', shared: 'NAME and I once…', regular: 'NAME and I always…', holiday: 'NAME and I spent a holiday…', met: 'NAME and I met…' };
  for (const [type, label] of Object.entries(relabeled)) {
    const question = q.questionFor(type);
    assert.equal(question.label, label, type);
    assert.ok(question.placeholder && question.short, `${type}: a fictional example and a short name for summaries`);
    assert.ok(!/\b(A time we|They always|How we met|The place we always|A holiday we)\b/.test(question.label), `${type}: no label that invites typing the frame's own words`);
  }
  assert.equal(q.labelOf(q.questionFor('shared'), 'June Smith'), 'June and I once…', 'the first name');
  assert.equal(q.labelOf(q.questionFor('shared'), ''), 'This person and I once…', 'before a name is typed');
  assert.equal(q.labelOf(q.questionFor('shared'), 'Bartholomew-Alexander'), 'This person and I once…', 'a long first name would be cut off on the one-line label');
  assert.equal(q.labelOf(q.questionFor('home'), 'June'), q.questionFor('home').label, 'other labels are unchanged');
});

console.log(`\nAll ${passed} sentence checks passed`);
