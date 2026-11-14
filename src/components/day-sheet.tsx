import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FlatList, PanResponder, Pressable, StyleSheet, View, type AccessibilityActionEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Note, Stat } from '@/components/dashboard';
import { ScoreRing } from '@/components/insight-ring';
import { Sheet } from '@/components/sheet';
import { MEMORY_SCORE } from '@/config/insights';
import { ASKED_FOR_HELP, FOUND_LABELS, STANDARD_WORDS, countAndShare, dayHint, dayName, extraPracticeText, pagerDays, stepDay, timeAgainst, type InsightsView } from '@/lib/insights';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, GUTTER, ICON, RADIUS, Space } from '@/theme/layout';

// The day sheet on Trends → Insights: one day's Memory score, cards, how they were found, practice
// time and who came up. A swipe moves to the next day (left) or the one before (right), one calendar
// day at a time, from the earliest day with records to today; so do the arrows in the header and
// VoiceOver's "Next day" and "Previous day". With Reduce Motion the day crossfades instead of
// sliding. Every figure comes from src/lib/insights.ts, the same with sign-in off or on.

type DaySheetProps = {
  view: InsightsView;
  names: Map<string, string>;
  today: string;
  /** The day shown. */
  selected?: string;
  visible: boolean;
  onSelect: (key: string) => void;
  onClose: () => void;
};

/** How far a swipe must go, or how fast, to move a day, with Reduce Motion on. */
const SWIPE = { distance: 40, speed: 0.3 };
/** The ring in each day's header: the hero's, smaller. */
const RING = 84;

export function DaySheet({ view, names, today, selected, visible, onSelect, onClose }: DaySheetProps) {
  const reduced = useReducedMotion();
  if (!selected) return null;
  const days = pagerDays(view, today);
  const shown = days.includes(selected) ? selected : days[days.length - 1];
  const previous = stepDay(days, shown, -1);
  const next = stepDay(days, shown, 1);
  const go = (key?: string) => key && onSelect(key);
  const actions = [...(next ? [{ name: 'next', label: 'Next day' }] : []), ...(previous ? [{ name: 'previous', label: 'Previous day' }] : [])];
  const onAction = (event: AccessibilityActionEvent) => go(event.nativeEvent.actionName === 'next' ? next : previous);
  const page = (key: string) => <DayPage dayKey={key} view={view} names={names} today={today} actions={key === shown ? actions : []} onAction={onAction} />;

  return (
    <Sheet
      visible={visible}
      title={dayName(shown, today)}
      onClose={onClose}
      header={
        <View style={styles.nav}>
          <DayArrow icon="chevron-back" label="Previous day" disabled={!previous} onPress={() => go(previous)} />
          <AppText testID="day-hint" fit center bold size="title" accessibilityRole="header" accessibilityLabel={dayName(shown, today)} style={styles.hint}>
            {dayHint(shown, today)}
          </AppText>
          <DayArrow icon="chevron-forward" label="Next day" disabled={!next} onPress={() => go(next)} />
        </View>
      }>
      {reduced ? <FadePager shown={shown} previous={previous} next={next} onSelect={onSelect} page={page} /> : <SlidePager days={days} shown={shown} onSelect={onSelect} page={page} />}
    </Sheet>
  );
}

function DayArrow({ icon, label, disabled, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={icon === 'chevron-back' ? 'day-previous' : 'day-next'}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.disabled]}>
      <Ionicons name={icon} size={ICON} color={Colors.primaryDark} aria-hidden />
    </Pressable>
  );
}

type PagerProps = { shown: string; onSelect: (key: string) => void; page: (key: string) => ReactNode };

/**
 * Days side by side, a page each, that follow the finger and settle on a day. The neighbors are
 * already drawn, so a swipe shows them at once; the ends bounce, with nothing past today or before
 * the first records. A horizontal list inside the sheet's vertical scroll, so dragging down still
 * scrolls and closes the sheet.
 */
function SlidePager({ days, shown, onSelect, page }: PagerProps & { days: string[] }) {
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<string>>(null);
  // The day the list rests on, so a change from the arrows scrolls it and a swipe doesn't scroll it twice.
  const resting = useRef(shown);
  const index = days.indexOf(shown);

  useEffect(() => {
    if (!width || resting.current === shown) return;
    resting.current = shown;
    list.current?.scrollToIndex({ index, animated: true });
  }, [shown, index, width]);

  function settle(event: NativeSyntheticEvent<NativeScrollEvent>, exact: boolean) {
    const x = event.nativeEvent.contentOffset.x;
    const at = Math.round(x / width);
    // On the web there is no momentum event, so a scroll that has come to rest on a page counts.
    if (exact && Math.abs(x - at * width) > 1) return;
    const key = days[Math.min(Math.max(at, 0), days.length - 1)];
    if (key && key !== resting.current) {
      resting.current = key;
      onSelect(key);
    }
  }

  return (
    <View testID="day-pager" style={styles.edgeToEdge} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width ? (
        <FlatList
          ref={list}
          horizontal
          pagingEnabled
          data={days}
          keyExtractor={(key) => key}
          getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
          initialScrollIndex={index}
          initialNumToRender={3}
          windowSize={3}
          maxToRenderPerBatch={3}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onMomentumScrollEnd={(event) => settle(event, false)}
          onScroll={(event) => settle(event, true)}
          renderItem={({ item }) => <View style={[styles.page, { width }]}>{page(item)}</View>}
        />
      ) : null}
    </View>
  );
}

