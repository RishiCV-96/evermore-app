import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import { Image, type ImageProps } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Fragment, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Animated, { FadeInLeft, FadeInRight, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import {
  AddRow,
  CaregiverScreen,
  FieldChain,
  FieldNote,
  FormCell,
  FormGroup,
  FormRow,
  LabelLine,
  MonthStepper,
  Notice,
  QuietLink,
  RequiredLegend,
  RevealContext,
  TestTag,
  useFieldChain,
  type NotApplicable,
} from '@/components/caregiver-ui';
import { Chip, Chips, Picker } from '@/components/choices';
import { Avatar, avatarSource, hasPhoto, photoSource, profileOf, type PhotoFields } from '@/components/person-photo';
import { ProgressBar } from '@/components/progress-bar';
import { Checkbox } from '@/components/sheet';
import { useAutosave } from '@/components/use-autosave';
import { LOCAL_ONLY, addPerson, addToPractice, saveFacts, setFactHints, setProfile, updatePerson } from '@/data/app-data';
import type { SavedCard, SavedPerson } from '@/data/family-store';
import {
  FACTS_ONLY,
  NOT_APPLICABLE,
  REVIEW_STEP,
  SECTIONS,
  STILL_NEEDED,
  canNotApply,
  displayValue,
  exampleOf,
  hasRequired,
  questionFor,
  questionGroups,
  stepLabel,
  type Question,
  type Section,
} from '@/data/questionnaire';
import { confirm } from '@/lib/confirm';
import { monthOf, type PickedPhoto } from '@/lib/facts';
import {
  blankEntry,
  missingItems,
  profileCompletion,
  reviewAction,
  sectionEntries,
  sectionSummary,
  toDrafts,
  validYear,
  withAnswers,
  type Entry,
  type ProfilePerson,
} from '@/lib/profile';
import { tidyName, tidyRelationship, type BestClue } from '@/lib/stories';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, ICON, RADIUS, Space } from '@/theme/layout';
import { warnKind } from '@/lib/log';
import { shrinkPhoto } from '@/lib/shrink-photo';

const NOT_SAVED = LOCAL_ONLY
  ? 'That step couldn’t be saved. Please try again.'
  : 'That step couldn’t be saved. Please check the internet connection and try again.';

/** The person's photo on the form: large enough to see who it is. */
const PHOTO = 80;
const MEMORY_PHOTO = 32;

/** Quick: long enough to read as moving on, never a wait. Reduce Motion skips it. */
const STEP_MOTION = 200;

/** A question jumped to from Review is brought into view once its step has slid in. */
const REVEAL_AFTER = STEP_MOTION + 150;

const newId = () => Crypto.randomUUID();

type QuestionnaireProps = {
  /** The person's id, made before they are first saved. */
  id: string;
  /** Saved so far: a new person isn't, until they have a name. */
  person?: SavedPerson & PhotoFields;
  /** This person's facts. */
  cards: SavedCard[];
  step: number;
  /** Go to a step; 0 is the first (shown as "Step 1 of 8"). */
  onStep: (step: number) => void;
};

// Screen 5 as steps, every one with the same slim header: the bar, "Step N of 8 · X% complete" and
// Finish later. Answers save as a draft while they are typed (src/components/use-autosave.ts), so the
// caregiver can stop anywhere and resume from the person's sheet. The questions are in
// src/data/questionnaire.ts; docs/ADD-PERSON-AUDIT.md has why it looks the way it does.
export function Questionnaire({ id, person, cards, step, onStep }: QuestionnaireProps) {
  // Sent here from the review step: the step's button goes straight back to it.
  const [fromReview, setFromReview] = useState(false);
  // A step arrives from the side the caregiver is heading.
  const [forward, setForward] = useState(true);
  // What's left: the question to bring into view on arriving.
  const [focus, setFocus] = useState<string>();
  const section = SECTIONS.find((candidate) => candidate.step === step)!;

  function moveTo(to: number, question?: string) {
    setForward(to > step);
    setFocus(question);
    onStep(to);
  }

  if (step === REVIEW_STEP && person) {
    return (
      <ReviewStep
        person={person}
        cards={cards}
        forward={forward}
        onBack={() => moveTo(REVIEW_STEP - 1)}
        onEdit={(to, question) => {
          setFromReview(true);
          moveTo(to, question);
        }}
      />
    );
  }
  return (
    <SectionStep
      key={step}
      id={id}
      section={section}
      person={person}
      cards={cards}
      forward={forward}
      focus={focus}
      toReview={fromReview}
      next={fromReview ? REVIEW_STEP : step + 1}
      onStep={moveTo}
    />
  );
}

const leave = () => (router.canGoBack() ? router.back() : router.replace('/caregiver'));

