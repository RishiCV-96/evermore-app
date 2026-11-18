// The store build's settings, and what an EAS upload would hold (`npm test`, quick too). It never logs
// in, never uploads and never runs eas: it reads app.json, eas.json and the files on this computer.
//
//   1. app.json: the bundle identifier, iPhone only, export compliance, and (resolved through Expo's
//      config plugins, as a build would) exactly three permission strings in plain, honest words (the
//      photo library, and the camera and microphone notes the photo picker requires, which say the app
//      never uses either), no code that could reach the camera or microphone, no push entitlement, and a
//      privacy manifest that declares every reason the native modules declare.
//   2. eas.json: the three profiles, remote build numbers, production read from EAS environment
//      variables (nothing of the project, no Apple ID, no key written in the file), sign-in on.
//   3. The EAS upload: every file EAS would send (tracked and untracked files, less .easignore, which
//      EAS reads instead of .gitignore). No .env file, real photo, local deck, denylist, screenshot
//      folder, native folder, signing file, secret or denylist entry. Never prints an entry: only its
//      number and where. `eas build:inspect` would show the same list but needs a login.
//   4. Store-facing words make no medical claim: the app's strings, the store copy in
//      docs/app-store-listing.md and docs/TESTER-GUIDE.md.
//
// scripts/check-release.mjs checks the bundles themselves.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findIn, isText, loadDenylist } from './denylist.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${root}src/${specifier.slice(2)}.ts`).href, context);
    return next(specifier, context);
  },
});

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};
const inRepo = (path) => readFileSync(join(root, path), 'utf8');
const md5 = (buffer) => createHash('md5').update(buffer).digest('hex');
const brand = await import('@/config/brand');

// ---- 1. app.json ----

/** Chosen for the first TestFlight build. Apple and Google tie every later build to it: never change it. */
const BUNDLE_ID = 'com.rishiverma.memorypractice';

const app = JSON.parse(inRepo('app.json')).expo;
check(app.ios?.bundleIdentifier === BUNDLE_ID && app.android?.package === BUNDLE_ID, `the iOS bundle identifier and Android package are ${BUNDLE_ID}`);
check(!/tandem|ever[\s_-]?more/i.test(BUNDLE_ID) && !BUNDLE_ID.toLowerCase().includes(brand.APP_NAME_LOWER), 'the identifier is neutral: it names neither the app nor the old name, so a rename never touches it');
check(/^\d+\.\d+\.\d+$/.test(app.version), `the version is plain x.y.z (${app.version})`);
check(app.ios?.buildNumber === undefined && app.android?.versionCode === undefined, 'no build number in app.json: EAS keeps them (appVersionSource remote)');
check(app.ios?.supportsTablet === false, 'iPhone only (supportsTablet false), so no iPad screenshots are needed');
check(app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, 'ITSAppUsesNonExemptEncryption is false (HTTPS only: exempt)');

// The config as a build resolves it, through every plugin (the image picker and secure store add
// permission strings unless told not to). `expo config` reads only this folder: no login, no network.
const resolved = JSON.parse(execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, EXPO_OFFLINE: '1' }, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64e6 }));
const plist = resolved._internal?.modResults?.ios?.infoPlist ?? {};
const usage = Object.keys(plist).filter((key) => /UsageDescription$/.test(key)).sort();
// Exactly these words, and no other permission string (no Face ID: nothing uses it). The camera and
// microphone notes exist only because the photo picker's native code refers to both, so Apple's scan
// expects them; they say plainly that the app never uses either. A rename (APP_NAME) changes them too.
const PERMISSION_STRINGS = {
  NSCameraUsageDescription: `${brand.APP_NAME} never opens the camera and does not take photos or video. You choose photos from your own library. This note is here only because the photo picker requires it.`,
  NSMicrophoneUsageDescription: `${brand.APP_NAME} never uses the microphone and does not record audio or video. This note is here only because the photo picker requires it.`,
  NSPhotoLibraryUsageDescription: 'Pick a photo of each person you add, so it can appear on their practice cards. Only the photos you choose are used.',
};
check(JSON.stringify(usage) === JSON.stringify(Object.keys(PERMISSION_STRINGS).sort()), `exactly three permission strings, the photo library, camera and microphone (found: ${usage.join(', ') || 'none'}); no Face ID or any other`);
check(Object.entries(PERMISSION_STRINGS).every(([key, words]) => plist[key] === words), 'each says exactly the agreed words: the camera and microphone notes say the app never uses them');

// And nothing can use them: the only picker call opens the library for images, and no camera, audio,
// video or media-library module is installed or imported.
const appCode = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((path) => /\.tsx?$/.test(path) && existsSync(join(root, path)))
  .map((path) => ({ path, code: inRepo(path) }));
