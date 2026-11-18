import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { EmptyState, FormGroup, FormRow, Notice, Row } from '@/components/caregiver-ui';
import { Pressed } from '@/components/pressed';
import { Sheet } from '@/components/sheet';
import { TandemLogo } from '@/components/tandem-logo';
import { lastAuthor, rememberAuthor } from '@/data/board-author';
import { addNote, deleteNote, editNote, pinNote, refreshBoard, useBoardNotes } from '@/data/app-data';
import { cardTones, noteTilt, type CardTone } from '@/lib/board-look';
import { confirm } from '@/lib/confirm';
import {
  BOARD_FULL,
  BOARD_SUBTITLE,
  BOARD_TITLE,
  FROM_LETTERS,
  NOTE_LETTERS,
  NOTES_MOST,
  canAddNote,
  initialsOf,
  noteProblem,
  orderNotes,
  spokenNote,
  type FamilyNote,
  type NoteDraft,
} from '@/lib/family-notes';
import { speak } from '@/lib/speak';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { Elevation } from '@/theme/elevation';
import { CAREGIVER_GUTTER, COMPACT_TAP, Radius, Space } from '@/theme/layout';

// The caregiver's Family board tab (docs/FAMILY-BOARD-TAB-PLAN.md), the right-hand phone of the concept:
// the flower mark, the title and the Caregiver chip; then the notes as soft pastel cards (the pinned one
// in the warm sun tint, the others rose and sky in turn), each tilted very slightly by its id, with a
// "···" menu (Edit, Pin to top or Unpin, Delete) and Read aloud; and a floating Add note above the tab
// bar that opens the note form in a sheet. Only the caregiver writes; the person's board only reads.
// The caregiver's side only: the pinks, the sun tint and the tilt never reach a person's screen
// (scripts/check-board.mjs and scripts/check-logic.mjs follow every import from the person's screens).

/** The card's corner, and its padding: what sits inside near a corner uses the difference (concentric). */
const CARD_RADIUS = 20;
const CARD_PAD = Space.l;
const MENU_INSET = Space.xs;

/** Each pastel's card, the circle behind its initials (a deeper tone of the same), and the text on both is Ink. */
const TONES: Record<CardTone, { card: string; avatar: string }> = {
  sun: { card: Colors.accentSoft, avatar: Colors.accent },
  rose: { card: Colors.pink1, avatar: Colors.pink2 },
  sky: { card: Colors.softSuccess, avatar: Colors.sky },
};

type Editing = { id: string | null; draft: NoteDraft };