type StepLayoutProps = {
  section: Section;
  /** How much of the profile is done. */
  percent: number;
  /** Which way the caregiver is heading, for the step's entrance. */
  forward: boolean;
  /** Hides Finish later while a save is running. */
  busy?: boolean;
  onLater: () => void;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * A step of the form. Fixed: the slim bar, "Step N of 8 · X% complete" and Finish later. Sliding in:
 * the title, its one-line helper, "* Required" only where something is, and the facts-only line (in
 * full on the first step, behind a small link after it). The way on is pinned below.
 */
function StepLayout({ section, percent, forward, busy = false, onLater, footer, children }: StepLayoutProps) {
  const accent = useAccent();
  const reduced = useReducedMotion();
  const [factsOpen, setFactsOpen] = useState(false);
  const first = section.step === 0;
  const asks = section.questions.length > 0;
  const legend = hasRequired(section);
  const entering = reduced ? undefined : (forward ? FadeInRight : FadeInLeft).duration(STEP_MOTION);
  return (
    <CaregiverScreen
      narrow
      title={section.title}
      footer={footer}
      header={
        <>
          <ProgressBar completed={percent} goal={100} bare label={`Profile ${percent}% complete`} />
          <View style={styles.metaRow}>
            <AppText testID="percent" fit size="caption" muted style={styles.grow}>
              {stepLabel(section.step)} · {percent}% complete
            </AppText>
            <Pressable
              testID="finish-later"
              accessibilityRole="button"
              disabled={busy}
              onPress={onLater}
              style={({ pressed }) => [styles.later, pressed && styles.linkPressed]}>
              <AppText fit size="caption" color={accent}>
                Finish later
              </AppText>
            </Pressable>
          </View>
        </>
      }>
      <Animated.View entering={entering} style={styles.stepBody}>
        <View style={styles.intro}>
          <AppText testID="step-title" accessibilityRole="header" fit bold size="title">
            {section.title}
          </AppText>
          <AppText testID="step-helper" size="caption" muted>
            {section.helper}
          </AppText>
          {legend || (asks && !first) ? (
            <View style={styles.introRow}>
              {legend ? <RequiredLegend /> : null}
              {asks && !first ? (
                <View style={legend ? undefined : styles.linkFirst}>
                  <QuietLink
                    testID="facts-only-link"
                    icon="information-circle-outline"
                    inline
                    label="Facts only"
                    expanded={factsOpen}
                    onPress={() => setFactsOpen(!factsOpen)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          {first || factsOpen ? (
            <AppText testID="facts-only" size="caption" muted>
              {FACTS_ONLY}
            </AppText>
          ) : null}
        </View>
        {children}
      </Animated.View>
    </CaregiverScreen>
  );
}

type StepBarProps = { onBack: () => void; busy?: boolean; children: ReactNode };

/** The pinned bar: Back, quiet, and the one way on. */
function StepBar({ onBack, busy = false, children }: StepBarProps) {
  return (
    <View style={styles.actions}>
      <View style={styles.backAction}>
        <BigButton testID="back" quiet label="Back" disabled={busy} onPress={onBack} />
      </View>
      <View style={styles.action}>{children}</View>
    </View>
  );
}

/** A question's place on the step. Arriving from What's left, it is brought into view. */
function Target({ active, children }: { active: boolean; children: ReactNode }) {
  const reveal = useContext(RevealContext);
  const spot = useRef<ViewInstance>(null);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => reveal?.(spot.current), REVEAL_AFTER);
    return () => clearTimeout(timer);
  }, [active, reveal]);
  return (
    <View ref={spot} collapsable={false}>
      {children}
    </View>
  );
}

type SectionStepProps = {
  id: string;
  section: Section;
  person?: SavedPerson & PhotoFields;
  cards: SavedCard[];
  forward: boolean;
  /** A question to bring into view, and focus if it is typed. */
  focus?: string;
  /** Came from Review: the button goes back there. */
  toReview: boolean;
  /** Where the button goes. */
  next: number;
  onStep: (step: number) => void;
};

function SectionStep({ id, section, person, cards, forward, focus, toReview, next, onStep }: SectionStepProps) {
  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  // undefined keeps the current photo; null removes it.
  const [photo, setPhoto] = useState<PickedPhoto | null>();
  const [entries, setEntries] = useState(() => sectionEntries(section, cards, newId));
  const [bestClue, setBestClue] = useState<string | undefined>(person?.bestClue);
  const [hintsOff, setHintsOff] = useState(() => cards.filter((card) => card.hintOk === false).map((card) => card.id));
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  // Required questions the caregiver has been to, so a note only follows a touch (or a jump from What's left).
  const [visited, setVisited] = useState<string[]>(focus ? [focus] : []);
  const [marks, setMarks] = useState(person?.notApplicable ?? []);
  // Questions behind an add row, until it's tapped or they already have an answer.
  const [showAll, setShowAll] = useState(false);
  const waiting = (question: Question) =>
    Boolean(question.behind) && !showAll && !entries.some((entry) => entry.question === question.id && entry.text.trim());

  const has = (sets: Question['sets']) => section.questions.some((question) => question.sets === sets);
  const hasHintFacts = section.questions.some((question) => question.input === 'hint-facts');

  // The percent follows the form as it is typed: this step's answers over what is saved.
  const saved: ProfilePerson = person ? profileOf(person) : { hasPhoto: false };
  const shownPhoto = photo ? { uri: photo.uri } : photo === null || !person ? undefined : avatarSource(person);
  const live: ProfilePerson = {
    ...saved,
    name: tidyName(name) || person?.name,
    relationship: has('relationship') ? tidyRelationship(relationship) : saved.relationship,
    hasPhoto: has('photo') ? (photo ? true : photo === null ? false : saved.hasPhoto) : saved.hasPhoto,
    bestClue: has('bestClue') ? bestClue : saved.bestClue,
    notApplicable: marks,
  };
  const percent = profileCompletion(live, withAnswers(cards, entries, id));

  // The step's text fields, top to bottom: the keyboard's key moves through them.
  const order = section.questions
    .filter((question) => !waiting(question))
    .flatMap((question) => {
      if (question.sets === 'name') return ['name'];
      if (!['text', 'list', 'memory'].includes(question.input)) return [];
      return entries
        .filter((entry) => entry.question === question.id)
        .flatMap((entry) => (question.input === 'memory' && entry.text.trim() ? [entry.id, `year-${entry.id}`] : [entry.id]));
    });
  const chain = useFieldChain(order);

  /** Saves what this step holds, as a draft. A new person needs a name before anything is saved. */
  async function saveStep() {
    const cleanName = tidyName(name);
    if (!person && !cleanName) return;
    const sentPhoto = photo;
    const drafts = toDrafts(entries, new Date());

    if (has('name')) {
      const details = { name: cleanName || (person?.name ?? ''), relationship: tidyRelationship(relationship) };
      if (person) await updatePerson(id, { ...details, photo: sentPhoto });
      else await addPerson({ id, ...details, facts: [], pickedPhoto: sentPhoto ?? undefined });
    }
    await saveFacts(id, drafts);
    if (has('bestClue') && bestClue !== person?.bestClue) await setProfile(id, { bestClue: (bestClue as BestClue) ?? null });
    // Only when they changed: passing through must not undo the toggle on the person's sheet.
    const wereOff = cards.filter((card) => card.hintOk === false).map((card) => card.id);
    const hintsChanged = wereOff.length !== hintsOff.length || wereOff.some((off) => !hintsOff.includes(off));
    if (hasHintFacts && hintsChanged) await setFactHints(id, hintsOff);
    const wereMarked = person?.notApplicable ?? [];
    if (wereMarked.length !== marks.length || marks.some((mark) => !wereMarked.includes(mark))) await setProfile(id, { notApplicable: marks });

    // A picture is sent once: from now on it is the saved one.
    setPhoto((current) => (current === sentPhoto ? undefined : current));
    const sent = new Map(drafts.map((draft) => [draft.id, draft.photo]));
    setEntries((current) => current.map((entry) => (entry.photo !== undefined && entry.photo === sent.get(entry.id) ? { ...entry, photo: undefined } : entry)));
  }

  const saver = useAutosave(saveStep);

  function edit(next: Entry[]) {
    setEntries(next);
    saver.touch();
  }

  /** Any answer that isn't an entry changed. */
  function touched<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      saver.touch();
    };
  }

  const saveNow = () => {
    saver.flush().catch((error) => warnKind('Could not save the draft', error));
  };

  const visit = (questionId: string) => setVisited((current) => (current.includes(questionId) ? current : [...current, questionId]));

  /** A note under a required question left empty, once it has been touched. */
  function stillNeeded(question: Question) {
    if (!question.required || !visited.includes(question.id) || marks.includes(question.id)) return undefined;
    if (question.sets === 'relationship') return relationship.trim() ? undefined : STILL_NEEDED;
    if (question.sets === 'photo') return shownPhoto ? undefined : STILL_NEEDED;
    const kinds = [question.factType, ...(question.alsoAnsweredBy ?? [])];
    return entries.some((entry) => kinds.includes(entry.type) && entry.text.trim()) ? undefined : STILL_NEEDED;
  }

  /** An answer takes the place of "Not applicable". */
  const unmark = (questionId: string) => setMarks((current) => current.filter((mark) => mark !== questionId));

  function markFor(question: Question): NotApplicable | undefined {
    if (!canNotApply(question)) return undefined;
    return {
      marked: marks.includes(question.id),
      label: question.label,
      testID: `na-${question.id}`,
      onChange: touched((marked: boolean) => (marked ? setMarks((current) => [...current, question.id]) : unmark(question.id))),
    };
  }

  async function pickPersonPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;
    unmark('photo');
    // No bigger than it needs to be, before it is kept or uploaded (src/lib/photo-size.ts).
    touched(setPhoto)(await shrinkPhoto(result.assets[0]));
  }

  async function go(then: () => void, reached: number) {
    setSaving(true);
    try {
      await saver.flush();
      if ((person || tidyName(name)) && reached > (person?.profileStep ?? 0)) await setProfile(id, { step: reached });
      then();
    } catch (error) {
      warnKind('Could not save the step', error);
      setSaving(false);
      setNotice(NOT_SAVED);
    }
  }

  /** A new person can't be saved without a name: leaving with other answers asks first, so nothing goes unnoticed. */
  async function mayLeave() {
    if (person || tidyName(name)) return true;
    const unsaved = Boolean(relationship.trim() || photo || marks.length || entries.some((entry) => entry.text.trim()));
    if (!unsaved) return true;
    const sure = await confirm('Leave without saving?', 'A name is needed to save this person, so what you added here would be lost.', 'Leave');
    if (!sure) setNameTouched(true);
    return sure;
  }

  async function goBack() {
    if (section.step > 0) {
      go(() => onStep(section.step - 1), section.step);
      return;
    }
    if (await mayLeave()) go(leave, section.step);
  }

  async function finishLater() {
    if (await mayLeave()) go(leave, section.step);
  }

  function goForward() {
    if (!person && !tidyName(name)) {
      setNameTouched(true);
      return;
    }
    go(() => onStep(next), next);
  }

  function change(key: string, patch: Partial<Entry>) {
    const changing = entries.find((entry) => entry.id === key);
    if (changing) visit(changing.question);
    if (changing && patch.text?.trim()) unmark(changing.question);
    edit(entries.map((entry) => (entry.id === key ? { ...entry, ...patch } : entry)));
  }

  function add(entry: Entry) {
    if (entry.text.trim()) unmark(entry.question);
    edit([...entries, entry]);
  }

  function answer(question: Question) {
    if (question.sets === 'name') {
      return (
        <FormRow
          testID="name"
          chain="name"
          label={question.label}
          required={question.required}
          value={name}
          maxLength={question.limit}
          onChangeText={touched(setName)}
          onBlur={() => {
            setNameTouched(true);
            saveNow();
          }}
          note={nameTouched && !tidyName(name) ? 'A name is needed to save this person.' : undefined}
          autoCapitalize="words"
          autoComplete="off"
          focusAfter={focus === question.id ? REVEAL_AFTER : undefined}
        />
      );
    }
    if (question.sets === 'photo') {
      return (
        <PhotoField
          question={question}
          shown={shownPhoto}
          mark={markFor(question)!}
          note={stillNeeded(question)}
          onChoose={() => {
            visit(question.id);
            pickPersonPhoto().catch((error) => warnKind('Could not choose a photo', error));
          }}
          onRemove={() => touched(setPhoto)(null)}
        />
      );
    }
    if (question.sets === 'relationship') {
      return (
        <Picker
          testID="q-relationship"
          label={question.label}
          value={relationship}
          options={question.options!}
          other={question.other}
          placeholder={exampleOf(question)}
          limit={question.limit}
          inForm
          required={question.required}
          note={stillNeeded(question)}
          notApplicable={markFor(question)}
          onClose={() => visit(question.id)}
          onChange={(value) => {
            visit(question.id);
            if (value) unmark(question.id);
            touched(setRelationship)(value);
          }}
        />
      );
    }
    if (question.sets === 'bestClue') {
      return (
        <QuestionCell label={question.label}>
          <Chips>
            {question.options!.map((option) => (
              <Chip
                key={option.value}
                testID={`clue-${option.value}`}
                role="radio"
                label={option.label}
                selected={bestClue === option.value}
                onPress={() => touched(setBestClue)(bestClue === option.value ? undefined : option.value)}
              />
            ))}
          </Chips>
        </QuestionCell>
      );
    }
    if (question.input === 'hint-facts') {
      const facts = cards.filter((card) => card.status !== 'skipped');
      return (
        <QuestionCell label={question.label}>
          <AppText size="caption" muted>
            {facts.length
              ? 'Practice can give these as a hint. It never gives the fact a card already shows.'
              : 'Facts you add on earlier steps appear here, to choose which can be hints.'}
          </AppText>
          {facts.map((card) => (
            <Checkbox
              key={card.id}
              testID={`hint-fact-${card.type}`}
              checked={!hintsOff.includes(card.id)}
              onChange={(on) => touched(setHintsOff)(on ? hintsOff.filter((off) => off !== card.id) : [...hintsOff, card.id])}>
              {questionFor(card.type).short ?? questionFor(card.type).label}: {card.text}
            </Checkbox>
          ))}
        </QuestionCell>
      );
    }
    return (
      <FactAnswers
        question={question}
        entries={entries.filter((entry) => entry.question === question.id)}
        cards={cards}
        notApplicable={markFor(question)}
        note={stillNeeded(question)}
        focusFirst={focus === question.id}
        onChange={change}
        onAdd={add}
        onDrop={(key) => edit(entries.filter((entry) => entry.id !== key))}
        onBlur={() => {
          visit(question.id);
          saveNow();
        }}
      />
    );
  }

  return (
    <StepLayout
      section={section}
      percent={percent}
      forward={forward}
      busy={saving}
      onLater={finishLater}
      footer={
        <View style={styles.footerStack}>
          {notice ? <Notice>{notice}</Notice> : null}
          <StepBar busy={saving} onBack={goBack}>
            <BigButton testID="next-section" primary label={saving ? 'Saving…' : toReview ? 'Back to review' : 'Next'} disabled={saving} onPress={goForward} />
          </StepBar>
        </View>
      }>
      <FieldChain.Provider value={chain}>
        {questionGroups(section.questions).map((group) => {
          const behind = group.find(waiting);
          return (
            <FormGroup key={group[0].id} heading={group[0].heading}>
              {group
                .filter((question) => !waiting(question))
                .map((question) => (
                  <Target key={question.id} active={focus === question.id}>
                    {answer(question)}
                  </Target>
                ))}
              {behind ? <AddRow testID="show-more" label={behind.behind!} onPress={() => setShowAll(true)} /> : null}
            </FormGroup>
          );
        })}
      </FieldChain.Provider>
    </StepLayout>
  );
}

