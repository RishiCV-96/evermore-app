import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { TandemLogo } from '@/components/tandem-logo';
import { BOARD_SUBTITLE, BOARD_TITLE, VIEW_ONLY, initialsOf, spokenNote, type FamilyNote } from '@/lib/family-notes';
import { speak } from '@/lib/speak';
import { Colors } from '@/theme/colors';
import { ICON, PERSON_TOUCH, RADIUS, Space } from '@/theme/layout';

// The person's Family board (src/app/board.tsx, docs/FAMILY-BOARD-TAB-PLAN.md), the left-hand phone of
// the concept: notes the caregiver wrote, read only. Calm on purpose: Mist and Sky-tint cards with an Ink
// hairline, the pinned one with a thicker Ink outline and "Pinned", Ink words, straight, with no shadow,
// motion, gradient or decoration, and no pink, red or yellow. Authors are told apart by their initials
// and names, never by color. Every target is at least 56pt. scripts/check-board.mjs checks.

/** The two fills, in turn down the board: Mist, then the Sky tint. Ink words on both pass 7:1. */
const FILLS = [Colors.surface, Colors.softSuccess];

/** The flower mark, the title and the subtitle. */
export function BoardHeader() {
  return (
    <View style={styles.header}>
      <TandemLogo size="board" testID="logo-board" decorative />
      <View style={styles.headerWords}>
        <AppText testID="board-title" accessibilityRole="header" bold size="title">
          {BOARD_TITLE}
        </AppText>
        <AppText size="caption" muted>
          {BOARD_SUBTITLE}
        </AppText>
      </View>
    </View>
  );
}

/** "TODAY", "NOTES": small and letter-spaced, upper case on screen only, so screen readers say "Today". */
export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText accessibilityRole="header" bold size="caption" muted style={styles.sectionLabel}>
      {children}
    </AppText>
  );
}

/** One thing happening today: a dot, its title and its time. A tap opens it. */
export function TodayRow({ title, time, onPress, testID }: { title: string; time: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${time}`}
      accessibilityHint="Opens your reminder."
      onPress={onPress}
      style={({ pressed }) => [styles.todayRow, pressed && styles.pressed]}>
      <View style={styles.dot} aria-hidden />
      <View style={styles.todayWords}>
        <AppText bold>{title}</AppText>
        <AppText size="caption" muted>
          {time}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden />
    </Pressable>
  );
}

/** One note: "Pinned" if it is, the words, who it is from, and Read aloud. */
export function NoteCard({ note, index }: { note: FamilyNote; index: number }) {
  return (
    <View testID={`note-${note.id}`} style={[styles.card, { backgroundColor: FILLS[index % FILLS.length] }, note.pinned && styles.pinned]}>
      {note.pinned ? (
        <View testID="note-pinned" style={styles.pinnedLabel}>
          <Ionicons name="pin" size={20} color={Colors.text} aria-hidden />
          <AppText bold size="caption">
            Pinned
          </AppText>
        </View>
      ) : null}
      <AppText testID="note-body" bold>
        {note.body}
      </AppText>
      <View style={styles.footer}>
        <View style={styles.from}>
          <View style={styles.avatar} aria-hidden>
            {note.fromName ? (
              <AppText bold size="caption">
                {initialsOf(note.fromName)}
              </AppText>
            ) : (
              <Ionicons name="heart-outline" size={20} color={Colors.text} />
            )}
          </View>
          {note.fromName || note.fromRelationship ? (
            <View style={styles.fromWords}>
              {note.fromName ? (
                <AppText testID="note-from" bold size="caption">
                  {note.fromName}
                </AppText>
              ) : null}
              {note.fromRelationship ? (
                <AppText size="caption" muted>
                  {note.fromRelationship}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
        <ReadAloud note={note} />
      </View>
    </View>
  );
}

/** Reads the note, then who it is from, with the phone's own voice (the read-aloud practice uses). Drawn 56pt tall. */
function ReadAloud({ note }: { note: FamilyNote }) {
  return (
    <Pressable
      testID="note-read-aloud"
      accessibilityRole="button"
      accessibilityLabel="Read aloud"
      accessibilityHint="Reads this note out loud."
      onPress={() => speak(spokenNote(note))}
      style={({ pressed }) => [styles.readAloud, pressed && styles.pressed]}>
      <Ionicons name="volume-high-outline" size={ICON} color={Colors.text} aria-hidden />
      <AppText fit bold>
        Read aloud
      </AppText>
    </Pressable>
  );
}

/** The quiet line at the end: the board is for reading, and new notes come here. */
export function ViewOnly() {
  return (
    <View testID="board-view-only" style={styles.viewOnly}>
      <Ionicons name="eye-outline" size={ICON} color={Colors.textMuted} aria-hidden />
      <AppText size="caption" muted center style={styles.viewOnlyWords}>
        {VIEW_ONLY}
      </AppText>
    </View>
  );
}

/** A section: its label and what is in it. */
export function BoardSection({ label, children, testID }: { label: string; children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.section}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  headerWords: {
    flex: 1,
    gap: Space.xs,
  },
  section: {
    gap: Space.m,
  },
  sectionLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: PERSON_TOUCH + Space.l,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.text,
  },
  todayWords: {
    flex: 1,
  },
  card: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.text,
  },
  // Pinned is said in words ("Pinned") and drawn with a thicker Ink outline, never by color alone.
  pinned: {
    borderWidth: 2,
  },
  pinnedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  // Who it is from, and Read aloud beside it where they fit, under it where they don't.
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.m,
  },
  from: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    flexShrink: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.sky,
  },
  fromWords: {
    flexShrink: 1,
  },
  readAloud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: PERSON_TOUCH,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: Colors.text,
    backgroundColor: Colors.background,
  },
  pressed: {
    backgroundColor: Colors.skySoft,
  },
  viewOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    paddingVertical: Space.s,
  },
  viewOnlyWords: {
    flexShrink: 1,
  },
});
