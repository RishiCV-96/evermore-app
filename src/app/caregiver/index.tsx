import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TandemLogo } from '@/components/tandem-logo';
import { AppText } from '@/components/app-text';
import { ArchivedPeople } from '@/components/archived-people';
import { BigButton } from '@/components/big-button';
import { SettingsPage } from '@/components/settings-page';
import { EmptyState, Notice } from '@/components/caregiver-ui';
import { FamilyBoardTab } from '@/components/family-board-tab';
import { Hero, MonthGrid, Note, PeopleCounts, StatRow, WeekBars } from '@/components/dashboard';
import { InsightsPanel, InsightsSegments, type InsightsSegment } from '@/components/insights';
import { PeopleGrid } from '@/components/people-grid';
import { profileOf } from '@/components/person-photo';
import { PersonSheet } from '@/components/person-sheet';
import { BrainIcon } from '@/components/insight-brain';
import { Tabs, type TabItem } from '@/components/tabs';
import { Toast, type ToastContent } from '@/components/toast';
import type { Activity } from '@/data/activity-store';
import { LOCAL_ONLY, archivePerson, restorePerson, useDashboard } from '@/data/app-data';
import { useStudyDay } from '@/data/study-clock';
import type { Family } from '@/data/family-store';
import type { TrendsFamily } from '@/data/insights-store';
import { dailyCompletion, fourWeekAverage, practiceCounts, weekSessions } from '@/lib/activity';
import { CAREGIVER_TABS, type CaregiverTab } from '@/lib/caregiver-tabs';
import { DASHBOARD_PROBLEM } from '@/lib/load-problem';
import type { StepTarget } from '@/lib/insights';
import { enoughPeople, practiceFrom, todayLine } from '@/lib/session';
import { Colors } from '@/theme/colors';
import { CAREGIVER_GUTTER, COMPACT_TAP, ICON, Space } from '@/theme/layout';

type IconName = keyof typeof Ionicons.glyphMap;

type Tab = CaregiverTab;

/** Each tab's icon: Ionicons outline, filled when chosen; Insights has its own pink brain. */
const ICONS: Record<Exclude<Tab, 'insights'>, [outline: IconName, filled: IconName]> = {
  today: ['sunny-outline', 'sunny'],
  trends: ['calendar-outline', 'calendar'],
  people: ['people-outline', 'people'],
  board: ['chatbubble-ellipses-outline', 'chatbubble-ellipses'],
  settings: ['settings-outline', 'settings'],
};

// The chosen tab is Deep Rose under a Rose bar; the others muted Ink. Insights' brain is pink only when chosen.
const TABS: TabItem<Tab>[] = CAREGIVER_TABS.map((tab) =>
  tab.id === 'insights'
    ? { ...tab, accent: Colors.pinkInk, icon: (selected, color) => <BrainIcon filled={selected} color={color} /> }
    : { ...tab, icon: (selected, color) => <Ionicons name={ICONS[tab.id as Exclude<Tab, 'insights'>][selected ? 1 : 0]} size={ICON} color={color} aria-hidden /> },
);

