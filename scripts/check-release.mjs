// The release guard: builds the iOS and Android bundles as a release would (or reads an export you
// made) and fails if any of the user's real family is in them (the photos, the gitignored local deck's
// cards, and every entry of the private denylist), if a secret is, or if the settings a
// release depends on are wrong. It never prints a real photo, name or word: only which check failed.
//
//   node scripts/check-release.mjs              # exports to a temporary folder, checks, deletes it
//   node scripts/check-release.mjs <export-dir> # checks an export you already made
//
// Never run `eas build` or `eas update` (CLAUDE.md); this checks what any release bundle would hold.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { bundleHolds, loadDenylist } from './denylist.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = join(root, 'src/');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    return next(specifier, context);
  },
});

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};
const inRepo = (path) => readFileSync(join(root, path), 'utf8');
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');

// 1. The source: what keeps the real family out
check(/const added = __DEV__ \? require\.context\('\.\.\/\.\.\/assets\/photos'/.test(inRepo('src/data/photos.ts')), 'real photos load in development builds only');
check(/const localFiles = __DEV__ \? require\.context\('\.\/', false, \/\^\\\.\\\/deck\\\.local\\\.ts\$\/\) : null;/.test(inRepo('src/data/example-deck.ts')), 'the local real deck loads in development builds only');
// Nothing that ships may import the local deck: the app's code and the Edge Functions. Only
// example-deck.ts names it, inside its development-only require.context, and only local-store reads that.
const shipping = [...walk(join(root, 'src')), ...walk(join(root, 'supabase/functions'))].filter((path) => /\.(ts|tsx|js|mjs)$/.test(path));
const codeOf = (path) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gm, '$1');
const namesLocal = shipping.filter((path) => /deck\.local|deck\\\.local/.test(codeOf(path)));
check(namesLocal.length === 1 && namesLocal[0].endsWith('src/data/example-deck.ts'), 'nothing that ships imports src/data/deck.local.ts (only example-deck.ts names it, for development)');
const readers = shipping.filter((path) => /from '@\/data\/example-deck'/.test(readFileSync(path, 'utf8')));
check(readers.length === 1 && readers[0].endsWith('src/data/local-store.ts'), 'and only the local-only store reads the example deck');
check(shipping.every((path) => !/from '@\/data\/deck'|data\/deck'/.test(readFileSync(path, 'utf8'))), 'the old src/data/deck.ts is imported nowhere');
let trackedLocal = '';
try {
  trackedLocal = execFileSync('git', ['ls-files', 'src/data/deck.local.ts', 'scripts/private-denylist.local.txt', 'assets/photos'], { cwd: root, encoding: 'utf8' }).split('\n').filter((path) => path && path !== 'assets/photos/README.md').join();
} catch {
  trackedLocal = '';
}
check(trackedLocal === '', 'git tracks no local deck, denylist or photo');
const easignore = existsSync(join(root, '.easignore')) ? inRepo('.easignore') : '';
check(/^assets\/photos\/\*$/m.test(easignore) && /^!assets\/photos\/README\.md$/m.test(easignore) && /^src\/data\/deck\.local\.ts$/m.test(easignore) && /^\*\.local\.txt$/m.test(easignore) && /^\.env$/m.test(easignore), '.easignore keeps the photos, the local deck, the denylist and .env out of any EAS upload');
const gitignore = inRepo('.gitignore');
check(/^assets\/photos\/\*$/m.test(gitignore) && /^src\/data\/deck\.local\.ts$/m.test(gitignore) && /^scripts\/private-denylist\.local\.txt$/m.test(gitignore), 'and .gitignore keeps the photos, the local deck and the denylist out of git');
const features = inRepo('src/config/features.ts');
check(/export const AI_VARIANTS_ENABLED = false;/.test(features), 'AI questions are off by default');
check(/export const AUTH_ENABLED = process\.env\.EXPO_PUBLIC_LOCAL_ONLY !== '1';/.test(features), 'sign-in is on unless the development flag is set');

// 2. The bundles
let dir = process.argv[2];
const made = !dir;
if (made) {
  dir = mkdtempSync(join(tmpdir(), 'evermore-release-'));
  console.log('Exporting the iOS and Android bundles (a minute or two)…');
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_LOCAL_ONLY;
  delete env.EXPO_PUBLIC_CLEAR_TEST_DATA;
  execFileSync('npx', ['expo', 'export', '--platform', 'ios', '--platform', 'android', '--output-dir', dir, '--clear'], { cwd: root, env, stdio: 'ignore' });
}
try {
  const files = walk(dir);
  const bundles = files.filter((path) => /\.(hbc|js)$/.test(path));
  check(bundles.length > 0, 'the export has bundles to check');

  // No real photo, by its exact bytes
  const photoDir = join(root, 'assets/photos');
  const real = existsSync(photoDir) ? readdirSync(photoDir).filter((name) => /\.(jpe?g|png)$/i.test(name)).map((name) => md5(readFileSync(join(photoDir, name)))) : [];
  const shipped = new Set(files.filter((path) => !/\.(hbc|js|map|json|html)$/.test(path)).map((path) => md5(readFileSync(path))));
  check(real.every((hash) => !shipped.has(hash)), `none of the ${real.length} real photos is in the export`);

  // No real family member's words, from the gitignored local deck when it is on this computer (each
  // memory, as UTF-8 and as UTF-16, as Hermes may keep it). The denylist scan below covers
  // names on a computer without the local deck.
  const localPath = join(src, 'data/deck.local.ts');
  const localDeck = existsSync(localPath) ? ((await import('@/data/deck.local')).localDeck ?? []) : [];
  const words = localDeck.flatMap((person) => person.memories).filter((text) => text.length >= 12);
  const contents = bundles.map((path) => readFileSync(path));
  const inBundles = (text) => contents.some((buffer) => buffer.includes(Buffer.from(text, 'utf8')) || buffer.includes(Buffer.from(text, 'utf16le')));
  if (localDeck.length) {
    check(words.length > 0 && !words.some(inBundles), `none of the local deck's ${words.length} real cards is in the bundles`);
  } else {
    console.log('NOTE  no local deck on this computer: nothing of it to look for (the denylist scan still runs)');
  }

  // No entry of the private denylist (scripts/private-denylist.local.txt), named by number only, never printed.
  const denylist = loadDenylist();
  if (denylist.missing) {
    console.log('WARN  no private denylist (scripts/private-denylist.local.txt): its scan of the bundles is skipped');
  } else {
    const inBundles = [...new Set(contents.flatMap((buffer) => bundleHolds(buffer, denylist.entries)))];
    check(inBundles.length === 0, `no entry of the private denylist (${denylist.entries.length}) is in the bundles${inBundles.length ? `: entries ${inBundles.join(', ')}` : ''}`);
  }

  // No secret. supabase-js itself mentions the "sb_secret_" prefix (it checks key formats), so the
  // bundles are searched for the values themselves: every .env value that isn't EXPO_PUBLIC_ (only
  // those are meant for the app), an Anthropic key, and a service-role JWT (its payload, base64).
  const envFiles = readdirSync(root).filter((name) => /^\.env/.test(name) && !statSync(join(root, name)).isDirectory());
  const envPairs = envFiles.flatMap((name) => readFileSync(join(root, name), 'utf8').split('\n')).map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?([^'"\s#]+)/)).filter(Boolean);
  const isSecret = (value) => /^sb_secret_|^sk-ant-/.test(value) || (/^eyJ/.test(value) && Buffer.from(value.split('.')[1] ?? '', 'base64').toString().includes('service_role'));
  check(envPairs.every(([, , value]) => !isSecret(value)), 'no .env file holds a secret key (they live in Supabase’s secrets only)');
  const privateValues = envPairs.filter(([, key, value]) => !key.startsWith('EXPO_PUBLIC_') && value.length >= 8).map(([, , value]) => value);
  const latin = contents.map((buffer) => buffer.toString('latin1'));
  check(latin.every((text) => privateValues.every((value) => !text.includes(value))), 'no value from .env that isn’t EXPO_PUBLIC_ is in the bundles');
  check(latin.every((text) => !/sk-ant-[A-Za-z0-9_-]{20,}/.test(text) && !/c2VydmljZV9yb2xl/.test(text)), 'no Anthropic key or service-role JWT in the bundles');

  // No developer tools
  check(contents.every((buffer) => !/Load 14 days of sample activity|Clear sample activity|Load demo data for Insights|Development only/.test(buffer.toString('latin1'))), 'no developer control in the bundles');

  // Text as Hermes may keep it: Latin-1, and UTF-16 at both byte alignments.
  const views = contents.map((buffer) => [buffer.toString('latin1'), buffer.toString('utf16le'), buffer.subarray(1).toString('utf16le')].join('\n'));
  const nowhere = (pattern) => views.every((text) => !pattern.test(text));

  // No .env file, whatever its name, among the exported files.
  check(files.every((path) => !/(^|[\\/])\.env/.test(path.slice(dir.length))), 'no .env file in the export');

  // The old name is never shown. It stays only in lowercase identifiers (storage keys, the login
  // domain: scripts/brand-allowlist.txt), so any capitalized form would be a word on screen.
  check(nowhere(/Evermore|EVERMORE|EverMore|Ever[ _-]more/), 'the old app name is shown nowhere (only lowercase storage keys keep it)');

  // PIN pairing was removed (docs/PIN-REMOVAL-PLAN.md): none of its plumbing or words ship.
  check(nowhere(/pair-phone|hyper-function|Linked phones|Remove phone|Send the PIN|device_seen|phone\.evermore\.invalid|signInPairedPhone|DeviceCredential/), 'no PIN pairing code or words in the bundles');

  // The deck a release ships is the fictional sample deck: each sample memory is there (and, above,
  // none of the local deck's cards, photos or denylist entries is).
  const { sampleDeck } = await import('@/data/sample-deck');
  check(sampleDeck.length === 5 && sampleDeck.every((person) => person.memories.every(inBundles)), `the bundles hold the fictional sample deck (${sampleDeck.map((person) => person.name).join(', ')})`);
} finally {
  if (made) rmSync(dir, { recursive: true, force: true });
}

assert.equal(failures.length, 0, `${failures.length} release checks failed`);
console.log('All release checks passed');
