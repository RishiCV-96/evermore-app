// The privacy policy, the caregiver's agreements and the data inventory:
//   node scripts/check-privacy.mjs
// The policy's documents in step with its one source and a new version for new words; every table in
// supabase/schema.sql, every storage bucket and every key the app keeps on a phone named in
// docs/DATA-INVENTORY.md; no claim of compliance or certification and none of the banned words; the
// agreement rules (nothing ticked for the caregiver, no account without both, research off by default,
// a new version asks again); the person's step (one large sentence, the policy at the ordinary size with
// a 48pt target, no legal text, none of the agreement boxes); Settings' Privacy and data; and logs.
// The server's side is in supabase/tests/rls.test.mjs, the app against the stand-in in scripts/check-auth.mjs.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';

import { AGREEMENT_WORDS, HTML_PATH, LOCK_PATH, MD_PATH, consent, fingerprint, html, markdown, policy, reviewNotes } from './policy-source.mjs';

const root = new URL('../', import.meta.url);
const inRepo = (path) => readFileSync(new URL(path, root), 'utf8');
const walk = (dir) =>
  readdirSync(new URL(dir, root)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(new URL(path, root)).isDirectory() ? walk(path) : [path];
  });
const code = (path) => inRepo(path).replace(/\/\/.*|\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '');

let checks = 0;
const check = async (label, run) => {
  await run();
  checks += 1;
  console.log(`PASS  ${label}`);
};

// ---------------------------------------------------------------------------------------
// The policy and its documents
// ---------------------------------------------------------------------------------------

await check('the Markdown draft and the HTML page are written from the one source', () => {
  assert.equal(readFileSync(MD_PATH, 'utf8'), markdown(), 'docs/privacy-policy-draft.md is out of step: run node scripts/build-policy.mjs');
  assert.equal(readFileSync(HTML_PATH, 'utf8'), html(), 'docs/privacy-policy.html is out of step: run node scripts/build-policy.mjs');
});

await check('new words need a new version, so every caregiver is asked again', () => {
  const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  assert.ok(/^\d{4}-\d\d-\d\d$/.test(consent.POLICY_VERSION), 'the version is a date');
  assert.equal(lock[consent.POLICY_VERSION], fingerprint(), `the words changed under version ${consent.POLICY_VERSION}: set a new POLICY_VERSION, then run node scripts/build-policy.mjs`);
  assert.ok(Object.keys(lock).every((version) => version <= consent.POLICY_VERSION), 'the version in force is the newest recorded');
  assert.equal(policy.POLICY_VERSION, consent.POLICY_VERSION, 'one version for the policy and the agreements');
});