// Screens 4, 8 and 9: the caregiver dashboard, as six tabs so no page needs a long scroll. Today,
// Trends, People and Settings show only how much was practiced against the daily goal, never how
// answers went; Insights is the caregiver-only exception (see "Insights" in CLAUDE.md); the Family
// board (docs/FAMILY-BOARD-TAB-PLAN.md) is the notes the caregiver writes for the person.
export default function Dashboard() {
  const insets = useSafeAreaInsets();
  // Re-renders when a new study day begins (05:30), so Today, Trends and Insights move into it.
  useStudyDay();
  const [tab, setTab] = useState<Tab>('today');
  // The tab bar's height, so the toast sits above it.
  const [barHeight, setBarHeight] = useState<number>();
  const { family, activity, since, failed, problem, reload, insights, insightsSync, savedTrends } = useDashboard();
  // Trends need the family and practice; with sign-in on and no connection, as last seen on this phone.
  const trends = family && activity ? { family, activity } : savedTrends;
  // One note at a time, such as "June archived." with Undo. A new one replaces the last.
  const [toast, setToast] = useState<ToastContent & { id: number }>();
  const hideToast = useCallback(() => setToast(undefined), []);
  const showToast = useCallback((content: ToastContent) => setToast({ ...content, id: Date.now() }), []);
  // Insights' section, and the page's scroll, so a new section starts at the top.
  const [segment, setSegment] = useState<InsightsSegment>('overview');
  const scroll = useRef<ScrollViewInstance>(null);
  function chooseSegment(next: InsightsSegment) {
    setSegment(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  // A next step on Insights can open a person.
  const [personToOpen, setPersonToOpen] = useState<string>();
  // With sign-in on, pulling down on Insights fetches the family's records again.
  const [refreshing, setRefreshing] = useState(false);
  const canRefresh = Boolean(insightsSync) && tab === 'insights';

  async function refreshInsights() {
    setRefreshing(true);
    reload();
    await insightsSync?.refresh();
    setRefreshing(false);
  }

  function openStep(target: StepTarget) {
    if ('person' in target) {
      setPersonToOpen(target.person);
      setTab('people');
    } else {
      setTab('settings');
    }
  }

  useFocusEffect(reload);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.s }]}>
      {tab === 'board' ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.screen}>
          <FamilyBoardTab />
        </Animated.View>
      ) : (
        <>
          {/* A compact header: the logo's mark and the tab's name, so the page keeps the room. */}
          <View style={styles.header}>
            <TandemLogo size="header" testID="logo-header" />
            <AppText testID="page-title" fit bold size="largeTitle" accessibilityRole="header" color={tab === 'insights' ? Colors.pinkInk : Colors.text} style={styles.title}>
              {CAREGIVER_TABS.find((one) => one.id === tab)!.label}
            </AppText>
          </View>
          <ScrollView
            key={tab}
            ref={scroll}
            // On Insights, the sections' control stays at the top as the page scrolls.
            stickyHeaderIndices={tab === 'insights' && trends ? [0] : undefined}
            style={styles.screen}
            contentContainerStyle={[styles.content, { paddingBottom: Space.xxl }]}
            refreshControl={canRefresh ? <RefreshControl refreshing={refreshing} onRefresh={refreshInsights} tintColor={Colors.primary} colors={[Colors.primary]} /> : undefined}>
            {tab === 'insights' && trends ? <InsightsSegments value={segment} onChange={chooseSegment} /> : null}
            <Animated.View entering={FadeIn.duration(200)} style={styles.page}>
              {failed ? (
                <>
                  <Notice>{DASHBOARD_PROBLEM[problem ?? 'offline']}</Notice>
                  <BigButton testID="dashboard-retry" small label="Try again" onPress={reload} />
                </>
              ) : null}
              {/* Never a blank tab: while its data is on the way, one calm line. */}
              {!failed && ((tab === 'today' && !(family && activity)) || ((tab === 'trends' || tab === 'insights') && !trends) || (tab === 'people' && !family)) ? (
                <AppText testID="dashboard-loading" size="caption" muted>
                  Getting your family’s practice…
                </AppText>
              ) : null}
              {family && activity && tab === 'today' ? <TodayTab family={family} activity={activity} since={since} /> : null}
              {trends && tab === 'trends' ? <TrendsTab family={trends.family} activity={trends.activity} /> : null}
              {trends && tab === 'insights' ? <InsightsPanel segment={segment} family={trends.family} data={insights} sync={insightsSync} activity={trends.activity} onStep={openStep} /> : null}
              {family && tab === 'people' ? <PeopleTab family={family} onToast={showToast} openPerson={personToOpen} onOpened={() => setPersonToOpen(undefined)} /> : null}
              {/* With sign-in on, Settings always shows, so Sign out is there even when nothing else could load. */}
              {tab === 'settings' && (family || !LOCAL_ONLY) ? <SettingsPage family={family} failed={failed} onOpenBoard={() => setTab('board')} /> : null}
            </Animated.View>
          </ScrollView>
        </>
      )}
      <Tabs tabs={TABS} active={tab} onChange={setTab} indicator={Colors.pinkDeep} onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)} />
      {toast ? <Toast key={toast.id} message={toast.message} action={toast.action} onHide={hideToast} lift={barHeight} /> : null}
    </View>
  );
}

/** Whether the deck has the two people practice needs: the same deck the person's screens read. */
function practiceReady(family: Family) {
  return enoughPeople(practiceFrom(family.people, family.cards, profileOf).cards);
}

/** One hero figure, today's completion, then three supporting figures and the week. */
function TodayTab({ family, activity, since }: { family: Family; activity: Activity; since: Date | null }) {
  const now = new Date();
  const days = dailyCompletion(activity.sessions, family.goal, now, 30);
  const today = days[days.length - 1];
  const week = weekSessions(activity.sessions, now);
  const average = since ? fourWeekAverage(days, since) : 0;

  const ready = practiceReady(family);
  const none = activity.sessions.length === 0;
  return (
    <>
      {/* One calm message, never two: fewer than two people to practice with comes first (archived, drafts or
          deselected; a day already begun still shows its progress), then no practice yet. */}
      {ready ? null : <Notice>Add or restore people to start practicing.</Notice>}
      {family.goal > 0 ? (
        <Hero
          testID="today-percent"
          value={`${today.percent}%`}
          label={`${Math.min(today.completed, today.goal)} of ${today.goal} cards today`}
          note={ready ? todayLine(today.goal, today.completed) : undefined}
        />
      ) : null}
      {none && ready ? (
        <EmptyState testID="today-empty" icon="sunny-outline" title="No practice yet">
          Activity shows here after the first session.
        </EmptyState>
      ) : null}
      {/* Until the first session the figures are all zero, so they wait with the chart. */}
      {none ? null : (
        <StatRow
          testID="today-stats"
          items={[
            { testID: 'week-sessions', label: 'Sessions, last 7 days', value: String(week.count) },
            { testID: 'session-length', label: 'Average session', value: week.count ? `${Math.max(1, Math.round(week.averageMinutes))} min` : '–' },
            { testID: 'four-week', label: 'Average day, last 4 weeks', value: `${average}%` },
          ]}
        />
      )}
      {none ? null : (
        <View style={styles.group}>
          <AppText fit bold size="headline" accessibilityRole="header">
            Last 7 days (% of goal)
          </AppText>
          <WeekBars days={days.slice(-7)} today={now} />
        </View>
      )}
      <Note testID="footer" />
    </>
  );
}