const reaches = appCode.filter(({ code }) =>
  /launchCameraAsync|CameraPermission|MicrophonePermission|requestCamera|requestMicrophone|getUserMedia|recordAsync|expo-camera|expo-av|expo-audio|expo-video|expo-media-library|react-native-vision-camera/.test(code),
);
check(reaches.length === 0, `no code can open the camera or record audio or video${reaches.length ? `: ${reaches.map(({ path }) => path).join(', ')}` : ''}`);
const pickerCalls = appCode.flatMap(({ code }) => [...code.matchAll(/ImagePicker\.(\w+)\(([^)]*)\)/g)]);
check(pickerCalls.length > 0 && pickerCalls.every(([, method, args]) => method === 'launchImageLibraryAsync' && /mediaTypes: \['images'\]/.test(args)), `every image picker call opens the photo library for images only (${pickerCalls.length} calls)`);
const pkg = JSON.parse(inRepo('package.json'));
const mediaModules = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((name) => /camera|expo-av$|expo-audio|expo-video|media-library|audio-recorder/.test(name));
check(mediaModules.length === 0, `no camera, audio, video or media-library module is installed${mediaModules.length ? `: ${mediaModules.join(', ')}` : ''}`);
check(plist.ITSAppUsesNonExemptEncryption === false, 'and the built Info.plist says ITSAppUsesNonExemptEncryption false');
const entitlements = resolved._internal?.modResults?.ios?.entitlements ?? {};
check(!('aps-environment' in entitlements) && !(plist.UIBackgroundModes ?? []).includes('remote-notification'), 'no push entitlement or remote-notification background mode: the reminder is a local notification');
const notifications = app.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-notifications');
check(notifications?.[1]?.enableRemoteNotifications === false, 'expo-notifications has remote notifications off');
const manifestPermissions = resolved._internal?.modResults?.android?.manifest?.manifest?.['uses-permission'] ?? [];
const removed = new Set(manifestPermissions.filter((entry) => entry.$['tools:node'] === 'remove').map((entry) => entry.$['android:name'].replace('android.permission.', '')));
const blocked = ['CAMERA', 'RECORD_AUDIO', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW'];
check(blocked.every((name) => removed.has(name)), `Android blocks what the app never uses (${blocked.join(', ')})`);
const requested = manifestPermissions.filter((entry) => entry.$['tools:node'] !== 'remove').map((entry) => entry.$['android:name']);
check(requested.every((name) => !/LOCATION|CONTACTS|CAMERA|RECORD_AUDIO|CALENDAR|PHONE_STATE|BLUETOOTH/.test(name)), `and requests nothing sensitive (${requested.map((name) => name.replace('android.permission.', '')).join(', ')})`);

// Apple reads required-reason declarations badly from static CocoaPods, so Expo's guide says to repeat
// each native module's reasons in the app's own manifest. Every reason a module in node_modules
// declares must be in app.json's ios.privacyManifests.
const declared = new Map((app.ios?.privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map((type) => [type.NSPrivacyAccessedAPIType, new Set(type.NSPrivacyAccessedAPITypeReasons)]));
const manifests = execFileSync('find', ['node_modules', '-name', 'PrivacyInfo.xcprivacy', '-not', '-path', '*/example/*', '-not', '-path', '*/Example/*', '-not', '-path', '*/template*'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const missingReasons = [];
for (const path of manifests) {
  for (const [, dict] of inRepo(path).matchAll(/<dict>((?:(?!<dict>)[\s\S])*?)<\/dict>/g)) {
    const type = /<key>NSPrivacyAccessedAPIType<\/key>\s*<string>([^<]+)<\/string>/.exec(dict)?.[1];
    const reasons = /<key>NSPrivacyAccessedAPITypeReasons<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(dict)?.[1] ?? '';
    for (const [, reason] of type ? reasons.matchAll(/<string>([^<]+)<\/string>/g) : []) {
      if (!declared.get(type)?.has(reason)) missingReasons.push(`${type} ${reason} (${path.split('node_modules/')[1].split('/')[0]})`);
    }
  }
}
check(manifests.length > 0 && missingReasons.length === 0, `the privacy manifest declares every required reason of the ${manifests.length} native modules’ manifests${missingReasons.length ? `: missing ${[...new Set(missingReasons)].join('; ')}` : ''}`);
check(app.ios?.privacyManifests?.NSPrivacyTracking === false, 'and says the app does no tracking');

// ---- 2. eas.json ----

const easText = existsSync(join(root, 'eas.json')) ? inRepo('eas.json') : '{}';
const eas = JSON.parse(easText);
check(eas.cli?.appVersionSource === 'remote', 'eas.json keeps build numbers on EAS (appVersionSource remote)');
const { development, preview, production } = eas.build ?? {};
check(development?.developmentClient === true && development?.distribution === 'internal', 'a development profile (development client, internal)');
check(preview?.distribution === 'internal' && !preview?.developmentClient, 'a preview profile (internal distribution)');
check(production?.distribution === 'store' && production?.environment === 'production' && production?.autoIncrement === true, 'a production profile: store distribution, the production EAS environment, build number raised each build');
check(production?.env?.EXPO_PUBLIC_LOCAL_ONLY !== '1' && !/EXPO_PUBLIC_CLEAR_TEST_DATA/.test(easText), 'production keeps sign-in on and sets no development flag');
check(!/EXPO_PUBLIC_SUPABASE_(URL|ANON_KEY)|_FUNCTION"/.test(easText), 'the Supabase URL, key and function slugs come from EAS environment variables, not eas.json');
check(!/supabase\.co|sb_publishable_|sb_secret_|eyJ[A-Za-z0-9_-]{10,}|sk-ant-|@[a-z0-9-]+\.[a-z]/i.test(easText) && !/"(appleId|ascApiKeyPath|ascApiKeyId|ascApiKeyIssuerId|password)"/.test(easText), 'eas.json holds no project URL, key, Apple ID or App Store Connect key');
check(Boolean(eas.submit?.production?.ios), 'a submit profile for iOS (placeholders only)');

// ---- 3. What an EAS upload would hold ----

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64e6 }).split('\n').filter(Boolean);
const easignore = inRepo('.easignore');
const trackedOut = new Set(git('ls-files', '--cached', '--ignored', '--exclude-from=.easignore'));
const upload = [...new Set([...git('ls-files', '--cached').filter((path) => !trackedOut.has(path)), ...git('ls-files', '--others', '--exclude-from=.easignore')])]
  .filter((path) => existsSync(join(root, path)) && !statSync(join(root, path)).isDirectory())
  .sort();
const megabytes = (paths) => (paths.reduce((sum, path) => sum + statSync(join(root, path)).size, 0) / 1e6).toFixed(1);
check(['package.json', 'app.json', 'eas.json', 'src/app/_layout.tsx', 'src/data/sample-deck.ts', 'assets/images/icon.png'].every((path) => upload.includes(path)), `the upload holds the app (${upload.length} files, ${megabytes(upload)} MB)`);
const none = (pattern) => upload.filter((path) => pattern.test(path));
const envFiles = none(/(^|\/)\.env/).filter((path) => path !== '.env.example');
check(envFiles.length === 0, `no .env file is uploaded, whatever its name (${envFiles.length} found)`);
check(!/^[A-Z0-9_]+=\S/m.test(inRepo('.env.example')), 'and .env.example, which is, holds no value');
check(none(/^assets\/photos\//).every((path) => path === 'assets/photos/README.md'), 'no file from assets/photos but its README');
check(none(/(^|\/)deck\.local\.ts$|private-denylist\.local\.txt$|\.local\.(ts|md|txt)$/).length === 0, 'no local deck, denylist or local notes');
check(none(/\.(p8|p12|pem|key|jks|keystore|mobileprovision)$/i).length === 0, 'no signing key or provisioning profile');
check(none(/^(ios|android)\//).length === 0 && none(/^(node_modules|\.expo|dist|web-build)\//).length === 0, 'no native folder (made on the builder), dependencies or build output');
check(none(/^supabase\/tests\/|^scripts\/fakes\//).length === 0, 'no tests or fixtures');
const screenshotDirs = ['docs/ui-polish-screenshots/', 'docs/brand-screenshots/', 'docs/person-home-screenshots/'];
const screenshots = git('ls-files', ...screenshotDirs);
check(screenshotDirs.every((dir) => new RegExp(`^${dir.replace(/[.]/g, '\\.')}$`, 'm').test(easignore)) && upload.every((path) => !screenshotDirs.some((dir) => path.startsWith(dir))), `the documentation screenshots stay out (${screenshots.length} files, ${megabytes(screenshots)} MB, in git only)`);

// Secrets in any uploaded text: a secret key, an Anthropic key, a private key, a service-role JWT, a
// Supabase project URL or publishable key written into a file, or any value from a .env file on this
// computer (the slugs aside, which are ordinary words the docs use too).
const texts = upload.map((path) => ({ path, buffer: readFileSync(join(root, path)) })).filter(({ buffer }) => isText(buffer));
const jwtRole = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role;
  } catch {
    return undefined;
  }
};
const envValues = readdirSync(root)
  .filter((name) => /^\.env/.test(name) && name !== '.env.example' && !statSync(join(root, name)).isDirectory())
  .flatMap((name) => readFileSync(join(root, name), 'utf8').split('\n'))
  .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?([^'"\s#]+)/))
  .filter((match) => match && !/_FUNCTION$/.test(match[1]) && match[2].length >= 8)
  .map((match) => match[2]);
const leaks = texts.filter(({ buffer }) => {
  const text = buffer.toString('utf8');
  return (
    /sb_secret_[A-Za-z0-9_-]{20,}|sb_publishable_[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|https:\/\/[a-z0-9]{20}\.supabase\.co/.test(text) ||
    [...text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g)].some(([token]) => ['service_role', 'anon'].includes(jwtRole(token))) ||
    envValues.some((value) => text.includes(value))
  );
});
check(leaks.length === 0, `no key, project URL or .env value in the ${texts.length} uploaded text files${leaks.length ? `: ${leaks.map(({ path }) => path).join(', ')}` : ''}`);

const photoDir = join(root, 'assets/photos');
const realPhotos = existsSync(photoDir) ? new Set(readdirSync(photoDir).filter((name) => /\.(jpe?g|png|heic|webp)$/i.test(name)).map((name) => md5(readFileSync(join(photoDir, name))))) : new Set();
const copies = upload.filter((path) => !isText(readFileSync(join(root, path))) && realPhotos.has(md5(readFileSync(join(root, path)))));
check(copies.length === 0, `none of the ${realPhotos.size} real photos is uploaded under any name`);

const denylist = loadDenylist();
if (denylist.missing) {
  console.log('WARN  no private denylist (scripts/private-denylist.local.txt): the upload’s name scan is skipped');
} else {
  const hits = texts.flatMap(({ path, buffer }) => findIn(buffer.toString('utf8'), denylist.entries).map((hit) => `entry ${hit.number} in ${path}:${hit.line}`));
  for (const hit of hits) console.log(`      ${hit}`);
  check(hits.length === 0, `no entry of the private denylist (${denylist.entries.length}) in any uploaded file`);
}

// ---- 4. No medical claims ----

// The app is a practice aid, not a medical device. Disclaimers that deny a claim are fine; everything
// else naming treatment, cure, diagnosis, prevention, therapy, clinical proof or better memory fails.
const CLAIM = /\b(cur(e|es|ed|ing)|diagnos\w*|therap\w*|clinical(ly)?|proven|treat(s|ed|ing|ment|ments)?|prevent(s|ed|ing|ion)?|heal(s|ing)?|brain[- ]training|improv\w*\s+(\w+\s+)?memor\w*|sharpen\w*|boost\w*)\b/i;
const DISCLAIMERS = ['It does not test for, treat or measure any health condition.'];
const claimsIn = (text) =>
  text
    .split('\n')
    .map((line, index) => ({ line: DISCLAIMERS.reduce((rest, sentence) => rest.split(sentence).join(' '), line), number: index + 1 }))
    .filter(({ line }) => CLAIM.test(line))
    .map(({ number }) => number);
// The app's own words: every string in src (comments removed; the policy's lawyer notes, `review:`,
// are never shown and are about exactly these questions).
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
const appClaims = walk(join(root, 'src'))
  .filter((path) => /\.tsx?$/.test(path) && !/deck\.local\.ts$/.test(path))
  .flatMap((path) => {
    const code = readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
      .replace(/^\s*review:.*$/gm, '');
    return claimsIn(code).map((line) => `${path.slice(root.length)}:${line}`);
  });
check(appClaims.length === 0, `no medical claim in the app’s words${appClaims.length ? `: ${appClaims.join(', ')}` : ''}`);
const listing = existsSync(join(root, 'docs/app-store-listing.md')) ? inRepo('docs/app-store-listing.md') : '';
const storeCopy = [...listing.matchAll(/<!-- store-copy -->([\s\S]*?)<!-- \/store-copy -->/g)].map((match) => match[1]);
check(storeCopy.length >= 5, `docs/app-store-listing.md marks its store copy (${storeCopy.length} blocks)`);
const storeClaims = storeCopy.flatMap((block) => claimsIn(block));
check(storeClaims.length === 0, `no medical claim in the store copy${storeClaims.length ? ` (${storeClaims.length} lines)` : ''}`);
const guide = existsSync(join(root, 'docs/TESTER-GUIDE.md')) ? inRepo('docs/TESTER-GUIDE.md') : '';
check(guide.length > 0 && claimsIn(guide).length === 0, `no medical claim in docs/TESTER-GUIDE.md${claimsIn(guide).length ? `: lines ${claimsIn(guide).join(', ')}` : ''}`);
check(claimsIn('It treats memory loss.').length === 1 && claimsIn('Clinically proven to improve your memory.').length === 1 && claimsIn(`${brand.APP_NAME} is a practice tool. ${DISCLAIMERS[0]}`).length === 0, 'the claims check itself catches a planted claim and lets the disclaimer through');

assert.equal(failures.length, 0, `${failures.length} store checks failed`);
console.log('All store checks passed');
