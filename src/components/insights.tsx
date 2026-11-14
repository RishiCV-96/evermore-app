import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice } from '@/components/caregiver-ui';
import { Note } from '@/components/dashboard';
import { ScoreChart, SpeedChart, TimeChart } from '@/components/insight-charts';
import { FoundSection, MiniBar } from '@/components/insight-found';
import { PersonInsightSheet } from '@/components/insight-person';
import { DaySheet } from '@/components/day-sheet';
import { ScoreRing } from '@/components/insight-ring';
import { ScoreCalendar, ScoreHelp } from '@/components/score-calendar';
import { ScoreKey } from '@/components/score-key';
import { Segmented } from '@/components/segmented';
import { Checkbox } from '@/components/sheet';
import { MEMORY_SCORE } from '@/config/insights';
import type { Activity } from '@/data/activity-store';
import type { InsightsSync, TrendsFamily } from '@/data/insights-store';
import { dailyCompletion } from '@/lib/activity';
import { studyToday } from '@/data/study-clock';
import { INSIGHTS_PROBLEM } from '@/lib/load-problem';
import { heroRingSize } from '@/lib/insight-ring';
import {
  TREND_WORDS,
  dayName,
  insightsFor,
  minutesText,
  percentText,
  ringEmptyLine,
  ringSpoken,
  secondsText,
  timeAgainst,
  updatedText,
  type DayInsight,
  type InsightsData,
  type NextStep,
  type PersonInsight,
  type StepTarget,
  type Trend,
} from '@/lib/insights';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, ICON, RADIUS, Space } from '@/theme/layout';

// The Insights tab, for the caregiver only: how practice is going, from each card's record: kept on
// this phone with sign-in off, or fetched from the server with sign-in on. Practice activity, never a
// medical measure, and never a comparison with anyone else. Every figure comes from
// src/lib/insights.ts, the same way in both; this file only lays it out, in four sections a sticky
// control switches between, so no page is a long scroll.

export type InsightsSegment = 'overview' | 'answers' | 'people' | 'days';

export const INSIGHTS_SEGMENTS: { value: InsightsSegment; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'answers', label: 'Answers' },
  { value: 'people', label: 'People' },
  { value: 'days', label: 'Days' },
];

/** The sections' control, which stays at the top of the page as it scrolls (the dashboard makes it sticky). */
export function InsightsSegments({ value, onChange }: { value: InsightsSegment; onChange: (value: InsightsSegment) => void }) {
  return (
    <View style={styles.sticky}>
      <Segmented testID="insights-segment" label="Insights sections" options={INSIGHTS_SEGMENTS} value={value} onChange={onChange} accent={{ track: Colors.pinkTint, text: Colors.pinkInk }} />
    </View>
  );
}

type InsightsPanelProps = {
  /** The section shown. */
  segment: InsightsSegment;
  /** The family as Trends read it: the live one, or with sign-in on and offline, as last seen on this phone. */
  family: TrendsFamily;
  /** The records, once they have loaded: this phone's with sign-in off, the family's with sign-in on. */
  data?: InsightsData;
  /** With sign-in on only: when the records were last fetched, and fetching them again. */
  sync?: InsightsSync;
  /** Sessions, for the calendar's completion view, as on Trends. */
  activity: Activity;
  /** Opens a person's sheet or a setting, from a next step or a person's page. */
  onStep: (target: StepTarget) => void;
};

