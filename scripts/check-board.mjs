// The Family board and the two buttons on the person's home (docs/PERSON-HOME-PLAN.md), `npm test`:
//   1. The board's rules (src/lib/family-notes.ts): limits, tidying, order, pinning, initials, Read aloud's words.
//   2. With sign-in on, against the in-memory Supabase (scripts/fakes/): the caregiver adds, edits, pins,
//      unpins and deletes notes, and the person's phone shows each change after a refresh; offline (and
//      after a restart offline) it keeps the last notes; a fourth note is refused by the app and by the
//      server; the person's login can't write; sign-out forgets the copy.
//   3. Where it lives (since 2026-11-18, docs/FAMILY-BOARD-TAB-PLAN.md): the caregiver's Board tab and the
//      person's board screen, which View dashboard opens on every phone; gone from the home and Settings.
//   4. The person's screens: no pink, red, yellow, shadow, rotation, gradient or motion in the board or the
//      buttons; the concept's order; TODAY from their own reminder only; contrast and lightness in normal
//      vision, grayscale, protanopia, deuteranopia and tritanopia; equal 72pt buttons and 56pt targets;
//      Read aloud speaks the note.
//   5. The caregiver's Board tab: the pastels, chip and tab bar's contrast, the tilt from the note's id,
//      the floating menu, Add note and a full board, and the last author remembered and forgotten.
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
  list = notes.editNote(list, 'n2', { body: 'Third, edited', fromName: 'Mae', fromRelationship: 'Granddaughter' }, now).notes;
  assert.equal(notes.orderNotes(list)[1].body, 'Third, edited', 'editing doesn’t move a note');
  assert.equal(notes.deleteNote(list, 'n2').length, 2);
  assert.deepEqual([notes.initialsOf('Ruth'), notes.initialsOf('Ana Lee'), notes.initialsOf('')], ['RU', 'AL', '']);
  assert.equal(notes.fromLine({ fromName: 'Mae', fromRelationship: 'Granddaughter' }), 'Mae · Granddaughter');
  assert.equal(notes.spokenNote({ body: 'Dinner at my place Sunday at 5', fromName: 'Mae', fromRelationship: 'Granddaughter' }), 'Dinner at my place Sunday at 5. From Mae, granddaughter.');
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
  assert.equal(await board.addNote({ body: 'Dinner at my place Sunday at 5.', fromName: 'Mae', fromRelationship: 'Granddaughter' }), undefined);
  await asPerson();
  assert.deepEqual(bodies(), ['Dinner at my place Sunday at 5.'], 'added');
  await asCaregiver();
  const [first] = board.boardNotesNow();
  assert.equal(await board.editNote(first.id, { body: 'Dinner Sunday at 6.', fromName: 'Mae', fromRelationship: 'Granddaughter' }), undefined);
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

// ---- 3. Where the board lives (since 2026-11-18, docs/FAMILY-BOARD-TAB-PLAN.md) ----

