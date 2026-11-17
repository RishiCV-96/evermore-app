// The brand guard (in `npm test`, docs/BRAND-AUDIT.md):
//   1. The old name appears in no front-facing file (src, app.json, assets' text, README, the privacy
//      policy, the App Store drafts, the TestFlight checklist), in any case or spelling, except inside
//      an internal identifier listed in scripts/brand-allowlist.txt. Every entry there must still be used.
//   2. The name shown comes from src/config/brand.ts: app.json's name, the policy's title and its page.
//   3. The logo files in assets/images and src/components/tandem-logo-data.ts are what brand-kit/ makes:
//      copies byte for byte, composed images pixel for pixel (scripts/make-brand-assets.mjs), and the
//      renderer still reproduces the kit's own stacked PNG. Old logo files are gone.
// It never prints a file's text, only where.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ASSETS, COPIED, KIT, LOGO_DATA, composed, decodePng, difference, logoData, readKit, rendererFidelity } from './brand-kit.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = `${root}src/`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const file = `${src}${specifier.slice(2)}.ts`;
      if (existsSync(file)) return { url: pathToFileURL(file).href, format: 'module-typescript', shortCircuit: true };
    }
    return next(specifier, context);
  },
});

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log(`PASS  ${name}`);
}

// ---- 1. The old name ----

/** The old name in any case or spelling ("Evermore", "EverMore", "Ever more", "ever-more"), not "never more". */
const OLD_NAME = /(?<![a-z])ever[\s_-]?more/i;

export const FRONT_FACING = (path) =>
  path.startsWith('src/') ||
  path === 'app.json' ||
  path === 'README.md' ||
  (path.startsWith('assets/') && /\.(md|txt|json)$/.test(path)) ||
  /^docs\/(privacy-policy|app-store)/.test(path) ||
  path === 'docs/testflight-checklist.md';

