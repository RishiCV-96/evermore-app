import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen, Field, MEMORY_LIMIT, MonthStepper, Notice, TestTag } from '@/components/caregiver-ui';
import { FittedPhoto, hasPhoto, photoSource, type PhotoFields } from '@/components/person-photo';
import { Checkbox } from '@/components/sheet';
import { Toast, type ToastContent } from '@/components/toast';
import { LOCAL_ONLY, approveAll, editCard, setCardStatus, setPhrasingsOff, undoApproveAll, useFamilyView } from '@/data/app-data';
import type { CardStatus, SavedCard, SavedPerson } from '@/data/family-store';
import { factHelp, questionFor } from '@/data/questionnaire';
import { sentencesInUse, type AiSentence } from '@/lib/ai-sentences';
import { approveAllButton, approvedText, storyApproval } from '@/lib/approve-all';
import { monthOf, tidyDraft } from '@/lib/facts';
import { BLANK, PLAIN_MOST_WORDS, asOfLabel, phrasingsFor, sentenceFor, wordCount, type Fact, type PhrasingKind } from '@/lib/stories';
import { approvedVariants } from '@/lib/variants';
import { Colors } from '@/theme/colors';
import { Space } from '@/theme/layout';

const NOT_SAVED = LOCAL_ONLY
  ? 'That change couldn’t be saved. Please try again.'
  : 'That change couldn’t be saved. Please check the internet connection and try again.';

function statusText(card: SavedCard, person: SavedPerson) {
  // A draft's approved stories wait for the profile, as does everything else about them.
  const appears = person.inDeck ? 'It will appear in practice.' : `It will appear once ${person.name} is added to practice.`;
  if (card.status === 'skipped') return 'Skipped. It won’t appear in practice.';
  if (card.timeSensitive) {
    return card.status === 'approved'
      ? `Confirmed for ${asOfLabel(card.asOf!)}. ${appears}`
      : 'This may change, so it waits until you confirm it’s true.';
  }
  return card.status === 'approved' ? `Approved. ${appears}` : 'Not approved yet. It won’t appear in practice.';
}

/** What each kind of phrasing shows the person. */
const KIND_LABELS: Record<PhrasingKind, string> = {
  blank: 'Photo, then fill in the name',
  ask: 'Photo, with a question about them',
  who: 'Photo, with a fact about them',
  photo: 'Photo only',
  reverse: 'Photo and name, then fill in the fact',
};

const back = () => (router.canGoBack() ? router.back() : router.replace('/caregiver'));

