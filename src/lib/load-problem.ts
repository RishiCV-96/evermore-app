// Why something couldn't load, told apart so the caregiver sees the right calm message, not "check
// the internet" for everything. Pure, so scripts/check-logic.mjs checks it. Never shows a code or
// anything about the server's insides.

import { APP_NAME } from '@/config/brand';

export type LoadProblem = 'offline' | 'signed-out' | 'server-update' | 'server';

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown; name?: unknown };

/** Codes for a table, column or function the server doesn't have yet: its schema needs rerunning. */
const SCHEMA_CODES = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);

export function problemOf(error: unknown): LoadProblem {
  const { code, message, status, name } = (error && typeof error === 'object' ? error : {}) as ErrorLike;
  const text = `${typeof name === 'string' ? name : ''} ${typeof message === 'string' ? message : typeof error === 'string' ? error : ''}`;
  const codeText = typeof code === 'string' ? code : '';
  if (SCHEMA_CODES.has(codeText) || /does not exist|schema cache|could not find the (table|column|function)/i.test(text)) return 'server-update';
  if (codeText === 'PGRST301' || codeText === 'PGRST302' || status === 401 || /\bjwt\b|not authenticated|invalid claim|refresh token|session (missing|expired)|auth session/i.test(text)) return 'signed-out';
  if (status === 0 || /network request failed|failed to fetch|load failed|networkerror|fetch failed|timed? ?out|aborted|offline|enotfound|econnrefused/i.test(text)) return 'offline';
  // No code and no answer at all: the request never reached the server.
  if (!codeText && status === undefined && !/\S/.test(text)) return 'offline';
  return 'server';
}

/** What Insights say when they couldn't load the first time on this phone. */
export const INSIGHTS_PROBLEM: Record<LoadProblem, string> = {
  offline: 'Insights need the internet the first time they open on this phone. Please check the connection.',
  'signed-out': 'Your sign-in needs renewing. Please sign out in Settings, then sign in again.',
  'server-update': `Insights can’t open until ${APP_NAME}’s server is updated. Practice is saved meanwhile. Please try again later.`,
  server: 'Insights couldn’t load just now. Practice is saved meanwhile. Please try again in a moment.',
};

/** What the dashboard says when some of it couldn't load. */
export const DASHBOARD_PROBLEM: Record<LoadProblem, string> = {
  offline: 'Some of this couldn’t load. Please check the internet connection.',
  'signed-out': 'Your sign-in needs renewing. Please sign out in Settings, then sign in again.',
  'server-update': `Some of this can’t load until ${APP_NAME}’s server is updated. Please try again later.`,
  server: 'Some of this couldn’t load just now. Please try again in a moment.',
};
