import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageProps } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { FittedPhoto } from '@/components/person-photo';
import { ProgressBar } from '@/components/progress-bar';
import { RevealPhoto } from '@/components/reveal-photo';
import { SAME_SESSION_MOST, type RevealSetting } from '@/config/schedule';
import type { CardTiming } from '@/lib/attempts';
import { firstTryCorrect, type CardResult } from '@/lib/queue';
import { noteAnswer, photoShown, startsHidden } from '@/lib/reveal';
import { AFTER_THE_DAY, askedAgain, nextTapCounts, reaskSpot, reviewPass, todayYouSaw, type AskedToday } from '@/lib/session';
import { speak, stopSpeaking } from '@/lib/speak';
import { BLANK, answerOf, fillBlank, hintAt, hintLadder, listNames, type Card, type Round } from '@/lib/stories';
import { Colors } from '@/theme/colors';
import { GUTTER, ICON, RADIUS, Space, TAP } from '@/theme/layout';
import { Fonts } from '@/theme/type';

// The core loop: a card asks for a name (usually a photo and a sentence with a blank; see
// PhrasingKind in src/lib/stories.ts) -> tap a name -> gentle hint until the right one -> the
// whole sentence is read back with the photo, and Next is there at once. No timers, no scores,
// no red.
type PracticeScreenProps = {
  /** The session's cards, in the order the schedule chose. */
  rounds: Round[];
  /** Every approved card: the names for re-asked cards, and each person's facts for hints. */
  deck: Card[];
  /** What was asked earlier today, so a card asked again finds new words if there are any. */
  asked: AskedToday[];
  /** The picture for each person id. */
  photos: Record<string, ImageProps['source']>;
  /** The people with a photo of their own, by id, for "Today you saw" on the wrap-up. */
  faces: Record<string, ImageProps['source']>;
  /** A shared memory's own picture, by card id, shown with the sentence once it's answered. */
  memoryPhotos: Record<string, ImageProps['source']>;
  /** Cards finished today and the day's target, for the progress bar. */
  progress: { completed: number; goal: number };
  /** The whole day's target is finished. */
  dayDone: boolean;
  /** The study day this round began in: it keeps it to the end, even past 05:30. */
  studyDay: string;
  /** How often an eligible card starts behind the "?". */
  revealCards: RevealSetting;
  /** How many cards apart this session keeps one person's cards. */
  apart: number;
  /** A card was remembered, asked with that phrasing. Returns the card's new schedule step. */
  onRemembered: (card: Round, result: CardResult) => number;
  /** The person moved on from a card: what it measured, for the caregiver's insights only. */
  onCardLeft: (card: Round, timing: CardTiming) => void;
  onFinish: () => void;
  onHome: () => void;
};