// Screen 6: the person's photo as the hero, then each fact's sentence exactly as practice
// will show it. Nothing reaches practice until the caregiver approves it here, and a fact
// that may change only once they confirm it. Approve all, pinned beside Done, approves in one
// tap what one tap each would (storyApproval in src/lib/approve-all.ts), with Undo.
export default function ReviewStories() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const family = useFamilyView();
  const insets = useSafeAreaInsets();
  // Stories open for editing: Approve all leaves them as they are.
  const [editing, setEditing] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastContent & { id: number }>();
  const [approveNotice, setApproveNotice] = useState<string>();
  // The pinned bar's height, so the toast sits above it.
  const [footerHeight, setFooterHeight] = useState(0);
  // Each toast's key, so a new one replaces the last.
  const toastCount = useRef(0);
  if (!family) return null;
  const person = family.people.find((candidate) => candidate.id === id);
  const cards = family.cards.filter((card) => card.personId === id);
  const waiting = cards.filter((card) => card.status === 'pending').length;
  // The first story waiting shows its ways to ask; approving it opens the next.
  const nextUp = cards.find((card) => card.status === 'pending')?.id;
  const ready = person ? storyApproval(person, cards, editing) : { ids: [], held: 0 };
  const button = approveAllButton(ready.ids.length);

  async function approveEverything() {
    if (!person || !ready.ids.length) return;
    const held = ready.held;
    try {
      const result = await approveAll(person.id, { stories: ready.ids, questions: [] });
      setApproveNotice(undefined);
      setToast({
        id: (toastCount.current += 1),
        message: approvedText(result.approved, held),
        action: result.approved ? { label: 'Undo', onPress: () => void undoApproveAll(result.undo).catch(() => setApproveNotice(NOT_SAVED)) } : undefined,
      });
    } catch {
      setApproveNotice(NOT_SAVED);
    }
  }

  const footer = person ? (
    <View style={styles.footer} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
      {approveNotice ? <Notice>{approveNotice}</Notice> : null}
      <View style={styles.actions}>
        <View style={styles.action}>
          <BigButton
            testID="approve-all"
            label={button.label}
            disabled={button.disabled}
            accessibilityHint={button.disabled ? 'Nothing is waiting that can be approved at once.' : 'Approves every story still waiting, except any that may change.'}
            onPress={approveEverything}
          />
        </View>
        <View style={styles.action}>
          <BigButton testID="done" label="Done" primary onPress={back} />
        </View>
      </View>
    </View>
  ) : undefined;

  return (
    <View style={styles.screen}>
      <CaregiverScreen narrow title="Approve stories" backLabel="Dashboard" backTo="/caregiver" footer={footer}>
          {person ? (
          <>
            <AppText size="caption" muted>
              This is exactly what practice will show. Only approved stories appear.
            </AppText>
            <View style={styles.card}>
              <FittedPhoto source={photoSource(person)} style={styles.photoArea} />
              <AppText fit center bold>
                {person.name}
                {person.relationship ? `, ${person.relationship}` : ''}
              </AppText>
            </View>
            {cards.map((card, index) => (
              <StoryReview
                key={card.id}
                person={person}
                card={card}
                sentences={sentencesInUse(family.ai, person)}
                isNext={card.id === nextUp}
                label={`Story ${index + 1} of ${cards.length} · ${questionFor(card.type).short ?? questionFor(card.type).label}`}
                onEditing={(open) => setEditing((current) => [...current.filter((one) => one !== card.id), ...(open ? [card.id] : [])])}
              />
            ))}
            {waiting ? (
              <Notice>
                {waiting === 1 ? '1 story is' : `${waiting} stories are`} waiting for approval. You can come back to it from the
                People tab.
              </Notice>
            ) : null}
          </>
        ) : (
          <>
            <AppText>This person is no longer saved.</AppText>
            <BigButton testID="done" label="Done" primary onPress={back} />
          </>
        )}
      </CaregiverScreen>
      {toast ? (
        <Toast key={toast.id} message={toast.message} action={toast.action} onHide={() => setToast(undefined)} lift={footerHeight + insets.bottom + Space.l} />
      ) : null}
    </View>
  );
}

type StoryReviewProps = {
  person: SavedPerson & PhotoFields;
  card: SavedCard;
  /** Approved AI sentences in use, listed as ways to ask. */
  sentences: AiSentence[];
  /** The next story to approve. */
  isNext: boolean;
  label: string;
  /** Its edit box opened or closed. */
  onEditing: (open: boolean) => void;
};

