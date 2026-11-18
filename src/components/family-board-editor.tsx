import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { EmptyState, FormGroup, FormRow, Notice, Row } from '@/components/caregiver-ui';
import { BOARD_SUBTITLE, BOARD_TITLE, NoteCard } from '@/components/family-board';
import { Sheet } from '@/components/sheet';
import { addNote, deleteNote, editNote, pinNote, useBoardNotes } from '@/data/app-data';
import { confirm } from '@/lib/confirm';
import { BOARD_FULL, FROM_LETTERS, NOTE_LETTERS, NOTES_MOST, canAddNote, noteProblem, orderNotes, type FamilyNote, type NoteDraft } from '@/lib/family-notes';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { Elevation } from '@/theme/elevation';
import { CAREGIVER_GUTTER, COMPACT_TAP, Radius, Space } from '@/theme/layout';

// The caregiver's Family board (docs/PERSON-HOME-PLAN.md): Settings → The person's phone → Family board.
// A sheet that mirrors the person's board, each card with Edit, Pin to top and Delete, a sticky Add
// note, and the note form swapped into the same sheet, so no sheet opens on a sheet. Only the caregiver
// writes; the person's phone only reads.

const GUIDANCE = 'Keep it short and warm. It shows on their home screen as you write it.';

/** The Settings row and its sheet. */
export function FamilyBoardSetting() {
  const notes = useBoardNotes();
  const [open, setOpen] = useState(false);
  const count = notes?.length ?? 0;
  return (
    <>
      <Row
        testID="family-board-row"
        label={BOARD_TITLE}
        icon="chatbubble-ellipses-outline"
        subtitle="Short notes on their home screen."
        value={notes ? `${count} of ${NOTES_MOST}` : ''}
        onPress={() => setOpen(true)}
      />
      <BoardSheet visible={open} notes={notes ?? []} loading={!notes} onClose={() => setOpen(false)} />
    </>
  );
}

type Editing = { id: string | null; draft: NoteDraft } | null;

function BoardSheet({ visible, notes, loading, onClose }: { visible: boolean; notes: FamilyNote[]; loading: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string>();
  const full = !canAddNote(notes);

  function close() {
    setEditing(null);
    setNotice(undefined);
    onClose();
  }

  async function run(change: Promise<string | undefined>) {
    setNotice(await change.catch(() => 'That change couldn’t be saved. Please try again.'));
  }

  const addBar = editing ? null : (
    <View style={[styles.addBar, { paddingBottom: insets.bottom + Space.m }]}>
      {full ? (
        <AppText testID="board-full" size="caption" muted center>
          {BOARD_FULL}
        </AppText>
      ) : null}
      <BigButton testID="add-note" label="Add note" primary disabled={full || loading} onPress={() => setEditing({ id: null, draft: { body: '' } })} />
    </View>
  );

  return (
    <Sheet visible={visible} title={editing ? (editing.id ? 'Edit note' : 'Add note') : BOARD_TITLE} onClose={close} overlay={addBar}>
      {editing ? (
        <NoteForm
          editing={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice(undefined);
          }}
        />
      ) : (
        <View style={styles.list}>
          <AppText size="caption" muted>
            {BOARD_SUBTITLE} They appear on the person’s home screen, the pinned one first. Only you can add or change them.
          </AppText>
          {notice ? <Notice>{notice}</Notice> : null}
          {notes.length === 0 && !loading ? (
            <EmptyState testID="board-empty" icon="chatbubble-ellipses-outline" title="No notes yet">
              A short note from family appears on their home screen.
            </EmptyState>
          ) : null}
          {orderNotes(notes).map((note) => (
            <View key={note.id} style={styles.cardShadow}>
              <NoteCard
                note={note}
                actions={
                  <NoteMenu
                    note={note}
                    onEdit={() => setEditing({ id: note.id, draft: { body: note.body, fromName: note.fromName, fromRelationship: note.fromRelationship } })}
                    onPin={() => run(pinNote(note.pinned ? null : note.id))}
                    onDelete={async () => {
                      if (await confirm('Delete this note?', 'It goes from their home screen.', 'Delete')) await run(deleteNote(note.id));
                    }}
                  />
                }
              />
            </View>
          ))}
          {/* Room under the last card for the pinned Add note bar. */}
          <View style={styles.spacer} />
        </View>
      )}
    </Sheet>
  );
}

/** The "…" button on a card, opening Edit, Pin to top (or Unpin) and Delete under it. */
function NoteMenu({ note, onEdit, onPin, onDelete }: { note: FamilyNote; onEdit: () => void; onPin: () => void; onDelete: () => void }) {
  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <View style={styles.menu}>
      <Pressable
        testID="note-menu"
        accessibilityRole="button"
        accessibilityLabel="Note options"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}>
        <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} aria-hidden />
      </Pressable>
      {open ? (
        <View style={[styles.menuList, Elevation.lifted]}>
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
function NoteForm({ editing, onCancel, onSaved }: { editing: NonNullable<Editing>; onCancel: () => void; onSaved: () => void }) {
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
    if (answer) setNotice(answer);
    else onSaved();
  }

  return (
    <View style={styles.form}>
      <AppText size="caption" muted>
        {GUIDANCE}
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
          placeholder="e.g. Dinner at my place Sunday at 5."
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
          placeholder="e.g. Mikayla"
          autoCapitalize="words"
        />
        <FormRow
          testID="note-relationship-field"
          label="Relationship"
          value={draft.fromRelationship ?? ''}
          onChangeText={(fromRelationship) => setDraft({ ...draft, fromRelationship })}
          maxLength={FROM_LETTERS}
          placeholder="e.g. Daughter"
        />
      </FormGroup>
      <AppText size="caption" muted>
        From and Relationship are optional. They show under the note, as “Mikayla, Daughter”.
      </AppText>
      {notice ? <Notice>{notice}</Notice> : null}
      <BigButton testID="note-save" label={saving ? 'Saving…' : 'Save'} primary disabled={saving} onPress={save} />
      <BigButton testID="note-cancel" quiet label="Cancel" onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Space.l,
  },
  form: {
    gap: Space.l,
  },
  cardShadow: {
    borderRadius: Radius.card,
    ...Elevation.edge,
  },
  spacer: {
    height: 120,
  },
  addBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Space.s,
    paddingTop: Space.m,
    paddingHorizontal: CAREGIVER_GUTTER,
    backgroundColor: Colors.background,
    ...Elevation.float,
  },
  menu: {
    alignItems: 'flex-end',
  },
  menuButton: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control,
  },
  menuPressed: {
    backgroundColor: Colors.skySoft,
  },
  menuList: {
    marginTop: Space.xs,
    minWidth: 180,
    paddingVertical: Space.xs,
    borderRadius: Radius.inner,
    backgroundColor: Colors.background,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingHorizontal: Space.l,
  },
});
