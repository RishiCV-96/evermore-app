// Sign-in, from the welcome screen to signing out, with the real supabase-js client talking to an
// in-memory stand-in for Supabase (scripts/fakes/supabase-server.mjs) through `fetch`:
//   node scripts/check-auth.mjs
// The switch (sign-in on by default, local-only with EXPO_PUBLIC_LOCAL_ONLY=1), the welcome steps,
// and, as they are built, each form's checks, the confirm-email and no-confirm paths, keeping the
// session in secure storage and restoring it, signing out and what it clears, the person's sign-in
// with the login the caregiver makes, and that no password is ever logged or kept.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const inRepo = (path) => readFileSync(new URL(path, root), 'utf8');

// The app's modules load fresh for each "launch" of the app (a ?life= on every file under src/), while
// the phone's disks (the fakes) and the server (the stand-in) stay as they were, so a launch after a
// sign-in is the app opened again. The native modules are stand-ins (scripts/fakes/).
const src = fileURLToPath(new URL('../src/', import.meta.url));
const fake = (file) => new URL(`./fakes/${file}`, import.meta.url).href;
const FAKES = {
  '@react-native-async-storage/async-storage': fake('storage.mjs'),
  'expo-secure-store': fake('secure-store.mjs'),
  'expo-image': fake('image.mjs'),
  '@/lib/photo-files': fake('native.mjs'),
  '@/components/person-photo': pathToFileURL(`${src}lib/photo-fields.ts`).href,
  '@react-native-community/netinfo': fake('netinfo.mjs'),
  'expo-crypto': fake('native.mjs'),
  'expo-device': fake('device.mjs'),
  'expo-notifications': fake('notifications.mjs'),
  '@/lib/save-file': fake('save-file.mjs'),
  'react-native': fake('react-native.mjs'),
};
let life = 0;
const lifeOf = (parentURL) => (parentURL?.includes('?life=') ? new URL(parentURL).searchParams.get('life') : String(life));
const withLife = (file, parentURL) => `${pathToFileURL(file).href}?life=${lifeOf(parentURL)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (FAKES[specifier]) return next(FAKES[specifier], context);
    // The stores a check reads outside React get useSyncExternalStore without a component.
    if (specifier === 'react' && /\/src\/data\/(family-store|pairing|consent-store)\.ts/.test(context.parentURL ?? '')) return next(fake('react-store.mjs'), context);
    if (specifier.startsWith('@/')) {
      const file = [`${src}${specifier.slice(2)}.ts`, `${src}${specifier.slice(2)}.tsx`].find((one) => existsSync(one));
      if (file) return next(withLife(file, context.parentURL), context);
    }
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
      const file = fileURLToPath(new URL(`${specifier}.ts`, context.parentURL));
      if (existsSync(file)) return next(withLife(file, context.parentURL), context);
    }
    return next(specifier, context);
  },
});

const { createStandin } = await import(fake('supabase-server.mjs'));
const { disk } = await import(fake('storage.mjs'));
const { appState } = await import(fake('react-native.mjs'));
const { vault, secure } = await import(fake('secure-store.mjs'));
const { cleared } = await import(fake('image.mjs'));
const { notifications } = await import(fake('notifications.mjs'));
const { folder: exportFolder } = await import(fake('save-file.mjs'));

/** A new project on the stand-in, which every launch after it talks to through fetch. */
let standin;
function newProject(settings = {}) {
  standin = createStandin();
  Object.assign(standin.settings, settings);
  globalThis.fetch = (input, init) => standin.fetch(input, init);
  return standin;
}
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://standin.test';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';

/** What the console says, so no password can be in it. */
const said = [];
for (const level of ['log', 'warn', 'error', 'info', 'debug']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    said.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg) ?? String(arg))).join(' '));
    if (level === 'log') original(...args);
  };
}

const settle = async (rounds = 40) => {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
};
const module = (path) => import(withLife(`${src}${path}`));

/** The app, opened: its account store listening, as the root layout does. Resolves once it knows who is signed in. */
async function launch() {
  life += 1;
  appState.reset();
  const account = await module('data/account.ts');
  // What the app clears on sign-out registers itself, as src/data/app-data.ts imports it.
  await module('data/forget.ts');
  // Every state the app passes through, from the first, so a check can see how it opened even if
  // a later answer from the server has already moved it on.
  const states = [account.accountNow()];
  account.watchAccount(() => states.push(account.accountNow()));
  await until(() => account.accountNow().status !== 'loading', 'the app knows who is signed in');
  return { account, states, now: () => account.accountNow() };
}

async function until(condition, what, rounds = 400) {
  for (let i = 0; i < rounds; i++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail(`timed out waiting until ${what}`);
}

let checks = 0;
const check = async (label, run) => {
  await run();
  checks += 1;
  console.log(`PASS  ${label}`);
};

// ---------------------------------------------------------------------------------------
// 1. The switch: sign-in on by default, local-only on request, inlined as Expo bundles it
// ---------------------------------------------------------------------------------------

await check('sign-in is on unless EXPO_PUBLIC_LOCAL_ONLY is 1, in the bundle as in Node', () => {
  const babel = require('@babel/core');
  const file = new URL('src/config/features.ts', root).pathname;
  const source = inRepo('src/config/features.ts');
  assert.ok(/export const AUTH_ENABLED = process\.env\.EXPO_PUBLIC_LOCAL_ONLY !== '1';/.test(source), 'read literally, so Expo can inline it');
  const flags = (value) => {
    if (value === undefined) delete process.env.EXPO_PUBLIC_LOCAL_ONLY;
    else process.env.EXPO_PUBLIC_LOCAL_ONLY = value;
    // A release bundle, as Metro transforms it: the value is inlined.
    const { code } = babel.transformSync(source, {
      filename: file,
      babelrc: false,
      configFile: false,
      presets: [require.resolve('babel-preset-expo')],
      caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, engine: 'hermes' },
    });
    assert.ok(!/process\.env|virtual\/env/.test(code), 'nothing left to read at run time');
    const exports = {};
    new Function('exports', code)(exports);
    delete process.env.EXPO_PUBLIC_LOCAL_ONLY;
    return exports;
  };
  // AI questions are off by default (CLAUDE.md, the first hard rule): turning them on is a deliberate edit of the constant.
  assert.deepEqual(flags(undefined), { AUTH_ENABLED: true, AI_VARIANTS_ENABLED: false, AI_AVAILABLE: false }, 'sign-in on and AI off by default');
  assert.equal(flags('1').AUTH_ENABLED, false, 'local-only with EXPO_PUBLIC_LOCAL_ONLY=1');
  assert.equal(flags('1').AI_AVAILABLE, false, 'and AI questions stay off there too until the constant is turned on');
  assert.equal(flags('0').AUTH_ENABLED, true, 'any other value keeps sign-in on');
  assert.equal(flags('true').AUTH_ENABLED, true, 'only exactly 1 turns it off');
  const scripts = JSON.parse(inRepo('package.json')).scripts;
  assert.equal(scripts['start:local'], 'EXPO_PUBLIC_LOCAL_ONLY=1 expo start --clear', 'npm run start:local, with a clean cache');
  assert.ok(!/EXPO_PUBLIC_LOCAL_ONLY/.test(inRepo('.env.example')), 'the example .env leaves sign-in on');
});

await check('the welcome: two ways in, each step with a way back', () => {
  const welcome = inRepo('src/components/sign-in/welcome.tsx');
  const screen = inRepo('src/app/sign-in.tsx');
  assert.ok(welcome.includes('label="I am practicing"') && welcome.includes('label="I am a caregiver"'), 'the two paths, in plain words');
  assert.ok(welcome.includes('label="Sign in"') && welcome.includes('label="Create an account"'), 'the caregiver then signs in or makes an account');
  assert.ok(/backLabel="Back"\s+onBack=\{onBack\}/.test(welcome), 'with a plain Back');
  assert.ok(screen.includes("BackHandler.addEventListener('hardwareBackPress'"), "and Android's back button goes back a step, not out of the app");
  assert.ok(/<CompactType value=\{true\}>/.test(welcome), 'past the welcome, the caregiver gets the compact scale');
});

// ---------------------------------------------------------------------------------------
// 2. Caregiver sign-up: the form's notes, both ways Supabase can answer, and its limits
// ---------------------------------------------------------------------------------------

const form = await import(withLife(`${src}lib/auth-form.ts`));
const PASSWORD = 'tomatoes every summer';
const OTHER_PASSWORD = 'banana bread on Sundays';
/** Both agreements ticked, research left off: what Create an account sends once the boxes are ticked. */
const AGREED = { policy: true, responsibility: true, research: false };

await check('the sign-up form: each field’s note, in calm words', () => {
  const ok = { email: 'pat@family.test', password: PASSWORD, confirm: PASSWORD, ...AGREED };
  assert.deepEqual(form.signUpProblems(ok), {}, 'a complete form has nothing to fix');
  assert.ok(form.isClear(form.signUpProblems(ok)));
  const notes = (changes) => form.signUpProblems({ ...ok, ...changes });
  assert.equal(notes({ email: '' }).email, 'Please type your email address.');
  for (const email of ['pat', 'pat@', 'pat@family', '@family.test', 'pat family@x.test', 'pat@family.t', 'pat@@family.test']) {
    assert.equal(notes({ email }).email, 'Please check the email address. It looks like name@example.com.', `${email} isn't an address`);
  }
  for (const email of ['pat@family.test', ' Pat.Smith+evermore@Mail.Example.co.uk ', 'a@b.io']) assert.equal(notes({ email }).email, undefined, `${email} is an address`);
  assert.equal(notes({ password: '', confirm: '' }).password, 'Please choose a password.');
  assert.equal(notes({ password: 'short7!', confirm: 'short7!' }).password, 'Please use at least 8 characters.', 'at least 8');
  assert.equal(notes({ password: '8 chars!', confirm: '8 chars!' }).password, undefined, 'exactly 8 is enough');
  assert.equal(notes({ confirm: '' }).confirm, 'Please type the password again.');
  assert.equal(notes({ confirm: `${PASSWORD} ` }).confirm, 'The two passwords aren’t the same yet. Please type them again.', 'mismatched, even by a space');
  assert.equal(notes({ policy: false }).policy, 'Please agree to the privacy policy to create an account.');
  assert.equal(notes({ responsibility: false }).responsibility, 'Please confirm this to create an account.');
  assert.deepEqual(notes({ research: false }), {}, 'research is optional');
  assert.deepEqual(Object.keys(notes({ email: 'x', password: '1', confirm: '2', policy: false, responsibility: false })).sort(), ['confirm', 'email', 'password', 'policy', 'responsibility'], 'every field at once');
});