export function PracticeScreen({ rounds: firstRounds, deck, asked, photos, faces, memoryPhotos, progress, dayDone, studyDay, revealCards, apart, onRemembered, onCardLeft, onFinish, onHome }: PracticeScreenProps) {
  // Whether a card starts behind the "?" is decided as it comes up, from the round's day's answers so far.
  const dealt = (round: Round) => (startsHidden(round, revealCards, studyDay) ? { ...round, reveal: true } : round);
  const [rounds, setRounds] = useState(() => firstRounds.map((round, at) => (at === 0 ? dealt(round) : round)));
  const [index, setIndex] = useState(0);
  // A card that needed a hint comes back at expanding gaps (SAME_SESSION_CARDS in src/config/schedule.ts):
  // which gap each is on, the cards that came back, and how many have, which has a ceiling.
  const [gaps, setGaps] = useState<Record<string, number>>({});
  const [reasked, setReasked] = useState<string[]>([]);
  const [cameBack, setCameBack] = useState(0);
  // Every card that needed a hint, for the final review pass.
  const [hinted, setHinted] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [anyDone, setAnyDone] = useState(false);
  const review = reviewed ? [] : reviewPass(rounds, hinted, reasked, apart);

  function remembered(result: CardResult, revealed: boolean) {
    const card = rounds[index];
    const step = onRemembered(card, result);
    // A reverse card gives the name away, so it says nothing about recognizing them.
    if (card.phrasing.kind !== 'reverse') noteAnswer(card.personId, result, revealed, studyDay);
    setAnyDone(true);
    if (result.hintsUsed > 0 && !hinted.includes(card.id)) setHinted([...hinted, card.id]);
    // After a hint (step 0), the first gap; a card that came back and was answered first time, the
    // next, longer gap; one that needed a hint again, the first gap again. Review cards end there.
    const gap = card.again === 'reask' ? (firstTryCorrect(result) ? (gaps[card.id] ?? 0) + 1 : 0) : !card.again && step === 0 ? 0 : undefined;
    if (gap === undefined || cameBack >= SAME_SESSION_MOST) return;
    const position = reaskSpot(rounds, index, apart, Math.random, gap);
    if (position === null) return;
    setGaps({ ...gaps, [card.id]: gap });
    setCameBack(cameBack + 1);
    if (!reasked.includes(card.id)) setReasked([...reasked, card.id]);
    setRounds([...rounds.slice(0, position), askedAgain(card, rounds, deck, asked, position, 'reask'), ...rounds.slice(position)]);
  }

  /** On from a card. After the last, the short review pass if any card needs one, then the wrap-up. */
  function next() {
    if (index < rounds.length - 1) {
      setRounds(rounds.map((round, at) => (at === index + 1 ? dealt(round) : round)));
      setIndex(index + 1);
    } else if (review.length) {
      setRounds(review.reduce((laid, round) => [...laid, askedAgain(round, laid, deck, asked, laid.length, 'review')], rounds));
      setReviewed(true);
      setIndex(index + 1);
    } else {
      onFinish();
      setIndex(index + 1);
    }
  }

  if (index === rounds.length) {
    return <WrapUp rounds={rounds} faces={faces} progress={progress} dayDone={dayDone} onHome={onHome} />;
  }

  return (
    <PracticeCard
      // A new key gives each card fresh state.
      key={`${index}-${rounds[index].id}`}
      card={rounds[index]}
      photo={photos[rounds[index].personId]}
      memoryPhoto={memoryPhotos[rounds[index].id]}
      progress={progress}
      isLast={index === rounds.length - 1 && review.length === 0}
      onRemembered={remembered}
      onLeave={(timing) => onCardLeft(rounds[index], timing)}
      onNext={next}
      onHome={() => {
        // Stopping is fine at any card: what was finished is saved and counts.
        if (anyDone) onFinish();
        onHome();
      }}
    />
  );
}

/** When a tap happened. Only press handlers call this. */
const tapTime = () => Date.now();

type PracticeCardProps = {
  card: Round;
  photo: ImageProps['source'];
  memoryPhoto?: ImageProps['source'];
  progress: { completed: number; goal: number };
  isLast: boolean;
  /** `revealed`: the "?" was tapped before answering. It costs nothing, and nothing records it. */
  onRemembered: (result: CardResult, revealed: boolean) => void;
  /** Leaving the card, by Next or Home: what it measured. */
  onLeave: (timing: CardTiming) => void;
  onNext: () => void;
  onHome: () => void;
};

