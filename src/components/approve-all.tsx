import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { FormCell, FormGroup, QuietLink, Row, TestTag } from '@/components/caregiver-ui';
import type { SavedPerson } from '@/data/family-store';
import { questionFor } from '@/data/questionnaire';
import { BLANK_TOKEN, NAME_TOKEN } from '@/lib/ai-check';
import type { AiSentence } from '@/lib/ai-sentences';
import { HELD_WORDS, listOpened, planSize, waitingCount, type ApprovalPlan, type HeldReason } from '@/lib/approve-all';
import type { SavedCard } from '@/lib/facts';
import { BLANK, sentenceFor } from '@/lib/stories';
import { useAccent } from '@/theme/accent';
import { Space } from '@/theme/layout';

// Approve all on a person's sheet, for the caregiver only: the approvals area, the list of everything
// waiting (which must be opened once in a session before Approve all is offered), and the short
// confirmation. The rules are in src/lib/approve-all.ts.

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** On the main sheet: what is waiting, and, once that list has been opened this session, Approve all. */
export function ApprovalsArea({ personId, plan, onOpenList, onApproveAll }: { personId: string; plan: ApprovalPlan; onOpenList: () => void; onApproveAll: () => void }) {
  const waiting = waitingCount(plan);
  if (waiting === 0) return null;
  return (
    <View style={styles.area}>
      <View>
        <Row testID="waiting-list" label="Waiting for approval" value={String(waiting)} onPress={onOpenList} />
      </View>
      {listOpened(personId) && planSize(plan) > 0 ? <BigButton testID="approve-all-person" small label={`Approve all ${planSize(plan)}`} onPress={onApproveAll} /> : null}
    </View>
  );
}

const storyText = (person: SavedPerson, card: SavedCard) => sentenceFor(person, card).split(BLANK).join('______');
const questionText = (person: SavedPerson, sentence: AiSentence) => sentence.text.replace(NAME_TOKEN, person.name).replace(BLANK_TOKEN, '______');

function StoryItem({ person, card, reason }: { person: SavedPerson; card: SavedCard; reason?: HeldReason }) {
  const accent = useAccent();
  const question = questionFor(card.type);
  return (
    <FormCell>
      <View testID={reason ? 'held-item' : 'ready-item'} style={styles.item}>
        <AppText>{storyText(person, card)}</AppText>
        <View style={styles.meta}>
          <AppText size="caption" muted>
            {`Story · ${question.short ?? question.label}`}
          </AppText>
          {card.testData ? <TestTag /> : null}
        </View>
        {reason ? (
          <AppText size="caption" color={accent}>
            {HELD_WORDS[reason]}
          </AppText>
        ) : null}
      </View>
    </FormCell>
  );
}

function QuestionItem({ person, sentence, reason }: { person: SavedPerson; sentence: AiSentence; reason?: HeldReason }) {
  const accent = useAccent();
  return (
    <FormCell>
      <View testID={reason ? 'held-item' : 'ready-item'} style={styles.item}>
        <AppText>{questionText(person, sentence)}</AppText>
        {/* The facts it came from, as in the queue. */}
        <View>
          <AppText size="caption" muted>
            New question, from:
          </AppText>
          {sentence.facts.map((fact) => (
            <AppText key={fact.id} size="caption" muted>
              {questionFor(fact.type).short ?? questionFor(fact.type).label}: {fact.text}
            </AppText>
          ))}
        </View>
        {reason ? (
          <AppText size="caption" color={accent}>
            {HELD_WORDS[reason]}
          </AppText>
        ) : null}
      </View>
    </FormCell>
  );
}