await check('the strength hint: calm, about length, and never a reason to refuse a long password', () => {
  const levels = ['', 'abc', 'seven77', 'garden22', 'gardenwalks', 'gardenwalks4', 'garden walks daily', 'tomatoes every summer'].map((one) => form.passwordStrength(one).level);
  assert.deepEqual(levels, [0, 0, 0, 1, 1, 2, 3, 3], 'it grows with length');
  for (const easy of ['password', 'Password1', '12345678', 'aaaaaaaa', 'abcdefghij', 'evermore', 'qwerty123']) assert.equal(form.passwordStrength(easy).level, 1, `${easy} is easy to guess`);
  assert.equal(form.passwordStrength('patsmith2026', 'patsmith@family.test').level, 1, 'the email’s name in it is easy to guess');
  assert.match(form.passwordStrength('').words, /^At least 8 characters\./);
  assert.equal(form.passwordStrength(PASSWORD).words, 'Strong.');
  const component = inRepo('src/components/password-field.tsx');
  assert.ok(component.includes('Colors.primary') && component.includes('Colors.skySoft') && !/pink|accent|#[0-9a-f]{6}/i.test(component), 'blue fills in on a sky track: no red, no pink, no new color');
});

await check('every message is calm: no "wrong", "error", "invalid" or "failed", and none says whether an account exists', () => {
  const failures = [
    { name: 'AuthRetryableFetchError', status: 0 },
    { status: 502 },
    { status: 429, code: 'over_request_rate_limit' },
    { status: 429, code: 'over_email_send_rate_limit' },
    { status: 400, code: 'invalid_credentials' },
    { status: 400, code: 'email_not_confirmed' },
    { status: 422, code: 'user_already_exists' },
    { status: 422, code: 'email_exists' },
    { status: 422, code: 'weak_password' },
    { status: 422, code: 'same_password' },
    { status: 400, code: 'email_address_invalid' },
    { status: 400, code: 'email_address_not_authorized' },
    { status: 422, code: 'signup_disabled' },
    { status: 403, code: 'otp_expired' },
    { status: 401, code: 'reauthentication_needed' },
    { status: 400, code: 'something_new' },
  ];
  const contexts = ['sign-in', 'person', 'sign-up', 'email', 'code', 'new-password', 'current-password'];
  const constants = Object.entries(form).filter(([, value]) => typeof value === 'string').map(([, value]) => value);
  for (const failure of failures) {
    for (const context of contexts) {
      const { message, reason } = form.authProblem(failure, context);
      assert.ok(message && reason, `${failure.code} in ${context} has words`);
      assert.ok(!/\b(wrong|error|invalid|incorrect|fail(ed|ure)?|denied)\b/i.test(message), `"${message}" is calm`);
      assert.ok(!/already registered|no account|not found|doesn’t exist|does not exist/i.test(message), `"${message}" doesn't say whether an account exists`);
    }
  }
  for (const text of constants) assert.ok(!/\b(wrong|error|invalid|fail(ed|ure)?)\b/i.test(text), `"${text}" is calm`);
  assert.equal(form.authProblem({ name: 'AuthRetryableFetchError', status: 0 }, 'sign-in').reason, 'offline', 'no connection');
  assert.equal(form.authProblem({ status: 503 }, 'sign-up').reason, 'offline', 'a server that can’t answer reads the same, with retry');
  assert.equal(form.authProblem({ status: 429, code: 'over_request_rate_limit' }, 'sign-in').message, form.TOO_MANY, '"too many attempts", calmly');
  assert.equal(form.authProblem({ status: 429, code: 'over_email_send_rate_limit' }, 'sign-up').message, form.TOO_MANY_EMAILS);
  assert.equal(form.authProblem({ status: 422, code: 'user_already_exists' }, 'sign-up').message, form.ALREADY_THERE);
  assert.equal(form.authProblem({ status: 400, code: 'invalid_credentials' }, 'person').message, 'That did not work. Please check the ID and password, or ask your caregiver.');
});

await check('"Send again" waits a minute, counting down on the caregiver’s screen', () => {
  assert.equal(form.RESEND_SECONDS, 60, 'Supabase allows one email a minute to an address');
  assert.equal(form.secondsLeft(undefined, 5000), 0, 'nothing sent here yet: send at once');
  assert.equal(form.secondsLeft(1000, 1000), 60);
  assert.equal(form.secondsLeft(1000, 1000 + 18_200), 42);
  assert.equal(form.secondsLeft(1000, 61_000), 0);
  assert.equal(form.resendLabel(42), 'Send again in 42 s');
  assert.equal(form.resendLabel(0), 'Send the email again');
});

await check('Confirm email off: a new account is signed in at once, with consent and the sample family', async () => {
  disk.clear();
  newProject({ autoconfirm: true });
  vault.clear();
  const app = await launch();
  assert.equal(app.now().status, 'signed-out', 'a fresh phone opens on the welcome');
  const result = await app.account.signUpCaregiver(' pat@caregiver.test ', PASSWORD, AGREED);
  assert.deepEqual(result, { ok: true, checkEmail: false }, 'nothing to confirm');
  await until(() => app.now().status === 'signed-in', 'signed in');
  assert.equal(app.now().profile.role, 'caregiver', 'straight to the caregiver home');
  assert.equal(app.now().email, 'pat@caregiver.test');
  const user = standin.users.find((one) => one.email === 'pat@caregiver.test');
  assert.ok(Date.parse(user.user_metadata.consented_at) > Date.now() - 60_000, 'with the consent the database requires');
  assert.deepEqual([user.user_metadata.policy_version, user.user_metadata.agreed_policy, user.user_metadata.agreed_responsibility, user.user_metadata.research], ['2026-11-13', true, true, false], 'both agreements, at the policy’s version, research off');
  assert.deepEqual(standin.tables.consents.filter((one) => one.caregiver_id === user.id).map((one) => [one.kind, one.policy_version, one.choice]), [['policy', '2026-11-13', true], ['responsibility', '2026-11-13', true], ['research', '2026-11-13', false]], 'recorded as three versioned records');
  assert.equal(standin.tables.people.filter((one) => one.caregiver_id === user.id).length, 5, 'and the 5 sample people');
  assert.equal(standin.emails.length, 0, 'no email was sent');
});

await check('Confirm email on: "Check your email", resend with its wait, then the link, then Continue', async () => {
  disk.clear();
  newProject({ autoconfirm: false });
  const app = await launch();
  const result = await app.account.signUpCaregiver('sam@caregiver.test', PASSWORD, AGREED);
  assert.deepEqual(result, { ok: true, checkEmail: true }, 'Supabase sent an email: check your email');
  await settle();
  assert.equal(app.now().status, 'signed-out', 'nobody is signed in yet');
  assert.equal(standin.emails.filter((one) => one.to === 'sam@caregiver.test').length, 1, 'one email went out');
  const early = await app.account.signIn('caregiver', 'sam@caregiver.test', PASSWORD);
  assert.deepEqual([early.ok, early.reason], [false, 'unconfirmed'], 'Continue before the link: not confirmed yet');
  const soon = await app.account.resendConfirmation('sam@caregiver.test');
  assert.deepEqual([soon.ok, soon.reason, soon.message], [false, 'busy', form.TOO_MANY_EMAILS], 'Supabase’s minute between emails, in calm words');
  standin.expireAccessTokens(61);
  assert.deepEqual(await app.account.resendConfirmation('sam@caregiver.test'), { ok: true }, 'a minute later it sends again');
  assert.equal(standin.emails.filter((one) => one.to === 'sam@caregiver.test').length, 2);
  assert.ok(standin.confirmByLink('sam@caregiver.test'), 'the link, opened in a browser');
  assert.deepEqual(await app.account.signIn('caregiver', 'sam@caregiver.test', PASSWORD), { ok: true }, 'back in the app, Continue signs in');
  await until(() => app.now().status === 'signed-in' && app.now().profile.role === 'caregiver', 'the caregiver home');
  const screen = inRepo('src/components/sign-in/caregiver-sign-up.tsx');
  assert.ok(/AppState\.addEventListener\('change'/.test(screen) && /state !== 'active'/.test(screen), 'coming back to the app tries signing in by itself');
});

await check('Confirm email on, with the code from the email instead of the link', async () => {
  disk.clear();
  newProject({ autoconfirm: false });
  const app = await launch();
  await app.account.signUpCaregiver('lee@caregiver.test', PASSWORD, AGREED);
  const sent = standin.emails.find((one) => one.to === 'lee@caregiver.test');
  const miss = await app.account.confirmEmail('lee@caregiver.test', sent.code === '123456' ? '654321' : '123456');
  assert.deepEqual([miss.ok, miss.reason, miss.message], [false, 'code', form.CODE_NOT_MATCHED]);
  assert.deepEqual(await app.account.confirmEmail('lee@caregiver.test', ` ${sent.code} `), { ok: true }, 'the right code signs in');
  await until(() => app.now().status === 'signed-in', 'signed in by the code');
});

await check('an address that already has an account: neutral words with Confirm email off, nothing said with it on', async () => {
  disk.clear();
  newProject({ autoconfirm: true });
  let app = await launch();
  await app.account.signUpCaregiver('kim@caregiver.test', PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await app.account.signOut();
  await until(() => app.now().status === 'signed-out', 'signed out');
  const again = await app.account.signUpCaregiver('kim@caregiver.test', OTHER_PASSWORD, AGREED);
  assert.deepEqual([again.ok, again.reason, again.message], [false, 'exists', form.ALREADY_THERE], 'Confirm email off: Supabase says so, and the words stay neutral');
  standin.settings.autoconfirm = false;
  app = await launch();
  const quiet = await app.account.signUpCaregiver('kim@caregiver.test', OTHER_PASSWORD, AGREED);
  assert.deepEqual(quiet, { ok: true, checkEmail: true }, 'Confirm email on: the same "check your email" as a new address');
  assert.equal(standin.emails.length, 0, 'and nothing is sent');
  assert.deepEqual(await app.account.signIn('caregiver', 'kim@caregiver.test', PASSWORD), { ok: true }, 'the account is untouched: its own password still works');
  assert.deepEqual((await app.account.signIn('caregiver', 'kim@caregiver.test', OTHER_PASSWORD)).reason, 'credentials', 'and the new one doesn’t');
});

await check('sign-up when Supabase says no: offline, its own password rules, an address it won’t mail, too many emails', async () => {
  disk.clear();
  newProject({ autoconfirm: false });
  const app = await launch();
  standin.settings.offline = true;
  const offline = await app.account.signUpCaregiver('ana@caregiver.test', PASSWORD, AGREED);
  assert.deepEqual([offline.ok, offline.reason, offline.message], [false, 'offline', form.OFFLINE], 'no connection: check it and try again');
  standin.settings.offline = false;
  standin.settings.minPassword = 30;
  const weak = await app.account.signUpCaregiver('ana@caregiver.test', PASSWORD, AGREED);
  assert.deepEqual([weak.ok, weak.reason], [false, 'weak'], 'a project that asks for longer passwords');
  standin.settings.minPassword = 6;
  const address = await app.account.signUpCaregiver('ana@example.com', PASSWORD, AGREED);
  assert.deepEqual([address.ok, address.reason], [false, 'address'], 'an address Supabase won’t send to');
  assert.deepEqual(await app.account.signUpCaregiver('ana@caregiver.test', PASSWORD, AGREED), { ok: true, checkEmail: true }, 'then it works');
});

await check('the sign-up screen: email, password and confirmation with Show, the strength hint, the agreements and the policy', () => {
  const screen = inRepo('src/components/sign-in/caregiver-sign-up.tsx');
  const field = inRepo('src/components/password-field.tsx');
  for (const label of ['label="Email"', 'label="Password"', 'label="Confirm password"']) assert.ok(screen.includes(label), label);
  assert.equal(screen.match(/<PasswordField/g).length, 2, 'both password boxes can be shown or hidden');
  assert.ok(/useState\(false\)/.test(field) && /secureTextEntry=\{!shown\}/.test(field), 'hidden until Show is tapped');
  assert.ok(/strength=\{\{ email \}\}/.test(screen), 'the strength hint under the new password');
  assert.ok(/<AgreementBoxes[\s\S]*withResearch/.test(screen), 'the summary, the two agreements the database requires, and the optional research choice (scripts/check-privacy.mjs)');
  assert.ok(/<PolicySheet visible=\{privacy\}/.test(screen), 'the whole policy opens as a sheet, not a screen');
  assert.ok(/tried \|\| touched\[field\]/.test(screen), 'notes appear once a field is left, or after Create account');
  assert.ok(!/Colors\.(pink|accent)/.test(screen), 'in the neutral palette');
});

// ---------------------------------------------------------------------------------------
// 3. Caregiver sign-in: calm answers, the session in secure storage, restored on relaunch (offline
// too), and signing out, which clears what the phone kept from the server
// ---------------------------------------------------------------------------------------

const SESSION = 'sb-standin-auth-token';
const sessionInVault = () => {
  const count = Number(vault.get(`${SESSION}.n`)?.value ?? 0);
  return count ? Array.from({ length: count }, (_, index) => vault.get(`${SESSION}.${index}`).value).join('') : null;
};
/** Signs in, then leaves the kept access token expired, as after an hour away from the app. */
async function signInExpired(app, email = 'pat@caregiver.test', password = PASSWORD, role = 'caregiver') {
  assert.deepEqual(await app.account.signIn(role, email, password), { ok: true });
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const session = JSON.parse(sessionInVault());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const { chunksOf } = await module('lib/session-storage.ts');
  const chunks = chunksOf(JSON.stringify(session));
  for (const key of [...vault.keys()]) if (key.startsWith(SESSION)) vault.delete(key);
  chunks.forEach((chunk, index) => vault.set(`${SESSION}.${index}`, { value: chunk, options: {} }));
  vault.set(`${SESSION}.n`, { value: String(chunks.length), options: {} });
}

/** A fresh phone and project with one confirmed caregiver, signed out. */
async function caregiverAccount(email = 'pat@caregiver.test') {
  disk.clear();
  vault.clear();
  newProject({ autoconfirm: true });
  const app = await launch();
  await app.account.signUpCaregiver(email, PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in', 'signed up');
  await app.account.signOut();
  standin.log.length = 0;
  return app;
}

await check('the session is stored in pieces small enough for any phone’s secure storage', async () => {
  const store = await module('lib/session-storage.ts');
  assert.equal(store.CHUNK_BYTES, 1800);
  for (const value of ['', 'a', 'x'.repeat(1800), 'x'.repeat(1801), 'é'.repeat(2000), `${'a'.repeat(1799)}😀b`, 'June 🌷 '.repeat(700)]) {
    const chunks = store.chunksOf(value);
    assert.equal(chunks.join(''), value, 'nothing lost or reordered');
    assert.ok(chunks.every((chunk) => Buffer.byteLength(chunk) <= 1800), 'every piece fits');
    assert.ok(!chunks.some((chunk) => /�/.test(Buffer.from(chunk).toString())), 'no character split');
  }
  assert.deepEqual(store.chunksOf('x'.repeat(3601)).map((chunk) => chunk.length), [1800, 1800, 1], 'in order');
});

await check('caregiver sign-in: a mismatch, the pause after five, Supabase’s own limit, and no connection, each calmly, with retry', async () => {
  let app = await caregiverAccount();
  const miss = await app.account.signIn('caregiver', 'pat@caregiver.test', OTHER_PASSWORD);
  assert.deepEqual(miss, { ok: false, reason: 'credentials', message: form.CAREGIVER_NOT_MATCHED }, 'the same words for a password or an address that doesn’t match');
  const nobody = await app.account.signIn('caregiver', 'nobody@caregiver.test', PASSWORD);
  assert.deepEqual(nobody, miss, 'an address with no account reads exactly the same');
  for (let i = 0; i < 3; i++) await app.account.signIn('caregiver', 'pat@caregiver.test', OTHER_PASSWORD);
  const paused = await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  assert.deepEqual([paused.ok, paused.reason, paused.message], [false, 'busy', form.LOCKED_OUT], 'five misses: a short break, even for the right password');
  app = await launch();
  standin.settings.signInLimit = 0;
  const limited = await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  assert.deepEqual([limited.ok, limited.reason, limited.message], [false, 'busy', form.TOO_MANY], 'Supabase’s "too many attempts", in calm words');
  standin.settings.signInLimit = Infinity;
  standin.settings.offline = true;
  const offline = await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  assert.deepEqual([offline.ok, offline.reason, offline.message], [false, 'offline', form.OFFLINE], 'no connection: check it and try again');
  standin.settings.offline = false;
  assert.deepEqual(await app.account.signIn('caregiver', ' pat@caregiver.test ', PASSWORD), { ok: true }, 'trying again works');
  await until(() => app.now().status === 'signed-in', 'the caregiver home');
});

await check('the session is kept in secure storage, in chunks, and never in AsyncStorage', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const saved = JSON.parse(sessionInVault());
  assert.equal(saved.user.email, 'pat@caregiver.test', 'the session is in the Keychain');
  assert.ok(Number(vault.get(`${SESSION}.n`).value) >= 2, 'in more than one piece, as a session is bigger than one value may be');
  for (const [key, { value, options }] of vault) {
    if (!key.startsWith(SESSION)) continue;
    assert.ok(Buffer.byteLength(value) <= 2048, `${key} fits`);
    assert.equal(options.keychainAccessible, 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY', 'readable after the first unlock, and never restored onto another phone');
  }
  assert.ok(![...disk.keys()].some((key) => key.startsWith('sb-')), 'nothing of the session in AsyncStorage');
});

await check('relaunched, the phone is still signed in: no password asked, the token refreshed when it has expired', async () => {
  let app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  standin.log.length = 0;
  app = await launch();
  assert.equal(app.now().status, 'signed-in', 'opened straight to the caregiver home');
  assert.ok(!app.states.some((state) => state.status === 'signed-out'), 'never by way of the welcome');
  assert.ok(!standin.log.some((entry) => entry.path === '/auth/v1/token'), 'no sign-in and no refresh needed');
  await app.account.signOut();
  await signInExpired(app);
  standin.log.length = 0;
  app = await launch();
  assert.equal(app.now().status, 'signed-in', 'with the access token expired, still signed in');
  await until(() => standin.log.some((entry) => entry.path === '/auth/v1/token'), 'the token refreshed');
  assert.ok(!app.states.some((state) => state.status === 'signed-out'), 'and never shown the welcome');
});

await check('relaunched offline with an expired token: still signed in, then the session refreshes once online', async () => {
  let app = await caregiverAccount();
  await signInExpired(app);
  const before = JSON.parse(sessionInVault()).access_token;
  standin.settings.offline = true;
  app = await launch();
  assert.equal(app.now().status, 'signed-in', 'supabase-js can’t refresh, and the phone stays signed in on its saved profile');
  assert.equal(app.now().profile.role, 'caregiver');
  assert.equal(app.now().email, 'pat@caregiver.test', 'with the email saved alongside');
  assert.ok(!app.states.some((state) => state.status === 'signed-out'), 'no welcome, no prompt');
  assert.ok(sessionInVault(), 'the session is kept to try again');
  standin.settings.offline = false;
  // supabase-js waits out a minute after a failed refresh before trying again (REFRESH_FAILURE_COOLDOWN_MS).
  const realNow = Date.now;
  Date.now = () => realNow() + 61_000;
  const client = (await module('lib/supabase.ts')).supabase;
  const { data } = await client.auth.getSession();
  Date.now = realNow;
  assert.ok(data.session && data.session.access_token !== before, 'back online, the next request after that minute refreshes it');
  await settle();
  assert.equal(app.now().status, 'signed-in');
});

await check('a session the server refuses (a new password elsewhere) signs this phone out, and clears it', async () => {
  let app = await caregiverAccount();
  await signInExpired(app);
  const id = app.now().profile.id;
  standin.revokeSessions(id);
  app = await launch();
  assert.equal(app.now().status, 'signed-out', 'back to the welcome');
  await settle();
  assert.equal(sessionInVault(), null, 'the session is gone from secure storage');
  assert.ok(!disk.has(`evermore.profile.${id}`), 'and so is the saved profile');
});

/** What a caregiver's phone keeps from the server: Insights' copy and the saved profile. */
function seedCaregiverCopies(id) {
  disk.set(`evermore.insightsCache.v1.${id}`, JSON.stringify({ fetchedAt: Date.now() }));
  disk.set(`evermore.insightsCache.v1.${id}.2026-11`, JSON.stringify([{ personId: 'x' }]));
  disk.set('evermore.textSize.v1', 'large');
  disk.set('evermore.family.v1', JSON.stringify({ people: [] }));
}

await check('Sign out: the session, the saved profile, Insights’ copy and the photo cache go; the text size and the local-only family stay', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const id = app.now().profile.id;
  seedCaregiverCopies(id);
  assert.ok(disk.has(`evermore.profile.${id}`), 'the profile was saved for offline');
  const images = { ...cleared };
  await app.account.signOut();
  assert.equal(app.now().status, 'signed-out', 'back to the welcome');
  assert.equal(sessionInVault(), null, 'the session is gone from secure storage');
  assert.ok(![...vault.keys()].some((key) => key.startsWith(SESSION)), 'every piece of it');
  for (const key of [`evermore.profile.${id}`, `evermore.insightsCache.v1.${id}`, `evermore.insightsCache.v1.${id}.2026-11`]) assert.ok(!disk.has(key), `${key} is cleared`);
  assert.ok(cleared.memory > images.memory && cleared.disk > images.disk, 'the photos in the image cache are cleared');
  assert.equal(disk.get('evermore.textSize.v1'), 'large', 'the text size is the phone’s, and stays');
  assert.ok(disk.has('evermore.family.v1'), 'the local-only family isn’t server data, and stays');
  assert.ok(standin.log.some((entry) => entry.path === '/auth/v1/logout'), 'the server was told');
  const refresh = [...standin.sessions.values()].filter((one) => one.userId === id);
  assert.ok(refresh.length && refresh.every((one) => one.revoked), 'so the session can’t be used again anywhere');
});

await check('Sign out with no connection still signs out and clears, on the phone', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const id = app.now().profile.id;
  seedCaregiverCopies(id);
  const exportsCleared = exportFolder.cleared;
  standin.settings.offline = true;
  await app.account.signOut();
  assert.equal(app.now().status, 'signed-out', 'signed out at once');
  assert.ok(exportFolder.cleared > exportsCleared, 'any export file left in the temporary folder goes too');
  assert.equal(sessionInVault(), null, 'the session is forgotten here');
  assert.ok(!disk.has(`evermore.insightsCache.v1.${id}`) && !disk.has(`evermore.profile.${id}`), 'and the copies cleared');
  standin.settings.offline = false;
  const again = await launch();
  assert.equal(again.now().status, 'signed-out', 'and it stays signed out when the app opens again');
});

await check('Delete account removes the family on the server, then signs out and clears this phone', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const id = app.now().profile.id;
  seedCaregiverCopies(id);
  assert.deepEqual((await app.account.deleteFamily()).ok, true);
  assert.equal(app.now().status, 'signed-out');
  assert.ok(!standin.users.some((user) => user.id === id) && !standin.tables.people.some((row) => row.caregiver_id === id), 'gone from the server');
  assert.equal(sessionInVault(), null);
  assert.ok(!disk.has(`evermore.insightsCache.v1.${id}`) && !disk.has(`evermore.profile.${id}`), 'and from this phone');
});

await check('a session an earlier release kept in AsyncStorage moves into secure storage, still signed in', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const session = sessionInVault();
  vault.clear();
  disk.set(SESSION, session);
  const opened = await launch();
  assert.equal(opened.now().status, 'signed-in', 'nobody is asked to sign in again');
  await settle();
  assert.equal(JSON.parse(sessionInVault()).user.email, 'pat@caregiver.test', 'it is in the Keychain now');
  assert.ok(!disk.has(SESSION), 'and gone from AsyncStorage');
});