/** The month at a glance, and whose cards came up this week. */
function TrendsTab({ family, activity }: { family: TrendsFamily; activity: Activity }) {
  const now = new Date();
  const days = dailyCompletion(activity.sessions, family.goal, now, 30);
  const personOfCard = new Map(family.cards.map((card) => [card.id, card.personId]));
  // Someone deselected or archived leaves the totals with everything else about practice. Their
  // history stays, so restoring them brings their counts back.
  const nameOf = new Map(family.people.filter((person) => person.includeInPractice && !person.archivedAt).map((person) => [person.id, person.name]));
  const covered = practiceCounts(activity.weekCardIds.flatMap((id) => personOfCard.get(id) ?? []))
    .filter(([personId]) => nameOf.has(personId))
    .map(([personId, count]) => ({ name: nameOf.get(personId)!, count }));

  return (
    <>
      <View style={styles.group}>
        <AppText fit bold size="headline" accessibilityRole="header">
          Last 30 days
        </AppText>
        <MonthGrid days={days} />
        <Note />
      </View>
      <View style={styles.group}>
        <AppText fit bold size="headline" accessibilityRole="header">
          Times practiced this week
        </AppText>
        {covered.length ? <PeopleCounts rows={covered} /> : <AppText muted>No cards practiced in the last 7 days.</AppText>}
        <Note testID="footer" />
      </View>
    </>
  );
}

const TRY_AGAIN = LOCAL_ONLY ? 'Please try again.' : 'Please check the internet connection.';

/**
 * The deck, as picture cards. A tap opens the person's sheet. A long press starts editing: a minus
 * badge on every card archives that person at once, with Undo, since nothing is lost. Done, or a
 * tap anywhere else, ends it. Only ever on the caregiver's screens.
 */
function PeopleTab({ family, onToast, openPerson, onOpened }: { family: Family; onToast: (toast: ToastContent) => void; openPerson?: string; onOpened: () => void }) {
  // A next step on Insights opens someone's sheet as the tab appears, once.
  const [selected, setSelected] = useState<string | undefined>(openPerson);
  const [open, setOpen] = useState(Boolean(openPerson));
  useEffect(() => {
    if (openPerson) onOpened();
  }, [openPerson, onOpened]);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const active = family.people.filter((person) => !person.archivedAt);
  // Archiving the last one leaves nothing to edit.
  const isEditing = editing && active.length > 0;

  async function restore(personId: string, name: string) {
    try {
      await restorePerson(personId);
    } catch {
      setNotice(`${name} couldn’t be brought back. ${TRY_AGAIN}`);
    }
  }

  async function archive(personId: string) {
    const person = family.people.find((candidate) => candidate.id === personId);
    if (!person) return;
    try {
      await archivePerson(personId);
      setNotice(undefined);
      onToast({ message: `${person.name} archived.`, action: { label: 'Undo', onPress: () => restore(personId, person.name) } });
    } catch {
      setNotice(`${person.name} couldn’t be archived. ${TRY_AGAIN}`);
    }
  }

  return (
    // A tap anywhere outside the badges ends editing. It isn't a control of its own for screen readers.
    <Pressable accessible={false} focusable={false} onPress={() => setEditing(false)} style={styles.page}>
      {isEditing ? (
        <BigButton testID="people-done" label="Done" primary small onPress={() => setEditing(false)} />
      ) : (
        <BigButton testID="add-person" label="Add a person" primary small onPress={() => router.push('/caregiver/add')} />
      )}
      {notice ? <Notice>{notice}</Notice> : null}
      {active.length ? (
        <PeopleGrid
          people={active}
          cards={family.cards}
          onOpen={(id) => {
            setSelected(id);
            setOpen(true);
          }}
          edit={{ editing: isEditing, onStart: () => setEditing(true), onEnd: () => setEditing(false), onArchive: archive }}
        />
      ) : (
        <AppText muted>{family.people.length ? 'Everyone is archived. Restore someone below, or add a person.' : 'No people yet.'}</AppText>
      )}
      <ArchivedPeople people={family.people.filter((person) => person.archivedAt)} cards={family.cards} onToast={onToast} />
      <Note testID="footer" />
      <PersonSheet
        // Found even once archived, so the sheet slides away rather than vanishing.
        person={family.people.find((person) => person.id === selected)}
        cards={family.cards}
        ai={family.ai}
        practiceReady={practiceReady(family)}
        visible={open}
        onClose={() => setOpen(false)}
        onArchive={archive}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingHorizontal: CAREGIVER_GUTTER,
    paddingBottom: Space.s,
  },
  title: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: CAREGIVER_GUTTER,
    paddingTop: Space.s,
  },
  page: {
    flexGrow: 1,
    gap: Space.l,
  },
  group: {
    gap: Space.s,
  },
});