await check('the board is its own destination: the caregiver’s Board tab, the person’s board screen; gone from the home and from Settings’ sheet', () => {
  const home = inRepo('src/app/index.tsx');
  const dashboard = inRepo('src/app/caregiver/index.tsx');
  const settings = inRepo('src/components/settings-page.tsx');
  assert.ok(!/<FamilyBoard|<NoteCard|useBoardNotes|refreshBoard/.test(home), 'no board on the person’s home');
  assert.ok(/tab === 'board' \? \(/.test(dashboard) && /<FamilyBoardTab \/>/.test(dashboard), 'the dashboard’s Board tab shows the board');
  assert.ok(!existsSync(`${root}src/components/family-board-editor.tsx`) && !/<Sheet\b/.test(settings.slice(settings.indexOf('The person’s phone'), settings.indexOf('Privacy and data'))), 'the old Settings sheet is gone');
  assert.ok(/<FamilyBoardRow onOpen=\{onOpenBoard\} \/>/.test(settings) && /onOpenBoard=\{\(\) => setTab\('board'\)\}/.test(dashboard), 'one quiet row in Settings jumps to the tab');
  assert.ok(/<Stack\.Screen name="board" options=\{\{ animation: 'fade' \}\} \/>/.test(inRepo('src/app/_layout.tsx')), 'the person’s board is a screen in the person’s group, fading in as the others do');
});

await check('View dashboard on every phone opens the person’s board, never the caregiver’s screens; its words in one constant', async () => {
  const home = inRepo('src/app/index.tsx');
  const buttons = inRepo('src/components/home-buttons.tsx');
  const dashboardFaults = (home, buttons) => [
    ...(/^\s*<ViewDashboardButton onPress=\{\(\) => router\.push\('\/board'\)\} \/>$/m.test(home) ? [] : ['View dashboard isn’t on every phone, or doesn’t open the board']),
    ...(/openCaregiver|confirm\(|LOCAL_ONLY/.test(buttons) ? ['View dashboard reaches the caregiver’s side'] : []),
  ];
  assert.deepEqual(dashboardFaults(home, buttons), []);
  assert.deepEqual(dashboardFaults(home.replace("<ViewDashboardButton onPress={() => router.push('/board')} />", "{LOCAL_ONLY ? <ViewDashboardButton onPress={() => router.push('/board')} /> : null}"), buttons), ['View dashboard isn’t on every phone, or doesn’t open the board'], 'a planted sign-in-off-only button is caught');
  assert.deepEqual(dashboardFaults(home, `${buttons}\nopenCaregiver();`), ['View dashboard reaches the caregiver’s side'], 'a planted way to the dashboard is caught');
  const brand = await import('@/config/brand');
  assert.equal(brand.HOME_BOARD_BUTTON, 'View dashboard');
  assert.ok((buttons.match(/\{HOME_BOARD_BUTTON\}/g) ?? []).length === 2 && !/>\s*View dashboard\s*</.test(buttons), 'the label and the screen reader’s words come from src/config/brand.ts');
});

// ---- 4. The person's screens: the home's buttons and the board ----

/** What a person-screen file must never use: pink, red, yellow, shadows, rotation, gradients, motion. */
function lookFaults(code) {
  const text = code.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
  const faults = [];
  if (/Colors\.(pink\w*|deepRose)|Brand\.(rose|deepRose)|#E8629C|#B0467F|\bred\b|#FF0000/i.test(text)) faults.push('pink or red');
  if (/Colors\.(accent|accentSoft)\b|Brand\.sun|#F7C948|#FCE9B6|yellow/i.test(text)) faults.push('yellow');
  if (/shadow(Color|Opacity|Radius|Offset)|boxShadow|elevation:|\bElevation\b/.test(text)) faults.push('shadow');
  if (/rotate|transform:|noteTilt|board-look/.test(text)) faults.push('rotation');
  if (/gradient/i.test(text)) faults.push('gradient');
  if (/react-native-reanimated|\bAnimated\b|@\/theme\/motion|LayoutAnimation|@\/components\/pressed/.test(text)) faults.push('motion');
  if (/family-board-tab/.test(text)) faults.push('the caregiver’s board');
  return faults;
}
const PERSON_FILES = ['src/components/family-board.tsx', 'src/components/home-buttons.tsx', 'src/app/index.tsx', 'src/app/board.tsx'];

await check('the person’s board and buttons: no pink, red, yellow, shadow, rotation, gradient or motion', () => {
  for (const path of PERSON_FILES) assert.deepEqual(lookFaults(inRepo(path)), [], path);
  const card = inRepo('src/components/family-board.tsx');
  assert.ok(/const FILLS = \[Colors\.surface, Colors\.softSuccess\];/.test(card), 'Mist and Sky-tint cards');
  assert.ok(/card: \{[^}]*borderRadius: RADIUS,\s*borderWidth: StyleSheet\.hairlineWidth,\s*borderColor: Colors\.text,/.test(card), 'the one 16pt radius and an Ink hairline');
  assert.ok(/pinned: \{\s*borderWidth: 2,/.test(card) && /note\.pinned && styles\.pinned/.test(card) && />\s*Pinned\s*</.test(card), 'pinned: the word and a thicker Ink outline, never color alone');
});

await check('each look check fails on a planted fault', () => {
  const card = inRepo('src/components/family-board.tsx');
  const plants = [
    ['a pink card', card.replace('const FILLS = [Colors.surface,', 'const FILLS = [Colors.pink1,'), 'pink or red'],
    ['a yellow card', card.replace('const FILLS = [Colors.surface,', 'const FILLS = [Colors.accentSoft,'), 'yellow'],
    ['a tilted card', card.replace('borderRadius: RADIUS,', "borderRadius: RADIUS,\n    transform: [{ rotate: '-1deg' }],"), 'rotation'],
    ['the caregiver’s tilt', `${card}\nimport { noteTilt } from '@/lib/board-look';`, 'rotation'],
    ['a shadow', card.replace('borderRadius: RADIUS,', 'borderRadius: RADIUS,\n    shadowOpacity: 0.2,'), 'shadow'],
    ['a gradient', `${card}\nimport { LinearGradient } from 'expo-linear-gradient';`, 'gradient'],
    ['motion', `${card}\nimport Animated from 'react-native-reanimated';`, 'motion'],
    ['the caregiver’s press', `${card}\nimport { Pressed } from '@/components/pressed';`, 'motion'],
    ['the caregiver’s board', `${card}\nimport { FamilyBoardTab } from '@/components/family-board-tab';`, 'the caregiver’s board'],
  ];
  for (const [what, code, fault] of plants) assert.ok(lookFaults(code).includes(fault), `${what} is caught`);
});

await check('the person’s board screen: Aa and Hold to open at the top, the header, TODAY, NOTES, View only, and Back to home; one sentence when empty', () => {
  const screen = inRepo('src/app/board.tsx');
  const order = ['<TextSizeButton />', '<CaregiverButton label="Hold to open" />', '<BoardHeader />', '{BOARD_EMPTY}', 'label="Today"', 'label="Notes"', '<ViewOnly />', 'testID="board-back"'];
  const at = order.map((piece) => screen.indexOf(piece));
  assert.ok(at.every((index, i) => index > 0 && (i === 0 || index > at[i - 1])), 'in the concept’s order');
  assert.ok(/\{notes && ordered\.length === 0 \? \(\s*<AppText testID="board-empty" muted>\s*\{BOARD_EMPTY\}/.test(screen) && /\{ordered\.length > 0 \? \(/.test(screen), 'with no notes, the sentence and nothing else: no TODAY, no NOTES, no View only');
  assert.equal(notes.BOARD_EMPTY, 'No notes yet. Your family can leave notes here.');
  assert.equal(notes.VIEW_ONLY, 'View only. New notes from family appear here.');
  assert.ok(/useFocusEffect/.test(screen) && /refreshBoard\(\)/.test(screen) && /AppState\.addEventListener/.test(screen), 'it refreshes on opening and on coming back to the app');
  assert.ok(!/addNote|editNote|deleteNote|pinNote/.test(inRepo('src/components/family-board.tsx') + screen), 'no way to write a note from the person’s screen');
  assert.ok(/label="Back to home" icon="arrow-back"/.test(screen), 'a clearly labelled way back');
});

await check('TODAY is the person’s own daily reminder only: on this phone, never on the caregiver’s side', () => {
  const screen = inRepo('src/app/board.tsx');
  assert.ok(/useReminders\(\)/.test(screen) && /reminders\?\.settings\.on && reminders\.permission === 'granted' && practice && !doneToday\(practice\)/.test(screen), 'shown while the reminder is on, allowed and today isn’t done');
  assert.ok(/<TextSizeSheet visible=\{remindersOpen\}[^\n]*startOn="reminders" \/>/.test(screen), 'a tap opens that reminder');
  assert.ok(!/remind|Today/i.test(inRepo('src/components/family-board-tab.tsx').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'the caregiver’s board never mentions reminders and has no TODAY');
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
/** Every pair the person's home buttons and board use, and its target. */
const PERSON_PAIRS = [
  ['Start practice: white on Ink', Colors.onPrimary, Colors.primary, 7],
  ['View dashboard: Ink on Sky', Colors.text, Colors.sky, 7],
  ['the two buttons’ backgrounds', Colors.primary, Colors.sky, 3],
  ['View dashboard’s Ink outline on the page', Colors.text, Colors.background, 3],
  ['a note: Ink on Mist', Colors.text, Colors.surface, 7],
  ['a note: Ink on the Sky tint', Colors.text, Colors.softSuccess, 7],
  ['From’s relationship: muted on Mist', Colors.textMuted, Colors.surface, 4.5],
  ['From’s relationship: muted on the Sky tint', Colors.textMuted, Colors.softSuccess, 4.5],
  ['Read aloud: Ink on white', Colors.text, Colors.background, 7],
  ['the initials: Ink on Sky', Colors.text, Colors.sky, 7],
  ['TODAY’s Ink dot on Mist', Colors.text, Colors.surface, 3],
  ['the section labels: muted on white', Colors.textMuted, Colors.background, 4.5],
];
/** The caregiver's pastels: every word 4.5:1, every icon and edge 3:1. */
const CAREGIVER_PAIRS = [
  ['the pinned note: Ink on the sun tint', Colors.text, Colors.accentSoft, 4.5],
  ['a note: Ink on the rose tint', Colors.text, Colors.pink1, 4.5],
  ['a note: Ink on the sky tint', Colors.text, Colors.softSuccess, 4.5],
  ['the relationship: muted on the sun tint', Colors.textMuted, Colors.accentSoft, 4.5],
  ['the relationship: muted on the rose tint', Colors.textMuted, Colors.pink1, 4.5],
  ['the relationship: muted on the sky tint', Colors.textMuted, Colors.softSuccess, 4.5],
  ['the initials: Ink on Sun', Colors.text, Colors.accent, 4.5],
  ['the initials: Ink on the deeper rose', Colors.text, Colors.pink2, 4.5],
  ['the initials: Ink on Sky', Colors.text, Colors.sky, 4.5],
  ['the Caregiver chip: Deep Rose on the palest rose', Colors.deepRose, Colors.pinkTint, 4.5],
  ['Add note: white on Ink', Colors.onPrimary, Colors.primary, 4.5],
  ['Read aloud: Ink on white', Colors.text, Colors.background, 4.5],
  ['the pin and the "···": Ink on the sun tint', Colors.text, Colors.accentSoft, 3],
  ['the chosen tab: Deep Rose on white', Colors.deepRose, Colors.background, 4.5],
  ['the chosen tab’s Rose bar on white', Colors.pinkDeep, Colors.background, 3],
  ['an unchosen tab: muted on white', Colors.textMuted, Colors.background, 4.5],
];
const colorFaults = (pairs, visions = MATRICES) => pairs.flatMap(([what, a, b, target]) => Object.entries(visions).filter(([, matrix]) => ratio(a, b, matrix) < target).map(([vision]) => `${what} (${vision} ${ratio(a, b, MATRICES[vision]).toFixed(2)})`));

await check('the person’s buttons and notes pass their contrast and lightness targets, in grayscale and three kinds of color blindness', () => {
  assert.deepEqual(colorFaults(PERSON_PAIRS), []);
  const buttons = inRepo('src/components/home-buttons.tsx');
  assert.ok(/start: \{\s*backgroundColor: Colors\.primary/.test(buttons) && /dashboard: \{\s*borderWidth: 2,\s*borderColor: Colors\.text,\s*backgroundColor: Colors\.sky/.test(buttons), 'the buttons use exactly these colors');
  assert.ok(/name="play"/.test(buttons) && /name="grid-outline"/.test(buttons), 'and each its own icon');
  for (const matrix of Object.values(MATRICES)) assert.ok(Math.abs(luminance(Colors.primary, matrix) - luminance(Colors.sky, matrix)) > 0.3, 'the buttons differ in lightness, not only hue');
});

await check('the caregiver’s pastels, chip and tab bar pass 4.5:1 for words and 3:1 for icons', () => {
  assert.deepEqual(colorFaults(CAREGIVER_PAIRS, { normal: MATRICES.normal, grayscale: MATRICES.grayscale }), []);
});

await check('the color checks fail on a planted low-contrast button and two look-alike backgrounds', () => {
  assert.equal(colorFaults([['muted words on Sky', Colors.textMuted, Colors.sky, 7]]).length, 5, 'muted words on Sky fail 7:1 in every vision');
  assert.ok(colorFaults([['Sky beside its soft tint', Colors.sky, Colors.skySoft, 3]]).length > 0, 'two light blues side by side fail 3:1');
  assert.ok(colorFaults([['Rose words on white', Colors.pinkDeep, Colors.background, 4.5]]).length > 0, 'Rose as words would be caught');
});

await check('targets: both home buttons 72pt and equal, Read aloud, TODAY and Back at least 56pt', async () => {
  const buttons = inRepo('src/components/home-buttons.tsx');
  const height = Number(/HOME_BUTTON_HEIGHT = (\d+)/.exec(buttons)[1]);
  const targetFaults = (heights) => Object.entries(heights).filter(([, value]) => value < 56).map(([what]) => what);
  assert.equal(height, 72);
  assert.ok(/button: \{[^}]*minHeight: HOME_BUTTON_HEIGHT,[^}]*borderRadius: RADIUS,/.test(buttons) && !/start: \{[^}]*minHeight|dashboard: \{[^}]*minHeight/.test(buttons), 'one height and one corner for both');
  assert.equal((buttons.match(/<AppText fit bold size="title"/g) ?? []).length, 2, 'and the same size of words');
  const layout = await import('@/theme/layout');
  const card = inRepo('src/components/family-board.tsx');
  assert.ok(/readAloud: \{[^}]*minHeight: PERSON_TOUCH,/.test(card) && /todayRow: \{[^}]*minHeight: PERSON_TOUCH \+ Space\.l,/.test(card), 'Read aloud and the TODAY row are drawn at least 56pt tall');
  assert.deepEqual(targetFaults({ home: height, readAloud: layout.PERSON_TOUCH, back: 64 }), []);
  assert.ok(/minHeight: 64,/.test(inRepo('src/components/big-button.tsx')), 'Back to home is a person’s BigButton, 64pt');
  assert.deepEqual(targetFaults({ planted: 40 }), ['planted'], 'a planted 40pt target is caught');
});

await check('Read aloud speaks the note with the app’s own read-aloud, on both sides', async () => {
  for (const path of ['src/components/family-board.tsx', 'src/components/family-board-tab.tsx']) {
    const card = inRepo(path);
    assert.ok(/onPress=\{\(\) => speak\(spokenNote\(note\)\)\}/.test(card) && /from '@\/lib\/speak'/.test(card), `${path}: the button calls the app’s speak with the note’s words`);
  }
  const { speak } = await import('@/lib/speak');
  speak(notes.spokenNote({ body: 'Proud of you for practicing every day', fromName: 'Ruth', fromRelationship: 'Wife' }));
  assert.deepEqual(spoken.at(-1).text, 'Proud of you for practicing every day. From Ruth, wife.');
});

// ---- 5. The caregiver's Board tab ----

await check('the caregiver’s cards: sun for the pinned, then rose and sky in turn, from the brand’s tokens', async () => {
  const look = await import('@/lib/board-look');
  const tab = inRepo('src/components/family-board-tab.tsx');
  assert.deepEqual(look.cardTones([{ pinned: true }, { pinned: false }, { pinned: false }]), ['sun', 'rose', 'sky']);
  assert.deepEqual(look.cardTones([{ pinned: false }, { pinned: false }, { pinned: false }]), ['rose', 'sky', 'rose']);
  assert.ok(/sun: \{ card: Colors\.accentSoft, avatar: Colors\.accent \}/.test(tab) && /rose: \{ card: Colors\.pink1, avatar: Colors\.pink2 \}/.test(tab) && /sky: \{ card: Colors\.softSuccess, avatar: Colors\.sky \}/.test(tab), 'each pastel and its deeper circle from the palette');
  assert.ok(/const CARD_RADIUS = 20;/.test(tab) && /borderRadius: CARD_RADIUS - MENU_INSET/.test(tab), 'radius 20, and what sits inside its corner is concentric');
  assert.ok(/backgroundColor: Colors\.pinkTint/.test(tab) && /color=\{Colors\.deepRose\}>\s*Caregiver/.test(tab), 'the Caregiver chip: Deep Rose on the palest rose');
  assert.ok(/textTransform: 'uppercase'/.test(tab) && /<SectionLabel>Notes<\/SectionLabel>/.test(tab), 'NOTES: upper case on screen only');
});

/** A tilt must be slight, never zero, and come from the note's id alone. */
function tiltFaults(tilt) {
  const ids = ['a1', 'b2', 'c3', 'note-4', '0f6e2c1a-7b8d-4e2f-9a3b-5c6d7e8f9a0b', 'z'];
  const faults = [];
  if (ids.some((id) => tilt(id) !== tilt(id))) faults.push('changes between renders');
  if (ids.some((id) => Math.abs(tilt(id)) > 1.0001)) faults.push('more than 1°');
  if (ids.some((id) => Math.abs(tilt(id)) < 0.3)) faults.push('looks accidentally straight');
  if (new Set(ids.map(tilt)).size < 3) faults.push('every card the same');
  return faults;
}
await check('the caregiver’s tilt: about 1°, from the note’s id, the same every time; a planted random or steep tilt is caught', async () => {
  const look = await import('@/lib/board-look');
  assert.deepEqual(tiltFaults(look.noteTilt), []);
  assert.ok(/rotate: `\$\{noteTilt\(note\.id\)\}deg`/.test(inRepo('src/components/family-board-tab.tsx')), 'each card turns by its own id');
  assert.ok(tiltFaults(() => Math.random() * 2 - 1).includes('changes between renders'), 'a random tilt is caught');
  assert.ok(tiltFaults((id) => look.noteTilt(id) * 4).includes('more than 1°'), 'a steep tilt is caught');
  assert.ok(tiltFaults(() => 0).includes('looks accidentally straight'), 'no tilt is caught');
});

/** The editor's note menu floats: one open at a time, laid over the cards, never pushing them down. */
const menuFaults = (editor) => [
  ...(/menuList: \{\s*position: 'absolute',/.test(editor) ? [] : ['the menu sits in the card and pushes it taller']),
  ...(/useState<string \| null>\(null\)/.test(editor) && /menuOpen=\{menuFor === note\.id\}/.test(editor) ? [] : ['more than one menu can be open']),
  ...(/menuOpen && styles\.raised/.test(editor) && /cardTop: \{[^}]*zIndex: 1,/.test(editor) ? [] : ['the open card isn’t raised over the next']),
];
await check('the note menu floats over the cards, one at a time, with Edit, Pin and a confirmed Delete', () => {
  const tab = inRepo('src/components/family-board-tab.tsx');
  assert.deepEqual(menuFaults(tab), []);
  assert.deepEqual(menuFaults(tab.replace("menuList: {\n    position: 'absolute',", 'menuList: {')), ['the menu sits in the card and pushes it taller'], 'a planted inline menu is caught');
  assert.ok(/'note-edit'/.test(tab) && /note\.pinned \? 'Unpin' : 'Pin to top'/.test(tab) && /confirm\('Delete this note\?'/.test(tab), 'Edit, Pin to top or Unpin, and Delete after a confirmation');
});

await check('Add note floats above the tab bar; a full board says so in place, and the sheet fills in the last author', () => {
  const tab = inRepo('src/components/family-board-tab.tsx');
  assert.ok(/addArea: \{\s*position: 'absolute',\s*bottom: Space\.m,/.test(tab) && /tone=\{\[Colors\.primary, Colors\.primaryDark\]\}/.test(tab), 'an Ink pill floating above the bar');
  assert.ok(/if \(full\) \{\s*setFullNote\(true\);\s*return;\s*\}/.test(tab) && /\{fullNote && full \? \(/.test(tab) && /\{BOARD_FULL\}/.test(tab), 'a tap on a full board shows the friendly line, and opens nothing');
  assert.ok(/draft: \{ body: '', \.\.\.\(await lastAuthor\(\)\) \}/.test(tab) && /await rememberAuthor\(draft\);/.test(tab), 'the last author fills in, and saving remembers it');
  assert.ok(/maxLength=\{NOTE_LETTERS\}/.test(tab) && /`\$\{draft\.body\.length\} of \$\{NOTE_LETTERS\}`/.test(tab) && (tab.match(/maxLength=\{FROM_LETTERS\}/g) ?? []).length === 2, 'the 200 counter, and From and Relationship at 40');
});

await check('the last author: kept per caregiver on this phone, read back, cut to 40 letters, and forgotten at sign-out', async () => {
  who.role = 'caregiver';
  const author = await import('@/data/board-author');
  assert.deepEqual(await author.lastAuthor(), {}, 'nothing before the first note');
  await author.rememberAuthor({ fromName: '  Mae ', fromRelationship: 'Granddaughter' });
  assert.ok(disk.has(`tandem.boardAuthor.v1.${CAREGIVER}`));
  assert.deepEqual(await author.lastAuthor(), { fromName: 'Mae', fromRelationship: 'Granddaughter' });
  await author.rememberAuthor({ fromName: 'x'.repeat(60) });
  assert.deepEqual(await author.lastAuthor(), { fromName: 'x'.repeat(40) }, 'never longer than the field');
  await author.forgetAuthor(CAREGIVER);
  assert.ok(!disk.has(`tandem.boardAuthor.v1.${CAREGIVER}`));
  assert.ok(/forgetAuthor\(profile\.id\)/.test(inRepo('src/data/forget.ts')), 'every sign-out runs it');
  assert.ok(/`tandem\.boardAuthor\.v1\.<caregiver id>`/.test(inRepo('docs/DATA-INVENTORY.md')), 'the data inventory names it');
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