type PhotoFieldProps = {
  question: Question;
  /** The photo to show: just picked, or saved. */
  shown?: ImageProps['source'];
  mark: NotApplicable;
  note?: string;
  onChoose: () => void;
  onRemove: () => void;
};

/** The person's photo: a large preview that is itself the button, one clear action beside it, and "Not applicable" on the label line. */
function PhotoField({ question, shown, mark, note, onChoose, onRemove }: PhotoFieldProps) {
  const accent = useAccent();
  const marked = mark.marked && !shown;
  return (
    <View style={styles.photoCell}>
      <View style={styles.photoField}>
        <Pressable
          testID="photo-preview"
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Change photo' : 'Choose a photo'}
          onPress={onChoose}
          style={({ pressed }) => [styles.photoPreview, pressed && styles.previewPressed]}>
          {shown ? (
            <Image source={shown} contentFit="cover" style={styles.photoImage} accessibilityElementsHidden importantForAccessibility="no" />
          ) : (
            <Ionicons name="person-outline" size={ICON + Space.s} color={Colors.textMuted} aria-hidden />
          )}
        </Pressable>
        <View style={styles.photoSide}>
          <LabelLine label={question.label} required={question.required} notApplicable={shown ? undefined : mark} />
          {marked ? <AppText fit muted>{NOT_APPLICABLE}</AppText> : null}
          <View style={styles.photoActions}>
            <Pressable
              testID="choose-photo"
              accessibilityRole="button"
              onPress={onChoose}
              style={({ pressed }) => [styles.photoButton, pressed && styles.previewPressed]}>
              <AppText fit color={accent}>
                {shown ? 'Change photo' : 'Choose a photo'}
              </AppText>
            </Pressable>
            {shown ? <QuietLink testID="remove-photo" label="Remove" onPress={onRemove} /> : null}
          </View>
        </View>
      </View>
      {note ? <FieldNote>{note}</FieldNote> : null}
    </View>
  );
}

