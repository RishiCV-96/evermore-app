import { Image } from 'expo-image';

import { onSignOut } from '@/data/account';
import { forgetConsent } from '@/data/consent-store';
import { forgetFamily } from '@/data/family-store';
import { forgetInsights } from '@/data/insights-store';
import { forgetPin } from '@/data/pairing';
import { flushPractice, forgetPractice } from '@/data/practice-store';
import { forgetReminders } from '@/data/reminders';
import { clearExports } from '@/lib/save-file';

// What a phone keeps from the server for a login, and goes when that login signs out here, however
// it signs out (Settings, the person's phone handed back, Delete account, or the server refusing the
// session): the saved profile (src/data/account.ts), the family in memory, the person's copy of the
// deck, the caregiver's agreements read this session (memory only), the caregiver's copy of Insights, a PIN still on show, every photo in the image cache, and the
// person's daily reminders on this phone (cancelled, with their setting), so a signed-out or removed
// phone never reminds, and any export file left in the temporary folder by a share the app didn't see
// finish. What stays: practice and
// card records not yet sent (they hold ids and numbers only, and go when that login signs in again),
// the text size, and the family kept on the phone in the local-only mode, which isn't server data.
// Imported once by src/data/app-data.ts.

onSignOut({
  // The person's phone sends what is waiting first, if it can, so nothing is held back for long.
  before: (profile) => (profile.role === 'person' ? flushPractice() : undefined),
  after: (profile) =>
    Promise.allSettled([Promise.resolve().then(forgetConsent), forgetFamily(), forgetInsights(profile.id), forgetPractice(profile.id), forgetPin(), forgetReminders(), Promise.resolve().then(clearExports), Image.clearMemoryCache(), Image.clearDiskCache()]),
});
