// The Family board and the two buttons on the person's home (docs/PERSON-HOME-PLAN.md), `npm test`:
//   1. The board's rules (src/lib/family-notes.ts): limits, tidying, order, pinning, initials, Read aloud's words.
//   2. With sign-in on, against the in-memory Supabase (scripts/fakes/): the caregiver adds, edits, pins,
//      unpins and deletes notes, and the person's phone shows each change after a refresh; offline (and
//      after a restart offline) it keeps the last notes; a fourth note is refused by the app and by the
//      server; the person's login can't write; sign-out forgets the copy.
//   3. The person's screen: no pink, red, yellow, shadow, rotation, gradient or motion in the board or the
//      buttons; contrast and lightness in normal vision, grayscale, protanopia, deuteranopia and tritanopia;
//      56pt targets; Read aloud speaks the note.
// Each look and color check is shown to fail on a planted fault. supabase/tests/rls.test.mjs checks the
// database's rules (other families, signed-out users, the person, the limit, Delete account).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const src = `${root}src/`;
const fake = (file) => new URL(`./fakes/${file}`, import.meta.url).href;
const spoken = [];
const FAKES = {
  '@/lib/supabase': fake('supabase.mjs'),
  '@/data/account': fake('account.mjs'),
  'expo-crypto': fake('native.mjs'),
  '@react-native-async-storage/async-storage': fake('storage.mjs'),
};
registerHooks({
  resolve(specifier, context, next) {
    if (FAKES[specifier]) return next(FAKES[specifier], context);
    if (specifier === 'react' && /board-store\.ts/.test(context.parentURL ?? '')) return next(fake('react-store.mjs'), context);
    if (specifier === 'expo-speech') return next('data:text/javascript,export const speak = (text, options) => globalThis.__spoken.push({ text, options }); export const stop = () => {};', context);
    if (specifier.startsWith('@/')) return next(pathToFileURL(`${src}${specifier.slice(2)}.ts`).href, context);
    if (specifier.startsWith('.') && context.parentURL?.includes('.ts')) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
});
globalThis.__spoken = spoken;

const inRepo = (path) => readFileSync(`${root}${path}`, 'utf8');
let passed = 0;
const check = async (name, run) => {
  await run();
  passed += 1;
  console.log(`PASS  ${name}`);
};

const notes = await import('@/lib/family-notes');
const { server } = await import('./fakes/supabase.mjs');
const { who, CAREGIVER, PERSON } = await import('./fakes/account.mjs');
const { disk } = await import('./fakes/storage.mjs');
const now = new Date('2026-11-18T09:00:00Z');

// ---- 1. The rules ----

await check('the board’s rules: 3 notes, 200 letters, From optional, one pinned and shown first', () => {
  assert.equal(notes.NOTES_MOST, 3);
  assert.equal(notes.NOTE_LETTERS, 200);
  assert.equal(notes.noteProblem({ body: '   ' }), 'Write a few words first.');
  assert.equal(notes.noteProblem({ body: 'a'.repeat(200) }), undefined, '200 letters fit');
  assert.match(notes.noteProblem({ body: 'a'.repeat(201) }), /200 letters at most/);
  assert.match(notes.noteProblem({ body: 'Hi', fromName: 'x'.repeat(41) }), /40 letters/);
  assert.deepEqual(notes.tidyNote({ body: '  Dinner   Sunday ', fromName: '  ', fromRelationship: ' Daughter ' }), { body: 'Dinner Sunday', fromRelationship: 'Daughter' });
  let list = [];
  for (const [i, body] of ['First', 'Second', 'Third'].entries()) list = notes.addNote(list, { body }, `n${i}`, new Date(now.getTime() + i * 60_000)).notes;
  assert.deepEqual(notes.orderNotes(list).map((note) => note.body), ['Third', 'Second', 'First'], 'newest first');
  const fourth = notes.addNote(list, { body: 'Fourth' }, 'n3', now);
  assert.equal(fourth.problem, notes.BOARD_FULL, 'a fourth note is refused');
  assert.equal(fourth.notes.length, 3);
  list = notes.pinNote(list, 'n0', now);
  assert.deepEqual(notes.orderNotes(list).map((note) => note.body), ['First', 'Third', 'Second'], 'the pinned note first');
  list = notes.pinNote(list, 'n1', now);
  assert.deepEqual(list.filter((note) => note.pinned).map((note) => note.id), ['n1'], 'pinning another unpins the first');
  list = notes.editNote(list, 'n2', { body: 'Third, edited', fromName: 'Mikayla', fromRelationship: 'Daughter' }, now).notes;
  assert.equal(notes.orderNotes(list)[1].body, 'Third, edited', 'editing doesn’t move a note');
  assert.equal(notes.deleteNote(list, 'n2').length, 2);
  assert.deepEqual([notes.initialsOf('Mikayla'), notes.initialsOf('Mary Kate'), notes.initialsOf('')], ['MI', 'MK', '']);
  assert.equal(notes.fromLine({ fromName: 'Mikayla', fromRelationship: 'Daughter' }), 'Mikayla · Daughter');
  assert.equal(notes.spokenNote({ body: 'Dinner at my place Sunday at 5', fromName: 'Mikayla', fromRelationship: 'Daughter' }), 'Dinner at my place Sunday at 5. From Mikayla, daughter.');
  assert.equal(notes.spokenNote({ body: 'Love you always!' }), 'Love you always!');
});

/** What a board may hold. A check of its own, so a planted fourth note or a second pin shows it fails. */
const boardFaults = (list) => [
  ...(list.length > notes.NOTES_MOST ? [`${list.length} notes`] : []),
  ...(list.filter((note) => note.pinned).length > 1 ? ['two pinned'] : []),
  ...list.filter((note) => note.body.length > notes.NOTE_LETTERS).map(() => 'a long note'),
];
await check('a planted fourth note, a second pin and a long note are caught', () => {
  const three = ['a', 'b', 'c'].map((id) => ({ id, body: id, pinned: false, createdAt: '', updatedAt: '' }));
  assert.deepEqual(boardFaults(three), []);
  assert.deepEqual(boardFaults([...three, { ...three[0], id: 'd' }]), ['4 notes']);
  assert.deepEqual(boardFaults(three.map((note) => ({ ...note, pinned: true })).slice(0, 2)), ['two pinned']);
  assert.deepEqual(boardFaults([{ ...three[0], body: 'x'.repeat(201) }]), ['a long note']);
});

// ---- 2. Sign-in on: the caregiver writes, the person's phone shows it after a refresh ----

const board = await import('@/data/board-store');
const bodies = () => notes.orderNotes(board.boardNotesNow() ?? []).map((note) => `${note.pinned ? '📌' : ''}${note.body}`);
const asPerson = async () => {
  await board.forgetBoard(CAREGIVER);
  who.role = 'person';
  board.useBoard();
  await board.refreshBoard();
};
const asCaregiver = async () => {
  await board.forgetBoard(PERSON);
  who.role = 'caregiver';
  board.useBoard();
  await board.refreshBoard();
};

await check('the caregiver adds, edits, pins, unpins and deletes, and the person’s phone shows each after a refresh', async () => {
  await asCaregiver();
  assert.equal(await board.addNote({ body: 'Dinner at my place Sunday at 5.', fromName: 'Mikayla', fromRelationship: 'Daughter' }), undefined);
  await asPerson();
  assert.deepEqual(bodies(), ['Dinner at my place Sunday at 5.'], 'added');
  await asCaregiver();
  const [first] = board.boardNotesNow();
  assert.equal(await board.editNote(first.id, { body: 'Dinner Sunday at 6.', fromName: 'Mikayla', fromRelationship: 'Daughter' }), undefined);
  assert.equal(await board.addNote({ body: 'Lake photos this weekend?' }), undefined);
  await asPerson();
  assert.deepEqual(bodies(), ['Lake photos this weekend?', 'Dinner Sunday at 6.'], 'edited, and the newest first');
  await asCaregiver();
  assert.equal(await board.pinNote(first.id), undefined);
  await asPerson();
  assert.deepEqual(bodies(), ['📌Dinner Sunday at 6.', 'Lake photos this weekend?'], 'pinned on top');
  await asCaregiver();
  const second = board.boardNotesNow().find((note) => note.body.startsWith('Lake'));
  assert.equal(await board.pinNote(second.id), undefined);
  assert.deepEqual(bodies(), ['📌Lake photos this weekend?', 'Dinner Sunday at 6.'], 'pinning another unpins the first');
  assert.equal(await board.pinNote(null), undefined);
  assert.equal(await board.deleteNote(first.id), undefined);
  await asPerson();
  assert.deepEqual(bodies(), ['Lake photos this weekend?'], 'unpinned and deleted');
  assert.ok(server.tables.family_notes.every((row) => row.caregiver_id === CAREGIVER), 'every note is the family’s');
});

await check('a fourth note is refused by the app before anything is sent, and by the server', async () => {
  await asCaregiver();
  assert.equal(await board.addNote({ body: 'Second note' }), undefined);
  assert.equal(await board.addNote({ body: 'Third note' }), undefined);
  const sent = server.log.length;
  assert.equal(await board.addNote({ body: 'A fourth note' }), notes.BOARD_FULL, 'the app refuses');
  assert.ok(!server.log.slice(sent).some((entry) => entry.table === 'family_notes' && entry.action === 'insert'), 'and sends nothing');
  // The server refuses one too: here the board on the phone is out of date (it shows two), and the server has three.
  const real = server.tables.family_notes;
  server.tables.family_notes = real.slice(0, 2);
  await board.refreshBoard();
  server.tables.family_notes = real;
  assert.equal(await board.addNote({ body: 'A fourth note' }), notes.BOARD_FULL, 'the server’s refusal reads the same calm words');
  assert.equal(server.tables.family_notes.length, 3);
  assert.equal(server.tables.family_notes.filter((row) => row.body === 'A fourth note').length, 0);
});

await check('the person’s login only reads: every change is refused before it is sent', async () => {
  await asPerson();
  for (const change of [() => board.addNote({ body: 'x' }), () => board.editNote('x', { body: 'x' }), () => board.deleteNote('x'), () => board.pinNote(null)]) {
    await assert.rejects(change(), /Only the caregiver/);
  }
});

await check('offline the person’s phone keeps the last notes, after a restart too', async () => {
  await asPerson();
  const before = bodies();
  assert.ok(before.length === 3 && disk.has(`tandem.board.v1.${PERSON}`), 'a copy is kept on the phone');
  server.offline = true;
  await board.refreshBoard();
  assert.deepEqual(bodies(), before, 'a failed refresh keeps them');
  const restarted = await import(`${pathToFileURL(`${src}data/board-store.ts`).href}?restart`);
  restarted.useBoard();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(notes.orderNotes(restarted.boardNotesNow() ?? []).map((note) => `${note.pinned ? '📌' : ''}${note.body}`), before, 'and opening the app offline shows them from the copy');
  server.offline = false;
});

await check('signing out forgets the copy on the phone', async () => {
  await board.forgetBoard(PERSON);
  assert.ok(!disk.has(`tandem.board.v1.${PERSON}`) && board.boardNotesNow() === undefined);
  assert.ok(/forgetBoard\(profile\.id\)/.test(inRepo('src/data/forget.ts')), 'every sign-out runs it');
});

// ---- 3. The person's screen ----

/** What a person-screen file must never use: pink, red, yellow, shadows, rotation, gradients, motion. */
function lookFaults(code) {
  const text = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const faults = [];
  if (/Colors\.(pink\w*|deepRose)|Brand\.(rose|deepRose)|#E8629C|#B0467F|\bred\b|#FF0000/i.test(text)) faults.push('pink or red');
  if (/Colors\.(accent|accentSoft)|Brand\.sun|#F7C948|#FCE9B6|yellow/i.test(text)) faults.push('yellow');
  if (/shadow(Color|Opacity|Radius|Offset)|boxShadow|elevation:|\bElevation\b/.test(text)) faults.push('shadow');
  if (/rotate|transform:/.test(text)) faults.push('rotation');
  if (/gradient/i.test(text)) faults.push('gradient');
  if (/react-native-reanimated|\bAnimated\b|@\/theme\/motion|LayoutAnimation/.test(text)) faults.push('motion');
  return faults;
}
const PERSON_FILES = ['src/components/family-board.tsx', 'src/components/home-buttons.tsx', 'src/app/index.tsx'];

await check('the board and the buttons: no pink, red, yellow, shadow, rotation, gradient or motion', () => {
  for (const path of PERSON_FILES) assert.deepEqual(lookFaults(inRepo(path)), [], path);
  const card = inRepo('src/components/family-board.tsx');
  assert.ok(/backgroundColor: Colors\.surface/.test(card) && /pinned: \{\s*backgroundColor: Colors\.softSuccess/.test(card), 'Mist cards, the pinned one in the Sky tint');
  assert.ok(/borderRadius: RADIUS/.test(card), 'the one 16pt radius');
});

await check('each look check fails on a planted fault', () => {
  const card = inRepo('src/components/family-board.tsx');
  const plants = [
    ['a pink card', card.replace('backgroundColor: Colors.surface,', 'backgroundColor: Colors.pink1,'), 'pink or red'],
    ['a yellow card', card.replace('backgroundColor: Colors.surface,', 'backgroundColor: Colors.accentSoft,'), 'yellow'],
    ['a rotated card', card.replace('borderRadius: RADIUS,', "borderRadius: RADIUS,\n    transform: [{ rotate: '-2deg' }],"), 'rotation'],
    ['a shadow', card.replace('borderRadius: RADIUS,', 'borderRadius: RADIUS,\n    shadowOpacity: 0.2,'), 'shadow'],
    ['a gradient', `${card}\nimport { LinearGradient } from 'expo-linear-gradient';`, 'gradient'],
    ['motion', `${card}\nimport Animated from 'react-native-reanimated';`, 'motion'],
  ];
  for (const [what, code, fault] of plants) assert.ok(lookFaults(code).includes(fault), `${what} is caught`);
});

// Color: WCAG contrast, and Machado et al. (2009, severity 1) for color blindness, in linear RGB.
const { Colors } = await import('@/theme/colors');
const MATRICES = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  grayscale: [[0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const linear = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
const luminance = (hex, matrix) => {
  const c = linear(hex);
  const [r, g, b] = matrix.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b, matrix) => {
  const [x, y] = [luminance(a, matrix), luminance(b, matrix)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Every pair the home's buttons and board use, and its target. */
const COLOR_PAIRS = [
  ['Start practice: white on Ink', Colors.onPrimary, Colors.primary, 7],
  ['View dashboard: Ink on Sky', Colors.text, Colors.sky, 7],
  ['the two buttons’ backgrounds', Colors.primary, Colors.sky, 3],
  ['View dashboard’s Ink outline on the page', Colors.text, Colors.background, 3],
  ['a note: Ink on Mist', Colors.text, Colors.surface, 7],
  ['the pinned note: Ink on the Sky tint', Colors.text, Colors.softSuccess, 7],
  ['From’s relationship: muted on Mist', Colors.textMuted, Colors.surface, 4.5],
  ['From’s relationship: muted on the Sky tint', Colors.textMuted, Colors.softSuccess, 4.5],
  ['Read aloud: Ink on white', Colors.text, Colors.background, 7],
  ['the initials: Ink on Sky', Colors.text, Colors.sky, 7],
];
const colorFaults = (pairs) => pairs.flatMap(([what, a, b, target]) => Object.entries(MATRICES).filter(([, matrix]) => ratio(a, b, matrix) < target).map(([vision]) => `${what} (${vision} ${ratio(a, b, MATRICES[vision]).toFixed(2)})`));

await check('the buttons and notes pass their contrast and lightness targets, in grayscale and three kinds of color blindness', () => {
  assert.deepEqual(colorFaults(COLOR_PAIRS), []);
  const buttons = inRepo('src/components/home-buttons.tsx');
  assert.ok(/start: \{[^}]*backgroundColor: Colors\.primary/.test(buttons) && /dashboard: \{[^}]*borderColor: Colors\.text,\s*backgroundColor: Colors\.sky/.test(buttons), 'the buttons use exactly these colors');
  assert.ok(/name="play"/.test(buttons) && /name="grid-outline"/.test(buttons), 'and each its own icon');
  for (const [, [a, b]] of Object.entries({ x: [Colors.primary, Colors.sky] })) {
    for (const matrix of Object.values(MATRICES)) assert.ok(Math.abs(luminance(a, matrix) - luminance(b, matrix)) > 0.3, 'the buttons differ in lightness, not only hue');
  }
});

await check('the color checks fail on a planted low-contrast button and two look-alike backgrounds', () => {
  assert.equal(colorFaults([['muted words on Sky', Colors.textMuted, Colors.sky, 7]]).length, 5, 'muted words on Sky fail 7:1 in every vision');
  assert.ok(colorFaults([['Sky beside its soft tint', Colors.sky, Colors.skySoft, 3]]).length > 0, 'two light blues side by side fail 3:1');
  assert.ok(colorFaults([['white on Sky', Colors.onPrimary, Colors.sky, 7]]).length > 0);
});

await check('targets: Start practice the tallest, View dashboard and Read aloud at least 56pt', async () => {
  const text = inRepo('src/components/home-buttons.tsx');
  const start = Number(/START_HEIGHT = (\d+)/.exec(text)[1]);
  const dashboard = Number(/DASHBOARD_HEIGHT = (\d+)/.exec(text)[1]);
  const targetFaults = (heights) => Object.entries(heights).filter(([, height]) => height < 56).map(([what]) => what);
  assert.deepEqual(targetFaults({ start, dashboard }), []);
  assert.ok(start > dashboard, 'Start practice is the largest');
  const layout = await import('@/theme/layout');
  assert.ok(layout.TAP + 2 * layout.touchSlop() >= 56 && /hitSlop=\{touchSlop\(\)\}/.test(inRepo('src/components/family-board.tsx')), 'Read aloud is 48pt drawn, 56pt to touch');
  assert.deepEqual(targetFaults({ planted: 40 }), ['planted'], 'a planted 40pt target is caught');
});

await check('Read aloud speaks the note with the app’s own read-aloud', async () => {
  const card = inRepo('src/components/family-board.tsx');
  assert.ok(/onPress=\{\(\) => speak\(spokenNote\(note\)\)\}/.test(card) && /from '@\/lib\/speak'/.test(card), 'the button calls the app’s speak with the note’s words');
  const { speak } = await import('@/lib/speak');
  speak(notes.spokenNote({ body: 'Proud of you for practicing every day', fromName: 'Lucy', fromRelationship: 'Wife' }));
  assert.deepEqual(spoken.at(-1).text, 'Proud of you for practicing every day. From Lucy, wife.');
});

/** View dashboard must show only where it opens the caregiver's dashboard (sign-in off), never on the person's own phone. */
const dashboardFaults = (home, buttons) => [
  ...(/\{LOCAL_ONLY \? <ViewDashboardButton \/> : null\}/.test(home) ? [] : ['View dashboard isn’t limited to sign-in off']),
  ...(/<Sheet\b|explaining|LOCAL_ONLY/.test(buttons.slice(buttons.indexOf('export function ViewDashboardButton'))) ? ['View dashboard has a path that only explains'] : []),
];
await check('View dashboard only where it opens the dashboard: never on the person’s own phone', () => {
  const home = inRepo('src/app/index.tsx');
  const buttons = inRepo('src/components/home-buttons.tsx');
  assert.deepEqual(dashboardFaults(home, buttons), []);
  assert.ok(/confirm\('Open the caregiver dashboard\?'/.test(buttons) && /openCaregiver\(\)/.test(buttons), 'it asks first, then opens the dashboard');
  assert.deepEqual(dashboardFaults(home.replace('{LOCAL_ONLY ? <ViewDashboardButton /> : null}', '<ViewDashboardButton />'), buttons), ['View dashboard isn’t limited to sign-in off'], 'a planted button on every phone is caught');
  assert.ok(/centered/.test(home) && /!notes\?\.length && styles\.centered/.test(home), 'with no notes the column is centered, so the home doesn’t look half empty');
});

await check('the home: Start practice first, then View dashboard, then the board; and the board hides without notes', () => {
  const home = inRepo('src/app/index.tsx');
  assert.ok(home.indexOf('<StartPracticeButton') < home.indexOf('<ViewDashboardButton') && home.indexOf('<ViewDashboardButton') < home.indexOf('<FamilyBoard'));
  assert.ok(/if \(notes\.length === 0\) return null;/.test(inRepo('src/components/family-board.tsx')));
  assert.ok(/refreshBoard\(\);/.test(home) && /AppState\.addEventListener/.test(home), 'it refreshes on opening and on coming back to the app');
  assert.ok(!/addNote|editNote|deleteNote|pinNote/.test(inRepo('src/components/family-board.tsx') + home), 'no way to write a note from the person’s screen');
  assert.ok(/from '@\/components\/family-board-editor'/.test(inRepo('src/components/settings-page.tsx')), 'the editor lives in Settings');
});

/** Two buttons side by side must differ by icon and words, not only by where they sit. */
function lookAlikeFaults(code, ids) {
  const buttons = ids.map((id) => new RegExp(`<BigButton testID="${id}"[^>]*>`).exec(code)?.[0] ?? '');
  const icons = buttons.map((tag) => /icon="([^"]+)"/.exec(tag)?.[1]);
  const labels = buttons.map((tag) => /label="([^"]+)"/.exec(tag)?.[1]);
  return [
    ...(icons.some((icon) => !icon) ? ['a button without an icon'] : []),
    ...(new Set(icons).size < icons.length ? ['the same icon twice'] : []),
    ...(new Set(labels).size < labels.length ? ['the same words twice'] : []),
  ];
}
await check('Reminders: Earlier and Later differ by an arrow icon and words, not only by place', () => {
  const reminders = inRepo('src/components/reminders.tsx');
  assert.deepEqual(lookAlikeFaults(reminders, ['reminder-earlier', 'reminder-later']), []);
  assert.ok(/<BigButton testID="reminder-earlier" label="Earlier" icon="arrow-back"/.test(reminders) && /<BigButton testID="reminder-later" label="Later" icon="arrow-forward"/.test(reminders));
  const button = inRepo('src/components/big-button.tsx');
  assert.ok(/icon \? <Ionicons name=\{icon\}/.test(button.slice(button.indexOf('  return (\n    <Pressable'))), 'the person’s BigButton draws the icon, in the words’ color');
  assert.deepEqual(lookAlikeFaults(reminders.replace('icon="arrow-forward"', 'icon="arrow-back"'), ['reminder-earlier', 'reminder-later']), ['the same icon twice'], 'a planted look-alike pair is caught');
  assert.deepEqual(lookAlikeFaults(reminders.replace(' icon="arrow-back"', ''), ['reminder-earlier', 'reminder-later']), ['a button without an icon']);
});

console.log(`\nAll ${passed} board checks passed`);