await check('every draft statement for the lawyer is marked, and the documents say they are drafts', () => {
  const md = readFileSync(MD_PATH, 'utf8');
  const notes = reviewNotes();
  assert.ok(notes.length >= 20, 'the review notes');
  assert.equal((md.match(/\*\*\[REVIEW \d+\]\*\*/g) ?? []).length, notes.length, 'each note marked where it applies');
  for (const [i] of notes.entries()) assert.ok(md.includes(`\n${i + 1}. **`), `note ${i + 1} listed at the end`);
  assert.ok(md.includes('Draft for review by a lawyer or privacy professional') && html().includes('Draft for review by a lawyer or privacy professional'), 'both say so at the top');
  assert.ok(/Draft for review by a lawyer or privacy professional/.test(inRepo('src/components/privacy-policy.tsx')) || /DRAFT_LINE/.test(inRepo('src/components/privacy-policy.tsx')), 'and so does the app');
  assert.ok(!/\[REVIEW/.test(html()) && !/review:/.test(code('src/components/privacy-policy.tsx')), 'the notes stay out of the hosted page and the app');
  for (const placeholder of [policy.CONTACT, policy.EFFECTIVE_DATE]) assert.ok(md.includes(placeholder) && html().includes(placeholder.replace(/&/g, '&amp;')), `a clear placeholder: ${placeholder}`);
});

await check('the policy covers every section asked for', () => {
  const ids = policy.POLICY.map((section) => section.id);
  for (const id of ['about', 'store', 'who', 'leaves', 'never', 'photos', 'ai', 'research', 'exports', 'reminders', 'delete', 'retention', 'security', 'changes', 'contact']) assert.ok(ids.includes(id), id);
  const text = policy.policyText();
  for (const fact of ['not a medical device', 'practice activity, not a medical measure', '120 days', 'not deleted when you delete your account', 'can technically reach', 'Anthropic may keep the data for a short time', 'no analytics, advertising or crash-reporting', 'off unless you turn it on']) {
    assert.ok(text.toLowerCase().includes(fact.toLowerCase()), fact);
  }
});

await check('no claim of compliance or certification, no promise of perfect security, and none of the banned words', () => {
  const said = [policy.policyText(), ...AGREEMENT_WORDS.map((one) => one.text), ...policy.WHAT_WE_STORE.flatMap((group) => [group.heading, ...group.points]), html()].join('\n');
  assert.ok(!/\b(HIPAA|GDPR|COPPA|CCPA|CPRA|PIPEDA|SOC ?2|ISO ?27001|compliant|complies|compliance|certified|certification|guarantee\w*|100% secure|completely secure)\b/i.test(said), 'never a law, a certification or a guarantee');
  assert.ok(!/\b(diagnos\w*|decline|progression|severity|accuracy|missed|failed|failure|wrong|disease)\b/i.test(said), 'none of the words the app never uses');
  assert.ok(/No system is perfectly secure/.test(said), 'honest about security');
});

await check('the hosted page is one file: no scripts, no tracking, nothing loaded from elsewhere', () => {
  const page = html();
  assert.ok(!/<script|<iframe|<img|<link|@import|url\(/i.test(page), 'nothing that runs or fetches');
  assert.ok(!/https?:\/\//i.test(page), 'no address anywhere in it');
  assert.ok(/<meta name="viewport"/.test(page) && /prefers-color-scheme: dark/.test(page) && /<title>Evermore privacy policy<\/title>/.test(page), 'readable on a phone, in both themes');
});

// ---------------------------------------------------------------------------------------
// The data inventory
// ---------------------------------------------------------------------------------------

await check('every table in the schema is named in docs/DATA-INVENTORY.md', () => {
  const schema = inRepo('supabase/schema.sql');
  const inventory = inRepo('docs/DATA-INVENTORY.md');
  const tables = [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map((match) => match[1]);
  assert.ok(tables.length >= 16 && tables.includes('consents'), 'the tables are found');
  const missing = tables.filter((table) => !inventory.includes(`\`${table}\``));
  assert.deepEqual(missing, [], `tables not in the data inventory: ${missing.join(', ')}. Describe them there and in the privacy policy`);
  const buckets = [...schema.matchAll(/insert into storage\.buckets \([^)]*\)\s*values \('(\w+)'/g)].map((match) => match[1]);
  assert.ok(buckets.length >= 1 && buckets.every((bucket) => inventory.includes(`\`${bucket}\``)), 'and every storage bucket');
  const functions = readdirSync(new URL('supabase/functions', root));
  assert.ok(functions.every((name) => inventory.includes(`\`${name}\``)), 'and every Edge Function');
});

await check('every key the app keeps on a phone is named in docs/DATA-INVENTORY.md', () => {
  const inventory = inRepo('docs/DATA-INVENTORY.md');
  const keys = new Set();
  for (const path of walk('src').filter((one) => /\.tsx?$/.test(one))) for (const match of inRepo(path).matchAll(/['`](evermore\.[A-Za-z]+(?:\.v\d+)?)/g)) keys.add(match[1]);
  assert.ok(keys.size >= 14, 'the keys are found');
  const missing = [...keys].filter((key) => !inventory.includes(key));
  assert.deepEqual(missing, [], `keys not in the data inventory: ${missing.join(', ')}`);
  assert.ok(inventory.includes('sb-<project>-auth-token'), 'and the session in secure storage');
});

await check('no third-party analytics, crash reporting, ads or push in the app', () => {
  const pkg = JSON.parse(inRepo('package.json'));
  const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
  assert.ok(!/sentry|bugsnag|crashlytics|firebase|amplitude|mixpanel|segment|analytics|appsflyer|adjust|branch|onesignal|expo-updates|expo-tracking/i.test(all), 'none installed');
  assert.ok(!walk('src').some((path) => /getExpoPushTokenAsync|getDevicePushTokenAsync/.test(inRepo(path))), 'no push token is ever asked for');
  assert.equal(JSON.parse(inRepo('app.json')).expo.plugins.find((one) => Array.isArray(one) && one[0] === 'expo-notifications')[1].enableRemoteNotifications, false, 'remote notifications off');
});

// ---------------------------------------------------------------------------------------
// The agreements
// ---------------------------------------------------------------------------------------

const { consentState, signUpData, agreementProblems, agreementRows, researchRow, fromRow, POLICY_VERSION, LEGACY_VERSION } = consent;
const at = (minute) => `2026-11-13T10:${String(minute).padStart(2, '0')}:00Z`;
const record = (kind, version, choice, minute) => ({ kind, version, choice, at: at(minute) });

await check('no account without both agreements: nothing is sent, and the database refuses it too', () => {
  assert.equal(signUpData({ policy: false, responsibility: false, research: false }), null, 'neither');
  assert.equal(signUpData({ policy: true, responsibility: false, research: true }), null, 'the policy alone');
  assert.equal(signUpData({ policy: false, responsibility: true, research: false }), null, 'the responsibility alone');
  assert.equal(signUpData({ policy: 'yes', responsibility: 1, research: false }), null, 'only true counts');
  const data = signUpData({ policy: true, responsibility: true, research: false }, new Date('2026-11-13T10:00:00Z'));
  assert.deepEqual(data, { consented_at: '2026-11-13T10:00:00.000Z', policy_version: POLICY_VERSION, agreed_policy: true, agreed_responsibility: true, research: false });
  assert.equal(signUpData({ policy: true, responsibility: true })?.research, false, 'research is off unless chosen');
  assert.deepEqual(agreementProblems({ policy: false, responsibility: false }), { policy: consent.NEED_POLICY, responsibility: consent.NEED_RESPONSIBILITY });
  const account = inRepo('src/data/account.ts');
  assert.ok(/const agreed = signUpData\(agreement\);\n  if \(!agreed\) return/.test(account) && /options: \{ data: agreed \}/.test(account), 'signUpCaregiver sends nothing without both');
  const schema = inRepo('supabase/schema.sql');
  assert.ok(/->> 'agreed_policy', ''\) <> 'true'\s+or coalesce\(new\.raw_user_meta_data ->> 'agreed_responsibility', ''\) <> 'true'[\s\S]{0,200}raise exception/.test(schema), 'the sign-up trigger refuses an account without both');
  assert.ok(/coalesce\(new\.raw_user_meta_data ->> 'research', ''\) = 'true'/.test(schema), 'and records research as off unless it was chosen');
});

await check('nothing is ticked for the caregiver', () => {
  const signUp = inRepo('src/components/sign-in/caregiver-sign-up.tsx');
  assert.ok(/useState<Agreement>\(\{ policy: false, responsibility: false, research: false \}\)/.test(signUp), 'sign-up starts with every box empty');
  assert.ok(/<AgreementBoxes[\s\S]*withResearch/.test(signUp) && /signUpCaregiver\(email, password, agreement\)/.test(signUp), 'with the research choice, and the agreement goes with the sign-up');
  const boxes = inRepo('src/components/consent.tsx');
  for (const id of ['agree-policy', 'agree-responsibility', 'agree-research']) assert.ok(boxes.includes(`<Checkbox testID="${id}"`), `${id} is a box the caregiver ticks`);
  assert.ok(/useState<Agreement>\(\{ policy: false, responsibility: false, research: false \}\)/.test(boxes), 'asking again starts empty too');
  assert.ok(boxes.includes('label="Read the privacy policy"') && /<SIGN_UP_SUMMARY|SIGN_UP_SUMMARY\.map/.test(boxes), 'the short summary and a link to the whole policy');
});

await check('the agreement in force: versioned, per caregiver, and asked again for a new version', () => {
  assert.deepEqual(consentState([]), { agreed: false, research: false, researchAt: undefined, lastVersion: undefined }, 'nothing recorded: ask, and research off');
  assert.equal(consentState([record('responsibility', LEGACY_VERSION, true, 1)]).agreed, false, 'a caregiver from before versions is asked');
  const now = [record('policy', POLICY_VERSION, true, 1), record('responsibility', POLICY_VERSION, true, 1), record('research', POLICY_VERSION, false, 1)];
  assert.deepEqual(consentState(now), { agreed: true, research: false, researchAt: at(1), lastVersion: POLICY_VERSION }, 'both for this version');
  assert.equal(consentState(now.slice(0, 1)).agreed, false, 'the policy alone is not enough');
  assert.equal(consentState(now, '2027-01-01').agreed, false, 'a new version asks again');
  assert.equal(consentState([...now, record('policy', '2027-01-01', true, 5), record('responsibility', '2027-01-01', true, 5)], '2027-01-01').agreed, true, 'and agreeing to it is enough');
  const changes = [...now, record('research', POLICY_VERSION, true, 3), record('research', POLICY_VERSION, false, 4), record('research', POLICY_VERSION, true, 2)];
  assert.deepEqual([consentState(changes).research, consentState(changes).researchAt], [false, at(4)], 'the newest research choice is the one in force, in time order');
  assert.deepEqual(agreementRows('c1'), [
    { caregiver_id: 'c1', kind: 'policy', policy_version: POLICY_VERSION, choice: true },
    { caregiver_id: 'c1', kind: 'responsibility', policy_version: POLICY_VERSION, choice: true },
  ], 'agreeing adds two records, with no time (the server sets it)');
  assert.deepEqual(researchRow('c1', true), { caregiver_id: 'c1', kind: 'research', policy_version: POLICY_VERSION, choice: true }, 'a change is a new record');
  assert.equal(fromRow({ kind: 'marketing', policy_version: POLICY_VERSION, choice: true, agreed_at: at(1) }), null, 'an unknown kind is ignored');
});

await check('asking again: over every caregiver screen, no Close, nothing lost, never offline', () => {
  const layout = inRepo('src/app/caregiver/_layout.tsx');
  assert.ok(/\{LOCAL_ONLY \? null : <PolicyGate \/>\}/.test(layout), 'the gate sits over the caregiver group');
  const gate = inRepo('src/components/consent.tsx');
  assert.ok(/<Sheet visible=\{status === 'needed'\} title=/.test(gate) && !/<Sheet visible=\{status === 'needed'\}[^>]*onClose/.test(gate), 'no Close: agree or sign out');
  assert.ok(/Agree and continue/.test(gate) && /gate-sign-out/.test(gate), 'the two ways on');
  assert.ok(/stay saved in your account/.test(gate), 'signing out from it deletes nothing');
  const sheet = inRepo('src/components/sheet.tsx');
  assert.ok(/onRequestClose=\{onClose \?\? \(\(\) => \{\}\)\}/.test(sheet) && !/allowSwipeDismissal/.test(sheet), 'Android back and an iOS swipe can’t close it');
  const store = inRepo('src/data/consent-store.ts');
  assert.ok(/if \(!records\.length\) publish\(\{ status: 'unknown'/.test(store) && !/AsyncStorage|SecureStore/.test(store), 'offline, nobody is asked; nothing about agreements is kept on the phone');
  assert.ok(/forgetConsent/.test(inRepo('src/data/forget.ts')), 'and sign-out forgets what was read');
});

await check('the person’s phone: one large sentence, the policy at the ordinary size, no legal wall', () => {
  // Their first step is Hello (the User ID and password), since PIN pairing went on 2026-11-16.
  const person = inRepo('src/components/sign-in/person-sign-in.tsx');
  assert.equal(consent.SET_UP_FOR_YOU, 'Your caregiver set this up for you.');
  assert.ok(/<AppText testID="set-up-for-you" bold>\s*\{SET_UP_FOR_YOU\}/.test(person), 'the sentence at the person’s own body size (no smaller size), bold');
  assert.ok(/<PolicyLink testID="person-policy"/.test(person) && /<PolicySheet visible=\{policy\}/.test(person), 'a link to the policy, opening in a sheet');
  const link = inRepo('src/components/privacy-policy.tsx');
  assert.ok(/export function PolicyLink[\s\S]*<CompactType value=\{true\}>[\s\S]*Privacy policy/.test(link) && /link: \{\s*minHeight: TAP,\s*minWidth: TAP/.test(link), 'at the ordinary reading size, with a 48pt target');
  assert.ok(!/Colors\.(pink|accent)|red/i.test(code('src/components/privacy-policy.tsx')), 'no red, in the neutral palette');
  for (const path of ['src/components/sign-in/person-sign-in.tsx', 'src/app/index.tsx', 'src/app/practice.tsx', 'src/components/practice-screen.tsx']) {
    const text = inRepo(path);
    assert.ok(!/from '@\/components\/consent'|consent-store|AGREE_|RESEARCH_|SIGN_UP_SUMMARY/.test(text), `${path}: no agreements, boxes or research choice`);
  }
  assert.equal((person.match(/SET_UP_FOR_YOU/g) ?? []).length, 2, 'one sentence, once (and its import)');
});

await check('Settings: Privacy and data, compact and calm; Delete account last and apart', () => {
  const page = inRepo('src/components/settings-page.tsx');
  const section = page.slice(page.indexOf('title="Privacy and data"'), page.indexOf('title="About"'));
  for (const mark of ['testID="privacy-policy" label="Privacy policy"', 'testID="what-we-store" label="What the app stores"', '<ResearchSetting />', '<AiConsentSetting', '<ExportSetting />']) assert.ok(section.includes(mark), mark);
  assert.ok(page.indexOf('title="About"') < page.indexOf('<DeleteAccountSetting'), 'Delete account stays last, apart');
  assert.ok(/LOCAL_ONLY \? null : <ResearchSetting \/>/.test(page), 'the research choice with an account only');
  const gate = inRepo('src/components/consent.tsx');
  assert.ok(/Optional\. You can change this at any time\./.test(gate) && /if \(\(next === 'on'\) === research\) return;/.test(gate), 'the research choice says it can change, and records only a change');
  assert.ok(/AI questions agreement/.test(gate) && /withdrawAiConsent\(\)/.test(gate), 'AI’s agreement can be taken back where AI is available');
  assert.ok(/aiConsentAt: undefined/.test(inRepo('src/data/local-store.ts')), 'which clears it, so Generate asks again');
});

await check('logs: only the kind of a failure', () => {
  for (const path of ['src/data/consent-store.ts', 'src/components/consent.tsx', 'src/components/privacy-policy.tsx', 'src/lib/consent.ts', 'src/lib/privacy-policy.ts']) {
    assert.ok(!/console\./.test(code(path)), `${path}: no console`);
  }
  const store = code('src/data/consent-store.ts');
  assert.deepEqual([...store.matchAll(/warnKind\(([^,]+),/g)].map((match) => match[1]), ["'Could not read agreements'", "'Could not save an agreement'"], 'a fixed phrase and the error’s kind');
});

await check('the rules are written down: CLAUDE.md and HANDOFF.md', () => {
  const rules = inRepo('CLAUDE.md');
  assert.ok(/No data is collected before agreement/.test(rules) && /research choice is optional and off/i.test(rules), 'the consent rule');
  assert.ok(/docs\/DATA-INVENTORY\.md/.test(rules) && /must be updated whenever data handling changes/.test(rules), 'and keeping the policy and inventory in step');
  assert.ok(/node scripts\/check-privacy\.mjs/.test(rules), 'and this check is listed');
  assert.ok(/^# (Handoff|The release before): consent, the privacy policy/m.test(inRepo('HANDOFF.md')), 'the handoff records this release');
});

console.log(`\n${checks} checks passed`);