await check('secure storage that can’t be read for a moment doesn’t sign the phone out or clear it', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const id = app.now().profile.id;
  secure.locked = true;
  life += 1;
  const store = await module('lib/session-storage.ts');
  assert.equal(await store.storedSessionUser(SESSION), undefined, 'locked: it can’t tell, which isn’t "nobody"');
  secure.locked = false;
  assert.equal(await store.storedSessionUser(SESSION), id, 'the next read finds it: nothing was remembered as missing');
  secure.locked = true;
  const locked = await launch();
  assert.equal(locked.now().status, 'signed-out', 'opened while locked: the welcome for now');
  await settle();
  assert.ok(sessionInVault() !== null && disk.has(`evermore.profile.${id}`), 'but nothing is cleared');
  secure.locked = false;
  const unlocked = await launch();
  assert.equal(unlocked.now().status, 'signed-in', 'and the next launch is signed in as before');
});

await check('Forgot password: the same calm answer for any address, the code from the email, then the new password', async () => {
  const app = await caregiverAccount();
  assert.deepEqual(await app.account.sendPasswordReset('nobody@caregiver.test'), { ok: true }, 'an address with no account: the same answer');
  assert.equal(standin.emails.filter((one) => one.kind === 'recovery').length, 0, 'and nothing sent');
  assert.deepEqual(await app.account.sendPasswordReset('pat@caregiver.test'), { ok: true });
  const soon = await app.account.sendPasswordReset('pat@caregiver.test');
  assert.deepEqual([soon.ok, soon.reason], [false, 'busy'], 'asking again within the minute: calm words to wait');
  const sent = standin.emails.find((one) => one.kind === 'recovery');
  const miss = await app.account.resetPasswordWithCode('pat@caregiver.test', '000000', OTHER_PASSWORD);
  assert.deepEqual([miss.ok, miss.reason], [false, 'code']);
  assert.deepEqual(await app.account.resetPasswordWithCode('pat@caregiver.test', sent.code, OTHER_PASSWORD), { ok: true }, 'the code and a new password');
  await until(() => app.now().status === 'signed-in', 'signed in by it');
  await app.account.signOut();
  assert.equal((await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD)).reason, 'credentials', 'the old password no longer works');
  assert.deepEqual(await app.account.signIn('caregiver', 'pat@caregiver.test', OTHER_PASSWORD), { ok: true }, 'the new one does');
});