/** With Reduce Motion: one day at a time, crossfading to the next, and a swipe that moves nothing until it lets go. */
function FadePager({ shown, previous, next, onSelect, page }: PagerProps & { previous?: string; next?: string }) {
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, move) => Math.abs(move.dx) > 12 && Math.abs(move.dx) > 2 * Math.abs(move.dy),
    onPanResponderRelease: (_, move) => {
      if ((move.dx < -SWIPE.distance || move.vx < -SWIPE.speed) && next) onSelect(next);
      else if ((move.dx > SWIPE.distance || move.vx > SWIPE.speed) && previous) onSelect(previous);
    },
  });
  return (
    <View testID="day-pager" {...responder.panHandlers}>
      <Animated.View key={shown} entering={FadeIn.duration(250)} exiting={FadeOut.duration(250)}>
        {page(shown)}
      </Animated.View>
    </View>
  );
}

type DayPageProps = {
  dayKey: string;
  view: InsightsView;
  names: Map<string, string>;
  today: string;
  actions: { name: string; label: string }[];
  onAction: (event: AccessibilityActionEvent) => void;
};

/** One day: the date and its Memory score at the top, then its cards, or a calm word for a day without enough of them. */
function DayPage({ dayKey, view, names, today, actions, onAction }: DayPageProps) {
  const day = view.days.get(dayKey);
  const practiced = Boolean(day && day.cards > 0);
  const scored = day?.score !== undefined;
  const people = (day?.people ?? []).map((id) => names.get(id)).filter((name): name is string => Boolean(name));
  const figure = !practiced ? 'No practice' : scored ? day!.band! : 'Not enough cards';
  const below = !practiced ? 'Nothing counts against a day without practice.' : scored ? `${day!.score} out of 100` : `${day!.cards} of the ${MEMORY_SCORE.minCards} cards a score needs`;
  const label = !practiced ? `${dayName(dayKey, today)}: no practice` : scored ? `${dayName(dayKey, today)}: Memory score ${day!.score}, ${day!.band}` : `${dayName(dayKey, today)}: not enough cards for a score`;

  return (
    <View testID={`day-page-${dayKey}`} style={styles.body}>
      <View testID="day-sheet" accessible accessibilityLabel={label} accessibilityActions={actions} onAccessibilityAction={onAction} style={styles.top}>
        <ScoreRing testID="day-ring" small decorative size={RING} score={day?.score} band={day?.band} spoken={label} />
        <View style={styles.topText}>
          <AppText fit size="caption" muted>
            {`${dayName(dayKey, today)} · Memory score`}
          </AppText>
          <AppText fit bold size="title" color={practiced ? Colors.text : Colors.textMuted}>
            {figure}
          </AppText>
          {below ? (
            <AppText size="caption" muted>
              {below}
            </AppText>
          ) : null}
        </View>
      </View>
      <Note start />
      {practiced ? (
        <>
          <View>
            <Stat label="Cards answered" value={String(day!.cards)} />
            {([1, 2, 3] as const).map((on) => (
              <Stat key={on} label={FOUND_LABELS[on]} value={countAndShare(day!.resolutions.counts[on], day!.shares?.[on])} />
            ))}
            {/* A plain count, already part of With help. */}
            {day!.askedForHelp ? <Stat testID="asked-for-help" label={ASKED_FOR_HELP} value={String(day!.askedForHelp)} /> : null}
            {day!.standard ? <Stat label="Practice time" value={timeAgainst(day!.standard)} /> : null}
            {/* Counted in everything above, but not in the time against the standard. */}
            {day!.extraPractice.cards ? <Stat testID="extra-practice" label="Extra practice" value={extraPracticeText(day!.extraPractice)} /> : null}
          </View>
          {day!.standard ? (
            <AppText size="caption" muted>
              {`${STANDARD_WORDS[day!.standard.status]}.`}
            </AppText>
          ) : null}
          <View style={styles.people}>
            <AppText fit bold>
              People practiced
            </AppText>
            <AppText>{people.length ? people.join(', ') : 'None recorded'}</AppText>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  hint: {
    flex: 1,
  },
  arrow: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  disabled: {
    opacity: 0.35,
  },
  // The pages run to the sheet's edges, so a day slides out of view rather than into the margin.
  edgeToEdge: {
    marginHorizontal: -GUTTER,
  },
  page: {
    paddingHorizontal: GUTTER,
  },
  body: {
    gap: Space.l,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  people: {
    gap: Space.xs,
  },
});
