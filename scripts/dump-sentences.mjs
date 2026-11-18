// Prints every sentence the app can build for the five fictional sample people (src/data/sample-deck.ts)
// from invented facts of every kind: empty, single, plural, multi-word and the way people really type.
// Every variant of every phrasing, in wording 2 (what new cards use) and, for comparison, wording 1.
//   node scripts/dump-sentences.mjs > docs/SENTENCE-DUMP.md
// FICTIONAL ONLY: the sample people and invented answers. Never add a real name or fact here.
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${root}src/${specifier.slice(2)}.ts`).href, context);
    return next(specifier, context);
  },
});
const stories = await import('@/lib/stories');

/** The five sample people, as src/data/sample-deck.ts has them (names and relationships only). */
export const SAMPLE_PEOPLE = [
  { name: 'June', relationship: 'aunt' },
  { name: 'Leo', relationship: 'neighbor' },
  { name: 'Ruth', relationship: 'cousin' },
  { name: 'Omar', relationship: 'friend' },
  { name: 'Mae', relationship: 'granddaughter' },
];

/** Invented answers for every kind of fact: empty, one word, a plural, several words, a list, and as typed. */
export const DUMP_FACTS = {
  memory: ['', 'grows tomatoes every summer', 'Loves to bake bread', 'She knits scarves', 'They love card games', 'an early riser', 'owns three bikes'],
  work: ['', 'nurse', 'a nurse', 'engineer', 'teaches math', 'retired', 'accountants', 'works at the bank', 'Nurse at the clinic', 'owner of a bakery'],
  pastwork: ['', 'teacher', 'an engineer', 'taught school', 'worked at the mill', 'farmer and carpenter', 'Mail carrier'],
  field: ['', 'health care', 'education', 'the trades', 'farming'],
  workplace: ['', 'the library', 'Mercy Hospital', 'a bakery', 'the post office and the bank'],
  plans: ['', 'retire next year', 'moving to Florida', 'travel', 'to visit Spain', 'a trip to Maine'],
  interest: ['', 'gardening', 'card games', 'knit', 'to paint', 'puzzles and crosswords', 'Golf', 'the garden', 'birds'],
  team: ['', 'the Otters', 'Otters', 'baseball', 'the Riverton Otters and the Bears'],
  show: ['', 'Jeopardy', 'game shows', 'the news', 'cooking shows'],
  movie: ['', 'Casablanca', 'The Wizard of Oz', 'old westerns', 'comedies'],
  food: ['', 'lasagna', 'tacos', 'apple pie', 'pie', 'soup and bread'],
  music: ['', 'jazz', 'the Beatles', 'Elvis', 'old hymns'],
  place: ['', 'the lake', 'Paris', 'beaches', 'going to the beach', 'park', 'the mountains'],
  habit: ['', 'hums in the kitchen', 'hum', 'late', 'They always say hello', 'whistles', 'makes pancakes on Sundays', 'early'],
  shared: ['', 'got lost in Rome', 'we went to Paris', 'The time we baked a cake', 'went fishing', 'a picnic', 'our car broke down'],
  regular: ['', 'went for ice cream', 'go to the diner', 'We went to the movies', 'the park', 'camping'],
  holiday: ['', 'at the lake', 'went to Florida', 'Christmas at the farm', 'spent a week in Maine', 'Thanksgiving'],
  met: ['', 'at church', 'in college', 'We met at work', 'when we were 5', 'school'],
  birthday: ['', 'March 3', 'in May', 'the 4th of July', 'May'],
  nickname: ['', 'Junie', '"Bud"', 'J.J.', 'Doc'],
  calls: ['', 'Nana', 'grandma', 'Aunt Bea'],
  known: ['', 'since 1962', '50 years', 'all our lives', 'forever'],
  home: ['', 'Ohio', 'in Ohio', 'the house next door', 'Paris, France', 'an apartment'],
  lives_with: ['', 'two roommates', 'her husband', 'Sam and the kids', 'a cat', 'alone'],
  partner: ['', 'Sam', 'Sam and Alex'],
  child: ['', 'Noah', 'Noah and Ava', 'Noah, Ava and Liam', 'two daughters', 'a son'],
  pet: ['', 'Rex', 'dog', 'two cats', 'an old cat', 'a dog named Rex', 'fish', 'Rex and Bella'],
  marital: ['', 'married', 'widowed', 'single'],
  situation: ['', 'expecting a baby', 'a new grandparent', 'retired', 'is moving'],
};

/** Card ids enough to bring up every variant (wording 2 picks one from a stable hash of the id). */
const IDS = Array.from({ length: 12 }, (_, index) => `dump-${index}`);

/** Every distinct sentence a fact can give, across people, variants and phrasings, in one wording. */
export function sentencesFor(type, text, wording) {
  const out = new Set();
  for (const person of SAMPLE_PEOPLE) {
    for (const id of IDS) {
      const fact = { type, text, id, wording };
      // Each person's relationship reads "{rel}", so the five people's sentences collapse into one list.
      const own = (sentence) => (typeof sentence === 'string' ? sentence.split(person.relationship).join('{rel}') : sentence);
      out.add(own(stories.sentenceFor(person, fact)));
      for (const phrasing of stories.phrasingsFor({ ...person, hasPhoto: true }, fact)) out.add(own(phrasing.ask));
      out.add(own(stories.clueFor(fact)));
    }
  }
  return [...out].filter((sentence) => typeof sentence === 'string' && sentence !== '');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lines = [
    '# Every sentence, for the five sample people',
    '',
    `Written by \`node scripts/dump-sentences.mjs\` on ${new Date().toISOString().slice(0, 10)} (fictional people and invented facts only). \`{name}\` is the blank and \`{rel}\` the person's relationship. Each answer shows every distinct sentence it gives across the five sample people (June, aunt; Leo, neighbor; Ruth, cousin; Omar, friend; Mae, granddaughter), every variant and every phrasing, in wording 2, which new cards use. Wording 1 is kept byte for byte for cards approved before 2026-11-18 and is not shown.`,
    '',
  ];
  let total = 0;
  for (const [type, answers] of Object.entries(DUMP_FACTS)) {
    lines.push(`## ${type}`, '');
    for (const answer of answers) {
      const sentences = sentencesFor(type, answer, 2);
      total += sentences.length;
      lines.push(`**${answer === '' ? '(empty)' : `“${answer}”`}**`, '', ...(sentences.length ? sentences.map((sentence) => `- ${sentence}`) : ['- (no sentence, so no card)']), '');
    }
  }
  lines.splice(4, 0, `${total} sentences in all.`, '');
  console.log(lines.join('\n'));
}
