import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { AUTH_ENABLED } from '@/config/features';
import { sessionStorage, storedSessionUser } from '@/lib/session-storage';

// The app's only connection to the server. It holds the public URL and publishable (anon)
// key from .env; Row Level Security decides what each signed-in user can reach. Never put
// a secret or service-role key in the app.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (AUTH_ENABLED && (!url || !key)) {
  throw new Error(
    'Evermore needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example). Restart `npx expo start` after adding them. To run without a server, use `npm run start:local`.',
  );
}

/** Where the session is kept: supabase-js's own default name, sb-<project>-auth-token. */
export const SESSION_KEY = url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : 'sb-local-auth-token';

// With sign-in off (src/config/features.ts) no client is made, so nothing can reach the
// server; using it anyway fails with a clear message.
//
// The session lives in the phone's secure storage (src/lib/session-storage.ts) and is restored
// when the app opens, so a phone that signed in stays signed in until someone signs it out.
export const supabase: SupabaseClient = AUTH_ENABLED
  ? createClient(url!, key!, {
      auth: {
        storage: sessionStorage,
        storageKey: SESSION_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : serverOff();

/** The user whose session is kept on this phone, even while supabase-js can't refresh it (offline). */
export const keptSessionUser = () => storedSessionUser(SESSION_KEY);

/** Forgets the session on this phone, without asking the server: for signing out with no connection. */
export const forgetKeptSession = () => sessionStorage.removeItem(SESSION_KEY);

function serverOff() {
  const api = new Set(['auth', 'from', 'storage', 'functions', 'rpc', 'schema', 'channel', 'realtime']);
  return new Proxy({} as SupabaseClient, {
    get(_, name) {
      if (typeof name === 'string' && api.has(name)) {
        throw new Error('Sign-in is off (AUTH_ENABLED in src/config/features.ts), so the app makes no server calls.');
      }
      return undefined;
    },
  });
}

// Refresh the session only while the app is in front, as Supabase recommends on phones, starting now
// if it opened in front (AppState says nothing until it changes).
if (AUTH_ENABLED && Platform.OS !== 'web') {
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
