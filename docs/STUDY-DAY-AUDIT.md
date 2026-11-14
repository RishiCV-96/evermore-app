# Study day audit

Written 2026-11-12, before any code changed. It lists every place Evermore decides which day something belongs to, and what changes when the day begins at **05:30 local time** instead of midnight.

**The rule.** A study day runs from 05:30:00 to 05:29:59 the next morning, in the device's own time zone. Its key is the calendar date it began on, `YYYY-MM-DD`: 02:00 on Nov 13 is study day Nov 12; 05:30 on Nov 13 starts study day Nov 13. The start is `DAY_START_HOUR` and `DAY_START_MINUTE` in `src/config/schedule.ts`. `studyDayKey(date, timeZone)` in `src/lib/study-day.ts` is the only place the boundary is worked out.

**What a study day decides:** which day a card or a session counts toward, and when a new daily session begins. **Nothing else.** Practice is never blocked: after the day's session the person can keep practicing as often as they like, at any hour, as today.

## How "today" is decided now

Today there is no boundary of its own: every "today" is the **local calendar date at midnight**, from `dayKey(date)` and `lastDays(now, count)` in `src/lib/activity.ts`, or from `setHours(0, 0, 0, 0)` written out in place. Practice is already never blocked: once the day's target is met, the person's home offers Practice more.

## Every place, and what changes

### Practice on the person's phone

| What | Where | Now | Change |
| --- | --- | --- | --- |
| Today's target and its log (what was asked, the deck, the ceiling) | `goalToday`, `withGoal` in `src/data/practice-store.ts`; `src/data/local-store.ts` | `dayKey(new Date())` | The current study day, from the device's study-day clock (below) |
| "Is today's session done" | `completedToday`, `doneToday` (both stores) | Sessions whose `startedAt` falls on today's calendar date | Sessions whose **study day** is today. Each session stores the study day it started in (`studyDay`); older sessions without it fall back to `studyDayKey(startedAt)` |
| The cards for "today" | `sessionCards`, `planToday` | Target minus what was finished today | The same, against the study day: at 05:30 the day's target is fresh |
| What was asked today, so nothing repeats | `askedToday`, `logAsked`, `askedOn` in `src/lib/session.ts` | Keyed by `dayKey(now)` at each card | Keyed by the round's study day. A round that began before 05:30 never writes into, or wipes, the new day's log |
| A round in progress across 05:30 | `src/app/practice.tsx`, `PracticeScreen` | Its cards count toward the calendar day each was finished on; its progress bar re-reads "today" | The round keeps the study day it started in: every card counts there, its bar stays that day's, and nothing interrupts it |
| Reveal cards' unlock ("first try that day") | `startsHidden`, `noteAnswer` in `src/lib/reveal.ts`, called from `practice-screen.tsx` | `dayKey(new Date())` | The study day. Still memory only, still never saved or sent |
| The home and the wrap-up | `src/app/index.tsx`, `WrapUp` | "All done today." and Practice more | Calm, optional words: "Nice work. You can keep practicing, or come back in the morning." with **Keep practicing** always there. No countdown, nothing about when |
| "About 8 minutes today" | `todayLine` | Today's target and cards | Unchanged, read against the study day |
| Sessions kept on the phone | `pruned`, `localActivity` in `src/lib/local-practice.ts`; `refreshPractice`'s `since` | 31 and 30 calendar days; sessions since yesterday's midnight | The same counts of study days; the person's phone fetches sessions from the start of yesterday's study day |
| The app left open across 05:30 | none | The day changes only when something re-reads it | A clock store (`src/data/study-clock.ts`) re-checks when the app returns to the foreground and on a timer set to the next boundary, and the practice stores refresh, with no reload |

### Scheduling

| What | Where | Now | Change |
| --- | --- | --- | --- |
| Day steps (1, 3, 7 and 14 days) | `dueAtFor` in `src/lib/queue.ts` | Due at local **midnight** N days on | Due at the **start of the study day** N study days on: a card answered at 02:00 on Nov 13 (study day Nov 12) with a 1-day step is due at 05:30 on Nov 13 |
| Minute steps (10 minutes) | `dueAtFor` | From now | Unchanged: minutes are minutes |
| Restored from the archive | `spreadOnReturn` | "Same day" means since midnight; returns at midnights | Since the start of the study day; returns at study-day starts |

### The caregiver's dashboard (completion only)

| What | Where | Now | Change |
| --- | --- | --- | --- |
| Today's completion, the 7-day chart, the 4-week average, the 30-day calendar | `dailyCompletion`, `lastDays`, `fourWeekAverage`, `weekSessions` in `src/lib/activity.ts`; `src/components/dashboard.tsx` | Sessions by calendar date of `started_at` | Sessions by study day (their `study_day`, or worked out from `started_at` for older ones); "Today" is the study day |
| Sessions read with sign-in on | `src/data/activity-store.ts` | `started_at, completed_at, cards_completed, daily_goal` | Also `study_day` |

