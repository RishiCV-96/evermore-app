import type { FactType } from '@/lib/stories';

// Every question of the guided profile, in one place: the sections, what each question asks,
// how it is answered, the kind of fact the answer becomes, and its limits. The caregiver's form
// (src/components/questionnaire.tsx) is built from this, and a relatives' form can reuse it:
// see relativeSections below. Only data and small lookups, so it can be checked in plain Node.

/**
 * For display only: an all-lowercase picker or chip value gets a capital first letter. Anything
 * typed with a capital is left exactly as it is (McDonald, DeShawn), and what is saved never
 * changes, because the value finishes a sentence.
 */
export function displayValue(value: string) {
  if (!value || value !== value.toLowerCase()) return value;
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

/** Options whose label is their saved value, in the app's sentence case. */
const choices = (values: string[]) => values.map((value) => ({ label: displayValue(value), value }));

export type Option = {
  /** What the form shows. */
  label: string;
  /** What is saved, worded to fit the fact's sentence. */
  value: string;
  /** A line under the label, saying what the choice means. */
  hint?: string;
};

export type QuestionInput =
  | 'text' // one short field
  | 'list' // several short fields
  | 'choice' // one of a few, as chips
  | 'picker' // one of many, in a list that opens
  | 'chips' // any number of chips, plus their own words
  | 'memory' // a short field with an optional year and photo
  | 'photo' // the person's photo
  | 'hint-facts'; // the person's facts, to choose which can be hints

export type Question = {
  /** The fact type, for a question that becomes a fact. */
  id: string;
  label: string;
  /** A shorter name for it, on story approval. */
  short?: string;
  input: QuestionInput;
  /** The kind of fact each answer becomes. Left out for answers that set something else. */
  factType?: FactType;
  /** For the few answers that are not ordinary facts: they go on the person, or are step 1's one fact. */
  sets?: 'name' | 'photo' | 'relationship' | 'bestClue' | 'firstFact';
  /** An example, written as it would be typed: it finishes a sentence. */
  placeholder?: string;
  /** A name or a place: the keyboard capitalizes each word. Other answers finish a sentence, so it doesn't. */
  properName?: boolean;
  /** How the words are used, with NAME for the person's name. */
  frame?: string;
  /** The most letters in one answer. */
  limit?: number;
  options?: Option[];
  /** A picker also takes the caregiver's own words. */
  other?: boolean;
  /** How many answers a list or chips question takes, and what adds another. */
  most?: number;
  more?: string;
  /**
   * "always": a fact that can stop being true: always dated, and it waits for the caregiver to
   * confirm it. "may": the caregiver can mark it "This may change".
   */
  changes?: 'always' | 'may';
  /** Offers "This may change" on the form. Others of the kind are marked on story approval. */
  asksChanges?: boolean;
  /** Only the caregiver answers this, never a relative. */
  caregiverOnly?: boolean;
  /** Starts another card of related questions, with this small heading. Otherwise a step is one card. */
  heading?: string;
  /** Waits behind a quiet button with this label until it's wanted, or already answered. */
  behind?: string;
  /** A short answer that may sit beside the next one, two to a row, where the screen has the room. */
  sideBySide?: boolean;
  /** Needed for a complete profile. Each required question counts the same toward the percent. */
  required?: boolean;
  /** A required question that can honestly have no answer, so it offers "Not applicable". */
  mayNotApply?: boolean;
  /** How the review step names a required question that has no answer. */
  missing?: string;
  /** Other kinds of fact that answer a required question just as well. */
  alsoAnsweredBy?: FactType[];
  /** Not used as a hint unless the caregiver says so. */
  hintOff?: boolean;
};

export type Section = {
  /** Its place in the form, from 0: what `profile_step` stores. The caregiver sees the step that shows it (PAGES). */
  step: number;
  /** Short: one idea per step. */
  title: string;
  /** One line under the title, saying what the step is for. A full sentence. */
  helper: string;
  /** A relative may answer this section's questions, apart from caregiverOnly ones. */
  relativeSafe: boolean;
  questions: Question[];
};

/** The row that opens a card's less-asked questions. Anything answered behind it is always shown. */
export const MORE = 'More details';

const SHORT = 40;
const PHRASE = 60;
const MEMORY = 80;

export const SECTIONS: Section[] = [
  {
    step: 0,
    title: 'Who they are',
    helper: 'Their name, a photo, and how they’re related.',
    relativeSafe: false,
    questions: [
      { id: 'name', label: 'Name', input: 'text', sets: 'name', limit: 60, required: true, missing: 'Their name' },
      { id: 'photo', label: 'Photo', input: 'photo', sets: 'photo', required: true, mayNotApply: true, missing: 'A photo' },
      {
        id: 'relationship',
        label: 'Relationship',
        input: 'picker',
        sets: 'relationship',
        required: true,
        mayNotApply: true,
        missing: 'Their relationship',
        other: true,
        limit: SHORT,
        placeholder: 'older sister',
        options: choices(['mom', 'dad', 'wife', 'husband', 'partner', 'daughter', 'son', 'sister', 'brother', 'grandchild', 'friend', 'neighbor']),
      },
      {
        id: 'first-fact',
        label: 'One thing about them',
        input: 'text',
        sets: 'firstFact',
        factType: 'memory',
        placeholder: 'loves to bake banana bread',
        limit: MEMORY,
      },
    ],
  },
  {
    step: 1,
    title: 'Names and dates',
    helper: 'Nicknames, a birthday, and how far back they go.',
    relativeSafe: false,
    questions: [
      {
        id: 'nickname',
        behind: MORE,
        properName: true,
        label: 'Goes by',
        short: 'Nickname',
        input: 'text',
        factType: 'nickname',
        placeholder: 'Junie',
        frame: 'NAME goes by …',
        limit: SHORT,
      },
      {
        id: 'calls',
        behind: MORE,
        properName: true,
        label: 'What the person calls them',
        short: 'What they’re called',
        input: 'text',
        factType: 'calls',
        placeholder: 'Nana',
        frame: 'I call NAME …',
        limit: SHORT,
      },
      {
        id: 'known',
        behind: MORE,
        label: 'Known each other',
        short: 'Known each other',
        input: 'picker',
        factType: 'known',
        frame: 'NAME and I have known each other …',
        other: true,
        limit: SHORT,
        placeholder: 'since 1962',
        options: [
          { label: 'All their lives', value: 'all our lives' },
          { label: 'Since childhood', value: 'since we were children' },
          { label: 'Since school', value: 'since school' },
          { label: 'Many years', value: 'for many years' },
          { label: 'A few years', value: 'for a few years' },
        ],
      },
      { id: 'birthday', label: 'Birthday', input: 'text', factType: 'birthday', properName: true, placeholder: 'March 3', limit: SHORT, behind: MORE },
    ],
  },
  {
    step: 2,
    title: 'Work and school',
    helper: 'What they do, or used to do.',
    relativeSafe: true,
    questions: [
      {
        id: 'work',
        label: 'Job now',
        short: 'Work',
        input: 'text',
        factType: 'work',
        placeholder: 'a nurse',
        frame: 'NAME is …',
        limit: SHORT,
        changes: 'may',
        asksChanges: true,
      },
      {
        id: 'field',
        behind: MORE,
        label: 'Field',
        input: 'picker',
        factType: 'field',
        frame: 'NAME has worked in …',
        other: true,
        limit: SHORT,
        placeholder: 'the post office',
        options: [
          { label: 'Health care', value: 'health care' },
          { label: 'Teaching', value: 'teaching' },
          { label: 'Business', value: 'business' },
          { label: 'The trades', value: 'the trades' },
          { label: 'Farming', value: 'farming' },
          { label: 'The arts', value: 'the arts' },
          { label: 'Science', value: 'science' },
          { label: 'Government', value: 'government' },
          { label: 'The military', value: 'the military' },
        ],
      },
      {
        id: 'pastwork',
        label: 'Past job',
        input: 'text',
        factType: 'pastwork',
        placeholder: 'a teacher',
        frame: 'NAME worked as …',
        limit: SHORT,
      },
      {
        id: 'workplace',
        behind: MORE,
        properName: true,
        label: 'Employer or school',
        input: 'text',
        factType: 'workplace',
        placeholder: 'Mercy Hospital',
        frame: 'NAME has worked or studied at …',
        limit: SHORT,
      },
      {
        id: 'plans',
        behind: MORE,
        label: 'Future plans',
        input: 'text',
        factType: 'plans',
        placeholder: 'going to become a nurse',
        frame: 'NAME is …',
        limit: PHRASE,
        changes: 'always',
      },
    ],
  },
  {
    step: 3,
    title: 'Family and home',
    helper: 'Where they live, and the people and pets close to them.',
    relativeSafe: true,
    questions: [
      {
        id: 'home',
        properName: true,
        label: 'Lives in',
        input: 'text',
        factType: 'home',
        placeholder: 'Ohio',
        frame: 'NAME lives in …',
        limit: SHORT,
        changes: 'may',
        asksChanges: true,
      },
      {
        id: 'lives_with',
        behind: MORE,
        label: 'Lives with',
        input: 'text',
        factType: 'lives_with',
        placeholder: 'two roommates',
        frame: 'NAME lives with …',
        limit: SHORT,
        changes: 'may',
        asksChanges: true,
      },
      {
        id: 'partner',
        properName: true,
        label: 'Partner',
        input: 'text',
        factType: 'partner',
        placeholder: 'Sam',
        frame: 'NAME has a partner named …',
        limit: SHORT,
        changes: 'may',
        asksChanges: true,
      },
      {
        id: 'child',
        properName: true,
        label: 'Children',
        short: 'Child',
        input: 'list',
        factType: 'child',
        placeholder: 'Noah',
        frame: 'NAME has a child named …',
        limit: SHORT,
        most: 6,
        more: 'Add another child',
      },
      {
        id: 'pet',
        label: 'Pets',
        short: 'Pet',
        input: 'list',
        factType: 'pet',
        placeholder: 'a dog named Rex',
        frame: 'NAME has …',
        limit: SHORT,
        most: 4,
        more: 'Add another pet',
      },
      {
        id: 'marital',
        label: 'Marital status',
        input: 'choice',
        factType: 'marital',
        frame: 'NAME is …',
        limit: SHORT,
        options: choices(['married', 'engaged', 'single', 'divorced', 'widowed']),
        changes: 'always',
        caregiverOnly: true,
        hintOff: true,
        behind: MORE,
      },
      {
        id: 'situation',
        label: 'Family situation',
        input: 'text',
        factType: 'situation',
        placeholder: 'expecting a baby',
        frame: 'NAME is …',
        limit: PHRASE,
        changes: 'always',
        caregiverOnly: true,
        hintOff: true,
        behind: MORE,
      },
    ],
  },
  {
    step: 4,
    title: 'Interests',
    helper: 'What they enjoy. A favorite counts as an interest.',
    relativeSafe: true,
    questions: [
      {
        id: 'interest',
        label: 'Hobbies',
        short: 'Hobby',
        input: 'chips',
        factType: 'interest',
        required: true,
        mayNotApply: true,
        missing: 'One interest',
        // A favorite is an interest too.
        alsoAnsweredBy: ['team', 'show', 'movie', 'music', 'food', 'place'],
        frame: 'NAME enjoys …',
        placeholder: 'birdwatching',
        limit: SHORT,
        most: 8,
        more: 'Add a hobby',
        changes: 'may',
        options: choices(['gardening', 'cooking', 'reading', 'fishing', 'golf', 'knitting', 'walking', 'crosswords', 'card games']),
      },
      {
        id: 'habit',
        // The label is the sentence being finished (2026-11-18, docs/SENTENCE-AUDIT.md): "They always say or
        // do" led people to type "They always say …". NAME is the person's name (labelOf).
        label: 'NAME always…',
        short: 'Always says or does',
        input: 'text',
        factType: 'habit',
        placeholder: 'hums in the kitchen',
        frame: 'NAME always …',
        limit: PHRASE,
      },
      {
        id: 'team',
        sideBySide: true,
        properName: true,
        heading: 'Favorites',
        label: 'Team',
        short: 'Favorite team',
        input: 'text',
        factType: 'team',
        placeholder: 'the Otters',
        limit: SHORT,
        changes: 'may',
      },
      {
        id: 'show',
        sideBySide: true,
        properName: true,
        label: 'Show',
        short: 'Favorite show',
        input: 'text',
        factType: 'show',
        placeholder: 'Jeopardy',
        limit: SHORT,
        changes: 'may',
      },
      {
        id: 'movie',
        sideBySide: true,
        properName: true,
        label: 'Movie',
        short: 'Favorite movie',
        input: 'text',
        factType: 'movie',
        placeholder: 'Casablanca',
        limit: SHORT,
        changes: 'may',
      },
      {
        id: 'music',
        sideBySide: true,
        properName: true,
        label: 'Music',
        short: 'Favorite music',
        input: 'text',
        factType: 'music',
        placeholder: 'the Beatles',
        limit: SHORT,
        changes: 'may',
      },
      {
        id: 'food',
        sideBySide: true,
        label: 'Food',
        short: 'Favorite food',
        input: 'text',
        factType: 'food',
        placeholder: 'lasagna',
        limit: SHORT,
        changes: 'may',
      },
      {
        id: 'place',
        sideBySide: true,
        properName: true,
        label: 'Place',
        short: 'Favorite place',
        input: 'text',
        factType: 'place',
        placeholder: 'the lake',
        limit: SHORT,
        changes: 'may',
      },
    ],
  },
  {
    step: 5,
    title: 'Shared memories',
    helper: 'In the words of the person practicing.',
    relativeSafe: true,
    questions: [
      {
        id: 'shared',
        label: 'NAME and I once…',
        short: 'Shared memory',
        input: 'memory',
        factType: 'shared',
        required: true,
        mayNotApply: true,
        missing: 'One shared memory',
        // Any of them is a shared memory.
        alsoAnsweredBy: ['regular', 'holiday', 'met'],
        placeholder: 'got lost in Rome',
        frame: 'NAME and I once …',
        limit: MEMORY,
      },
      {
        id: 'regular',
        behind: MORE,
        label: 'NAME and I always…',
        short: 'A place we went',
        input: 'memory',
        factType: 'regular',
        placeholder: 'went for ice cream',
        frame: 'NAME and I always …',
        limit: MEMORY,
      },
      {
        id: 'holiday',
        behind: MORE,
        label: 'NAME and I spent a holiday…',
        short: 'A holiday',
        input: 'memory',
        factType: 'holiday',
        placeholder: 'at the lake',
        frame: 'NAME and I spent a holiday …',
        limit: MEMORY,
      },
      {
        id: 'met',
        label: 'NAME and I met…',
        short: 'How we met',
        input: 'text',
        factType: 'met',
        placeholder: 'at church in 1962',
        frame: 'NAME and I met …',
        limit: MEMORY,
      },
      {
        id: 'memory',
        label: 'Anything else',
        short: 'About them',
        input: 'list',
        factType: 'memory',
        placeholder: 'loves to bake bread',
        frame: 'NAME …',
        limit: MEMORY,
        most: 3,
        more: 'Add something else',
        changes: 'may',
        behind: MORE,
      },
    ],
  },
  {
    step: 6,
    title: 'Hints and recognition',
    helper: 'What helps the person practicing know who this is.',
    relativeSafe: false,
    questions: [
      {
        id: 'best-clue',
        label: 'Best clue to who this is',
        input: 'choice',
        sets: 'bestClue',
        options: [
          { label: 'Voice', value: 'voice' },
          { label: 'Laugh', value: 'laugh' },
          { label: 'Job', value: 'job' },
          { label: 'Hobby', value: 'hobby' },
          { label: 'Where we met', value: 'met' },
        ],
      },
      { id: 'hint-facts', label: 'Facts to use as hints', input: 'hint-facts' },
    ],
  },
  { step: 7, title: 'Review', helper: 'Each answer becomes a sentence you approve before it reaches practice.', relativeSafe: false, questions: [] },
];

/** The step that ends the form. */
export const REVIEW_STEP = SECTIONS[SECTIONS.length - 1].step;

/**
 * The form's five steps (since 2026-11-17, docs/UI-POLISH-PLAN.md). A step shows one or two sections.
 * What is stored never changed: `profile_step` is still the furthest *section* reached (0 to 7), so a
 * draft saved by any version opens on the step that holds its section, and reaching a step stores its
 * first section, a value every version understands. `headed` gives each section its own card, titled.
 */
export type Page = { title: string; helper: string; sections: number[]; headed?: boolean };

export const PAGES: Page[] = [
  { title: 'Who they are', helper: 'Their name, a photo, and how they’re related.', sections: [0, 1] },
  { title: 'Work and home', helper: 'What they do, where they live, and who is close to them.', sections: [2, 3], headed: true },
  { title: 'Interests', helper: 'What they enjoy. A favorite counts as an interest.', sections: [4] },
  { title: 'Memories and hints', helper: 'Times you shared, as the person practicing tells them.', sections: [5, 6], headed: true },
  { title: 'Review', helper: 'Each answer becomes a sentence you approve before it reaches practice.', sections: [7] },
];

/** The step that ends the form. */
export const REVIEW_PAGE = PAGES.length - 1;

/** The step that shows a stored section. Anything outside 0 to 7, or not a number, is brought into it. */
export function pageOf(section: number) {
  const clamped = Number.isFinite(section) ? Math.min(Math.max(Math.trunc(section), 0), REVIEW_STEP) : 0;
  return PAGES.findIndex((page) => page.sections.includes(clamped));
}

/** What reaching a step stores: its first section. */
export const firstSectionOf = (page: number) => PAGES[Math.min(Math.max(page, 0), REVIEW_PAGE)].sections[0];

/** A step's questions as one section to render: its sections' questions in order, each section's first titled when `headed`. */
export function pageSection(page: number): Section {
  const shown = PAGES[page];
  const parts = shown.sections.map((step) => SECTIONS.find((section) => section.step === step)!);
  return {
    step: shown.sections[0],
    title: shown.title,
    helper: shown.helper,
    relativeSafe: false,
    questions: parts.flatMap((section) =>
      section.questions.map((question, index) => (shown.headed && index === 0 ? { ...question, heading: section.title } : question)),
    ),
  };
}

/** "Step 3 of 5": steps are counted from 1 for the caregiver, Review included. */
export const stepLabel = (page: number) => `Step ${page + 1} of ${PAGES.length}`;

/** In full on the first step; behind a small "Facts only" link on the others. */
export const FACTS_ONLY = 'Facts only, please: nothing medical, financial or private.';

/** Whether a step asks anything required, so it shows the "* Required" legend. */
export const hasRequired = (section: Section) => section.questions.some((question) => question.required);

/**
 * How "X% complete" is made (src/lib/profile.ts). Each required question done is an equal share of
 * 100. Each optional question answered adds `optionalEach`, at most `optionalMost` in all, and only
 * while something required is still missing: so 100% means every required question is done, which
 * is what the 100% gate needs, and nothing else can reach it. `optionalMost` stays under one
 * required share.
 */
export const COMPLETION = { optionalEach: 3, optionalMost: 15 };

/** Optional questions that count toward the percent: every one that takes an answer, not the list of hint facts. */
export const countsAsOptional = (question: Question) => !question.required && question.input !== 'hint-facts';

/** After a required question's label, and in the legend at the top of each step. */
export const REQUIRED_MARK = '*';
export const REQUIRED_LEGEND = 'Required';

/** Marks a required question with no honest answer. It counts as done and creates no fact. */
export const NOT_APPLICABLE = 'Not applicable';

/** Under a required question left empty, once it has been touched. */
export const STILL_NEEDED = `Please add one, or choose ${NOT_APPLICABLE}.`;

/**
 * Only required questions need a way out, so nobody invents a fact to reach 100%. An optional
 * question can simply stay empty, and a person always has a name.
 */
export function canNotApply(question: Question) {
  return Boolean(question.required && question.mayNotApply);
}

const QUESTIONS = SECTIONS.flatMap((section) => section.questions);

/** The question a kind of fact comes from. Every kind has exactly one. */
export function questionFor(type: FactType) {
  return QUESTIONS.find((question) => question.factType === type && !question.sets)!;
}

/**
 * A question's label as the form shows it. Labels that are the start of the sentence being finished
 * hold NAME: the person's first name ("June and I once…"), or "This person" before a name is typed or
 * when the first name is long. The label line is one line, so a long name would hide the words that matter.
 */
export function labelOf(question: Pick<Question, 'label'>, name: string) {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return question.label.replace('NAME', first && first.length <= LABEL_NAME_MOST ? first : 'This person');
}

/** The longest first name a label holds before it says "This person" (checked at 375 points wide). */
export const LABEL_NAME_MOST = 12;

/** A placeholder can't be mistaken for an answer already given. */
export const exampleOf = (question: Question) => (question.placeholder ? `e.g. ${question.placeholder}` : undefined);

/** The line that shows how a fact's words are used, and an example. */
export function factHelp(type: FactType, name: string) {
  const { frame, placeholder } = questionFor(type);
  const who = name.trim() || 'They';
  const example = placeholder ? `For example: ${placeholder}` : '';
  return frame ? `Finishes “${frame.replace('NAME', who)}”. ${example}`.trim() : example;
}

/** A step's questions as they sit together on the form. */
export function questionGroups(questions: Question[]) {
  return questions.reduce<Question[][]>((groups, question, index) => {
    if (index === 0 || question.heading) groups.push([]);
    groups[groups.length - 1].push(question);
    return groups;
  }, []);
}

/** What a relative may be asked, for the next release's form: never the caregiver-only questions. */
export function relativeSections() {
  return SECTIONS.filter((section) => section.relativeSafe).map((section) => ({
    ...section,
    questions: section.questions.filter((question) => !question.caregiverOnly),
  }));
}