const allowlist = readFileSync(new URL('brand-allowlist.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((line) => line.replace(/\s+#.*$/, '').trim())
  .filter((line) => line && !line.startsWith('#'))
  // Longest first, so a key isn't cut short by a shorter one it starts with.
  .sort((a, b) => b.length - a.length);

/** Where the old name appears outside an allowed identifier: line numbers only. */
export function oldNameIn(text, allowed = allowlist) {
  const found = [];
  const used = new Set();
  text.split('\n').forEach((line, index) => {
    let rest = line;
    for (const entry of allowed) {
      if (rest.includes(entry)) {
        used.add(entry);
        rest = rest.split(entry).join(' ');
      }
    }
    if (OLD_NAME.test(rest)) found.push(index + 1);
  });
  return { found, used };
}

check('the guard sees the old name in any spelling, and lets identifiers through', () => {
  for (const planted of ['Evermore', 'EVERMORE', 'EverMore', 'Ever more', 'ever-more', 'ever_more', 'Welcome to evermore.']) assert.deepEqual(oldNameIn(planted).found, [1], `${planted} is found`);
  for (const fine of ['never more than two', 'evermore.textSize.v1', 'x@person.evermore.invalid', "'evermore1'", 'Tandem']) assert.deepEqual(oldNameIn(fine).found, [], `${fine} is allowed`);
  assert.deepEqual(oldNameIn('evermore.reminder.2026 and Evermore').found, [1], 'an identifier on the line doesn’t hide the name beside it');
});

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((path) => path && FRONT_FACING(path) && existsSync(`${root}${path}`) && !/\.(png|jpe?g|gif|webp|ttf|otf)$/i.test(path));

check(`no trace of the old name in the ${files.length} front-facing files, outside the allowlist`, () => {
  const used = new Set();
  const problems = [];
  for (const path of files) {
    const result = oldNameIn(readFileSync(`${root}${path}`, 'utf8'));
    for (const entry of result.used) used.add(entry);
    if (result.found.length) problems.push(`${path}:${result.found.join(',')}`);
  }
  assert.deepEqual(problems, [], `the old name is still shown in ${problems.join(' ')}`);
  const stale = allowlist.filter((entry) => !used.has(entry));
  assert.deepEqual(stale, [], `allowlist entries no longer used anywhere: ${stale.join(', ')}`);
});

// ---- 2. One name ----

const brand = await import('@/config/brand');
const policy = await import('@/lib/privacy-policy');
const appJson = JSON.parse(readFileSync(`${root}app.json`, 'utf8')).expo;

check('the name comes from src/config/brand.ts: app.json, the policy and its page agree', () => {
  assert.equal(appJson.name, brand.APP_NAME, 'app.json’s name is APP_NAME');
  assert.equal(brand.APP_NAME_LOWER, brand.APP_NAME.toLowerCase());
  assert.ok(policy.POLICY_TITLE.startsWith(brand.APP_NAME), 'the policy is titled with the name');
  assert.ok(readFileSync(`${root}docs/privacy-policy.html`, 'utf8').includes(`<title>${brand.APP_NAME} privacy policy</title>`), 'the hosted page says it too');
  assert.equal(policy.CONTACT, brand.POLICY_CONTACT, 'the policy’s contact is the brand config’s');
  // The identifiers stay, so phones keep their data and the Expo project its link.
  assert.equal(appJson.slug, 'evermore', 'the slug is unchanged');
  assert.equal(appJson.scheme, 'evermore', 'the scheme is unchanged');
});

// ---- 3. The logo files ----

const kit = readKit();

check('the renderer still reproduces the kit’s own stacked PNG', () => {
  const { mean, max } = rendererFidelity(kit);
  assert.ok(mean <= 0.05 && max <= 48, `drawn against the kit: mean ${mean.toFixed(3)}, largest ${max}`);
});

check('the kit’s icon, favicon and light splash logo are in assets exactly as they are in the kit', () => {
  for (const [asset, source] of Object.entries(COPIED)) {
    assert.ok(readFileSync(new URL(asset, ASSETS)).equals(readFileSync(new URL(source, KIT))), `assets/images/${asset} differs from brand-kit/${source}: run node scripts/make-brand-assets.mjs`);
  }
});

check('the dark splash logo and Android foreground are what the kit makes, pixel for pixel', () => {
  for (const [asset, make] of Object.entries(composed(kit))) {
    let file;
    try {
      file = decodePng(readFileSync(new URL(asset, ASSETS)));
    } catch {
      assert.fail(`assets/images/${asset} can't be read as the kit's image: run node scripts/make-brand-assets.mjs`);
    }
    const { mean, max } = difference(file, make());
    assert.ok(mean === 0 && max === 0, `assets/images/${asset} differs from what brand-kit/ makes: run node scripts/make-brand-assets.mjs`);
  }
});

check('<TandemLogo /> draws the kit’s shapes and colors', () => {
  assert.equal(readFileSync(LOGO_DATA, 'utf8'), logoData(kit), 'src/components/tandem-logo-data.ts differs from brand-kit/: run node scripts/make-brand-assets.mjs');
});

check('app.json uses those files, and the old logo files are gone', () => {
  const splash = appJson.plugins.find((one) => Array.isArray(one) && one[0] === 'expo-splash-screen')[1];
  assert.equal(appJson.icon, './assets/images/icon.png');
  assert.equal(appJson.web.favicon, './assets/images/favicon.png');
  assert.equal(appJson.android.adaptiveIcon.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(appJson.android.adaptiveIcon.backgroundColor, kit.reversedBackground, 'the adaptive icon sits on Ink, like the kit’s navy icon');
  assert.equal(splash.image, './assets/images/splash-logo.png');
  assert.equal(splash.dark.image, './assets/images/splash-logo-dark.png');
  assert.equal(splash.backgroundColor, '#EAF3FB', 'the splash is Mist');
  assert.equal(splash.dark.backgroundColor, kit.reversedBackground, 'and Ink in dark mode');
  for (const old of ['logo-wordmark.png', 'logo-mark.png', 'splash-icon.png']) assert.ok(!existsSync(new URL(old, ASSETS)), `the old ${old} is gone`);
});

console.log(`\nAll ${passed} brand checks passed`);