type QuestionCellProps = {
  label: string;
  required?: boolean;
  /** Offers "Not applicable" on the label line. */
  notApplicable?: NotApplicable;
  /** Marks made-up answers. */
  test?: boolean;
  /** A calm line under the answer, shown once it has been touched. */
  note?: string;
  /** Its follow-ups come next: no hairline. */
  joined?: boolean;
  children: ReactNode;
};

/** A question answered with chips or checkboxes: the same label line as every field, the answer under it. */
function QuestionCell({ label, required = false, notApplicable, test = false, note, joined = false, children }: QuestionCellProps) {
  return (
    <View style={[styles.cell, joined && styles.joinedCell]}>
      <LabelLine label={label} required={required} notApplicable={test ? undefined : notApplicable} trailing={test ? <TestTag /> : null} />
      {notApplicable?.marked ? <AppText fit muted>{NOT_APPLICABLE}</AppText> : null}
      {children}
      {note ? <FieldNote>{note}</FieldNote> : null}
    </View>
  );
}

type FactAnswersProps = {
  question: Question;
  entries: Entry[];
  /** This person's saved facts, for a memory's photo. */
  cards: SavedCard[];
  notApplicable?: NotApplicable;
  /** A calm line under the question, shown once it has been touched. */
  note?: string;
  /** Jumped to from What's left: its first field takes the focus. */
  focusFirst?: boolean;
  onChange: (key: string, patch: Partial<Entry>) => void;
  onAdd: (entry: Entry) => void;
  onDrop: (key: string) => void;
  onBlur: () => void;
};