// The photo is the hero and the one part that gives way, so the sentence and the names
// always fit. The names, then the success banner, stay at the bottom within reach. Every
// kind of card shows the photo, before and after the answer. The one exception is a reveal
// card, where it waits behind a "?" until tapped, and is always shown by the end of the card.
function PracticeCard({ card, photo, memoryPhoto, progress, isLast, onRemembered, onLeave, onNext, onHome }: PracticeCardProps) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const [remembered, setRemembered] = useState(false);
  // Counts other names chosen: each one moves the hint one rung further (src/lib/stories.ts).
  const [misses, setMisses] = useState(0);
  // The name the "fewer names" hint set aside: the last other name chosen.
  const [setAside, setSetAside] = useState<string>();
  // The "?" was tapped: a free hint, with no penalty.
  const [tapped, setTapped] = useState(false);
  // When the right name was chosen, so that same tap can't also land on Next.
  const answeredAt = useRef(0);
  // For the caregiver's insights only, and invisible here: when the card came up, each answer
  // chosen, the hints shown, and spells in the background, which never count as time on the card.
  const timing = useRef<CardTiming>({ shownAt: 0, selections: [], away: [], leftAt: 0, hints: [] });
  useEffect(() => {
    const measured = timing.current;
    measured.shownAt = Date.now();
    let awaySince = 0;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && awaySince) {
        measured.away.push([awaySince, Date.now()]);
        awaySince = 0;
      } else if (state !== 'active' && !awaySince) {
        awaySince = Date.now();
      }
    });
    return () => subscription.remove();
  }, []);
  const { kind, ask, reveal } = card.phrasing;
  // Before the answer, a "blank" card shows its blank; the others show their question. After
  // it, every card shows the whole sentence with the name filled in.
  const sentence = remembered ? reveal : ask;
  const [before, after] = sentence.split(BLANK);
  const filled = remembered || kind === 'blank' || kind === 'reverse';
  const hint = hintAt(card, misses);
  const choices = card.choices.filter((name) => name !== setAside);
  const target = answerOf(card);
  // A fact can be too long for the one line a name fits on, and the sentence above shows it anyway.
  const said = kind === 'reverse' ? 'it' : target;
  const readBack = `Yes, that’s ${said}. ${fillBlank(reveal, target)}`;

  // With very large text on a small phone, the hint can leave too little room for the photo
  // and the sentence; keep the sentence in view.
  useEffect(() => {
    if (misses > 0) scroll.current?.scrollToEnd({ animated: true });
  }, [misses]);

  function choose(name: string) {
    if (remembered) return;
    timing.current.selections.push({ at: tapTime(), right: name === target });
    if (name === target) {
      answeredAt.current = tapTime();
      setRemembered(true);
      // Saved now, so the card counts even if the app is closed before Next.
      onRemembered({ tries: misses + 1, hintsUsed: misses }, tapped);
      speak(readBack);
    } else {
      const next = hintAt(card, misses + 1);
      // The rung this hint is on, as hintAt chose it.
      const ladder = hintLadder(card);
      const rung = ladder[Math.min(misses + 1, ladder.length) - 1];
      if (rung) timing.current.hints.push(rung);
      setMisses(misses + 1);
      if (next.fewer && !setAside) setSetAside(name);
      AccessibilityInfo.announceForAccessibility(`${next.lead} ${next.detail}`);
    }
  }

  /** Hands up what the card measured, once, as the person leaves it. */
  function leave() {
    const measured = timing.current;
    if (measured.leftAt) return;
    measured.leftAt = tapTime();
    onLeave({ ...measured, selections: [...measured.selections], away: [...measured.away], hints: [...measured.hints] });
  }

  // Moving on leaves the card, so a flip still turning simply stops with it.
  function goOn() {
    if (!nextTapCounts(answeredAt.current, tapTime())) return;
    stopSpeaking();
    leave();
    onNext();
  }

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.screen}>
      <ScrollView ref={scroll} style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + Space.s }]}>
        <View style={styles.topRow}>
          <HomeButton
            onPress={() => {
              stopSpeaking();
              leave();
              onHome();
            }}
          />
          <View style={styles.topProgress}>
            <ProgressBar completed={progress.completed} goal={progress.goal} bare />
          </View>
        </View>
        {/* The photo and its sentence stay together at the top, as one card. */}
        {card.reveal ? (
          <RevealPhoto
            key="reveal"
            source={photo}
            shown={photoShown({ reveal: card.reveal, tapped, answered: remembered })}
            onReveal={() => setTapped(true)}
            style={styles.photoArea}
          />
        ) : remembered && memoryPhoto ? (
          <FittedPhoto key="memory" source={memoryPhoto} style={styles.photoArea} />
        ) : (
          <FittedPhoto key="person" source={photo} style={styles.photoArea} />
        )}
        <AppText testID="story" size="title" accessibilityLabel={filled ? fillBlank(sentence, remembered ? target : 'blank') : sentence}>
          {filled ? (
            <>
              {before}
              {remembered ? <Text style={styles.name}>{target}</Text> : '______'}
              {after}
            </>
          ) : (
            sentence
          )}
        </AppText>
      </ScrollView>

      {remembered ? (
        <Animated.View
          entering={FadeInDown.duration(250)}
          testID="confirmation"
          accessibilityLiveRegion="polite"
          style={[styles.success, { paddingBottom: insets.bottom + Space.l }]}>
          <View style={styles.column}>
            <View style={styles.successLine}>
              <Ionicons name="heart-outline" size={ICON} color={Colors.onSoftSuccess} aria-hidden />
              <AppText fit bold size="title" color={Colors.onSoftSuccess} style={styles.successText}>
                Yes, that’s {said}.
              </AppText>
            </View>
            <BigButton testID="next-card" label={isLast ? 'Finish' : 'Next story'} primary onPress={goOn} />
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.column, styles.answers, { paddingBottom: insets.bottom + Space.l }]}>
          {misses > 0 ? (
            // Keyed by misses so the hint replays its entrance on every tap.
            <Animated.View key={misses} entering={FadeInDown.duration(250)} testID="hint" style={styles.hint}>
              <Ionicons name="bulb-outline" size={ICON} color={Colors.text} aria-hidden />
              <AppText style={styles.hintText}>
                <Text style={styles.bold}>{hint.lead}</Text>
                {hint.detail ? ` ${hint.detail}` : ''}
              </AppText>
            </Animated.View>
          ) : (
            <AppText fit bold size="caption" muted>
              {card.phrasing.fill ? 'Choose one' : 'Choose a name'}
            </AppText>
          )}
          {choices.map((name) => (
            // Once the hint has said the answer, its button shows which one it is.
            <BigButton key={name} label={name} selected={hint.show && name === target} onPress={() => choose(name)} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** Small and out of the way: back to the home screen. The cards done so far still count. */
function HomeButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="home-button"
      accessibilityRole="button"
      accessibilityLabel="Home"
      onPress={onPress}
      style={({ pressed }) => [styles.homeButton, pressed && styles.homePressed]}>
      <Ionicons name="home-outline" size={ICON} color={Colors.textMuted} aria-hidden />
    </Pressable>
  );
}

type WrapUpProps = {
  rounds: Round[];
  faces: Record<string, ImageProps['source']>;
  progress: { completed: number; goal: number };
  dayDone: boolean;
  onHome: () => void;
};

/** Without photos to show: more names than this reads as a count, so the line stays calm. */
const NAMES_LISTED = 5;

// Screen 7: a warm end to the session, with today's progress, and the faces and names of the
// people practiced, seen once more with nothing to do. No score.
function WrapUp({ rounds, faces, progress, dayDone, onHome }: WrapUpProps) {
  const insets = useSafeAreaInsets();
  const seen = todayYouSaw(rounds, faces);
  const names = [...new Set(rounds.map((round) => round.answer))];

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      testID="wrap-up"
      style={[styles.screen, styles.column, styles.wrapUp, { paddingTop: insets.top + Space.l, paddingBottom: insets.bottom + Space.l }]}>
      <View style={styles.wrapUpBody}>
        <Image
          source={require('@/assets/images/logo-mark.png')}
          contentFit="contain"
          style={styles.mark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <AppText accessibilityRole="header" fit center bold size="display">
          {AFTER_THE_DAY.title}
        </AppText>
        {dayDone ? (
          <AppText testID="keep-going-line" center muted>
            {AFTER_THE_DAY.line}
          </AppText>
        ) : null}
        {seen.length ? (
          <View testID="today-you-saw" style={styles.seen}>
            <AppText center muted>
              Today you saw
            </AppText>
            <View style={styles.faces}>
              {seen.map(({ personId, name }) => (
                <View key={personId} style={styles.face}>
                  <Image source={faces[personId]} contentFit="cover" style={styles.faceImage} accessibilityElementsHidden importantForAccessibility="no" />
                  <AppText fit center>
                    {name}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <AppText center>You spent time with {names.length > NAMES_LISTED ? `${names.length} people` : listNames(names)}.</AppText>
        )}
      </View>
      <View style={styles.wrapUpBottom}>
        <ProgressBar completed={progress.completed} goal={progress.goal} />
        <BigButton testID="wrap-up-home" label="Home" primary large onPress={onHome} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  column: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  content: {
    flexGrow: 1,
    gap: Space.l,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingBottom: Space.l,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  topProgress: {
    flex: 1,
  },
  homeButton: {
    width: TAP,
    height: TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  homePressed: {
    backgroundColor: Colors.surface,
  },
  photoArea: {
    flex: 1,
    minHeight: 80,
    maxHeight: 560,
  },
  name: {
    fontFamily: Fonts.bold,
    backgroundColor: Colors.accent,
  },
  answers: {
    gap: Space.m,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: RADIUS,
    backgroundColor: Colors.accentSoft,
  },
  hintText: {
    flex: 1,
  },
  bold: {
    fontFamily: Fonts.bold,
  },
  success: {
    paddingTop: Space.xl,
    backgroundColor: Colors.softSuccess,
  },
  successLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    marginBottom: Space.l,
  },
  successText: {
    flexShrink: 1,
  },
  wrapUp: {
    gap: Space.xl,
  },
  wrapUpBody: {
    flex: 1,
    justifyContent: 'center',
    gap: Space.l,
  },
  mark: {
    width: 110,
    height: 141,
    alignSelf: 'center',
    marginBottom: Space.s,
  },
  seen: {
    gap: Space.m,
  },
  faces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Space.l,
  },
  face: {
    width: 88,
    alignItems: 'center',
    gap: Space.xs,
  },
  faceImage: {
    width: 72,
    height: 72,
    borderRadius: RADIUS,
  },
  wrapUpBottom: {
    gap: Space.xl,
  },
});