export function InsightsPanel({ segment, family, data, sync, activity, onStep }: InsightsPanelProps) {
  const [includeArchived, setIncludeArchived] = useState(false);
  // The day open on the calendar, kept while its sheet slides away.
  const [dayOpen, setDayOpen] = useState<string>();
  const [daySheet, setDaySheet] = useState(false);
  const [help, setHelp] = useState(false);
  // The person open on People, kept while their sheet slides away.
  const [personOpen, setPersonOpen] = useState<string>();
  const [personSheet, setPersonSheet] = useState(false);
  const reduced = useReducedMotion();
  // With sign-in on, opening Insights fetches what the person's phone has sent since the last time.
  const update = sync?.update;
  useEffect(() => {
    void update?.();
  }, [update]);

  // With sign-in on, before the first fetch on this phone has come back.
  if (!data || (sync && !sync.updatedAt)) {
    return (
      <>
        {data && sync && !sync.loading ? (
          <View testID="insights-problem" style={styles.problem}>
            <Notice>{INSIGHTS_PROBLEM[sync.problem ?? 'offline']}</Notice>
            <BigButton testID="insights-retry" small label="Try again" onPress={() => void sync.update()} />
          </View>
        ) : (
          <AppText testID="insights-loading" size="caption" muted>
            Getting the latest practice…
          </AppText>
        )}
        <Note testID="footer" />
      </>
    );
  }

  const today = studyToday();
  const view = insightsFor(data.attempts, family, includeArchived, data.demo, today);
  const names = new Map(family.people.map((person) => [person.id, person.name]));
  const timedPeople = view.people.filter((person) => person.medianFirstMs !== undefined && names.get(person.personId));
  const scoredDays = view.month.filter((one) => one.day?.score !== undefined).length;
  const openPerson = view.people.find((person) => person.personId === personOpen);

  return (
    <Animated.View key={segment} entering={reduced ? undefined : FadeIn.duration(200)} style={styles.page}>
      {sync?.updatedAt ? (
        <AppText testID="insights-updated" size="caption" muted>
          {updatedText(sync.updatedAt, new Date())}
        </AppText>
      ) : null}
      {data.demo ? <Notice>Demo data is on: made-up practice for the sample people. Clear test data removes it.</Notice> : null}
      {family.people.some((person) => person.archivedAt) ? (
        <Checkbox testID="include-archived" checked={includeArchived} onChange={setIncludeArchived}>
          Include archived people
        </Checkbox>
      ) : null}

      {segment === 'overview' ? (
        <>
          <ScoreHero day={view.latest} today={today} trend={view.trend} chance={view.chanceScore} onExplain={() => setHelp(true)} />
          {view.latest ? (
            <ScoreKey chance={view.chanceScore} folded />
          ) : (
            <View testID="insights-empty" style={styles.group}>
              <AppText fit bold accessibilityRole="header">
                Insights begin with practice
              </AppText>
              <AppText muted>After a few days of practice, this shows how answers were found, practice time, and a daily Memory score. It describes practice only.</AppText>
            </View>
          )}
          {view.latest ? (
            <>
              <Section
                title="Memory score"
                meta="Last 30 days"
                caption={
                  scoredDays <= 2
                    ? `${scoredDays === 1 ? 'One day has' : `${scoredDays} days have`} a score so far. The line fills in as practice goes on.`
                    : `Each point is a day with at least ${MEMORY_SCORE.minCards} cards. Tap one to see its score.`
                }>
                <ScoreChart days={view.month} today={today} />
              </Section>
              <View style={styles.group}>
                <SectionHeading title="What stands out" meta="Last 14 days" />
                {view.observations.length ? (
                  <View>
                    {view.observations.map((text) => (
                      <View key={text} testID="observation" style={styles.observation}>
                        <View style={styles.dot} />
                        <AppText style={styles.flex}>{text}</AppText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <AppText muted>Nothing stands out yet. A few more days of practice will help.</AppText>
                )}
              </View>
              <View style={styles.group}>
                <SectionHeading title="Suggested next steps" />
                {view.steps.length ? (
                  <View>
                    {view.steps.map((step) => (
                      <StepRow key={step.text} step={step} onPress={() => step.target && onStep(step.target)} />
                    ))}
                  </View>
                ) : (
                  <AppText muted>Nothing to change right now.</AppText>
                )}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {segment === 'answers' ? (
        <>
          <FoundSection view={view} today={today} />
          <Section title="Answer speed" meta="Last 14 days" note={false} caption="The middle time to the first name chosen each day. It varies with the time of day, sleep, mood and how a question is asked, and isn’t part of the score.">
            <SpeedChart days={view.fortnight} today={today} />
            {timedPeople.length ? (
              <View testID="speed-people" style={styles.grid} accessible accessibilityLabel={`Middle time by person: ${timedPeople.map((person) => `${names.get(person.personId)} ${secondsText(person.medianFirstMs!)}`).join(', ')}`}>
                {timedPeople.map((person) => (
                  <View key={person.personId} style={styles.cell}>
                    <AppText fit style={styles.flex}>
                      {names.get(person.personId)}
                    </AppText>
                    <AppText fit bold style={styles.figure}>
                      {secondsText(person.medianFirstMs!)}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>
        </>
      ) : null}

      {segment === 'people' ? (
        <View style={styles.group}>
          <SectionHeading title="Whose cards came up" meta="Last 14 days" />
          {view.people.filter((person) => names.get(person.personId)).length ? (
            <>
              <AppText size="caption" muted>
                How each person’s cards were found. Tap someone for more.
              </AppText>
              <View>
                {view.people
                  .filter((person) => names.get(person.personId))
                  .map((person) => (
                    <PersonRow
                      key={person.personId}
                      person={person}
                      name={names.get(person.personId)!}
                      onPress={() => {
                        setPersonOpen(person.personId);
                        setPersonSheet(true);
                      }}
                    />
                  ))}
              </View>
            </>
          ) : (
            <AppText muted>No cards came up in the last 14 days.</AppText>
          )}
        </View>
      ) : null}

      {segment === 'days' ? (
        <>
          <ScoreCalendar
            view={view}
            completion={dailyCompletion(activity.sessions, family.goal, new Date(), 30)}
            today={today}
            selected={dayOpen}
            onOpenDay={(key) => {
              setDayOpen(key);
              setDaySheet(true);
            }}
            onExplain={() => setHelp(true)}
          />
          <Section title="Practice time" meta="Last 14 days" note={false} caption="Active practice time each day. The dashed line is the standard for the session length.">
            <TimeChart days={view.fortnight} today={today} />
          </Section>
        </>
      ) : null}

      <Note testID="footer" />
      <DaySheet view={view} names={names} today={today} selected={dayOpen} visible={daySheet} onSelect={setDayOpen} onClose={() => setDaySheet(false)} />
      <ScoreHelp chance={view.chanceScore} visible={help} onClose={() => setHelp(false)} />
      {openPerson ? (
        <PersonInsightSheet
          person={openPerson}
          name={names.get(openPerson.personId) ?? ''}
          visible={personSheet}
          onClose={() => setPersonSheet(false)}
          onOpenProfile={() => {
            setPersonSheet(false);
            onStep({ person: openPerson.personId });
          }}
        />
      ) : null}
    </Animated.View>
  );
}

/** The latest day of practice in one card: its score as a ring, its cards and practice time, and what the score is. */
function ScoreHero({ day, today, trend, chance, onExplain }: { day?: DayInsight; today: string; trend?: Trend; chance: number; onExplain: () => void }) {
  const { width, height } = useWindowDimensions();
  const when = day ? dayName(day.key, today) : undefined;
  return (
    <View testID="insights-hero-card" style={styles.heroCard}>
      <AppText fit size="caption" muted center>
        {when ? `Memory score, ${when}` : 'Memory score'}
      </AppText>
      <ScoreRing
        testID="insights-hero"
        score={day?.score}
        band={day?.band}
        chance={chance}
        size={heroRingSize(Math.min(width, 640), height)}
        spoken={ringSpoken(day, today)}
        emptyLine={ringEmptyLine(day)}
      />
      <Note testID="score-note" />
      {day ? (
        <View style={styles.tiles}>
          <Tile testID="insights-cards" label="Cards answered" value={String(day.cards)} />
          {day.standard ? (
            <Tile
              testID="insights-time"
              label="Practice time"
              value={minutesText(day.standard.activeMs)}
              sub={day.standard.status === 'partial' ? 'Partial day' : `of about ${minutesText(day.standard.expectedMs)}`}
              spoken={timeAgainst(day.standard)}
            />
          ) : null}
        </View>
      ) : null}
      {trend ? (
        <View testID="insights-trend" style={styles.trend}>
          <AppText size="caption">
            Last two weeks: <AppText bold size="caption">{TREND_WORDS[trend.label]}</AppText>
          </AppText>
          {trend.early ? (
            <View style={styles.tag}>
              <AppText fit size="caption" muted>
                Early read
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <HeroButton testID="hero-explain" label="What is this score?" onPress={onExplain} />
    </View>
  );
}

/** A figure in a small white tile on the hero card. */
function Tile({ label, value, sub, spoken, testID }: { label: string; value: string; sub?: string; spoken?: string; testID?: string }) {
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${spoken ?? value}`} style={styles.tile}>
      <AppText fit size="caption" muted>
        {label}
      </AppText>
      <AppText fit bold size="title" style={styles.figure}>
        {value}
      </AppText>
      {sub ? (
        <AppText fit size="caption" muted>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

/** A clear, full-width button on the hero card: white, with the Insights pink words and icon. */
function HeroButton({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.heroButton, pressed && styles.heroButtonPressed]}>
      <Ionicons name="help-circle-outline" size={20} color={Colors.pinkInk} aria-hidden />
      <AppText fit bold color={Colors.pinkInk}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A section's heading: its title in bold, and what it covers in the muted caption at the end. */
function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.heading}>
      <AppText fit bold accessibilityRole="header" style={styles.flex}>
        {title}
      </AppText>
      {meta ? (
        <AppText fit size="caption" muted>
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

/** A chart with its heading, a short caption, and the note every chart carries (the last in a section leaves it to the page's footer). */
function Section({ title, meta, caption, note = true, children }: { title: string; meta?: string; caption: string; note?: boolean; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <SectionHeading title={title} meta={meta} />
      {children}
      <AppText size="caption" muted>
        {caption}
      </AppText>
      {note ? <Note /> : null}
    </View>
  );
}

/** One person on People: their name, how their cards were found as a slim bar, and their cards and middle time. */
function PersonRow({ person, name, onPress }: { person: PersonInsight; name: string; onPress: () => void }) {
  const details = [`${person.cards} ${person.cards === 1 ? 'card' : 'cards'}`, person.medianFirstMs !== undefined ? secondsText(person.medianFirstMs) : undefined].filter(Boolean).join(' · ');
  return (
    <Pressable
      testID={`person-row-${person.personId}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${details}. ${person.shares ? `${percentText(person.shares[1])} right away.` : 'Not enough cards yet for shares.'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.personRow, pressed && styles.pressed]}>
      <View style={styles.personText}>
        <View style={styles.heading}>
          <AppText fit bold style={styles.flex}>
            {name}
          </AppText>
          <AppText fit size="caption" muted style={styles.figure}>
            {details}
          </AppText>
        </View>
        {person.shares ? (
          <MiniBar shares={person.shares} />
        ) : (
          <AppText size="caption" muted>
            Not enough cards yet
          </AppText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden />
    </Pressable>
  );
}

/** A next step: its words, which may wrap, and a chevron when it opens something. */
function StepRow({ step, onPress }: { step: NextStep; onPress: () => void }) {
  return (
    <Pressable testID="next-step" accessibilityRole="button" onPress={onPress} disabled={!step.target} style={({ pressed }) => [styles.step, pressed && styles.pressed]}>
      <AppText style={styles.stepText}>{step.text}</AppText>
      {step.target ? <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  problem: {
    gap: Space.s,
  },
  page: {
    gap: Space.xl,
  },
  group: {
    gap: Space.s,
  },
  // The hero: one card on the softest pink, its pieces centered, nothing boxed inside but two white tiles.
  heroCard: {
    gap: Space.s,
    padding: Space.l,
    borderRadius: RADIUS,
    backgroundColor: Colors.pinkTint,
  },
  tiles: {
    flexDirection: 'row',
    gap: Space.s,
  },
  tile: {
    flex: 1,
    gap: 2,
    paddingHorizontal: Space.m,
    paddingVertical: Space.s,
    borderRadius: RADIUS - Space.xs,
    backgroundColor: Colors.background,
  },
  heroButton: {
    minHeight: COMPACT_TAP,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS - Space.xs,
    backgroundColor: Colors.background,
  },
  heroButtonPressed: {
    backgroundColor: Colors.pink1,
  },
  figure: {
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  trend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.s,
  },
  tag: {
    paddingHorizontal: Space.s,
    paddingVertical: 2,
    borderRadius: RADIUS,
    backgroundColor: Colors.background,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  stepText: {
    flex: 1,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  // The sections' control, on white so the page scrolls under it.
  sticky: {
    paddingTop: Space.s,
    paddingBottom: Space.s,
    backgroundColor: Colors.background,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.s,
  },
  flex: {
    flex: 1,
  },
  observation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.m,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  // A small pink mark leading each line, so the list scans.
  dot: {
    width: 8,
    height: 8,
    marginTop: 7,
    borderRadius: 4,
    backgroundColor: Colors.pinkInk,
  },
  // Each person's middle time: two even columns that never wrap a name onto a second row.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Space.xl,
  },
  cell: {
    width: '45%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP + Space.l,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  personText: {
    flex: 1,
    gap: Space.s,
  },
});