/** What comes under an answer once it has words: "This may change" and its month, a memory's year and photo. Each renders joined to the next but the last. */
function followUps(question: Question, entry: Entry, saved: SavedCard | undefined, onChange: FactAnswersProps['onChange'], onBlur: () => void) {
  if (!entry.text.trim()) return [];
  const month = entry.asOf ?? monthOf(new Date());
  const rows: ((joined: boolean) => ReactNode)[] = [];
  const stepper = (joined: boolean) => (
    <FormCell joined={joined}>
      <MonthStepper testID={`as-of-${question.id}`} value={month} onChange={(asOf) => onChange(entry.id, { asOf })} />
    </FormCell>
  );
  if (question.changes === 'always') rows.push(stepper);
  // The rest stay short here: story approval can still mark them.
  else if (question.asksChanges) {
    rows.push((joined) => (
      <FormCell joined={joined}>
        <Checkbox testID={`may-change-${question.id}`} checked={entry.timeSensitive} onChange={(checked) => onChange(entry.id, { timeSensitive: checked, asOf: month })}>
          This may change
        </Checkbox>
      </FormCell>
    ));
    if (entry.timeSensitive) rows.push(stepper);
  }
  if (question.input === 'memory') rows.push((joined) => <MemoryExtras entry={entry} saved={saved} joined={joined} onChange={onChange} onBlur={onBlur} />);
  return rows;
}

