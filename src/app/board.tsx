import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverButton } from '@/components/caregiver-button';
import { BoardHeader, BoardSection, NoteCard, TodayRow, ViewOnly } from '@/components/family-board';
import { TextSizeButton, TextSizeSheet } from '@/components/text-size';
import { doneToday, refreshBoard, useBoardNotes, usePractice } from '@/data/app-data';
import { REMINDERS_AVAILABLE, useReminders } from '@/data/reminders';
import { BOARD_EMPTY, orderNotes } from '@/lib/family-notes';
import { timeLabel } from '@/lib/reminders';
import { Colors } from '@/theme/colors';
import { GUTTER, Space } from '@/theme/layout';

// Screen 9, the person's side (docs/FAMILY-BOARD-TAB-PLAN.md): their Family board, which View dashboard
// opens from the home on every phone. Read only: the notes their caregiver wrote, from this phone's copy
// first and then the server, refreshed on opening and on coming back to the app. At the top, Aa (their
// text size and reminders) and the held Caregiver control, the same one the home has; at the bottom, a
// large Back to home. TODAY shows only the person's own daily reminder, kept on this phone (never the
// caregiver's). With no notes, one calm sentence and nothing else. No new motion: it fades in as the
// home and practice do.
export default function Board() {
  const insets = useSafeAreaInsets();
  const notes = useBoardNotes();
  const practice = usePractice();
  const reminders = useReminders();
  const [remindersOpen, setRemindersOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshBoard();
    }, []),
  );
  // A note the caregiver saved shows when the person comes back to the app, as well as on opening the board.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshBoard();
    });
    return () => listener.remove();
  }, []);

  // Today's one reminder: on, allowed by the phone, and today's practice not yet done.
  const reminder = REMINDERS_AVAILABLE && reminders?.settings.on && reminders.permission === 'granted' && practice && !doneToday(practice) ? reminders.settings.time : undefined;
  const ordered = orderNotes(notes ?? []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.s, paddingBottom: insets.bottom + Space.l }]}>
      <View style={styles.top}>
        <TextSizeButton />
        <CaregiverButton label="Hold to open" />
      </View>
      <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent}>
        <BoardHeader />
        {notes && ordered.length === 0 ? (
          <AppText testID="board-empty" muted>
            {BOARD_EMPTY}
          </AppText>
        ) : null}
        {ordered.length > 0 ? (
          <>
            {reminder !== undefined ? (
              <BoardSection label="Today" testID="board-today">
                <TodayRow testID="today-reminder" title="Practice reminder" time={timeLabel(reminder)} onPress={() => setRemindersOpen(true)} />
              </BoardSection>
            ) : null}
            <BoardSection label="Notes" testID="family-board">
              {ordered.map((note, index) => (
                <NoteCard key={note.id} note={note} index={index} />
              ))}
            </BoardSection>
            <ViewOnly />
          </>
        ) : null}
      </ScrollView>
      <BigButton testID="board-back" label="Back to home" icon="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <TextSizeSheet visible={remindersOpen} onClose={() => setRemindersOpen(false)} reminders startOn="reminders" />
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
    gap: Space.xl,
    paddingTop: Space.l,
    paddingBottom: Space.xl,
  },
});
