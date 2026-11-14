import { useNetInfo } from '@react-native-community/netinfo';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Field, FormCell, FormGroup, Notice, Row } from '@/components/caregiver-ui';
import { agreeToAi, approveAiSentence, approveAllSentences, editAiSentence, generateQuestions, rejectAiSentence } from '@/data/app-data';
import type { AiFailure } from '@/data/ai-client';
import type { FamilyAi, SavedCard, SavedPerson } from '@/data/family-store';
import { questionFor } from '@/data/questionnaire';
import { BLANK_TOKEN, NAME_TOKEN } from '@/lib/ai-check';
import { sendableFacts } from '@/lib/ai-request';
import { queueOf, queueRoom, type AiSentence } from '@/lib/ai-sentences';
import { Colors } from '@/theme/colors';
import { Space } from '@/theme/layout';

// AI questions on the person's sheet: the Generate action, the one-time consent, and the queue
// where the caregiver approves, edits or rejects every sentence. Nothing reaches the person
// from here without an approval. The rules are in src/lib/ai-sentences.ts.

export type AiView = 'person' | 'consent' | 'queue';

export const AI_TITLES: Record<Exclude<AiView, 'person'>, string> = { consent: 'Before you generate', queue: 'New questions' };

const FAILURES: Record<AiFailure, string> = {
  offline: 'New questions need the internet. Please try again when you’re connected.',
  rate_limited_hour: 'That’s enough for this hour. Please try again later.',
  rate_limited_day: 'That’s enough for today. Please try again tomorrow.',
  busy: 'New questions are resting for today. Please try again tomorrow.',
  disabled: 'New questions are turned off for now.',
  unavailable: 'New questions couldn’t be written just now. Please try again.',
};

/** Why an edit wasn't accepted, in plain words. */
function whyNot(reason: string) {
  if (reason === 'new-word' || reason === 'new-name' || reason === 'new-number') return 'That uses a word that isn’t in the facts. Please keep to the facts’ own words.';
  if (reason === 'dropped-fact') return 'Please keep every word of the fact, so it still says the same thing.';
  if (reason === 'answer-leak') return 'The answer has to stay out of the sentence.';
  if (reason === 'blank') return `Please keep one ${BLANK_TOKEN} where the answer goes.`;
  if (reason === 'unknown-fact') return 'A fact it used has changed, so it can’t be approved as it is.';
  return 'That doesn’t fit. It needs to be one short sentence from the facts.';
}

export function useGenerate(personId?: string) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function run() {
    if (!personId) return;
    setBusy(true);
    setNotice(undefined);
    const result = await generateQuestions(personId).catch(() => ({ error: 'unavailable' as const }));
    setBusy(false);
    if ('error' in result) setNotice(FAILURES[result.error]);
    else setNotice(result.added === 0 ? 'No new questions passed the checks this time. Please try again.' : undefined);
  }

  return { busy, notice, run };
}

type AiSectionProps = {
  person: SavedPerson;
  /** This person's facts. */
  cards: SavedCard[];
  ai: FamilyAi;
  generate: ReturnType<typeof useGenerate>;
  onConsent: () => void;
  onQueue: () => void;
};

/** Why Generate isn't offered, calmly, or nothing if it is. */
function heldBack(person: SavedPerson, cards: SavedCard[], ai: FamilyAi, offline: boolean) {
  if (person.aiHeldBack) return 'These facts stay on this phone.';
  if (!ai.on) return 'AI questions are off in Settings.';
  if (person.aiOk === false) return `AI questions are off for ${person.name}.`;
  if (offline) return 'New questions need the internet. Practice works as usual.';
  if (sendableFacts(cards).length === 0) return 'New questions are written from approved facts, so approve a story first.';
  if (queueRoom(ai.sentences, person.id) === 0) return 'Please review the new questions first.';
  return undefined;
}

/** On the person's sheet, for a complete profile. */
export function AiSection({ person, cards, ai, generate, onConsent, onQueue }: AiSectionProps) {
  const offline = useNetInfo().isConnected === false;
  const waiting = queueOf(ai.sentences, person.id).length;
  const note = heldBack(person, cards, ai, offline);

  return (
    <View testID="ai-section" style={styles.section}>
      <AppText accessibilityRole="header" fit bold>
        New questions
      </AppText>
      {note ? (
        <AppText testID="ai-note" size="caption" muted>
          {note}
        </AppText>
      ) : (
        <BigButton
          testID="generate"
          small
          label={generate.busy ? 'Writing new questions…' : 'Generate new questions'}
          disabled={generate.busy}
          onPress={() => (ai.consented ? generate.run() : onConsent())}
        />
      )}
      {generate.notice ? <Notice>{generate.notice}</Notice> : null}
      {waiting ? (
        <View>
          <Row testID="ai-queue" label="To review" value={String(waiting)} onPress={onQueue} />
        </View>
      ) : null}
    </View>
  );
}

