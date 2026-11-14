// Every offline check, one after another, stopping at the first that fails (`npm test`):
//   node scripts/check-all.mjs            everything, the release bundles last (about a minute more)
//   node scripts/check-all.mjs --quick    everything but the release bundles
// The live tests (supabase/tests/live*.test.mjs) need the real project and are run by hand.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  'scripts/check-no-real-data.mjs',
  'scripts/check-no-real-data.test.mjs',
  'scripts/check-logic.mjs',
  'scripts/check-auth.mjs',
  'scripts/check-server-family.mjs',
  'scripts/check-sync.mjs',
  'scripts/check-export.mjs',
  'scripts/check-reminders.mjs',
  'scripts/check-privacy.mjs',
  'supabase/tests/rls.test.mjs',
  'supabase/tests/records.test.mjs',
  'supabase/tests/pairing.test.mjs',
  'supabase/tests/function.test.mjs',
  ...(process.argv.includes('--quick') ? [] : ['scripts/check-release.mjs']),
];
for (const suite of suites) {
  const result = spawnSync('node', ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', suite], { cwd: root, encoding: 'utf8' });
  const last = `${result.stdout}`.trim().split('\n').at(-1);
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'}  ${suite}  ${last ?? ''}`);
  if (result.status !== 0) {
    process.stdout.write(result.stdout.split('\n').filter((line) => /FAIL|Error/.test(line)).slice(0, 20).join('\n'));
    process.stderr.write(`\n${result.stderr.split('\n').slice(0, 15).join('\n')}\n`);
    process.exit(1);
  }
}
console.log(`\nAll ${suites.length} suites passed`);