/** A question that becomes facts, in whichever way it is answered. */
function FactAnswers({ question, entries, cards, notApplicable, note, focusFirst = false, onChange, onAdd, onDrop, onBlur }: FactAnswersProps) {
  /** The one answer of a choice or picker: set, changed or cleared. */
  function setOne(value: string) {
    const [entry] = entries;
    if (entry) onChange(entry.id, { text: value });
    else onAdd({ ...blankEntry(question, newId()), text: value });
  }

  if (question.input === 'chips') {
    return (
      <ChipAnswers
        question={question}
        entries={entries}
        cards={cards}
        notApplicable={notApplicable}
        note={note}
        onChange={onChange}
        onAdd={onAdd}
        onDrop={onDrop}
        onBlur={onBlur}
      />
    );
  }

  if (question.input === 'picker') {
    return (
      <Picker
        testID={`q-${question.id}`}
        label={question.label}
        value={entries[0]?.text ?? ''}
        options={question.options!}
        other={question.other}
        placeholder={exampleOf(question)}
        limit={question.limit}
        inForm
        required={question.required}
        notApplicable={notApplicable}
        note={note}
        onChange={setOne}
      />
    );
  }

  if (question.input === 'choice') {
    const value = entries[0]?.text;
    const extras = entries[0] ? followUps(question, entries[0], undefined, onChange, onBlur) : [];
    return (
      <>
        <QuestionCell label={question.label} required={question.required} notApplicable={value ? undefined : notApplicable} note={note} joined={extras.length > 0}>
          <Chips>
            {question.options!.map((option) => (
              <Chip
                key={option.value}
                testID={`q-${question.id}-${option.value}`}
                role="radio"
                label={option.label}
                selected={value === option.value}
                onPress={() => setOne(value === option.value ? '' : option.value)}
              />
            ))}
          </Chips>
        </QuestionCell>
        {extras.map((render, index) => (
          <Fragment key={index}>{render(index < extras.length - 1)}</Fragment>
        ))}
      </>
    );
  }

  const last = entries[entries.length - 1];
  return (
    <>
      {entries.map((entry, index) => {
        const extras = followUps(question, entry, cards.find((card) => card.id === entry.id), onChange, onBlur);
        return (
          <Fragment key={entry.id}>
            <FormRow
              testID={question.sets === 'firstFact' ? 'first-fact' : `fact-${question.id}-${index}`}
              chain={entry.id}
              joined={extras.length > 0}
              label={index === 0 ? question.label : `${question.label} ${index + 1}`}
              required={question.required && index === 0}
              note={index === 0 ? note : undefined}
              placeholder={exampleOf(question)}
              accessibilityHint={exampleOf(question)}
              value={entry.text}
              maxLength={question.limit}
              onChangeText={(text) => onChange(entry.id, { text })}
              onBlur={onBlur}
              autoCapitalize={question.properName ? 'words' : 'none'}
              focusAfter={focusFirst && index === 0 ? REVEAL_AFTER : undefined}
              notApplicable={index === 0 ? notApplicable : undefined}
              trailing={entry.testData ? <TestTag /> : null}
            />
            {extras.map((render, at) => (
              <Fragment key={at}>{render(at < extras.length - 1)}</Fragment>
            ))}
          </Fragment>
        );
      })}
      {question.input === 'list' && question.more && entries.length < (question.most ?? 1) && last?.text.trim() ? (
        <AddRow testID={`add-${question.id}`} label={question.more} onPress={() => onAdd(blankEntry(question, newId()))} />
      ) : null}
    </>
  );
}