### Insights

| What | Where | Now | Change |
| --- | --- | --- | --- |
| A day's records: the Memory score, cards, how answers were found, speed | `byDay`, `dayInsight` in `src/lib/insights.ts` | Calendar date of `shownAt` | The record's `studyDay`; older records without one fall back to `studyDayKey(shownAt)` on the reading phone. **The score's calculation is unchanged**, over all of that day's records |
| Practice time against the standard ("session time met the standard") | `againstStandard`, in `dayInsight` | Every card that day, partial below the target | The day's own session only: extra practice adds no time and can't change whether the day is finished |
| **Extra practice** | none | Practice more cards count like any other | Each record says whether its round began after the day's session was complete (`extraPractice`). They count in the score and everything else, and a day's sheet shows them as "Extra practice", with no effect on the standard |
| The calendar, the trend, the last 14 days, the charts' days | `lastDayKeys`, `trendOf`, `monthCells`, `score-calendar.tsx`, `day-sheet.tsx`, `insights.tsx`, `insights-store.ts` | `dayKey(new Date())` for today, calendar dates for records | Today is the study day; records grouped by study day |
| Streaks | none | There are none (hard rule: no streaks) | Nothing |
| The demo | `src/lib/demo-insights.ts` | Made-up times during the day | Unchanged (none before 05:30, so their study day is their date) |
| Retention (120 days) and the phone's month keys | `keptAttempts`, `monthOf` in `src/lib/attempts.ts`; `attempt_records_prune` | Calendar months and days | Unchanged: storage, not a study-day decision |

### Records and what is synced

| What | Where | Now | Change |
| --- | --- | --- | --- |
| A card's record | `attemptOf` in `src/lib/attempts.ts` | No day of its own | `studyDay` (the round's, computed on the device when the round began) and `extraPractice` |
| Uploaded rows | `toRow`, `fromRow`, `RECORD_COLUMNS` in `src/lib/attempt-records.ts`; `attempt_records` | No day column | **`study_day date`** (null for older rows, which fall back to their time) and **`extra_practice boolean`** |
| Sessions | `sessionRow` in `practice-store.ts`; `sessions` | No day column | **`study_day date`** (null for older rows) |
| Two paired phones | `refreshPractice` reads `sessions` `.eq('person_user_id', id)`; RLS lets a person login read only its own sessions | One phone can't see that the other finished the day | The person's login may **read** (never write) the family's sessions, so either phone shows the day complete after sync, by `study_day` |
| Offline for days | the outbox, the record queue | Rows keep their own ids and times | Unchanged, and each row now carries the study day it was made in, so a late upload lands on the right day and a resend is still refused as a duplicate |

### Labels that describe a clock time, not a study day

`updatedText` ("Last updated today at 1:30 AM") in `src/lib/insights.ts`, and "Paired today", "Last seen today at …" in `src/lib/pairing.ts`, describe when something happened by the calendar. They decide nothing about practice, so they keep the calendar date and are named as exceptions in the check.

## The clock

A per-device **study-day clock** (`src/data/study-clock.ts`, saved under `evermore.studyDay.v1`) remembers the last study day this phone has seen. It only moves forward:

- **Clock set backwards, or travel west:** the study day stays where it was, so a day can't be handed out twice.
- **Clock set forwards, or travel east:** the new local day begins as soon as the new local time says so. Records keep their own key, so nothing already practiced moves.
- **Daylight saving:** the boundary is 05:30 on the wall clock, so the study day spanning the change is 23 or 25 hours long.

## Schema

`supabase/schema.sql` gains `sessions.study_day`, `attempt_records.study_day` and `attempt_records.extra_practice` (all added `if not exists`, null or false for older rows), the insert grants for them, and a policy letting a person's login read its family's sessions. **The file must be rerun in the Supabase SQL Editor.** Until it is, the app's uploads of the new columns are refused and wait in the queue (nothing is lost), and old app versions keep working.

## Decisions the brief left open

- **Which day a record belongs to:** the study day its round began in, fixed when the round starts. That is the brief's "a round in progress at 05:30 counts toward the day it started in", and it is still computed on the device.
- **Extra practice** is any round that begins once the day's session is complete (Practice more, or one person's cards). Its cards still count toward the day's card total, which was already complete, so the status can't change.
- **Clock forwards then back:** the day reached stays until real time catches up. Daily sessions can't be handed out twice; practice is never blocked meanwhile.
- **Scheduling uses the study day of the moment a card is finished**, not the round's: a card's next due date should follow when it was really practiced.
