import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverButton } from '@/components/caregiver-button';
import { TandemLogo } from '@/components/tandem-logo';
import { PracticeMore } from '@/components/practice-more';
import { ProgressBar } from '@/components/progress-bar';
import { ReminderQuestion, useReminderSync } from '@/components/reminders';
import { SuccessBanner } from '@/components/success-banner';
import { TextSizeButton } from '@/components/text-size';
import { completedToday, deckCards, doneToday, refreshPractice, takeHandoff, useHandoff, usePractice, useWho } from '@/data/app-data';
import { mayAsk, useReminders } from '@/data/reminders';
import { useStudyDay } from '@/data/study-clock';
import { AFTER_THE_DAY, enoughPeople, todayLine } from '@/lib/session';
import { Colors } from '@/theme/colors';
import { GUTTER, Space } from '@/theme/layout';

// Screen 2, the person's home: the logo, a greeting, today's progress and one big Start. It
// counts finished cards only. The person can stop and come back at any time. Once the day's
// session is finished, a warm message and Keep practicing, always there, at any hour: one person
// again, or a mix. Nothing ever says they can't practice, and nothing counts down. A new study day
// begins at 05:30 (src/lib/study-day.ts), and the home moves into it while open. The home also
// keeps this phone's daily reminder right, and after the first completed session asks once, gently,
// whether the person would like one (src/components/reminders.tsx).
export default function Home() {
  const insets = useSafeAreaInsets();
  const who = useWho();
  const practice = usePractice();
  // With sign-in off, the caregiver can hand the phone over straight into one person's cards.
  const handoff = useHandoff();
  // Re-renders when a new study day begins, so a fresh day's session is ready at 05:30 without a reload.
  useStudyDay();
  const reminders = useReminders();
  // Whether the home is the screen in front, so the question never opens over the wrap-up.
  const [inFront, setInFront] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshPractice();
      setInFront(true);
      return () => setInFront(false);
    }, []),
  );
  useReminderSync(practice);

  useEffect(() => {
    if (!handoff) return;
    takeHandoff();
    router.push({ pathname: '/practice', params: { person: handoff } });
  }, [handoff]);

  if (!practice) return null;

  const done = completedToday(practice);
  const met = doneToday(practice);
  // With fewer than two people there would be no choice to make, so there's nothing to start.
  const hasStories = enoughPeople(deckCards(practice));
  const estimate = todayLine(practice.goal, done);
  const askAboutReminders = inFront && hasStories && met && mayAsk(reminders);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.s, paddingBottom: insets.bottom + Space.l }]}>
      <View style={styles.top}>
        <TextSizeButton />
        <CaregiverButton />
      </View>
      {/* Scrolls only if very large text on a small phone needs it, so Start is never pushed off the screen. */}
      <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent}>
        <TandemLogo size="home" testID="logo-home" />
        <AppText accessibilityRole="header" fit center bold size="display">
          {who.name ? `Hello, ${who.name}.` : 'Hello.'}
        </AppText>
        {!hasStories ? (
          <AppText center muted>
            Stories appear here once a caregiver adds and approves them.
          </AppText>
        ) : met ? (
          <View style={styles.ready}>
            <SuccessBanner testID="all-done">{AFTER_THE_DAY.title}</SuccessBanner>
            <AppText testID="keep-going-line" center muted>
              {AFTER_THE_DAY.line}
            </AppText>
          </View>
        ) : (
          <View style={styles.ready}>
            <AppText center muted>
              {done === 0 ? 'Your stories are ready.' : 'Ready for a few more stories?'}
            </AppText>
            {estimate ? (
              <AppText testID="today-estimate" center muted size="caption">
                {estimate}
              </AppText>
            ) : null}
          </View>
        )}
      </ScrollView>
      {hasStories ? (
        <View style={styles.bottom}>
          <ProgressBar completed={done} goal={practice.goal} />
          {met ? (
            <PracticeMore people={practice.people} />
          ) : (
            <BigButton testID="start" label={done === 0 ? 'Start' : 'Keep going'} primary large onPress={() => router.push('/practice')} />
          )}
        </View>
      ) : null}
      <ReminderQuestion visible={askAboutReminders} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    backgroundColor: Colors.background,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  middle: {
    flex: 1,
  },
  middleContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Space.l,
    paddingVertical: Space.m,
  },
  ready: {
    gap: Space.s,
  },
  bottom: {
    gap: Space.xl,
  },
});
