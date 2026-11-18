import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { fromLine, initialsOf, orderNotes, spokenNote, type FamilyNote } from '@/lib/family-notes';
import { speak } from '@/lib/speak';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space, TAP, touchSlop } from '@/theme/layout';

// The Family board on the person's home (docs/PERSON-HOME-PLAN.md): notes the caregiver wrote, read
// only. Calm on purpose: Mist cards (the pinned one in the soft Sky tint, and labelled), Ink words, a
// hairline edge, straight, with no shadow, motion, gradient or decoration, and no pink or yellow.
// Authors are told apart by their initials and names, never by color. scripts/check-board.mjs checks.

export const BOARD_TITLE = 'Family board';
export const BOARD_SUBTITLE = 'Notes from the people who love you.';

/** The title, the notes (pinned first, then newest) and the quiet "View only" line. Nothing at all without notes. */
export function FamilyBoard({ notes }: { notes: FamilyNote[] }) {
  if (notes.length === 0) return null;
  return (
    <View testID="family-board" style={styles.board}>
      <View style={styles.heading}>
        <AppText testID="board-title" accessibilityRole="header" bold size="title">
          {BOARD_TITLE}
        </AppText>
        <AppText size="caption" muted>
          {BOARD_SUBTITLE}
        </AppText>
      </View>
      {orderNotes(notes).map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
      <View testID="board-view-only" style={styles.viewOnly}>
        <Ionicons name="eye-outline" size={ICON} color={Colors.textMuted} aria-hidden />
        <AppText size="caption" muted center>
          New notes from your family appear here.
        </AppText>
      </View>
    </View>
  );
}

/** One note: the words, who it is from, and Read aloud. `actions` lets the caregiver's editor add its own menu. */
export function NoteCard({ note, actions }: { note: FamilyNote; actions?: ReactNode }) {
  const from = fromLine(note);
  return (
    <View testID={`note-${note.id}`} style={[styles.card, note.pinned && styles.pinned]}>
      {note.pinned || actions ? (
        <View style={styles.top}>
          {note.pinned ? (
            <View testID="note-pinned" style={styles.pinnedLabel}>
              <Ionicons name="pin" size={20} color={Colors.text} aria-hidden />
              <AppText bold size="caption">
                Pinned
              </AppText>
            </View>
          ) : (
            <View />
          )}
          {actions}
        </View>
      ) : null}
      <AppText testID="note-body" size="body">
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
          {from ? (
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

/** Reads the note, then who it is from, with the phone's own voice (the read-aloud practice uses). */
function ReadAloud({ note }: { note: FamilyNote }) {
  return (
    <Pressable
      testID="note-read-aloud"
      accessibilityRole="button"
      accessibilityLabel="Read aloud"
      accessibilityHint="Reads this note out loud."
      onPress={() => speak(spokenNote(note))}
      hitSlop={touchSlop()}
      style={({ pressed }) => [styles.readAloud, pressed && styles.readAloudPressed]}>
      <Ionicons name="volume-high-outline" size={20} color={Colors.text} aria-hidden />
      <AppText fit bold size="caption">
        Read aloud
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    gap: Space.m,
  },
  heading: {
    gap: Space.xs,
    paddingBottom: Space.xs,
  },
  card: {
    gap: Space.m,
    padding: Space.l,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  pinned: {
    backgroundColor: Colors.softSuccess,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
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
    minHeight: TAP,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: Colors.text,
    backgroundColor: Colors.background,
  },
  readAloudPressed: {
    backgroundColor: Colors.skySoft,
  },
  viewOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    paddingVertical: Space.s,
  },
});
