import { NAME_TOKEN, BLANK_TOKEN } from '@/lib/ai-check';
import type { AiSentence } from '@/lib/ai-sentences';
import { BLANK, sentenceFor, type Fact, type Phrasing, type PhrasingKind } from '@/lib/stories';

// Where approved AI sentences join practice. Practice and story approval ask every card through
// the fixed shapes in src/lib/stories.ts, plus whatever this returns, so an approved sentence takes
// its turn in rotation, shows on story approval, and can be turned off like any other way to ask.
// With AI off this returns nothing, and both screens are exactly what they were.

const KINDS: Record<AiSentence['shape'], PhrasingKind> = {
  one_fact: 'blank',
  two_facts: 'blank',
  context: 'blank',
  fact_to_name: 'ask',
  reverse: 'reverse',
};

/** How much each shape gives away, for cue fading (cueLevel in src/lib/stories.ts): two facts are the richest, the reverse card the leanest. */
const CUES: Record<AiSentence['shape'], number> = {
  two_facts: 0,
  one_fact: 1,
  context: 1,
  fact_to_name: 1,
  reverse: 3,
};

/** An approved sentence as a way to ask its card. */
function phrasingOf(sentence: AiSentence, person: { name: string; relationship?: string }, fact: Fact): Phrasing {
  const kind = KINDS[sentence.shape];
  const ask = sentence.text.replace(BLANK_TOKEN, BLANK).replace(NAME_TOKEN, person.name);
  return {
    id: sentence.id,
    kind,
    ask,
    // A question reads back the sentence the caregiver approved for the fact.
    reveal: kind === 'ask' ? sentenceFor(person, fact) : ask,
    factIds: sentence.facts.map((one) => one.id),
    cue: CUES[sentence.shape],
    ...(kind === 'reverse' ? { fill: { answer: fact.text, others: [] } } : {}),
  };
}

/** The approved sentences that join this card: their first fact is the card. */
export function approvedVariants(sentences: AiSentence[], cardId: string, person: { name: string; relationship?: string }, fact: Fact | undefined): Phrasing[] {
  if (!fact) return [];
  return sentences.filter((sentence) => sentence.status === 'approved' && sentence.facts[0]?.id === cardId).map((sentence) => phrasingOf(sentence, person, fact));
}

/** The sentence ids AI wrote, for preferring them when both fit. */
export const isAiPhrasing = (phrasing: Phrasing) => phrasing.id.startsWith('ai-');