/** Any number of chips, each one a fact, plus the caregiver's own. */
function ChipAnswers({ question, entries, notApplicable, note, onChange, onAdd }: FactAnswersProps) {
  const [own, setOwn] = useState('');
  const [adding, setAdding] = useState(false);
  const shown = entries.filter((entry) => entry.text);
  const extras = shown.filter((entry) => !question.options!.some((option) => option.value === entry.text));
  const full = shown.length >= (question.most ?? 8);

  function toggle(value: string) {
    const entry = entries.find((candidate) => candidate.text === value);
    if (entry) {
      onChange(entry.id, { text: '' });
      return;
    }
    const emptied = entries.find((candidate) => !candidate.text);
    if (emptied) onChange(emptied.id, { text: value });
    else onAdd({ ...blankEntry(question, newId()), text: value });
  }

  /** The caregiver's own words become a chip: on Add, on the keyboard's key, or on leaving the field, so typed words are never lost. */
  function addOwn() {
    const words = own.trim();
    setOwn('');
    if (words && !shown.some((entry) => entry.text === words)) toggle(words);
  }

  return (
    <QuestionCell label={question.label} required={question.required} notApplicable={shown.length ? undefined : notApplicable} test={shown.some((entry) => entry.testData)} note={note}>
      <Chips>
        {question.options!.map((option) => {
          const selected = shown.some((entry) => entry.text === option.value);
          return (
            <Chip
              key={option.value}
              testID={`q-${question.id}-${option.value}`}
              label={option.label}
              selected={selected}
              onPress={() => {
                if (selected || !full) toggle(option.value);
              }}
            />
          );
        })}
        {extras.map((entry) => (
          <Chip key={entry.id} label={displayValue(entry.text)} selected onPress={() => toggle(entry.text)} />
        ))}
        {adding || full ? null : <Chip testID={`more-${question.id}`} label="Other" selected={false} onPress={() => setAdding(true)} />}
      </Chips>
      {!adding || full ? null : (
        <View style={styles.ownChip}>
          <FormRow
            testID={`own-${question.id}`}
            label={question.more ?? 'Something else'}
            placeholder={exampleOf(question)}
            value={own}
            maxLength={question.limit}
            onChangeText={setOwn}
            onSubmitEditing={addOwn}
            onBlur={addOwn}
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            trailing={own.trim() ? <QuietLink testID={`add-own-${question.id}`} label="Add" onPress={addOwn} /> : null}
          />
        </View>
      )}
    </QuestionCell>
  );
}

type MemoryExtrasProps = { entry: Entry; saved?: SavedCard; joined: boolean; onChange: FactAnswersProps['onChange']; onBlur: () => void };

/** A shared memory's optional year and photo, right under its words. */
function MemoryExtras({ entry, saved, joined, onChange, onBlur }: MemoryExtrasProps) {
  const [touched, setTouched] = useState(false);
  // A photo just picked, or the one saved, unless it was just removed.
  const shown = entry.photo ? { uri: entry.photo.uri } : entry.photo === null || !saved || !hasPhoto(saved) ? undefined : photoSource(saved);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) onChange(entry.id, { photo: await shrinkPhoto(result.assets[0]) });
  }

  return (
    <FormRow
      testID={`year-${entry.question}`}
      chain={`year-${entry.id}`}
      joined={joined}
      label="Year"
      placeholder="e.g. 1987"
      keyboardType="number-pad"
      value={entry.year ? String(entry.year) : ''}
      maxLength={4}
      onChangeText={(text) => onChange(entry.id, { year: Number(text.replace(/\D/g, '')) || undefined })}
      onBlur={() => {
        setTouched(true);
        onBlur();
      }}
      note={touched && entry.year && !validYear(entry.year, new Date()) ? 'Please use a four-digit year, such as 1987.' : undefined}
      trailing={
        shown ? (
          <>
            <Avatar name="" source={shown} size={MEMORY_PHOTO} />
            <QuietLink label="Remove" onPress={() => onChange(entry.id, { photo: null })} />
          </>
        ) : (
          <QuietLink testID={`photo-${entry.question}`} label="Add photo" onPress={pickPhoto} />
        )
      }
    />
  );
}

type ReviewStepProps = {
  person: SavedPerson & PhotoFields;
  cards: SavedCard[];
  forward: boolean;
  onBack: () => void;
  /** Go to a step to change something there, and the question to bring into view. */
  onEdit: (step: number, question?: string) => void;
};

/** "One interest" in a list: "Still needed: a photo, one interest". */
const inList = (label: string) => `${label[0].toLowerCase()}${label.slice(1)}`;