await check('the sign-in screens: Show on every password, Forgot password, and Sign out always in Settings', () => {
  const signIn = inRepo('src/components/sign-in/caregiver-sign-in.tsx');
  const screen = inRepo('src/app/sign-in.tsx');
  const dashboard = inRepo('src/app/caregiver/index.tsx');
  assert.ok(!/<Field[^>]*secureTextEntry/s.test(signIn + inRepo('src/components/sign-in/caregiver-sign-up.tsx')), 'every caregiver password box is a PasswordField, with Show and Hide');
  assert.ok(signIn.includes('label="Forgot password?"') && signIn.includes("'Send reset email'") && signIn.includes("'Save new password'"), 'Forgot password, its email, and the new password');
  assert.ok(/If there’s an account for/.test(signIn), 'the reset confirmation never says whether the address has an account');
  assert.ok(!/Keep me signed in/.test(screen + signIn), 'no "Keep me signed in": a phone stays signed in until someone signs it out');
  assert.ok(/tab === 'settings' && \(family \|\| !LOCAL_ONLY\)/.test(dashboard), 'Settings shows with sign-in on even when the family couldn’t load');
  // Settings lives in src/components/settings-page.tsx since 2026-11-12: Sign out is in Account, which never waits for the family.
  const settings = inRepo('src/components/settings-page.tsx');
  const account = settings.slice(settings.indexOf('<Section title="Account">'), settings.indexOf('<Section title="Linked phones">'));
  assert.ok(/<SignOutSetting \/>/.test(account) && /<Row testID="sign-out" label="Sign out"/.test(settings) && !/family \? <SignOutSetting/.test(settings), 'and Sign out is never behind the family');
  assert.ok(inRepo('src/data/app-data.ts').includes("import '@/data/forget';"), 'the app registers what sign-out clears');
});

// ---------------------------------------------------------------------------------------
// 4. The person's sign-in, with the login the caregiver makes, on a second phone or the same one;
// then never asked again unless the caregiver signs the phone out
// ---------------------------------------------------------------------------------------

/** Two phones: each keeps its own disks. Switching saves the one in hand and picks up the other. */
const phones = {};
let inHand = null;
function usePhone(name) {
  if (inHand) phones[inHand] = { disk: new Map(disk), vault: new Map(vault) };
  disk.clear();
  vault.clear();
  for (const [key, value] of phones[name]?.disk ?? []) disk.set(key, value);
  for (const [key, value] of phones[name]?.vault ?? []) vault.set(key, value);
  inHand = name;
}

const ROSE_PASSWORD = 'roses grow by the door';

