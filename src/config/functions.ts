// The URL slugs of the two Edge Functions, as deployed. Calls go to /functions/v1/<slug>.
//
// Each comes from an EXPO_PUBLIC_ variable, so a build can point at a project whose functions have
// other slugs without a code change. The defaults are the development project's slugs, which its
// dashboard editor made up. A project deployed with the CLI (`npx supabase functions deploy
// manage-family …`, docs/RELEASE-STEPS.md) gets each function's own name as its slug, so the production
// build sets both variables to the names (EAS environment variables, never in git):
//   EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION=manage-family
//   EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION=generate-questions
// Read as process.env.EXPO_PUBLIC_… exactly, so Expo inlines them when it bundles the app; an empty
// value falls back to the default too.

/** manage-family (supabase/functions/manage-family): the person's login, and Delete account. */
export const MANAGE_FAMILY_FUNCTION = process.env.EXPO_PUBLIC_MANAGE_FAMILY_FUNCTION || 'dynamic-api';

/** generate-questions (supabase/functions/generate-questions): AI questions, off in this build. */
export const GENERATE_QUESTIONS_FUNCTION = process.env.EXPO_PUBLIC_GENERATE_QUESTIONS_FUNCTION || 'clever-service';