/** Everything Approve all would approve, as practice will show it. */
function ReadyItems({ person, plan }: { person: SavedPerson; plan: ApprovalPlan }) {
  return (
    <>
      {plan.stories.length ? (
        <FormGroup heading={count(plan.stories.length, 'story', 'stories')}>
          {plan.stories.map((card) => (
            <StoryItem key={card.id} person={person} card={card} />
          ))}
        </FormGroup>
      ) : null}
      {plan.questions.length ? (
        <FormGroup heading={count(plan.questions.length, 'new question', 'new questions')}>
          {plan.questions.map((sentence) => (
            <QuestionItem key={sentence.id} person={person} sentence={sentence} />
          ))}
        </FormGroup>
      ) : null}
    </>
  );
}

function HeldItems({ person, plan }: { person: SavedPerson; plan: ApprovalPlan }) {
  if (plan.held.length === 0) return null;
  return (
    <FormGroup heading={`${count(plan.held.length, 'needs', 'need')} your confirmation`}>
      {plan.held.map((one) =>
        one.kind === 'story' ? (
          <StoryItem key={one.card.id} person={person} card={one.card} reason={one.reason} />
        ) : (
          <QuestionItem key={one.sentence.id} person={person} sentence={one.sentence} reason={one.reason} />
        ),
      )}
    </FormGroup>
  );
}

/** The list of everything waiting for this person. Opening it is what makes Approve all available. */
export function WaitingList({ person, plan, onApproveAll, onReview, onBack }: { person: SavedPerson; plan: ApprovalPlan; onApproveAll: () => void; onReview: () => void; onBack: () => void }) {
  return (
    <>
      <AppText size="caption" muted>
        Nothing here reaches practice until it is approved. Approve all approves what is ready; anything that needs your confirmation stays here for you.
      </AppText>
      {planSize(plan) > 0 ? <BigButton testID="approve-all-list" small primary label={`Approve all ${planSize(plan)}`} onPress={onApproveAll} /> : null}
      <ReadyItems person={person} plan={plan} />
      <HeldItems person={person} plan={plan} />
      {waitingCount(plan) === 0 ? <AppText muted>Nothing is waiting.</AppText> : null}
      <BigButton testID="open-review" quiet label="Open story approval" onPress={onReview} />
      <BigButton testID="waiting-back" quiet label="Back" onPress={onBack} />
    </>
  );
}

/** The short confirmation: how many of each kind, the items themselves a tap away, and what stays. */
export function ApproveConfirm({ person, plan, draft, onConfirm, onCancel }: { person: SavedPerson; plan: ApprovalPlan; draft: boolean; onConfirm: () => void; onCancel: () => void }) {
  const [shown, setShown] = useState(false);
  const kinds = [plan.stories.length ? count(plan.stories.length, 'story', 'stories') : '', plan.questions.length ? count(plan.questions.length, 'new question', 'new questions') : ''].filter(Boolean);
  return (
    <>
      <View testID="approve-confirm" style={styles.counts}>
        <AppText>{`This approves ${planSize(plan)} for ${person.name}:`}</AppText>
        {kinds.map((line) => (
          <AppText key={line} bold>
            {line}
          </AppText>
        ))}
      </View>
      {plan.held.length ? (
        <AppText size="caption" muted>
          {`${count(plan.held.length, 'item needs', 'items need')} your confirmation and will stay waiting.`}
        </AppText>
      ) : null}
      {draft ? (
        <AppText size="caption" muted>
          {`They will reach practice once ${person.name}’s profile is complete.`}
        </AppText>
      ) : null}
      <View style={styles.link}>
        <QuietLink testID="confirm-show" label={shown ? 'Hide them' : 'Show them'} expanded={shown} onPress={() => setShown(!shown)} />
      </View>
      {shown ? <ReadyItems person={person} plan={plan} /> : null}
      <BigButton testID="confirm-approve" primary label={`Approve ${planSize(plan)}`} onPress={onConfirm} />
      <BigButton testID="confirm-cancel" quiet label="Cancel" onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  area: {
    gap: Space.s,
  },
  item: {
    gap: Space.xs,
    paddingVertical: Space.s,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  counts: {
    gap: Space.xs,
  },
  link: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
});
