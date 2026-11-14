import { GENERATE_QUESTIONS_FUNCTION } from '@/config/functions';
import type { AiRequest } from '@/lib/ai-request';
import { installToken } from '@/lib/install-token';

// The one call that leaves the phone with sign-in off, and only when the caregiver taps Generate.
// It needs no Supabase client: the function takes no account, only this install's token.

/** Why no sentences came back, in the words the sheet shows for each. */
export type AiFailure = 'offline' | 'rate_limited_hour' | 'rate_limited_day' | 'busy' | 'disabled' | 'unavailable';

// Longer than the function's slowest case, two tries of 45 seconds, so a paid-for answer isn't lost.
const TIMEOUT_MS = 100_000;
const KNOWN: AiFailure[] = ['rate_limited_hour', 'rate_limited_day', 'busy', 'disabled', 'unavailable'];

export async function fetchSentences(body: AiRequest): Promise<{ sentences: unknown } | { error: AiFailure }> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) return { error: 'disabled' };
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/functions/v1/${GENERATE_QUESTIONS_FUNCTION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-install-token': await installToken() },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    const answer: unknown = await response.json().catch(() => null);
    if (response.ok) return { sentences: answer };
    const code = (answer as { error?: AiFailure } | null)?.error;
    return { error: code && KNOWN.includes(code) ? code : 'unavailable' };
  } catch {
    // No answer in time, or nothing got through at all.
    return { error: abort.signal.aborted ? 'unavailable' : 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
