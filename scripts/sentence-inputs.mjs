// The fictional inputs every sentence template is run against (scripts/check-sentences.mjs).
// FICTIONAL ONLY: invented people and invented answers. Never add a real name or fact here
// (CLAUDE.md, "Real data stays off git"; scripts/check-no-real-data.mjs checks).
//
// Each answer is either typical (what the question asks for, tidily typed: the 16-word limit and the
// reading-level check apply) or a stress answer (what people really type: their own pronoun, the
// question's own opening, a capital, a bare noun, a list, a long memory). Every check except the word
// limit and reading level applies to both.

/** [answer, typical] for every kind of fact. */
export const ANSWERS = {
  memory: [['loves to bake banana bread', true], ['grows tomatoes every summer', true], ['Loves to bake bread', false], ['She loves to bake bread', false], ['They love card games', false], ['turned 80 this year', true], ['always laughs at bad jokes?', false], ['loves cats, dogs and birds', true], ['tells the same story about the war every single summer when the whole family gathers at the lake house', false]],
  work: [['a nurse', true], ['nurse', false], ['an engineer', true], ['engineer', false], ['teaches math at the high school', false], ['retired', true], ['a nurse at Mercy Hospital', true]],
  pastwork: [['a teacher', true], ['teacher', false], ['taught school for 30 years', false], ['an air traffic controller', true], ['owner of a bakery', false]],
  field: [['health care', true], ['the trades', true], ['teaching', true]],
  workplace: [['Mercy Hospital', true], ['the post office', true], ['Lincoln High School and Ohio State', true]],
  plans: [['going to become a nurse', true], ['retire next year', false], ['moving to Florida', true], ['planning to travel', true]],
  interest: [['gardening', true], ['card games', true], ['to paint', false], ['knit', false], ['gardening, cooking and reading', true], ['Golf', false]],
  team: [['the Otters', true], ['Otters', false], ['the Riverton Otters and the Bears', true]],
  show: [['Jeopardy', true], ['game shows', true]],
  movie: [['Casablanca', true], ['The Wizard of Oz', true], ['old westerns', false]],
  food: [['lasagna', true], ['tacos', true], ['apple pie and ice cream', true]],
  music: [['the Beatles', true], ['jazz', true], ['Elvis', true]],
  place: [['the lake', true], ['Paris', true], ['going to the beach', false]],
  habit: [['hums in the kitchen', true], ['hum in the kitchen', false], ['They always say its not that easy', false], ['says "it is not that easy"', true], ['always hums', false], ['late', false], ['She says hello to everyone', false], ['makes pancakes on Sundays', true]],
  shared: [['got lost in Rome', true], ['A time we had to go into this arena and fight each other', false], ['we went to Paris', false], ['went fishing every summer.', true], ['A time our car came to life and we had to save the world', false], ['The time we got lost', false], ['June and I baked a cake', false]],
  regular: [['went for ice cream', true], ['go to the diner', true], ['The place we always went was the diner', false], ['always went to the park', false], ['We went to the movies', false]],
  holiday: [['at the lake', true], ['spent a week in Maine', true], ['went to Florida', true], ['Christmas at Grandma’s', false], ['A holiday we spent in Maine', false], ['spent at the lake', false]],
  met: [['at church in 1962', true], ['in college', true], ['We met at church', false], ['when we were 5', true], ['through friends', true]],
  birthday: [['March 3', true], ['3/14', true], ['in March', false], ['the 4th of July', true]],
  nickname: [['Junie', true], ['"Bud"', true], ['J.J.', true]],
  calls: [['Nana', true], ['grandma', false], ['Aunt Bea', true]],
  known: [['all our lives', true], ['since 1962', true], ['for 50 years', true], ['50 years', false], ['since we were children', true]],
  home: [['Ohio', true], ['in Ohio', false], ['the house next door', true], ['Paris, France', true]],
  lives_with: [['two roommates', true], ['her husband', true], ['Sam and the kids', true]],
  partner: [['Sam', true], ['Sam and Alex', false]],
  child: [['Noah', true], ['Noah and Ava', false], ['Noah, Ava and Liam', false], ['two daughters', true]],
  pet: [['a dog named Rex', true], ['Rex', false], ['dog', false], ['two cats', true], ['an old cat', true]],
  marital: [['married', true], ['widowed', true]],
  situation: [['expecting a baby', true], ['a new grandparent', true]],
};

/** As typed into the relationship picker or its own words. */
export const RELATIONSHIPS = ['friend', 'aunt', 'Grandma', 'older sister', 'step-dad', 'the neighbor', 'an aunt', 'mom and best friend', undefined];

/** Names that test possessives, apostrophes, hyphens and titles. */
export const NAMES = ['June', 'Leo', 'Charles', "D'Andre", 'Mary-Kate', 'Grandma Rose', 'Ruth', 'Omar', 'Mae'];

/** Card ids that pick different wording variants (the choice is a stable hash of the id). */
export const CARD_IDS = ['sample-june-0', 'sample-leo-1', 'card-a', 'card-b', 'card-c', 'f3b1c2d4-0000-4000-8000-000000000001'];

/** The optional parts of a sentence: none, a memory's year, a may-change fact's month. */
export const LEADS = [{}, { year: 2002 }, { timeSensitive: true, asOf: '2026-05-01' }];
