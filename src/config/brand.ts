// The app's name and the words that go with it, in one place. "Tandem" is a placeholder pending
// trademark clearance: a rename is a change to this file, then `node scripts/build-policy.mjs` (with a
// new POLICY_VERSION in src/lib/consent.ts), app.json's "name", and the logo files in brand-kit/.
// scripts/check-brand.mjs keeps app.json's name and the policy in step with APP_NAME.
//
// Not changed by a rename, on purpose (docs/BRAND-AUDIT.md says what each would break): the Expo slug
// and URL scheme, storage keys, the reserved login domains, Supabase function slugs and secrets.

/** The name people see: the home screen, Settings, every screen, the policy and exports. */
export const APP_NAME = 'Tandem';

/** The name in lower case, for file names such as tandem-data-2026-11-16.json. */
export const APP_NAME_LOWER = 'tandem';

/** A short line about the app. A placeholder, not shown in the app yet. */
export const TAGLINE = 'Short stories about the people you love.';

/** Where people write for help. A placeholder until a real address exists: never shown as a link. */
export const SUPPORT_EMAIL = '[Support email to be added]';

/** Where the privacy policy says to write about your information. A placeholder, like SUPPORT_EMAIL. */
export const POLICY_CONTACT = '[Contact email to be added]';
