import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice, Row, TypeToConfirm } from '@/components/caregiver-ui';
import { PeopleGrid } from '@/components/people-grid';
import { Avatar, avatarSource, type PhotoFields } from '@/components/person-photo';
import { Sheet } from '@/components/sheet';
import type { ToastContent } from '@/components/toast';
import { LOCAL_ONLY, deletePerson, restorePerson } from '@/data/app-data';
import type { SavedCard, SavedPerson } from '@/data/family-store';
import { displayValue } from '@/data/questionnaire';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, ICON, Space } from '@/theme/layout';

const TRY_AGAIN = LOCAL_ONLY ? 'Please try again.' : 'Please check the internet connection.';

type Archived = SavedPerson & PhotoFields;

/** "November 9", with the year once it isn't this year's. */
function archivedOn(iso: string) {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

/**
 * The foot of the People tab: everyone archived, folded away until asked for, and gone when there
 * is nobody. Restore puts someone back as they were. Deleting for good is only here, on the sheet,
 * behind a confirmation.
 */
export function ArchivedPeople({ people, cards, onToast }: { people: Archived[]; cards: SavedCard[]; onToast: (toast: ToastContent) => void }) {
  const [open, setOpen] = useState(false);
  // Kept as it was when opened, so the sheet can slide away after a restore or a delete.
  const [selected, setSelected] = useState<Archived>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  async function restore(person: Archived) {
    try {
      await restorePerson(person.id);
      setSheetOpen(false);
      setNotice(undefined);
      onToast({ message: `${person.name} restored.` });
    } catch {
      setNotice(`${person.name} couldn’t be restored. ${TRY_AGAIN}`);
    }
  }

  const sheet = (
    <ArchivedSheet
      person={selected}
      cards={cards}
      visible={sheetOpen}
      onClose={() => setSheetOpen(false)}
      onRestore={restore}
      onDeleted={(name) => {
        setSheetOpen(false);
        onToast({ message: `${name} deleted.` });
      }}
    />
  );
  // With nobody archived the section goes, but a sheet just closing still slides away.
  if (people.length === 0) return sheet;

  return (
    <View style={styles.section}>
      <Pressable
        testID="archived-toggle"
        accessibilityRole="button"
        accessibilityLabel={`Archived people, ${people.length}`}
        aria-expanded={open}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <AppText fit bold style={styles.toggleLabel}>
          Archived people
        </AppText>
        <AppText testID="archived-count" muted>
          {people.length}
        </AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={ICON} color={Colors.textMuted} aria-hidden />
      </Pressable>
      {notice ? <Notice>{notice}</Notice> : null}
      {open ? (
        <>
          <AppText size="caption" muted>
            Out of practice, with everything kept. Restoring brings someone back as they were.
          </AppText>
          <PeopleGrid
            people={people}
            cards={cards}
            openHint="Opens their details."
            onOpen={(id) => {
              setSelected(people.find((person) => person.id === id));
              setSheetOpen(true);
            }}
            onRestore={(id) => {
              const person = people.find((candidate) => candidate.id === id);
              if (person) restore(person);
            }}
          />
        </>
      ) : null}
      {sheet}
    </View>
  );
}

type ArchivedSheetProps = {
  person: Archived | undefined;
  cards: SavedCard[];
  visible: boolean;
  onClose: () => void;
  onRestore: (person: Archived) => void;
  onDeleted: (name: string) => void;
};

/** An archived person, to look at only: Restore, or Delete permanently after a clear confirmation. */
function ArchivedSheet({ person, cards, visible, onClose, onRestore, onDeleted }: ArchivedSheetProps) {
  const [notice, setNotice] = useState<string>();
  // Delete permanently asks in the sheet: what goes, from where, and "delete" typed first.
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!person) return null;
  const shown = person;
  const theirs = cards.filter((card) => card.personId === shown.id);
  const approved = theirs.filter((card) => card.status === 'approved').length;

  async function remove() {
    setBusy(true);
    try {
      await deletePerson(shown.id);
      setNotice(undefined);
      setDeleting(false);
      onDeleted(shown.name);
    } catch {
      setNotice(`${shown.name} couldn’t be deleted. ${TRY_AGAIN}`);
    }
    setBusy(false);
  }

  function close() {
    setDeleting(false);
    onClose();
  }

  if (deleting) {
    const where = LOCAL_ONLY ? 'from this phone' : 'from this phone and from the server';
    return (
      <Sheet visible={visible} title={`Delete ${shown.name}?`} onClose={close}>
        <AppText testID="delete-what">
          {`This deletes ${shown.name} for good, ${where}: their photo, ${theirs.length} ${theirs.length === 1 ? 'fact' : 'facts'} and every story and question made from them, and their practice history. It can’t be undone.`}
        </AppText>
        <AppText size="caption" muted>
          Leaving {shown.name} archived keeps all of it, out of practice.
        </AppText>
        <TypeToConfirm testID="delete-person-confirm" label={`Delete ${shown.name} permanently`} busy={busy} onConfirm={remove} />
        {notice ? <Notice>{notice}</Notice> : null}
        <BigButton testID="delete-person-cancel" label={`Keep ${shown.name}`} onPress={() => setDeleting(false)} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} title={shown.name} onClose={close}>
      <View style={styles.who}>
        <Avatar name={shown.name} source={avatarSource(shown)} size={64} />
        <View style={styles.whoText}>
          {shown.relationship ? <AppText fit>{displayValue(shown.relationship)}</AppText> : null}
          {shown.archivedAt ? (
            <AppText testID="archived-on" fit size="caption" muted>
              Archived on {archivedOn(shown.archivedAt)}
            </AppText>
          ) : null}
        </View>
      </View>
      <View>
        <Row testID="archived-stories" label="Stories" value={`${approved} approved`} />
      </View>
      <AppText size="caption" muted>
        {shown.name} is out of practice. Their stories, photo, hints and practice history are kept, so restoring brings them back as
        they were.
      </AppText>
      <BigButton testID="restore-person" label={`Restore ${shown.name}`} primary small onPress={() => onRestore(shown)} />
      <BigButton
        testID="delete-person"
        label="Delete permanently"
        quiet
        onPress={() => {
          setNotice(undefined);
          setDeleting(true);
        }}
      />
      {notice ? <Notice>{notice}</Notice> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.m,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: COMPACT_TAP,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  toggleLabel: {
    flex: 1,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  whoText: {
    flex: 1,
  },
});