function StoryReview({ person, card, sentences, isNext, label, onEditing }: StoryReviewProps) {
  const [draft, setDraft] = useState<Fact | null>(null);
  const [notice, setNotice] = useState<string>();
  // Every way practice may ask it, listed for the story up next so nothing reaches the person
  // unseen. The caregiver can open or close any story's list themselves.
  const [waysChoice, setWaysChoice] = useState<boolean>();
  const showWays = waysChoice ?? isNext;
  const question = questionFor(card.type);
  // The same functions practice uses, so the preview can't differ from what the person sees.
  const sentence = sentenceFor(person, draft ? tidyDraft(draft) : card);
  const [before, after] = sentence.split(BLANK);
  const ways = [...phrasingsFor({ relationship: person.relationship, hasPhoto: hasPhoto(person), name: person.name }, card), ...approvedVariants(sentences, card.id, person, card)];
  const on = ways.filter((way) => !card.phrasingsOff.includes(way.id)).length;

  async function toggleWay(id: string, keep: boolean) {
    const off = keep ? card.phrasingsOff.filter((other) => other !== id) : [...card.phrasingsOff, id];
    if (ways.every((way) => off.includes(way.id))) {
      setNotice('Keep at least one way to ask it.');
      return;
    }
    try {
      await setPhrasingsOff(card.id, off);
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  async function saveEdit() {
    if (!draft || !tidyDraft(draft).text) {
      setNotice('Type a few words, or choose Skip.');
      return;
    }
    try {
      await editCard(card.id, tidyDraft(draft));
      setDraft(null);
      onEditing(false);
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  async function setStatus(status: CardStatus) {
    try {
      await setCardStatus(card.id, status);
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  return (
    <View testID={`story-${card.id}`} style={styles.story}>
      <View style={styles.storyTop}>
        <AppText fit size="caption" muted style={styles.action}>
          {label}
        </AppText>
        {card.testData ? <TestTag /> : null}
      </View>
      <AppText testID="story-text">
        {before}______{after}
      </AppText>
      {wordCount(sentence) > PLAIN_MOST_WORDS ? (
        // A guide, never a rule: the caregiver's words are theirs to keep.
        <AppText testID="story-long" size="caption" muted>
          Shorter sentences are easier to read.
        </AppText>
      ) : null}
      {hasPhoto(card) ? (
        <View style={styles.memoryPhoto}>
          <FittedPhoto source={photoSource(card)} style={styles.memoryPhotoArea} />
          <AppText size="caption" muted style={styles.memoryPhotoNote}>
            Shown with the sentence, once it’s answered.
          </AppText>
        </View>
      ) : null}
      {draft === null ? (
        <>
          <AppText size="caption" muted>
            {statusText(card, person)}
          </AppText>
          {notice ? <Notice>{notice}</Notice> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <BigButton
                testID="approve"
                small
                label={card.timeSensitive ? 'Confirm' : 'Approve'}
                selected={card.status === 'approved'}
                onPress={() => setStatus('approved')}
              />
            </View>
            <View style={styles.action}>
              <BigButton
                testID="edit"
                small
                label="Edit"
                onPress={() => {
                  setDraft({ type: card.type, text: card.text, timeSensitive: card.timeSensitive, asOf: card.asOf, year: card.year });
                  onEditing(true);
                }}
              />
            </View>
            <View style={styles.action}>
              <BigButton testID="skip" small label="Skip" selected={card.status === 'skipped'} onPress={() => setStatus('skipped')} />
            </View>
          </View>
          <BigButton
            testID="ways"
            quiet
            label={showWays ? 'Hide the ways to ask' : `Ways to ask: ${on} of ${ways.length} on`}
            onPress={() => setWaysChoice(!showWays)}
          />
          {showWays ? (
            <View style={styles.ways}>
              {ways.map((way) => (
                <Checkbox
                  key={way.id}
                  testID={`way-${way.id}`}
                  checked={!card.phrasingsOff.includes(way.id)}
                  onChange={(keep) => toggleWay(way.id, keep)}>
                  {way.ask.replace(BLANK, '______')}
                  {'\n'}
                  <AppText size="caption" muted>
                    {KIND_LABELS[way.kind]}
                  </AppText>
                </Checkbox>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Field
            testID="edit-text"
            label={question.short ?? question.label}
            help={factHelp(card.type, person.name)}
            value={draft.text}
            maxLength={MEMORY_LIMIT}
            onChangeText={(text) => setDraft({ ...draft, text })}
            autoCapitalize="none"
            autoFocus
          />
          {question.changes === 'may' ? (
            <Checkbox
              testID="edit-may-change"
              checked={draft.timeSensitive}
              onChange={(checked) => setDraft({ ...draft, timeSensitive: checked, asOf: draft.asOf ?? monthOf(new Date()) })}>
              This may change
            </Checkbox>
          ) : null}
          {question.changes && draft.timeSensitive ? (
            <MonthStepper value={draft.asOf ?? monthOf(new Date())} onChange={(asOf) => setDraft({ ...draft, asOf })} />
          ) : null}
          {notice ? <Notice>{notice}</Notice> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <BigButton testID="save-edit" small label="Save" primary onPress={saveEdit} />
            </View>
            <View style={styles.action}>
              <BigButton
                small
                label="Cancel"
                onPress={() => {
                  setDraft(null);
                  onEditing(false);
                  setNotice(undefined);
                }}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  footer: {
    gap: Space.s,
  },
  card: {
    gap: Space.m,
  },
  photoArea: {
    height: 180,
  },
  story: {
    gap: Space.s,
    paddingTop: Space.l,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  storyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  actions: {
    flexDirection: 'row',
    gap: Space.s,
  },
  ways: {
    gap: Space.xs,
  },
  memoryPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  memoryPhotoArea: {
    width: 72,
    height: 72,
  },
  memoryPhotoNote: {
    flex: 1,
  },
  action: {
    flex: 1,
  },
});
