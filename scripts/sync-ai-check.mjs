// Copies src/lib/ai-check.ts into the Edge Function, which can't import it when it is pasted into
// the Supabase dashboard. Run it after changing the checks:
//   node scripts/sync-ai-check.mjs
// scripts/check-logic.mjs fails if the two copies differ.
import { readFileSync, writeFileSync } from 'node:fs';

const FUNCTION = new URL('../supabase/functions/generate-questions/index.ts', import.meta.url);
const CHECKS = new URL('../src/lib/ai-check.ts', import.meta.url);
const START = '// <ai-check>\n';
const END = '// </ai-check>\n';

const code = readFileSync(FUNCTION, 'utf8');
const before = code.slice(0, code.indexOf(START) + START.length);
const after = code.slice(code.indexOf(END));
writeFileSync(FUNCTION, before + readFileSync(CHECKS, 'utf8') + after);
console.log('Copied the checks into the function.');