/** The last step: everything in plain words, what is still needed, and Continue to story approval at 100%. */
function ReviewStep({ person, cards, forward, onBack, onEdit }: ReviewStepProps) {
  const about = profileOf(person);
  const missing = missingItems(about, cards);
  const percent = profileCompletion(about, cards);
  const action = reviewAction(percent, person);
  const [notice, setNotice] = useState<string>();
  const section = SECTIONS.find((candidate) => candidate.step === REVIEW_STEP)!;

  async function finish() {
    try {
      if (!person.inDeck) await addToPractice(person.id);
      router.replace({ pathname: '/caregiver/review', params: { id: person.id } });
    } catch (error) {
      warnKind('Could not add them to practice', error);
      setNotice(NOT_SAVED);
    }
  }

  return (
    <StepLayout
      section={section}
      percent={percent}
      forward={forward}
      onLater={leave}
      footer={
        <View style={styles.footerStack}>
          {missing.length ? (
            <View testID="still-missing" style={styles.missingRow}>
              <AppText size="caption" muted style={styles.grow}>
                Still needed: {missing.map((item) => inList(item.label)).join(', ')}
              </AppText>
              <QuietLink testID="whats-left" label="What’s left" accessibilityLabel={`What’s left: ${missing[0].label}`} onPress={() => onEdit(missing[0].step, missing[0].id)} />
            </View>
          ) : null}
          {notice ? <Notice>{notice}</Notice> : null}
          <StepBar onBack={onBack}>
            <BigButton
              testID="add-to-practice"
              primary
              label={action.label}
              disabled={action.disabled}
              progress={percent}
              accessibilityHint={action.disabled ? 'Available once the profile is complete.' : 'Opens story approval.'}
              onPress={finish}
            />
          </StepBar>
        </View>
      }>
      {missing.length === 0 && cards.length === 0 ? <Notice>There are no stories yet, so practice has nothing to show for {person.name}.</Notice> : null}
      <FormGroup>
        {SECTIONS.filter((one) => one.questions.length).map((one) => (
          <SummaryRow
            key={one.step}
            title={one.step === 0 ? person.name : one.title}
            lines={sectionSummary(one, about, cards)}
            avatar={one.step === 0 ? <Avatar name={person.name} source={avatarSource(person)} size={COMPACT_TAP - Space.xs} /> : null}
            testID={`edit-section-${one.step}`}
            onEdit={() => onEdit(one.step)}
          />
        ))}
      </FormGroup>
    </StepLayout>
  );
}

type SummaryRowProps = {
  title: string;
  lines: { label: string; text: string; test?: boolean }[];
  avatar: ReactNode;
  testID: string;
  onEdit: () => void;
};

/** A section of the review, as one row of the card: its title, its answers in plain words (or "Nothing yet"), and Edit. */
function SummaryRow({ title, lines, avatar, testID, onEdit }: SummaryRowProps) {
  return (
    <FormCell>
      <View style={styles.summaryRow}>
        {avatar}
        <View style={styles.grow}>
          <AppText accessibilityRole="header" fit bold>
            {title}
          </AppText>
          {lines.length ? (
            lines.map((line) => <Line key={line.label} {...line} />)
          ) : (
            <AppText size="caption" muted>
              Nothing yet
            </AppText>
          )}
        </View>
        <QuietLink testID={testID} label="Edit" accessibilityLabel={`Edit ${title}`} onPress={onEdit} />
      </View>
    </FormCell>
  );
}

function Line({ label, text, test = false }: { label: string; text: string; test?: boolean }) {
  if (!text) return null;
  return (
    <View style={styles.line}>
      <AppText size="caption" style={styles.grow}>
        <AppText size="caption" muted>
          {label}:{' '}
        </AppText>
        {text}
      </AppText>
      {test ? <TestTag /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP - Space.s,
  },
  later: {
    minHeight: COMPACT_TAP,
    justifyContent: 'center',
    paddingHorizontal: Space.s,
    marginRight: -Space.s,
    borderRadius: RADIUS,
  },
  linkPressed: {
    backgroundColor: Colors.surface,
  },
  grow: {
    flex: 1,
  },
  stepBody: {
    gap: Space.xl,
  },
  intro: {
    gap: Space.xs,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.m,
    paddingTop: Space.xs,
  },
  // Its words line up with the helper above, not its 44pt target.
  linkFirst: {
    marginLeft: -Space.xs,
  },
  footerStack: {
    gap: Space.s,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  backAction: {
    width: 88,
  },
  action: {
    flex: 1,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  cell: {
    gap: Space.s,
    marginLeft: Space.l,
    paddingRight: Space.l,
    paddingTop: Space.s,
    paddingBottom: Space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  joinedCell: {
    borderBottomWidth: 0,
  },
  ownChip: {
    marginLeft: -Space.l,
    marginRight: -Space.l,
  },
  photoCell: {
    gap: Space.s,
    marginLeft: Space.l,
    paddingRight: Space.l,
    paddingVertical: Space.m,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  photoField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  photoPreview: {
    width: PHOTO,
    height: PHOTO,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: RADIUS,
    backgroundColor: Colors.background,
  },
  previewPressed: {
    opacity: 0.7,
  },
  photoImage: {
    width: PHOTO,
    height: PHOTO,
  },
  photoSide: {
    flex: 1,
    gap: Space.s,
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Space.s,
  },
  photoButton: {
    minHeight: COMPACT_TAP,
    justifyContent: 'center',
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
    backgroundColor: Colors.background,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
});
