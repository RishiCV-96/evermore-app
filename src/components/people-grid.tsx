import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn, ZoomOut } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { QuietLink } from '@/components/caregiver-ui';
import { avatarSource, profileOf, type PhotoFields } from '@/components/person-photo';
import type { SavedCard, SavedPerson } from '@/data/family-store';
import { placeholderPhoto } from '@/data/portraits';
import { displayValue } from '@/data/questionnaire';
import { outOfDeckLabel, profileCompletion } from '@/lib/profile';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space } from '@/theme/layout';

const COLUMNS = 3;
const GAP = Space.m;
/** How long a press on a picture card starts editing. */
const LONG_PRESS_MS = 400;
const BADGE = 28;

/**
 * Editing the People tab, for the caregiver only: a long press on any card starts it, every card
 * gets a minus badge that archives that person, and a tap on a card ends it. Screen readers get the
 * same as an action on each card, with no gesture needed.
 */
export type GridEditing = {
  editing: boolean;
  onStart: () => void;
  onEnd: () => void;
  onArchive: (personId: string) => void;
};

type PeopleGridProps = {
  people: (Pick<SavedPerson, 'id' | 'name' | 'relationship' | 'bestClue'> & Partial<Pick<SavedPerson, 'notApplicable' | 'testMarks' | 'inDeck'>> & PhotoFields)[];
  /** The caregiver's cards, to show what waits for approval. */
  cards?: SavedCard[];
  /** Opens a person. Leave out to show the cards without opening them. */
  onOpen?: (personId: string) => void;
  /** What a tap does, for screen readers. */
  openHint?: string;
  /** Archiving from the grid. Leave out wherever the person might be using the phone. */
  edit?: GridEditing;
  /** Archived people: muted cards, each with Restore under it. */
  onRestore?: (personId: string) => void;
};

/** The deck as picture cards: photo, then name, then why they're out of the deck, what waits for approval, or relationship. */
export function PeopleGrid({ people, cards = [], onOpen, openHint = 'Opens their stories and details.', edit, onRestore }: PeopleGridProps) {
  const [width, setWidth] = useState(0);
  const tile = width ? Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS) : 0;

  return (
    <View style={styles.grid} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {tile
        ? people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              size={tile}
              waiting={onRestore ? 0 : cards.filter((card) => card.personId === person.id && card.status === 'pending').length}
              outOfDeck={
                person.inDeck === false && !onRestore
                  ? outOfDeckLabel(profileCompletion(profileOf(person), cards.filter((card) => card.personId === person.id)))
                  : undefined
              }
              onPress={onOpen ? () => onOpen(person.id) : undefined}
              openHint={openHint}
              edit={edit}
              onRestore={onRestore ? () => onRestore(person.id) : undefined}
            />
          ))
        : null}
    </View>
  );
}

type PersonCardProps = {
  person: PeopleGridProps['people'][number];
  size: number;
  waiting: number;
  /** Why they aren't in the practice deck: a draft, or deselected. */
  outOfDeck?: string;
  onPress?: () => void;
  openHint: string;
  edit?: GridEditing;
  /** Archived: shown muted, with Restore under the card. */
  onRestore?: () => void;
};

/** A light tap where the phone has one. Nothing happens where it doesn't. */
function lightTap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

function PersonCard({ person, size, waiting, outOfDeck, onPress, openHint, edit, onRestore }: PersonCardProps) {
  const accent = useAccent();
  const reduced = useReducedMotion();
  const body = (
    <>
      <Image
        source={avatarSource(person) ?? placeholderPhoto}
        contentFit="cover"
        style={[styles.photo, { width: size, height: size }, onRestore && styles.mutedPhoto]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <AppText fit bold muted={Boolean(onRestore)}>
        {person.name}
      </AppText>
      {outOfDeck ? (
        <AppText testID={`out-${person.name}`} size="caption" muted>
          {outOfDeck}
        </AppText>
      ) : waiting ? (
        <AppText fit bold size="caption" color={accent}>
          {waiting} to approve
        </AppText>
      ) : person.relationship ? (
        <AppText fit muted size="caption">
          {displayValue(person.relationship)}
        </AppText>
      ) : null}
    </>
  );
  const label = [person.name, person.relationship, onRestore ? 'archived' : (outOfDeck ?? (waiting ? `${waiting} to approve` : ''))].filter(Boolean).join(', ');

  if (!onPress) {
    return (
      <View testID={`person-${person.name}`} accessible accessibilityLabel={label} style={[styles.card, { width: size }]}>
        {body}
      </View>
    );
  }
  const archive = `Archive ${person.name}`;
  return (
    <View style={{ width: size }}>
      <Pressable
        testID={`person-${person.name}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={edit?.editing ? 'Stops editing.' : openHint}
        accessibilityActions={edit ? [{ name: 'archive', label: archive }] : undefined}
        onAccessibilityAction={edit ? (event) => event.nativeEvent.actionName === 'archive' && edit.onArchive(person.id) : undefined}
        onPress={edit?.editing ? edit.onEnd : onPress}
        onLongPress={
          edit && !edit.editing
            ? () => {
                lightTap();
                edit.onStart();
              }
            : undefined
        }
        delayLongPress={LONG_PRESS_MS}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {body}
      </Pressable>
      {onRestore ? (
        <View style={styles.restore}>
          <QuietLink testID={`restore-${person.name}`} label="Restore" accessibilityLabel={`Restore ${person.name}`} onPress={onRestore} />
        </View>
      ) : null}
      {/* Beside the card, not inside it, so a screen reader can reach it as a button of its own. */}
      {edit?.editing ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.duration(150)}
          exiting={reduced ? undefined : ZoomOut.duration(120)}
          style={styles.badgeSpot}>
          <Pressable
            testID={`archive-${person.name}`}
            accessibilityRole="button"
            accessibilityLabel={archive}
            onPress={() => edit.onArchive(person.id)}
            style={({ pressed }) => [styles.badgeTarget, pressed && styles.badgePressed]}>
            <View style={styles.badgeRing}>
              <View style={styles.badge}>
                <Ionicons name="remove" size={18} color={Colors.onPrimary} aria-hidden />
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GAP,
    rowGap: Space.s,
  },
  card: {
    gap: Space.xs,
  },
  photo: {
    borderRadius: RADIUS,
  },
  // Only the picture fades, so the name keeps its contrast.
  mutedPhoto: {
    opacity: 0.5,
  },
  // Lined up with the name above it: the link's own padding sits outside the column.
  restore: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  // A 44pt target over the photo's corner, the badge itself sitting just inside it.
  badgeSpot: {
    position: 'absolute',
    top: (BADGE - COMPACT_TAP) / 2,
    left: (BADGE - COMPACT_TAP) / 2,
  },
  badgeTarget: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePressed: {
    transform: [{ scale: 0.92 }],
  },
  badgeRing: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  badge: {
    width: BADGE - 4,
    height: BADGE - 4,
    borderRadius: (BADGE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark,
  },
});