/** The whole tab: its own header and scrolling list, and the Add note button floating just above the tab bar. */
export function FamilyBoardTab() {
  const notes = useBoardNotes();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<string>();
  const [fullNote, setFullNote] = useState(false);
  // The one note whose menu is open: it floats over the cards below, so its card is raised above them.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const loading = !notes;
  const full = notes ? !canAddNote(notes) : false;
  const ordered = orderNotes(notes ?? []);
  const tones = cardTones(ordered);

  useEffect(() => {
    void refreshBoard();
  }, []);

  async function run(change: Promise<string | undefined>) {
    setNotice(await change.catch(() => 'That change couldn’t be saved. Please try again.'));
  }

  async function startAdding() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (full) {
      setFullNote(true);
      return;
    }
    setEditing({ id: null, draft: { body: '', ...(await lastAuthor()) } });
  }

  const startEditing = (note: FamilyNote) => setEditing({ id: note.id, draft: { body: note.body, fromName: note.fromName, fromRelationship: note.fromRelationship } });

  return (
    <View testID="board-tab" style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} onScrollBeginDrag={() => setMenuFor(null)}>
        <View style={styles.chipRow}>
          <View testID="caregiver-chip" style={styles.chip}>
            <AppText bold size="caption" color={Colors.deepRose}>
              Caregiver
            </AppText>
          </View>
        </View>
        <View style={styles.header}>
          <TandemLogo size="board" testID="logo-board-caregiver" decorative />
          <View style={styles.headerWords}>
            <AppText testID="page-title" accessibilityRole="header" fit bold size="display">
              {BOARD_TITLE}
            </AppText>
            <AppText size="caption" muted>
              {BOARD_SUBTITLE}
            </AppText>
          </View>
        </View>
        {notice ? <Notice>{notice}</Notice> : null}
        {loading ? (
          <AppText testID="board-loading" size="caption" muted>
            Getting the board…
          </AppText>
        ) : ordered.length === 0 ? (
          <EmptyState testID="board-empty" icon="chatbubble-ellipses-outline" title="No notes yet">
            {`Up to ${NOTES_MOST} short notes from family. They show on their Family board, which View dashboard opens on their home screen.`}
          </EmptyState>
        ) : (
          <View style={styles.section}>
            <SectionLabel>Notes</SectionLabel>
            {ordered.map((note, index) => (
              <BoardCard
                key={note.id}
                note={note}
                tone={tones[index]}
                menuOpen={menuFor === note.id}
                // The last card's menu opens upward, so the floating Add note never covers it.
                menuUp={index > 0 && index === ordered.length - 1}
                onToggleMenu={(open) => {
                  setMenuFor(open ? note.id : null);
                  setFullNote(false);
                }}
                onEdit={() => startEditing(note)}
                onPin={() => run(pinNote(note.pinned ? null : note.id))}
                onDelete={async () => {
                  if (await confirm('Delete this note?', 'It goes from their Family board.', 'Delete')) await run(deleteNote(note.id));
                }}
              />
            ))}
          </View>
        )}
        {/* Room under the last card for the floating Add note. */}
        <View style={styles.spacer} />
      </ScrollView>
      <View pointerEvents="box-none" style={styles.addArea}>
        {/* The friendly line about a full board, after a tap on Add note; it goes once there is room again. */}
        {fullNote && full ? (
          <View testID="board-full" accessibilityLiveRegion="polite" style={styles.fullNote}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.text} aria-hidden />
            <AppText size="caption" style={styles.fullWords}>
              {BOARD_FULL}
            </AppText>
          </View>
        ) : null}
        <Pressed
          testID="add-note"
          accessibilityRole="button"
          accessibilityLabel="Add note"
          accessibilityHint={full ? BOARD_FULL : 'Opens a new note.'}
          accessibilityState={{ disabled: loading }}
          disabled={loading}
          onPress={startAdding}
          tone={[Colors.primary, Colors.primaryDark]}
          style={styles.add}>
          <Ionicons name="add" size={22} color={Colors.onPrimary} aria-hidden />
          <AppText fit bold color={Colors.onPrimary}>
            Add note
          </AppText>
        </Pressed>
      </View>
      <Sheet visible={Boolean(editing)} title={editing?.id ? 'Edit note' : 'Add note'} onClose={() => setEditing(null)}>
        {editing ? (
          <NoteForm
            editing={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setNotice(undefined);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

/** "NOTES": small, letter-spaced and muted. Upper case on screen only, so screen readers say "Notes". */
function SectionLabel({ children }: { children: string }) {
  return (
    <AppText accessibilityRole="header" bold size="caption" muted style={styles.sectionLabel}>
      {children}
    </AppText>
  );
}

type BoardCardProps = {
  note: FamilyNote;
  tone: CardTone;
  menuOpen: boolean;
  menuUp: boolean;
  onToggleMenu: (open: boolean) => void;
  onEdit: () => void;
  onPin: () => void;
  onDelete: () => void;
};

/** One note: tilted by its id, in its pastel. A tap anywhere on it opens Edit, as the menu's Edit does. */
function BoardCard({ note, tone, menuOpen, menuUp, onToggleMenu, onEdit, onPin, onDelete }: BoardCardProps) {
  const look = TONES[tone];
  return (
    <View style={[styles.cardTilt, { transform: [{ rotate: `${noteTilt(note.id)}deg` }] }, menuOpen && styles.raised]}>
      <Pressed testID={`note-${note.id}`} accessible={false} onPress={onEdit} style={[styles.card, { backgroundColor: look.card }]}>
        <View style={styles.cardTop}>
          {note.pinned ? (
            <View testID="note-pinned" style={styles.pinned}>
              <Ionicons name="pin" size={16} color={Colors.text} aria-hidden />
              <AppText bold size="caption">
                Pinned
              </AppText>
            </View>
          ) : (
            <View />
          )}
          <NoteMenu note={note} open={menuOpen} up={menuUp} onToggle={onToggleMenu} onEdit={onEdit} onPin={onPin} onDelete={onDelete} />
        </View>
        <AppText testID="note-body" bold size="headline">
          {note.body}
        </AppText>
        <View style={styles.footer}>
          <View style={styles.from}>
            <View style={[styles.avatar, { backgroundColor: look.avatar }]} aria-hidden>
              {note.fromName ? (
                <AppText bold size="caption">
                  {initialsOf(note.fromName)}
                </AppText>
              ) : (
                <Ionicons name="heart-outline" size={18} color={Colors.text} />
              )}
            </View>
            <View style={styles.fromWords}>
              {note.fromName ? (
                <AppText testID="note-from" bold size="caption" numberOfLines={1}>
                  {note.fromName}
                </AppText>
              ) : null}
              {note.fromRelationship ? (
                <AppText size="caption" muted numberOfLines={1}>
                  {note.fromRelationship}
                </AppText>
              ) : null}
            </View>
          </View>
          <Pressed
            testID="note-read-aloud"
            accessibilityRole="button"
            accessibilityLabel="Read aloud"
            accessibilityHint="Reads this note out loud."
            onPress={() => speak(spokenNote(note))}
            hitSlop={(COMPACT_TAP - READ_HEIGHT) / 2}
            tone={[Colors.background, Colors.surface]}
            style={styles.readAloud}>
            <Ionicons name="volume-high-outline" size={16} color={Colors.text} aria-hidden />
            <AppText fit bold size="caption">
              Read aloud
            </AppText>
          </Pressed>
        </View>
      </Pressed>
    </View>
  );
}

/** The "···" button on a card, and Edit, Pin to top (or Unpin) and Delete floating under it (or over it, `up`). */
function NoteMenu({ note, open, up, onToggle, onEdit, onPin, onDelete }: { note: FamilyNote; open: boolean; up: boolean; onToggle: (open: boolean) => void; onEdit: () => void; onPin: () => void; onDelete: () => void }) {
  const accent = useAccent();
  const choose = (action: () => void) => () => {
    onToggle(false);
    action();
  };
  return (
    <View style={styles.menu}>
      <Pressable
        testID="note-menu"
        accessibilityRole="button"
        accessibilityLabel="Note options"
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(!open)}
        style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}>
        <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} aria-hidden />
      </Pressable>
      {open ? (
        <View style={[styles.menuList, up && styles.menuUp, Elevation.lifted]}>
          {[
            { id: 'note-edit', label: 'Edit', icon: 'create-outline' as const, action: onEdit },
            { id: 'note-pin', label: note.pinned ? 'Unpin' : 'Pin to top', icon: 'pin-outline' as const, action: onPin },
            { id: 'note-delete', label: 'Delete', icon: 'trash-outline' as const, action: onDelete },
          ].map((item) => (
            <Pressable key={item.id} testID={item.id} accessibilityRole="button" onPress={choose(item.action)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuPressed]}>
              <Ionicons name={item.icon} size={20} color={accent} aria-hidden />
              <AppText size="body">{item.label}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The note's words, From and Relationship: labels above fields, a live counter, and calm words when something's missing. */
function NoteForm({ editing, onCancel, onSaved }: { editing: Editing; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<NoteDraft>(editing.draft);
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [saving, setSaving] = useState(false);
  const problem = noteProblem(draft);

  async function save() {
    setTried(true);
    if (problem) return;
    setSaving(true);
    const answer = await (editing.id ? editNote(editing.id, draft) : addNote(draft)).catch(() => 'That note couldn’t be saved. Please try again.');
    setSaving(false);
    if (answer) {
      setNotice(answer);
      return;
    }
    await rememberAuthor(draft);
    onSaved();
  }

  return (
    <View style={styles.form}>
      <AppText size="caption" muted>
        Keep it short and warm. It shows on their Family board as you write it.
      </AppText>
      <FormGroup>
        <FormRow
          testID="note-body-field"
          label="Note"
          required
          value={draft.body}
          onChangeText={(body) => setDraft({ ...draft, body })}
          multiline
          maxLength={NOTE_LETTERS}
          placeholder="e.g. Dinner Sunday at 5."
          trailing={
            <AppText testID="note-counter" size="caption" muted tabular>
              {`${draft.body.length} of ${NOTE_LETTERS}`}
            </AppText>
          }
          note={tried ? problem : undefined}
        />
        <FormRow
          testID="note-from-field"
          label="From"
          value={draft.fromName ?? ''}
          onChangeText={(fromName) => setDraft({ ...draft, fromName })}
          maxLength={FROM_LETTERS}
          placeholder="e.g. Mae"
          autoCapitalize="words"
        />
        <FormRow
          testID="note-relationship-field"
          label="Relationship"
          value={draft.fromRelationship ?? ''}
          onChangeText={(fromRelationship) => setDraft({ ...draft, fromRelationship })}
          maxLength={FROM_LETTERS}
          placeholder="e.g. Granddaughter"
        />
      </FormGroup>
      <AppText size="caption" muted>
        From and Relationship are optional, and fill in with the last ones you used. They show under the note.
      </AppText>
      {notice ? <Notice>{notice}</Notice> : null}
      <BigButton testID="note-save" label={saving ? 'Saving…' : 'Save'} primary disabled={saving} onPress={save} />
      <BigButton testID="note-cancel" quiet label="Cancel" onPress={onCancel} />
    </View>
  );
}

/** Settings → The person's phone: one quiet row that jumps to the Board tab, so the board is easy to find. */
export function FamilyBoardRow({ onOpen }: { onOpen: () => void }) {
  const notes = useBoardNotes();
  return (
    <Row
      testID="family-board-row"
      label={BOARD_TITLE}
      icon="chatbubble-ellipses-outline"
      subtitle="In the Board tab."
      value={notes ? `${notes.length} of ${NOTES_MOST}` : ''}
      onPress={onOpen}
    />
  );
}

const READ_HEIGHT = 32;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: Space.l,
    paddingHorizontal: CAREGIVER_GUTTER,
    paddingTop: Space.xs,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  chip: {
    paddingHorizontal: Space.m,
    paddingVertical: Space.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.pinkTint,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    marginTop: -Space.s,
  },
  headerWords: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: Space.m,
  },
  sectionLabel: {
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: Space.xs,
  },
  cardTilt: {
    borderRadius: CARD_RADIUS,
  },
  raised: {
    zIndex: 10,
  },
  card: {
    gap: Space.m,
    padding: CARD_PAD,
    paddingTop: CARD_PAD - MENU_INSET,
    borderRadius: CARD_RADIUS,
    ...Elevation.edge,
  },
  // Above the words below it, so the floating menu covers them.
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: -(CARD_PAD - MENU_INSET),
    marginBottom: -Space.s,
    zIndex: 1,
  },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.s,
  },
  from: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    flexShrink: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromWords: {
    flexShrink: 1,
  },
  readAloud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    height: READ_HEIGHT,
    paddingHorizontal: Space.m,
    borderRadius: Radius.pill,
    ...Elevation.edge,
  },
  menu: {
    alignItems: 'flex-end',
  },
  menuButton: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    // Concentric with the card's corner, from which it sits MENU_INSET in.
    borderRadius: CARD_RADIUS - MENU_INSET,
  },
  menuPressed: {
    backgroundColor: Colors.surface,
  },
  // Floats over the card and the ones below, from just under the "···" button, without moving anything.
  menuList: {
    position: 'absolute',
    top: COMPACT_TAP + Space.xs,
    right: 0,
    zIndex: 10,
    minWidth: 180,
    paddingVertical: Space.xs,
    borderRadius: Radius.inner,
    backgroundColor: Colors.background,
  },
  menuUp: {
    top: undefined,
    bottom: COMPACT_TAP + Space.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingHorizontal: Space.l,
  },
  spacer: {
    height: 96,
  },
  // The tab sits above the tab bar, so its bottom edge is the bar's top: the button floats just above it.
  addArea: {
    position: 'absolute',
    bottom: Space.m,
    left: CAREGIVER_GUTTER,
    right: CAREGIVER_GUTTER,
    gap: Space.s,
  },
  fullNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: Radius.control,
    backgroundColor: Colors.surface,
    ...Elevation.edge,
  },
  fullWords: {
    flex: 1,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    minHeight: 52,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.pill,
    ...Elevation.lifted,
  },
  form: {
    gap: Space.l,
  },
});
