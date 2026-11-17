import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { AiConsent, AiQueue, AiSection, AI_TITLES, useGenerate, type AiView } from '@/components/ai-questions';
import { ApprovalsArea, ApproveConfirm, WaitingList } from '@/components/approve-all';
import { FormGroup, Notice, Row } from '@/components/caregiver-ui';
import { Avatar, avatarSource, profileOf, type PhotoFields } from '@/components/person-photo';
import { Checkbox, Sheet } from '@/components/sheet';
import { Toast, type ToastContent } from '@/components/toast';
import { LOCAL_ONLY, approveAll, practiceWith, setAiOk, setHints, setIncludeInPractice, setRevealOk, undoApproveAll } from '@/data/app-data';
import type { FamilyAi, SavedCard, SavedPerson } from '@/data/family-store';
import { displayValue } from '@/data/questionnaire';
import { approvalPlan, approvedText, markListOpened } from '@/lib/approve-all';
import { inPractice } from '@/lib/facts';
import { missingItems, needsFinishing, profileCompletion, resumeLine, resumeStep } from '@/lib/profile';
import { HINT_LADDER, type HintRung } from '@/lib/stories';
import { Space } from '@/theme/layout';

const HINT_LABELS: Record<HintRung, string> = {
  letter: 'The first letter of their name',
  fact: 'Another fact about them',
  relationship: 'How they are related',
  fewer: 'Fewer names to choose from',
};

type PersonSheetProps = {
  person: (SavedPerson & PhotoFields) | undefined;
  cards: SavedCard[];
  /** AI questions, when they're available at all. */
  ai?: FamilyAi;
  /** The deck has enough people to practice with. */
  practiceReady: boolean;
  visible: boolean;
  onClose: () => void;
  /** Archives them; the sheet closes first. */
  onArchive: (personId: string) => void;
};

/** One person from the People tab: their stories, their details, archiving them. A sheet, not a screen. */
export function PersonSheet({ person, cards, ai, practiceReady, visible, onClose, onArchive }: PersonSheetProps) {
  // AI's consent and queue, and the approvals list and its confirmation, take the sheet's place: a
  // sheet on top of a sheet doesn't hold up on iOS.
  const [view, setView] = useState<AiView | 'waiting' | 'confirm'>('person');
  // Where Cancel on the confirmation goes back to.
  const [confirmFrom, setConfirmFrom] = useState<'person' | 'waiting'>('person');
  const [toast, setToast] = useState<ToastContent & { id: number }>();
  const [approveNotice, setApproveNotice] = useState<string>();
  // Each toast's key, so a new one replaces the last.
  const toastCount = useRef(0);
  const generate = useGenerate(person?.id);
  if (!person) return null;
  const shown = person;
  const theirs = cards.filter((card) => card.personId === shown.id);
  const waiting = theirs.filter((card) => card.status === 'pending').length;
  const approved = theirs.filter((card) => card.status === 'approved').length;

  // How much of the form is filled in: nothing to do with practice or the person's memory.
  const about = profileOf(shown);
  const percent = profileCompletion(about, theirs);
  // Where Resume profile picks up: the furthest step reached, or once through, what is missing.
  const resumeAt = resumeStep(shown.profileStep, missingItems(about, theirs));
  // Sign-in off, the person practices on this phone: hand it over straight into their cards.
  const canPractice = LOCAL_ONLY && practiceReady && shown.inDeck && percent === 100 && theirs.some(inPractice);

  function open(pathname: '/caregiver/add' | '/caregiver/review', step?: number) {
    onClose();
    router.push({ pathname, params: step ? { id: shown.id, step } : { id: shown.id } });
  }

  function close() {
    setView('person');
    setToast(undefined);
    onClose();
  }

  // What Approve all would do. AI sentences count only where the sheet shows AI questions.
  const plan = approvalPlan(shown, theirs, ai && !needsFinishing(percent) ? ai.sentences : []);

  function openList() {
    markListOpened(shown.id);
    setView('waiting');
  }

  function confirmFromHere(from: 'person' | 'waiting') {
    setConfirmFrom(from);
    setView('confirm');
  }

  async function approveNow() {
    const heldCount = plan.held.length;
    setView('person');
    try {
      const result = await approveAll(shown.id, { stories: plan.stories.map((card) => card.id), questions: plan.questions.map((sentence) => sentence.id) });
      setApproveNotice(undefined);
      setToast({
        id: (toastCount.current += 1),
        message: approvedText(result.approved, heldCount),
        action: result.approved ? { label: 'Undo', onPress: () => void undoApproveAll(result.undo).catch(() => setApproveNotice(NOT_SAVED)) } : undefined,
      });
    } catch {
      setApproveNotice(NOT_SAVED);
    }
  }

  const overlay = toast ? <Toast key={toast.id} message={toast.message} action={toast.action} onHide={() => setToast(undefined)} /> : null;

  if (view === 'waiting') {
    return (
      <Sheet visible={visible} title="Waiting for approval" onClose={close}>
        <WaitingList person={shown} plan={plan} onApproveAll={() => confirmFromHere('waiting')} onReview={() => open('/caregiver/review')} onBack={() => setView('person')} />
      </Sheet>
    );
  }

  if (view === 'confirm') {
    return (
      <Sheet visible={visible} title="Approve all?" onClose={close}>
        <ApproveConfirm person={shown} plan={plan} draft={needsFinishing(percent)} onConfirm={approveNow} onCancel={() => setView(confirmFrom)} />
      </Sheet>
    );
  }

  if (ai && view !== 'person') {
    return (
      <Sheet visible={visible} title={AI_TITLES[view]} onClose={close}>
        {view === 'consent' ? (
          <AiConsent
            onAgree={() => {
              setView('person');
              generate.run();
            }}
            onDecline={() => setView('person')}
          />
        ) : (
          <AiQueue person={shown} sentences={ai.sentences} onBack={() => setView('person')} />
        )}
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} title={shown.name} onClose={close} overlay={overlay}>
      <View style={styles.who}>
        <Avatar name={shown.name} source={avatarSource(shown)} size={64} />
        <View style={styles.whoText}>
          {shown.relationship ? <AppText fit>{displayValue(shown.relationship)}</AppText> : null}
          <AppText testID="profile-percent" fit size="caption" muted>
            {needsFinishing(percent) ? 'Draft,' : 'Profile'} {percent}% complete
          </AppText>
        </View>
      </View>
      {needsFinishing(percent) ? (
        <View style={styles.resume}>
          <BigButton testID="finish-profile" small label="Resume profile" onPress={() => open('/caregiver/add', resumeAt)} />
          <AppText testID="resume-line" size="caption" muted center>
            {resumeLine(resumeAt)}
          </AppText>
        </View>
      ) : null}
      <FormGroup>
        <Row
          testID="person-stories"
          label="Stories"
          icon="book-outline"
          value={waiting ? `${waiting} to approve` : `${approved} approved`}
          onPress={() => open('/caregiver/review')}
        />
        <Row testID="person-edit" label="Edit details" icon="create-outline" onPress={() => open('/caregiver/add')} />
      </FormGroup>
      <ApprovalsArea personId={shown.id} plan={plan} onOpenList={openList} onApproveAll={() => confirmFromHere('person')} />
      {approveNotice ? <Notice>{approveNotice}</Notice> : null}
      {canPractice ? (
        <BigButton
          testID="practice-with"
          small
          label={`Practice with ${shown.name} now`}
          onPress={() => {
            onClose();
            practiceWith(shown.id);
          }}
        />
      ) : null}
      {needsFinishing(percent) ? null : <PracticeChoices person={shown} ai={ai} />}
      {ai && !needsFinishing(percent) ? (
        <AiSection
          person={shown}
          cards={theirs}
          ai={ai}
          generate={generate}
          onConsent={() => setView('consent')}
          onQueue={() => setView('queue')}
        />
      ) : null}
      <HintSettings person={shown} />
      {/* The way to archive without the long press, apart from the rest. Deleting is only offered once someone is archived. */}
      <View style={styles.apart} />
      <BigButton
        testID="archive-person"
        quiet
        label={`Archive ${shown.name}`}
        onPress={() => {
          close();
          onArchive(shown.id);
        }}
      />
    </Sheet>
  );
}