/** A caregiver on their own phone who has made the person's login under Settings, Their login. */
async function familyWithLogin() {
  for (const name of Object.keys(phones)) delete phones[name];
  inHand = null;
  usePhone('caregiver');
  newProject({ autoconfirm: true });
  const app = await launch();
  await app.account.signUpCaregiver('pat@caregiver.test', PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in', 'the caregiver signed up');
  const made = await app.account.createPersonLogin(' Rose.M ', ROSE_PASSWORD, 'Rose');
  assert.equal(made.ok, true, 'Their login, made');
  return app;
}

await check('the person’s form: only that something is typed, in gentle words', () => {
  assert.deepEqual(form.personProblems({ userId: 'rose.m', password: 'x' }), {});
  assert.deepEqual(form.personProblems({ userId: '  ', password: '' }), { userId: 'Please type your User ID.', password: 'Please type your password.' });
});

await check('Their login: the caregiver makes it, and the server checks it the same way', async () => {
  const app = await familyWithLogin();
  const person = standin.tables.profiles.find((one) => one.role === 'person');
  assert.equal(person.username, 'rose.m', 'the User ID, in lowercase and without spaces');
  assert.equal(person.display_name, 'Rose');
  assert.ok(standin.users.some((user) => user.email === 'rose.m@person.evermore.invalid'), 'a login on the reserved domain that can never receive mail');
  assert.equal((await app.account.createPersonLogin('ann', ROSE_PASSWORD, '')).ok, false, 'one login per family');
  const settings = inRepo('src/components/caregiver-settings.tsx');
  assert.ok(/<PasswordField\s+testID="person-password"/.test(settings), 'the caregiver types it hidden, with Show to read it back');
  assert.ok(settings.includes('choose “I am practicing” and sign in'), 'and is told what the person does on their phone');
});

await check('on a second phone: "I am practicing", the User ID and password, Continue, and their home', async () => {
  await familyWithLogin();
  usePhone('person');
  const app = await launch();
  assert.equal(app.now().status, 'signed-out', 'a new phone opens on the welcome');
  const miss = await app.account.signIn('person', 'rose.m', 'roses grow by the gate');
  assert.deepEqual(miss, { ok: false, reason: 'credentials', message: 'That did not work. Please check the ID and password, or ask your caregiver.' }, 'gently');
  assert.deepEqual(await app.account.signIn('person', 'rose.n', ROSE_PASSWORD), miss, 'an ID that doesn’t exist reads the same');
  standin.settings.offline = true;
  assert.equal((await app.account.signIn('person', 'rose.m', ROSE_PASSWORD)).reason, 'offline', 'no connection: check it and try again');
  standin.settings.offline = false;
  assert.deepEqual(await app.account.signIn('person', ' Rose.M ', ROSE_PASSWORD), { ok: true }, 'capitals and spaces don’t matter');
  await until(() => app.now().status === 'signed-in', 'signed in');
  assert.equal(app.now().profile.role, 'person', 'the person’s home and practice');
  assert.equal(app.now().profile.displayName, 'Rose', '"Hello, Rose."');
  await settle();
  assert.ok(sessionInVault(), 'kept in secure storage');
});

// ---------------------------------------------------------------------------------------
// The caregiver's agreements (2026-11-13): no account without both, versioned records per caregiver,
// asked again for a new version, research off by default and every change kept, the person's login
// reading none, nothing kept on the phone, and offline never locking the caregiver out
// ---------------------------------------------------------------------------------------

await check('no account without both agreements: nothing leaves the phone, and the database refuses it too', async () => {
  disk.clear();
  newProject({ autoconfirm: true });
  const app = await launch();
  const consent = await module('lib/consent.ts');
  for (const agreement of [{ policy: false, responsibility: false, research: true }, { policy: true, responsibility: false, research: false }, { policy: false, responsibility: true, research: false }, undefined]) {
    const result = await app.account.signUpCaregiver('pat@caregiver.test', PASSWORD, agreement ?? {});
    assert.deepEqual(result, { ok: false, reason: 'other', message: consent.NEED_POLICY }, 'a calm note');
  }
  assert.ok(!standin.log.some((one) => one.path.endsWith('/signup')), 'no request was sent: the email and password never left the phone');
  // An older app, or anyone calling Supabase directly, with only the consent time:
  for (const data of [{ consented_at: new Date().toISOString() }, { consented_at: new Date().toISOString(), policy_version: '2026-11-13', agreed_policy: true }]) {
    const direct = await standin.fetch('http://standin.test/auth/v1/signup', { method: 'POST', headers: { 'content-type': 'application/json', apikey: 'anon' }, body: JSON.stringify({ email: 'old@caregiver.test', password: PASSWORD, data }) });
    assert.equal(direct.status, 500, 'Database error saving new user');
  }
  assert.equal(standin.users.length + standin.tables.profiles.length + standin.tables.consents.length, 0, 'no login, profile or record was made');
});

await check('agreements: versioned per caregiver, asked again for a new version, research off and every change kept', async () => {
  disk.clear();
  newProject({ autoconfirm: true });
  let app = await launch();
  await app.account.signUpCaregiver('pat@caregiver.test', PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in', 'signed up');
  const pat = app.now().profile.id;
  let store = await module('data/consent-store.ts');
  await store.loadConsent();
  assert.deepEqual([store.useConsent().status, store.useConsent().research], ['current', false], 'agreed at sign-up; research off by default');
  assert.deepEqual(await store.setResearch(true), { ok: true });
  assert.deepEqual(await store.setResearch(false), { ok: true });
  assert.deepEqual(standin.tables.consents.filter((one) => one.kind === 'research').map((one) => one.choice), [false, true, false], 'each change is its own record, nothing overwritten');
  assert.equal(store.useConsent().research, false);
  // The policy changes (as if Pat had signed up before versions): the next read asks again, and nothing else changes.
  const people = standin.tables.people.length;
  standin.legacyConsent('pat@caregiver.test');
  app = await launch();
  store = await module('data/consent-store.ts');
  await store.loadConsent();
  assert.equal(store.useConsent().status, 'needed', 'asked to read and agree again');
  assert.equal(standin.tables.people.length, people, 'with nothing lost while it waits');
  assert.deepEqual(await store.agreeToPolicy(), { ok: true });
  assert.equal(store.useConsent().status, 'current', 'agreeing lets the caregiver continue');
  assert.deepEqual(standin.tables.consents.filter((one) => one.caregiver_id === pat).map((one) => [one.kind, one.policy_version]), [['responsibility', 'legacy'], ['policy', '2026-11-13'], ['responsibility', '2026-11-13']], 'the old record kept, the new ones added');
  assert.ok(standin.tables.consents.every((one) => one.agreed_at), 'each at the server’s time');
  // Records can't be changed or removed, even by their caregiver.
  const supabase = (await module('lib/supabase.ts')).supabase;
  const changed = await supabase.from('consents').update({ choice: false }).eq('kind', 'policy');
  const removed = await supabase.from('consents').delete().eq('caregiver_id', pat);
  assert.ok(changed.error && removed.error && standin.tables.consents.filter((one) => one.caregiver_id === pat).length === 3, 'never changed or removed');
  // Offline on a fresh launch: nothing is asked, nothing is kept.
  standin.legacyConsent('pat@caregiver.test');
  standin.settings.offline = true;
  app = await launch();
  store = await module('data/consent-store.ts');
  await store.loadConsent();
  assert.equal(store.useConsent().status, 'unknown', 'offline, the caregiver is never locked out');
  standin.settings.offline = false;
  await store.loadConsent();
  assert.equal(store.useConsent().status, 'needed', 'and is asked once the server answers');
  assert.ok(![...disk.keys()].some((key) => /consent/i.test(key)), 'nothing about agreements is kept on the phone');
  // Signing out forgets what was read.
  await app.account.signOut();
  await until(() => app.now().status === 'signed-out', 'signed out');
  assert.equal(store.useConsent().status, 'checking', 'forgotten at sign-out');
});

await check('one caregiver never reads another’s agreements, and the person’s login reads none', async () => {
  const app = await familyWithLogin();
  const pat = app.now().profile.id;
  await app.account.signOut();
  await until(() => app.now().status === 'signed-out', 'signed out');
  await app.account.signUpCaregiver('sam@caregiver.test', PASSWORD, { ...AGREED, research: true });
  await until(() => app.now().status === 'signed-in', 'Sam signed up');
  const sam = app.now().profile.id;
  const supabase = (await module('lib/supabase.ts')).supabase;
  const asSam = await supabase.from('consents').select('caregiver_id, kind, choice');
  assert.ok(!asSam.error && asSam.data.length === 3 && asSam.data.every((one) => one.caregiver_id === sam), 'Sam reads only Sam’s');
  assert.equal(asSam.data.find((one) => one.kind === 'research').choice, true, 'research ticked at sign-up is recorded as on');
  assert.equal((await supabase.from('consents').select('id').eq('caregiver_id', pat)).data.length, 0, 'none of Pat’s, even naming Pat');
  assert.ok((await supabase.from('consents').insert({ caregiver_id: pat, kind: 'research', policy_version: '2026-11-13', choice: true })).error, 'and can’t add one in Pat’s name');
  usePhone('person');
  const phone = await launch();
  assert.deepEqual(await phone.account.signIn('person', 'rose.m', ROSE_PASSWORD), { ok: true });
  await until(() => phone.now().status === 'signed-in', 'the person signed in');
  const asPerson = (await module('lib/supabase.ts')).supabase;
  const read = await asPerson.from('consents').select('id');
  assert.ok(!read.error && read.data.length === 0, 'the person’s login reads no agreement');
  assert.ok((await asPerson.from('consents').insert({ caregiver_id: pat, kind: 'policy', policy_version: '2026-11-13', choice: true })).error, 'nor adds one');
  const store = await module('data/consent-store.ts');
  await store.loadConsent();
  assert.notEqual(store.useConsent().status, 'needed', 'and the person is never asked to agree');
});

await check('signed in once, the person is never asked again: relaunched, after an hour away, and offline', async () => {
  await familyWithLogin();
  usePhone('person');
  let app = await launch();
  await app.account.signIn('person', 'rose.m', ROSE_PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  standin.log.length = 0;
  app = await launch();
  assert.equal(app.now().status, 'signed-in', 'opened straight to their home');
  assert.ok(!app.states.some((state) => state.status === 'signed-out'), 'never by way of the welcome');
  assert.ok(!standin.log.some((entry) => entry.path === '/auth/v1/token'), 'no password asked');
  await app.account.signOut();
  await signInExpired(app, 'rose.m', ROSE_PASSWORD, 'person');
  standin.settings.offline = true;
  app = await launch();
  assert.equal(app.now().status, 'signed-in', 'an hour away and offline: still their home');
  assert.equal(app.now().profile.role, 'person');
  assert.ok(!app.states.some((state) => state.status === 'signed-out'), 'no prompt at any point');
  standin.settings.offline = false;
  const layout = inRepo('src/app/_layout.tsx');
  assert.ok(/guard=\{AUTH_ENABLED && who\.role === null\}>\s*<Stack\.Screen name="sign-in"/.test(layout), 'sign-in shows only while nobody is signed in');
  assert.ok(/guard=\{who\.role === 'person'\}>\s*<Stack\.Screen name="index"[^>]*\/>\s*<Stack\.Screen name="practice"/.test(layout), 'a signed-in person reaches home and practice');
  for (const path of ['src/app/practice.tsx', 'src/components/practice-screen.tsx', 'src/app/index.tsx']) {
    const code = inRepo(path).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/signIn\(|PersonSignIn|sign-in['"]|password|@\/data\/account/i.test(code), `${path} has no sign-in of its own: no login wall inside practice`);
  }
});

await check('the person’s screens never show the caregiver’s email or any account detail', () => {
  for (const path of ['src/components/sign-in/person-sign-in.tsx', 'src/components/sign-in/person-pairing.tsx', 'src/app/index.tsx', 'src/app/practice.tsx', 'src/components/practice-screen.tsx', 'src/components/practice-more.tsx', 'src/components/caregiver-button.tsx']) {
    const text = inRepo(path);
    assert.ok(!/\.email\b|useAccount|currentProfile|(?<!")username|personEmail/.test(text), `${path} reaches no account detail (the autofill hint "username" aside)`);
  }
  assert.ok(/name: account\.status === 'signed-in' \? account\.profile\.displayName : ''/.test(inRepo('src/data/app-data.ts')), 'the person’s screens get their first name, and nothing else of the account');
});

await check('the person’s sign-in screen: "Hello", large type, 48pt targets, one Continue', () => {
  const screen = inRepo('src/components/sign-in/person-sign-in.tsx');
  assert.ok(!/CompactType/.test(screen), 'the person’s own large type and Text size, not the caregiver’s compact scale');
  assert.ok(/size="display">\s*Hello/.test(screen), '"Hello" at the largest size');
  assert.equal(screen.match(/<BigButton/g).length, 1, 'one action');
  assert.ok(/label=\{busy \? 'One moment…' : 'Continue'\} primary large/.test(screen), 'one big Continue');
  assert.ok(/<PasswordField/.test(screen) && /label="User ID"/.test(screen), 'User ID and a password with Show');
  assert.ok(/minHeight: TAP/.test(screen) && /TAP\b/.test(inRepo('src/components/password-field.tsx')), 'Back and Show are 48pt');
  assert.ok(!/setTimeout|setInterval|Countdown|seconds/i.test(screen), 'nothing timed');
  assert.ok(!/<Field[^>]*secureTextEntry/s.test(inRepo('src/app/sign-in.tsx') + screen), 'every password box can be shown or hidden');
});

await check('a new password from the caregiver signs the person’s phone out the next time it refreshes', async () => {
  const caregiver = await familyWithLogin();
  usePhone('person');
  let app = await launch();
  await signInExpired(app, 'rose.m', ROSE_PASSWORD, 'person');
  usePhone('caregiver');
  await launch();
  assert.equal((await caregiver.account.resetPersonLogin('rose.m', 'violets by the gate')).ok, true, 'Reset their login');
  usePhone('person');
  app = await launch();
  assert.equal(app.now().status, 'signed-out', 'their phone asks for the new password');
  assert.deepEqual(await app.account.signIn('person', 'rose.m', 'violets by the gate'), { ok: true }, 'which works');
});

await check('handed back to the caregiver: the person’s phone signs out, keeping only practice not yet sent', async () => {
  await familyWithLogin();
  usePhone('person');
  const app = await launch();
  await app.account.signIn('person', 'rose.m', ROSE_PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const id = app.now().profile.id;
  const unsent = [{ kind: 'attempt', id: 'a1', row: { id: 'a1', card_id: 'c1', tries: 1 } }];
  disk.set(`evermore.practice.v1.${id}`, JSON.stringify({ people: [{ id: 'p1', name: 'June' }], cards: [{ id: 'c1', sentence: 'My aunt, {name}, grows tomatoes.' }], goal: 9, schedule: { c1: { step: 1 } }, sessions: [], outbox: unsent, today: { asked: ['My aunt, June, grows tomatoes.'] } }));
  disk.set(`evermore.recordQueue.v1.${id}`, JSON.stringify([{ id: 'r1', personId: 'p1' }]));
  const images = cleared.disk;
  await app.account.signOut();
  assert.equal(app.now().status, 'signed-out', 'the welcome, for the caregiver to sign in');
  const left = JSON.parse(disk.get(`evermore.practice.v1.${id}`));
  assert.deepEqual(left.outbox, unsent, 'practice not yet sent stays, to go when they sign in again');
  assert.deepEqual([left.people, left.cards, left.today], [[], [], undefined], 'the names, sentences and today’s log are gone');
  assert.ok(!JSON.stringify(left).includes('June'), 'nobody’s name is left');
  assert.ok(disk.has(`evermore.recordQueue.v1.${id}`), 'card records waiting to be sent stay (ids and numbers only)');
  assert.ok(!disk.has(`evermore.profile.${id}`) && sessionInVault() === null, 'the profile and session go');
  assert.ok(cleared.disk > images, 'and the photos in the image cache');
  const button = inRepo('src/components/caregiver-button.tsx');
  assert.ok(/delayLongPress=\{1000\}/.test(button) && /confirm\(\s*'Switch to the caregiver\?'/.test(button), 'only by holding Caregiver, then confirming');
});

// ---------------------------------------------------------------------------------------
// 5. Account basics in Settings: who is signed in, Change password, Sign out, Delete account
// ---------------------------------------------------------------------------------------

await check('Change password: the current one first, then the new one; calm when it doesn’t go', async () => {
  const app = await caregiverAccount();
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const notCurrent = await app.account.changePassword(OTHER_PASSWORD, 'a brand new garden path');
  assert.deepEqual([notCurrent.ok, notCurrent.reason, notCurrent.message], [false, 'credentials', 'That isn’t your current password. Please try again.']);
  const same = await app.account.changePassword(PASSWORD, PASSWORD);
  assert.deepEqual([same.ok, same.message], [false, 'That’s the password you have now. Please choose a new one.']);
  standin.settings.signInLimit = 0;
  standin.resetSignInTries();
  assert.equal((await app.account.changePassword(PASSWORD, 'a brand new garden path')).message, form.TOO_MANY, 'too many tries, calmly');
  standin.settings.signInLimit = Infinity;
  standin.settings.offline = true;
  assert.equal((await app.account.changePassword(PASSWORD, 'a brand new garden path')).reason, 'offline');
  standin.settings.offline = false;
  assert.deepEqual(await app.account.changePassword(PASSWORD, 'a brand new garden path'), { ok: true }, 'changed');
  await settle();
  assert.equal(app.now().status, 'signed-in', 'and still signed in on this phone');
  await app.account.signOut();
  assert.equal((await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD)).reason, 'credentials', 'the old password no longer works');
  assert.deepEqual(await app.account.signIn('caregiver', 'pat@caregiver.test', 'a brand new garden path'), { ok: true }, 'the new one does');
});

await check('Settings: the signed-in email, Change password, Sign out and Delete account, with or without the family', () => {
  const settings = inRepo('src/components/caregiver-settings.tsx');
  // Since 2026-11-12 the tab is src/components/settings-page.tsx: these rows never wait for the family.
  const page = inRepo('src/components/settings-page.tsx');
  for (const row of ['<SignedInAs />', '<ChangePasswordSetting />', '<SignOutSetting />', '<DeleteAccountSetting />']) {
    assert.ok(page.includes(row), `${row} is in the sign-in-on rows`);
    assert.ok(!new RegExp(`family \\? ${row.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(page), `${row} shows without the family`);
  }
  assert.ok(/Signed in as/.test(settings) && /<AppText selectable>\{account\.email\}<\/AppText>/.test(settings), 'the email, whole, on two lines if it needs them');
  assert.equal(settings.match(/<PasswordField/g).length, 4, 'Change password’s three boxes and the person’s, each with Show');
  assert.ok(/label="Current password"/.test(settings) && /strength=\{\{ email \}\}/.test(settings), 'the current password, then the new one with its strength hint');
});

// ---------------------------------------------------------------------------------------
// 6. Pairing the person's phone, the caregiver's side: a PIN, Linked phones, Remove phone
// ---------------------------------------------------------------------------------------

const pairing = await import(withLife(`${src}lib/pairing.ts`));

await check('the PIN’s words: in two halves, digit by digit for a screen reader, and counting down', () => {
  assert.equal(pairing.pinForDisplay('482913'), '482 913');
  assert.equal(pairing.pinForScreenReader('482913'), '4 8 2 9 1 3');
  const at = Date.parse('2026-11-11T15:00:00Z');
  assert.equal(pairing.expiresIn(at + 15 * 60000, at), 'Expires in 15:00');
  assert.equal(pairing.expiresIn(at + 61000, at), 'Expires in 1:01');
  assert.equal(pairing.expiresIn(at + 500, at), 'Expires in 0:01');
  assert.equal(pairing.expiresIn(at, at), null, 'then it has expired');
  assert.equal(pairing.expiresInWords(at + 15 * 60000, at), 'Expires in 15 minutes', 'whole minutes for a screen reader, not every second');
  assert.equal(pairing.expiresInWords(at + 30000, at), 'Expires in less than a minute');
  assert.deepEqual([0, 1, 2].map(pairing.phonesCount), ['None yet', '1 phone', '2 phones']);
  const now = new Date(2026, 10, 11, 16, 0);
  assert.equal(pairing.pairedWords(new Date(2026, 10, 11, 9).toISOString(), now), 'Paired today');
  assert.equal(pairing.pairedWords(new Date(2026, 10, 10, 9).toISOString(), now), 'Paired yesterday');
  assert.equal(pairing.pairedWords(new Date(2026, 10, 4, 9).toISOString(), now), 'Paired on November 4');
  assert.equal(pairing.pairedWords(new Date(2025, 10, 4, 9).toISOString(), now), 'Paired on November 4, 2025');
  assert.equal(pairing.lastSeenWords(new Date(2026, 10, 11, 15, 42).toISOString(), now), 'Last seen today at 3:42 PM');
  assert.equal(pairing.lastSeenWords(null, now), 'Not seen since it was paired');
});

/** A phone fresh from the box, called `name`. Earlier phones keep what they hold, for the last check. */
function freshPhone(name) {
  if (inHand) phones[inHand] = { disk: new Map(disk), vault: new Map(vault) };
  inHand = null;
  delete phones[name];
  usePhone(name);
}

/** A caregiver signed in on their own phone, with this launch's pairing store. */
async function caregiverForPairing(email = 'pat@caregiver.test') {
  freshPhone('pairing caregiver');
  newProject({ autoconfirm: true });
  const app = await launch();
  await app.account.signUpCaregiver(email, PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in', 'the caregiver signed up');
  return { app, pair: await module('data/pairing.ts') };
}

/** A phone paired straight through the server, as the person's phone does (section 7 drives the app itself). */
async function pairDirect(pin, deviceName = 'Rose’s iPhone', email = 'pat@caregiver.test') {
  const { PAIR_PHONE_FUNCTION } = await import(withLife(`${src}config/functions.ts`));
  const response = await standin.fetch(`http://standin.test/functions/v1/${PAIR_PHONE_FUNCTION}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'redeem', email, pin, deviceName }),
  });
  return { status: response.status, body: await response.json() };
}

await check('Create a PIN: six digits for 15 minutes, held only in memory; a new one stops the first working', async () => {
  const { pair } = await caregiverForPairing();
  assert.equal(pair.usePairing().pin, null, 'none until asked for');
  assert.deepEqual(await pair.createPin([]), { ok: true });
  const first = pair.usePairing().pin;
  assert.match(first.pin, /^\d{6}$/);
  assert.ok(Math.abs(first.expiresAt - Date.now() - 15 * 60000) < 5000, 'for 15 minutes');
  await pair.createPin([]);
  const second = pair.usePairing().pin;
  assert.equal((await pairDirect(first.pin)).body.error, 'not-paired', 'the first no longer works');
  assert.equal((await pairDirect(second.pin)).status, 200, 'the new one does');
  await settle();
  const kept = [...disk.values(), ...[...vault.values()].map((one) => one.value)].join('\n');
  assert.ok(!kept.includes(first.pin) && !kept.includes(second.pin), 'no PIN is saved on the phone');
  assert.ok(!said.some((line) => line.includes(first.pin) || line.includes(second.pin)), 'or logged');
});

await check('when a PIN can’t be made (no connection), calm words and nothing shown', async () => {
  const { pair } = await caregiverForPairing();
  standin.settings.offline = true;
  assert.deepEqual(await pair.createPin([]), { ok: false, message: form.OFFLINE });
  standin.settings.offline = false;
  assert.equal(pair.usePairing().pin, null, 'nothing shown');
});

await check('Linked phones: each paired phone with its name, when it was paired and last seen; nobody else’s', async () => {
  const { app, pair } = await caregiverForPairing();
  assert.deepEqual(await pair.linkedPhones(), { phones: [] });
  await pair.createPin([]);
  await pairDirect(pair.usePairing().pin.pin);
  await pair.linkedPhones();
  assert.deepEqual(pair.usePairing(), { pin: null, linked: 'Rose’s iPhone' }, 'once its phone pairs, the PIN is used: it goes, and the phone is named');
  await pair.createPin(['already-linked-phone']);
  await pairDirect(pair.usePairing().pin.pin, '   ');
  const { phones: listed } = await pair.linkedPhones();
  assert.deepEqual(listed.map((one) => one.name), ['Rose’s iPhone', 'Phone 2'], 'the phone’s own name, or "Phone 2"');
  assert.ok(listed.every((one) => one.pairedAt && one.lastSeenAt), 'when it was paired and last seen');
  await app.account.signOut();
  await app.account.signUpCaregiver('sam@caregiver.test', PASSWORD, AGREED);
  await until(() => app.now().status === 'signed-in' && app.now().profile.id !== listed[0].id, 'another caregiver signed up');
  await settle();
  assert.deepEqual(await pair.linkedPhones(), { phones: [] }, 'another family sees none of them');
  standin.settings.offline = true;
  assert.deepEqual(await pair.linkedPhones(), { message: form.OFFLINE }, 'offline, calmly');
  standin.settings.offline = false;
});

await check('Remove phone: gone from the list, its access ended, and its login can no longer refresh or sign in', async () => {
  const { pair } = await caregiverForPairing();
  await pair.createPin([]);
  const paired = (await pairDirect(pair.usePairing().pin.pin)).body;
  const {
    phones: [phone],
  } = await pair.linkedPhones();
  assert.deepEqual(await pair.removePhone(phone.id), { ok: true });
  assert.deepEqual(await pair.linkedPhones(), { phones: [] }, 'no longer listed');
  assert.ok(standin.tables.devices[0].revoked_at, 'marked removed on the server, its practice kept');
  assert.equal(standin.users.find((one) => one.email === paired.login).banned, true, 'banned, so its session can’t refresh');
  const signIn = await standin.fetch('http://standin.test/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: paired.login, password: paired.credential }) });
  assert.equal(signIn.status, 400, 'and its credential no longer signs in');
  assert.deepEqual(await pair.removePhone(phone.id), { ok: true }, 'removing it again is harmless');
  assert.equal((await pair.removePhone('00000000-0000-4000-8000-000000000000')).ok, false, 'a phone that isn’t theirs');
});

await check('Their login still works beside paired phones, and Settings still finds it', async () => {
  const { app, pair } = await caregiverForPairing();
  await pair.createPin([]);
  await pairDirect(pair.usePairing().pin.pin);
  assert.equal((await app.account.createPersonLogin('rose.m', ROSE_PASSWORD, 'Rose')).ok, true, 'a User ID login beside a paired phone');
  assert.equal((await app.account.createPersonLogin('ann', ROSE_PASSWORD, '')).ok, false, 'still one User ID login per family');
  assert.equal((await app.account.resetPersonLogin('rose.m', 'violets by the gate')).ok, true, 'and it can be reset');
  assert.equal(standin.tables.profiles.filter((one) => one.role === 'person').length, 2, 'two person logins in the family');
  const store = await module('data/family-store.ts');
  store.useFamily();
  await until(() => store.useFamily() !== null, 'the family loads with several person logins');
  assert.deepEqual([store.useFamily().person.username, store.useFamily().person.displayName], ['rose.m', 'Rose'], 'Their login is the one with a User ID');
});

await check('signing out forgets a PIN still on show; Delete account takes every paired phone’s login', async () => {
  const { app, pair } = await caregiverForPairing();
  await pair.createPin([]);
  const paired = (await pairDirect(pair.usePairing().pin.pin)).body;
  await pair.createPin([]);
  await app.account.signOut();
  assert.equal(pair.usePairing().pin, null, 'the PIN goes with the caregiver');
  await app.account.signIn('caregiver', 'pat@caregiver.test', PASSWORD);
  await until(() => app.now().status === 'signed-in', 'signed in again');
  assert.equal((await app.account.deleteFamily()).ok, true);
  assert.ok(!standin.users.some((one) => one.email === paired.login), 'the paired phone’s login is deleted with the family');
  assert.equal(standin.tables.devices.length + standin.pairings.length, 0, 'and its phones and PINs');
});

await check('the sheet: the PIN large with its countdown, New PIN, what they need, email not yet, and Remove phone that asks first', () => {
  const sheet = inRepo('src/components/pair-phone.tsx');
  assert.ok(/size="display"/.test(sheet) && /pinForDisplay\(pin!\.pin\)/.test(sheet), 'the PIN in large type');
  assert.ok(/expiresIn\(pin\.expiresAt, now\)/.test(sheet) && /setInterval\(listener, 1000\)/.test(sheet), 'a visible countdown, each second');
  assert.ok(sheet.includes("label={busy ? 'Creating…' : 'Create a PIN'}") && sheet.includes("label={busy ? 'Creating…' : 'New PIN'}"), 'Create a PIN, then New PIN');
  assert.ok(sheet.includes('Your email and this PIN.'), 'a plain reminder of what the person will need');
  assert.ok(/Send the PIN by email/.test(sheet) && /accessibilityState=\{\{ disabled: true \}\}/.test(sheet) && /Not available yet/.test(sheet), 'a clearly marked, disabled place for email');
  assert.ok(sheet.includes('await confirm(`Remove ${phone.name}?`'), 'Remove phone asks first, naming the phone');
  assert.ok(!/AsyncStorage|SecureStore|console\./.test(sheet + inRepo('src/data/pairing.ts')), 'the PIN is neither saved nor logged');
  assert.ok(!/Colors\.(pink|accent)\b/.test(sheet), 'the neutral caregiver palette');
  const page = inRepo('src/components/settings-page.tsx');
  assert.ok(page.includes('<PairPhoneSetting />') && !page.includes('family ? <PairPhoneSetting'), 'in Settings with sign-in on, whether or not the family loaded');
});

// ---------------------------------------------------------------------------------------
// 7. Pairing the person's phone, the person's side: Create my account with the caregiver's email and
// the PIN, then never asked again; removed by the caregiver, back to the welcome
// ---------------------------------------------------------------------------------------

const DEVICE = 'evermore.device.v1';
const credentialInVault = () => (vault.get(DEVICE) ? JSON.parse(vault.get(DEVICE).value) : null);

/** The caregiver makes a PIN on their phone; then a new phone, in the person's hands, is opened. */
async function pinAndNewPhone() {
  const { pair } = await caregiverForPairing();
  standin.readyDeck('pat@caregiver.test', 3);
  await pair.createPin([]);
  const pin = pair.usePairing().pin.pin;
  freshPhone('paired phone');
  const app = await launch();
  return { pin, app, pair: await module('data/pairing.ts') };
}

/** The session this phone keeps, left expired, as after an hour away: the next launch must refresh it. */
async function expireKeptSession() {
  const session = JSON.parse(sessionInVault());
  session.expires_at = Math.floor(Date.now() / 1000) - 60;
  const { chunksOf } = await module('lib/session-storage.ts');
  const chunks = chunksOf(JSON.stringify(session));
  for (const key of [...vault.keys()]) if (key.startsWith(SESSION)) vault.delete(key);
  chunks.forEach((chunk, index) => vault.set(`${SESSION}.${index}`, { value: chunk, options: {} }));
  vault.set(`${SESSION}.n`, { value: String(chunks.length), options: {} });
}
const passwordGrants = () => standin.log.filter((entry) => entry.path === '/auth/v1/token' && entry.grant === 'password').length;
const refreshGrants = () => standin.log.filter((entry) => entry.path === '/auth/v1/token' && entry.grant === 'refresh_token').length;

/** Back to the caregiver's phone, opened again. */
/** The person's home turned on their daily reminder on this phone: three are waiting, and one is in the list. */
async function remindersWaiting() {
  notifications.permission = 'granted';
  notifications.scheduled.clear();
  notifications.presented.clear();
  disk.set('evermore.reminders.v1', JSON.stringify({ on: true, time: 540, asked: true }));
  const reminders = await module('data/reminders.ts');
  await reminders.syncReminders(false, true);
  assert.equal([...notifications.scheduled.keys()].filter((id) => id.startsWith('evermore.reminder.')).length, 3, 'reminders are waiting');
  notifications.presented.add('evermore.reminder.2026-01-01');
}

/** Nothing of the reminders is left on this phone: none waiting, none in the list, and the setting off. */
function noReminders() {
  assert.equal(notifications.scheduled.size, 0, 'no reminder waits on a signed-out phone');
  assert.equal(notifications.presented.size, 0, 'and none stays in the list');
  const saved = JSON.parse(disk.get('evermore.reminders.v1') ?? 'null');
  assert.deepEqual(saved, { on: false, time: 540, asked: true }, 'off, with only the question remembered as asked');
}

async function caregiverPhone() {
  usePhone('pairing caregiver');
  const app = await launch();
  return { app, pair: await module('data/pairing.ts') };
}

await check('the person’s two steps: only that something sensible is typed, in gentle words', () => {
  assert.equal(pairing.pairEmailProblem(' '), 'Please type your caregiver’s email.');
  assert.equal(pairing.pairEmailProblem('pat'), 'Please check the email. It looks like name@example.com.');
  assert.equal(pairing.pairEmailProblem(' Pat@Caregiver.test '), undefined);
  assert.equal(pairing.pinDigits('48 29-13 7'), '482913', 'only digits, at most six, however it was typed or pasted');
  assert.equal(pairing.pinProblem(''), 'Please type the PIN.');
  assert.equal(pairing.pinProblem('4829'), 'The PIN has 6 numbers.');
  assert.equal(pairing.pinProblem('482913'), undefined);
  assert.equal(pairing.PAIR_NOT_MATCHED, 'That did not work. Please check with your caregiver.', 'the brief’s words');
  for (const words of [pairing.PAIR_NOT_MATCHED, pairing.pairEmailProblem(''), pairing.pinProblem('1')]) {
    assert.ok(!/wrong|error|invalid|fail|expired|exist|no account/i.test(words), `calm: ${words}`);
  }
});

await check('Create my account: the caregiver’s email and the PIN pair this phone, and its home opens, signed in', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  assert.equal(app.now().status, 'signed-out', 'a new phone opens on the welcome');
  assert.deepEqual(await pair.pairPhone('  PAT@caregiver.test ', pin), { ok: true }, 'the email typed any way');
  const kept = credentialInVault();
  assert.match(kept.login, /@phone\.evermore\.invalid$/);
  assert.ok(kept.credential.length >= 40, 'a long random credential');
  assert.equal(vault.get(DEVICE).options.keychainAccessible, 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY', 'in secure storage, on this phone only');
  assert.ok(![...disk.values()].some((value) => value.includes(kept.credential)), 'never in AsyncStorage');
  assert.deepEqual(await app.account.signInPairedPhone(), { ok: true }, '"You are all set", then it signs in');
  await until(() => app.now().status === 'signed-in', 'signed in');
  assert.equal(app.now().profile.role, 'person', 'their home');
  assert.equal(app.now().profile.username, null, 'with no User ID to remember');
  const device = standin.tables.devices.find((one) => one.person_user_id === app.now().profile.id);
  assert.equal(device.name, 'Rose’s iPhone', 'listed for the caregiver by the phone’s own name, tidied');
  const { supabase } = await module('lib/supabase.ts');
  assert.equal((await supabase.from('cards').select('id')).data.length, 9, 'it reads the deck the caregiver approved');
  assert.deepEqual((await supabase.from('devices').select('id')).data, [], 'and no phones');
  await settle();
  assert.ok(sessionInVault(), 'the session kept in secure storage, as any sign-in');
});

await check('every failure reads the same: unknown email, wrong PIN, used, expired, too many tries; only no connection differs', async () => {
  const { pin, pair } = await pinAndNewPhone();
  const miss = { ok: false, message: pairing.PAIR_NOT_MATCHED };
  const wrong = String((Number(pin) + 1) % 1e6).padStart(6, '0');
  assert.deepEqual(await pair.pairPhone('nobody@caregiver.test', pin), miss, 'an email with no account');
  assert.deepEqual(await pair.pairPhone('pat@caregiver.test', wrong), miss, 'a wrong PIN');
  standin.settings.offline = true;
  assert.deepEqual(await pair.pairPhone('pat@caregiver.test', pin), { ok: false, message: form.OFFLINE }, 'no connection: check it and try again');
  standin.settings.offline = false;
  assert.deepEqual(await pair.pairPhone('pat@caregiver.test', pin), { ok: true });
  assert.deepEqual(await pair.pairPhone('pat@caregiver.test', pin), miss, 'a PIN already used');
  standin.pairings.push({ id: 'old', caregiver_id: standin.users.find((one) => one.email === 'pat@caregiver.test').id, pin: '135790', expires_at: new Date(Date.now() - 1000).toISOString(), used_at: null, failures: 0 });
  assert.deepEqual(await pair.pairPhone('pat@caregiver.test', '135790'), miss, 'an expired PIN');
  standin.pairTries.length = 0;
  const { pair: caregiver } = await caregiverPhone();
  await caregiver.createPin([]);
  const fresh = caregiver.usePairing().pin.pin;
  usePhone('paired phone');
  await launch();
  const phone = await module('data/pairing.ts');
  for (let i = 0; i < 5; i++) await phone.pairPhone('pat@caregiver.test', '000000');
  assert.deepEqual(await phone.pairPhone('pat@caregiver.test', fresh), miss, 'too many tries: even the right PIN, for a while');
  assert.ok(!said.some((line) => /not-paired|pat@caregiver/.test(line)), 'nothing logged');
});

await check('nothing about the caregiver stays on the person’s phone, and nothing sensitive is cached', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const kept = [...disk.entries(), ...vault.entries()].map(([key, value]) => `${key}=${typeof value === 'string' ? value : value.value}`).join('\n');
  assert.ok(!kept.includes('pat@caregiver.test') && !kept.includes('caregiver.test'), 'the caregiver’s email is kept nowhere');
  assert.ok(!kept.includes(pin), 'nor the PIN');
  assert.ok(!said.some((line) => line.includes(pin) || line.includes(credentialInVault().credential)), 'nor logged, with the credential');
  assert.notEqual(app.now().email, 'pat@caregiver.test', 'the account knows only this phone’s own login');
  const steps = inRepo('src/components/sign-in/person-pairing.tsx') + inRepo('src/app/sign-in.tsx');
  assert.ok(!/AsyncStorage|SecureStore|localStorage|console\./.test(steps), 'the steps save and log nothing');
  assert.ok(/setPin\(''\)/.test(steps) && /if \(next !== 'pair-email' && next !== 'pair-pin'\) setPairEmail\(''\)/.test(steps), 'the PIN clears once used, and the email once the steps are left or done');
  assert.ok(/autoComplete="off"/.test(steps) && /textContentType="none"/.test(steps) && /importantForAutofill="no"/.test(steps), 'and the phone’s autofill doesn’t keep them');
});

await check('paired once, never asked again: relaunched, after an hour away, and offline', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  let again = await launch();
  assert.equal(again.now().status, 'signed-in', 'opened straight to their home');
  assert.ok(!again.states.some((state) => state.status === 'signed-out'), 'never by way of the welcome');
  await expireKeptSession();
  standin.settings.offline = true;
  again = await launch();
  assert.equal(again.now().status, 'signed-in', 'an hour away and offline: still their home');
  await settle(80);
  assert.ok(!again.states.some((state) => state.status === 'signed-out'), 'no welcome at any point');
  assert.ok(credentialInVault(), 'the pairing kept');
  standin.settings.offline = false;
  standin.log.length = 0;
  again = await launch();
  await until(() => refreshGrants() > 0, 'online again, the session refreshes');
  await settle(80);
  assert.equal(again.now().status, 'signed-in', 'and it carries on');
  assert.equal(passwordGrants(), 0, 'without the credential: the session was enough');
});

await check('a lost session comes back by itself, with the phone’s credential: no welcome, nothing asked', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  const id = app.now().profile.id;
  await settle();
  standin.revokeSessions(id);
  await expireKeptSession();
  standin.log.length = 0;
  const again = await launch();
  await until(() => refreshGrants() > 0, 'it tries to refresh, and the server refuses');
  await until(() => passwordGrants() > 0, 'then it signs in with its credential');
  await settle(120);
  assert.equal(again.now().status, 'signed-in', 'signed in again by itself');
  assert.equal(again.now().profile.id, id, 'as the same phone');
  assert.ok(!again.states.some((state) => state.status === 'signed-out'), 'the welcome never showed');
});

await check('Remove phone: the person’s phone returns to the welcome as soon as it is online, and forgets the pairing', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  await remindersWaiting();
  const { pair: caregiver } = await caregiverPhone();
  const { phones: listed } = await caregiver.linkedPhones();
  assert.ok(listed[0].lastSeenAt, 'the caregiver sees when it was last seen');
  assert.deepEqual(await caregiver.removePhone(listed[0].id), { ok: true });
  usePhone('paired phone');
  const phone = await launch();
  // The earlier copy of the app on this same phone is still running, and may already have heard and
  // forgotten everything (also right). Otherwise it opens as before, until it hears.
  const opened = phone.states.find((state) => state.status !== 'loading')?.status;
  assert.ok(opened === 'signed-in' || (credentialInVault() === null && sessionInVault() === null), `until it hears, it opens as before (${opened})`);
  await phone.account.checkThisPhone();
  await until(() => phone.now().status === 'signed-out', 'the welcome');
  assert.equal(credentialInVault(), null, 'the pairing is forgotten');
  assert.equal(sessionInVault(), null, 'and the session');
  await settle();
  noReminders();
  const again = await launch();
  await settle(80);
  assert.equal(again.now().status, 'signed-out', 'relaunched, still the welcome');
  const store = inRepo('src/data/practice-store.ts');
  assert.ok(/export async function refreshPractice\(\) \{[\s\S]{0,200}void checkThisPhone\(\);/.test(store), 'it checks whenever practice refreshes: opening, the home, coming back to the front');
  assert.ok(/state\.isConnected && practice\) void checkThisPhone\(\)/.test(store), 'and when the connection comes back');
});

await check('removed while offline: within the hour its session is refused, and it shows the welcome', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  const { pair: caregiver } = await caregiverPhone();
  const { phones: listed } = await caregiver.linkedPhones();
  await caregiver.removePhone(listed[0].id);
  usePhone('paired phone');
  await expireKeptSession();
  standin.log.length = 0;
  const phone = await launch();
  await until(() => phone.now().status === 'signed-out', 'the welcome, once its session is refused', 1500);
  assert.ok(refreshGrants() > 0 && passwordGrants() > 0, 'the refresh refused (banned), then its credential refused too');
  assert.equal(credentialInVault(), null, 'so the pairing is forgotten');
});

await check('handed back: holding Caregiver signs a paired phone out and it doesn’t sign itself back in', async () => {
  const { pin, app, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  await app.account.signInPairedPhone();
  await until(() => app.now().status === 'signed-in', 'signed in');
  await settle();
  await remindersWaiting();
  await app.account.signOut();
  assert.equal(app.now().status, 'signed-out');
  assert.equal(credentialInVault(), null, 'the pairing goes with it');
  noReminders();
  const again = await launch();
  await settle(80);
  assert.equal(again.now().status, 'signed-out', 'the welcome, for the caregiver; a new PIN pairs it again');
});

await check('the User ID sign-in still works beside paired phones', async () => {
  const { pin, pair } = await pinAndNewPhone();
  await pair.pairPhone('pat@caregiver.test', pin);
  const { app: caregiver } = await caregiverPhone();
  assert.equal((await caregiver.account.createPersonLogin('rose.m', ROSE_PASSWORD, 'Rose')).ok, true);
  freshPhone('user id phone');
  const app = await launch();
  assert.deepEqual(await app.account.signIn('person', 'rose.m', ROSE_PASSWORD), { ok: true });
  await until(() => app.now().status === 'signed-in', 'signed in');
  assert.equal(app.now().profile.username, 'rose.m');
  await settle();
  assert.equal(credentialInVault(), null, 'no pairing on that phone');
});

await check('the person’s steps: large type, 48pt, one action each, a plain Back, no account detail', () => {
  const steps = inRepo('src/components/sign-in/person-pairing.tsx');
  const screen = inRepo('src/app/sign-in.tsx');
  assert.ok(!/CompactType/.test(steps), 'the person’s own large type and Text size');
  assert.ok(steps.includes('label="Create my account" primary large') && steps.includes('label="Sign in" large'), '"I am practicing" leads to two large, simple options');
  assert.ok(/size="title">\s*Your caregiver’s email/.test(steps) && /keyboardType="email-address"/.test(steps), 'step 1: the email, with the email keyboard');
  assert.ok(/size="title">\s*The PIN from your caregiver/.test(steps) && /keyboardType="number-pad"/.test(steps), 'step 2: the PIN, with the number pad');
  for (const name of ['PairEmail', 'PairPin']) {
    const part = steps.slice(steps.indexOf(`export function ${name}`), steps.indexOf('export function', steps.indexOf(`export function ${name}`) + 10));
    assert.equal(part.match(/<BigButton/g).length, 1, `${name}: one Continue`);
    assert.ok(/<Back /.test(part), `${name}: a plain Back`);
  }
  assert.ok(/minHeight: TAP/.test(steps), 'Back is 48pt');
  assert.ok(/You are all set/.test(steps) && /'all-set': null/.test(screen), '"You are all set", then straight on: no way back to the forms');
  assert.ok(screen.includes("'pair-pin': 'pair-email'") && screen.includes("'pair-email': 'person'") && screen.includes("'person-sign-in': 'person'"), 'each step goes back one');
  assert.ok(!/\.email\b|useAccount|currentProfile|username|personEmail/.test(steps), 'no account detail shown');
  assert.ok(!/Colors\.(pink|accent)\b/.test(steps), 'the neutral palette, nothing red');
});

await check('no password is ever logged, kept on the phone, or shown afterwards', () => {
  const passwords = [PASSWORD, OTHER_PASSWORD, ROSE_PASSWORD, 'violets by the gate', 'a brand new garden path'];
  const kept = [...[...disk.values()], ...[...vault.values()].map((one) => one.value), ...Object.values(phones).flatMap((phone) => [...phone.disk.values(), ...[...phone.vault.values()].map((one) => one.value)])];
  for (const password of passwords) {
    assert.ok(!said.some((line) => line.includes(password)), `"${password}" never reaches the console`);
    assert.ok(!kept.some((value) => String(value).includes(password)), `"${password}" is in no storage on any phone`);
  }
  assert.ok(said.length >= 0 && kept.length > 0, 'the storage was looked at');
  assert.ok(standin.users.every((user) => !Object.values(user).some((value) => passwords.includes(value))), 'the stand-in, like Supabase, keeps only salted hashes');
  // In the code: nothing that logs or stores a password, and no screen that shows one once it is saved.
  const files = ['src/data/account.ts', 'src/lib/auth-form.ts', 'src/lib/session-storage.ts', 'src/lib/supabase.ts', 'src/components/password-field.tsx', 'src/components/caregiver-settings.tsx', 'src/app/sign-in.tsx', 'src/components/sign-in/caregiver-sign-in.tsx', 'src/components/sign-in/caregiver-sign-up.tsx', 'src/components/sign-in/person-sign-in.tsx', 'src/components/sign-in/welcome.tsx'];
  for (const path of files) {
    const code = inRepo(path);
    assert.ok(!/console\.\w+\([^)]*password/i.test(code), `${path} logs no password`);
    assert.ok(!/(AsyncStorage|SecureStore|localStorage)\.\w+\([^)]*password/i.test(code), `${path} stores no password`);
    assert.ok(!/\$\{password\}|\{password\}<|\$\{current\}/.test(code), `${path} never puts a password into words on screen`);
  }
});

console.log(`All ${checks} sign-in checks passed`);