/** The one-time consent, before anything is sent. */
export function AiConsent({ onAgree, onDecline }: { onAgree: () => void; onDecline: () => void }) {
  return (
    <>
      {/* In step with "AI questions" in the privacy policy (src/lib/privacy-policy.ts). */}
      <AppText>To write new sentences, this person’s approved facts are sent as text to an AI service, Anthropic.</AppText>
      <AppText size="caption" muted>
        Their name and any other names are replaced first. Photos are never sent, and neither are facts that may change, such as a job.
      </AppText>
      <AppText size="caption" muted>
        Evermore keeps none of it. Anthropic may keep it for a short time under its own terms, and says it doesn’t use it to train its models.
      </AppText>
      <AppText size="caption" muted>
        You approve every sentence before it reaches practice. You can turn this off, or take back this agreement, in Settings at any time, or turn it off for one person on their sheet.
      </AppText>
      <BigButton
        testID="ai-agree"
        primary
        label="Agree and generate"
        onPress={() => {
          agreeToAi();
          onAgree();
        }}
      />
      <BigButton testID="ai-decline" quiet label="Not now" onPress={onDecline} />
    </>
  );
}

type AiQueueProps = {
  person: SavedPerson;
  sentences: AiSentence[];
  onBack: () => void;
};

/** Every sentence waiting for this person, each with the facts it came from. */
export function AiQueue({ person, sentences, onBack }: AiQueueProps) {
  const waiting = queueOf(sentences, person.id);

  return (
    <>
      <AppText size="caption" muted>
        Nothing here reaches practice until you approve it. Each one shows the facts it came from.
      </AppText>
      {waiting.length > 1 ? <BigButton testID="approve-all" small primary label="Approve all valid" onPress={() => approveAllSentences(person.id)} /> : null}
      {waiting.map((sentence) => (
        <QueueItem key={sentence.id} sentence={sentence} name={person.name} />
      ))}
      {waiting.length === 0 ? <AppText muted>Nothing to review.</AppText> : null}
      <BigButton testID="ai-back" quiet label="Back" onPress={onBack} />
    </>
  );
}

const shownText = (sentence: AiSentence, name: string) => sentence.text.replace(NAME_TOKEN, name);

function QueueItem({ sentence, name }: { sentence: AiSentence; name: string }) {
  const [draft, setDraft] = useState<string>();
  const [notice, setNotice] = useState<string>();

  function approve() {
    const reason = approveAiSentence(sentence.id);
    setNotice(reason ? whyNot(reason) : undefined);
  }

  function saveEdit() {
    const reason = editAiSentence(sentence.id, draft ?? '');
    setNotice(reason ? whyNot(reason) : undefined);
    if (!reason) setDraft(undefined);
  }

  return (
    <FormGroup>
      <FormCell>
        <View testID={`sentence-${sentence.shape}`} style={styles.item}>
          {draft === undefined ? (
            <AppText testID="sentence-text">{shownText(sentence, name).replace(BLANK_TOKEN, '______')}</AppText>
          ) : (
            <Field
              testID="sentence-edit"
              label="This sentence"
              value={draft}
              maxLength={160}
              count={false}
              multiline
              numberOfLines={3}
              submitBehavior="blurAndSubmit"
              returnKeyType="done"
              onChangeText={setDraft}
              autoCapitalize="sentences"
            />
          )}
          {sentence.status === 'flagged' ? (
            <AppText testID="sentence-flagged" size="caption" color={Colors.primaryDark}>
              A fact this used has changed, so it’s out of practice until you review it.
            </AppText>
          ) : null}
          <View>
            {sentence.facts.map((fact) => (
              <AppText key={fact.id} size="caption" muted>
                {questionFor(fact.type).short ?? questionFor(fact.type).label}: {fact.text}
              </AppText>
            ))}
          </View>
          {notice ? <Notice>{notice}</Notice> : null}
          {draft === undefined ? (
            <View style={styles.actions}>
              <View style={styles.action}>
                <BigButton testID="sentence-approve" small label="Approve" onPress={approve} />
              </View>
              <View style={styles.action}>
                <BigButton testID="sentence-start-edit" small label="Edit" onPress={() => setDraft(shownText(sentence, name))} />
              </View>
              <View style={styles.action}>
                <BigButton testID="sentence-reject" small label="Reject" onPress={() => rejectAiSentence(sentence.id)} />
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <View style={styles.action}>
                <BigButton testID="sentence-save" small primary label="Save" onPress={saveEdit} />
              </View>
              <View style={styles.action}>
                <BigButton
                  small
                  label="Cancel"
                  onPress={() => {
                    setDraft(undefined);
                    setNotice(undefined);
                  }}
                />
              </View>
            </View>
          )}
        </View>
      </FormCell>
    </FormGroup>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.s,
  },
  item: {
    gap: Space.s,
    paddingVertical: Space.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: Space.s,
  },
  action: {
    flex: 1,
  },
});
