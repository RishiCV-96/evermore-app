import { lastDays, type SessionRecord } from '@/lib/activity';
import { supabase } from '@/lib/supabase';

// Practice activity for the caregiver dashboard: sessions from the last 30 days, and which
// cards were practiced in the last 7. Only completion is read. The columns that say how
// a card went can't be read through the API at all (see supabase/schema.sql).

export type Activity = {
  sessions: SessionRecord[];
  /** The card id of every card practiced in the last 7 days. */
  weekCardIds: string[];
};

export async function loadActivity(now = new Date()): Promise<Activity> {
  const monthStart = lastDays(now, 30)[0];
  const weekStart = lastDays(now, 7)[0];
  const [sessions, attempts] = await Promise.all([
    // Every column, so this works whether or not the server has study_day yet (supabase/schema.sql).
    // A day's margin before the window, for a phone in another time zone; the days are picked by study day.
    supabase
      .from('sessions')
      .select('*')
      .gte('started_at', new Date(monthStart.getTime() - 24 * 60 * 60_000).toISOString())
      .order('started_at'),
    supabase.from('attempts').select('card_id').gte('attempted_at', weekStart.toISOString()),
  ]);
  const error = sessions.error ?? attempts.error;
  // The error itself, so its kind (offline, signed out, a server not yet updated) can be told apart.
  if (error) throw error;
  return {
    sessions: (sessions.data ?? []).map((row) => ({
      startedAt: row.started_at,
      completedAt: row.completed_at,
      cardsCompleted: row.cards_completed,
      dailyGoal: row.daily_goal,
      studyDay: row.study_day ?? null,
    })),
    weekCardIds: (attempts.data ?? []).map((row) => row.card_id),
  };
}