const NOT_SAVED = LOCAL_ONLY ? 'That change couldn’t be saved. Please try again.' : 'That change couldn’t be saved. Please check the internet connection.';

/** On for everyone complete. Off leaves their profile as it is and takes them out of practice. Reveal cards can be turned off for one person. */
function PracticeChoices({ person, ai }: { person: SavedPerson; ai?: FamilyAi }) {
  const [notice, setNotice] = useState<string>();

  async function save(change: Promise<void>) {
    try {
      await change;
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  return (
    <View>
      <Checkbox testID="include-in-practice" checked={person.includeInPractice} onChange={(on) => save(setIncludeInPractice(person.id, on))}>
        Include in practice
      </Checkbox>
      <Checkbox testID="reveal-ok" checked={person.revealOk} onChange={(on) => save(setRevealOk(person.id, on))}>
        Reveal cards
      </Checkbox>
      {ai && !person.aiHeldBack ? (
        <Checkbox testID="ai-ok" checked={person.aiOk !== false} onChange={(on) => save(setAiOk(person.id, on))}>
          AI questions
        </Checkbox>
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}
    </View>
  );
}

/** Which rungs of the hint ladder practice may use for this person. Saved as soon as they change. */
function HintSettings({ person }: { person: SavedPerson }) {
  const [notice, setNotice] = useState<string>();

  async function toggle(rung: HintRung, on: boolean) {
    try {
      await setHints(person.id, { ...person.hints, [rung]: on });
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  return (
    <View style={styles.hints}>
      <AppText accessibilityRole="header" fit bold>
        Hints
      </AppText>
      <AppText size="caption" muted>
        One at a time, in this order, then the answer itself. Every card still ends on the right name.
      </AppText>
      {HINT_LADDER.map((rung) => (
        <Checkbox key={rung} testID={`hint-${rung}`} checked={person.hints[rung]} onChange={(on) => toggle(rung, on)}>
          {HINT_LABELS[rung]}
        </Checkbox>
      ))}
      {notice ? <Notice>{notice}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  whoText: {
    flex: 1,
  },
  hints: {
    gap: Space.xs,
  },
  resume: {
    gap: Space.xs,
  },
  apart: {
    height: Space.l,
  },
});
