// Proves scripts/check-no-real-data.mjs works, with an invented word in a temporary denylist (never your
// real one, which this never reads):
//   node scripts/check-no-real-data.test.mjs
// It fails once a denylisted word is planted (in a new file, as an id, in a bundle), never printing the
// word, passes again once it is gone, warns and passes without a denylist, honours =exact entries, and
// fails on a photo tracked under assets/photos/ (staged in a temporary git index, so your real index is
// never touched). Everything planted is removed, even when a check fails.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'evermore-denylist-'));
// Invented, and made at run time, so this file itself holds no entry.
const WORD = ['Zebu', 'lonquist'].join('');
const EXACT = ['Quill', 'brook'].join('');
const LIBRARY_WORD = ['Wordlib', 'rariesuse'].join('');
const denylist = join(scratch, 'denylist.txt');
writeFileSync(denylist, `# test entries\n${WORD}\n=${EXACT}\n`);
const planted = join(root, 'scripts', '__planted-by-test.txt');
const photo = join(root, 'assets', 'photos', '__planted-by-test.png');
const index = join(scratch, 'index');

function run(args = [], env = {}) {
  const result = spawnSync('node', ['scripts/check-no-real-data.mjs', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, EVERMORE_DENYLIST: denylist, ...env } });
  const said = `${result.stdout}${result.stderr}`;
  assert.ok(!said.toLowerCase().includes(WORD.toLowerCase()) && !said.includes(EXACT), 'never prints an entry');
  return { code: result.status, said };
}

let checks = 0;
const check = (label, run) => {
  run();
  checks += 1;
  console.log(`PASS  ${label}`);
};

try {
  check('passes when no entry is present', () => assert.equal(run().code, 0));
  check('fails when a denylisted word is planted, naming the entry by number and the place only', () => {
    writeFileSync(planted, `A note about ${WORD} and their garden.\n`);
    const { code, said } = run();
    assert.equal(code, 1);
    assert.ok(/entry 2 in scripts\/__planted-by-test\.txt:1/.test(said), 'the entry’s line number and where');
  });
  check('passes again once it is removed', () => {
    rmSync(planted);
    assert.equal(run().code, 0);
  });
  check('catches the word in any capitalization, and as an id', () => {
    writeFileSync(planted, `const id = '${WORD.toLowerCase()}-0';\n`);
    assert.equal(run().code, 1);
    rmSync(planted);
  });
  check('a word that only contains it is not a match', () => {
    writeFileSync(planted, `${WORD}s ${WORD}ville\n`);
    assert.equal(run().code, 0);
    rmSync(planted);
  });
  check('an =exact entry matches only its own capitalization', () => {
    writeFileSync(planted, `${EXACT.toLowerCase()} is a setting\n`);
    assert.equal(run().code, 0, 'another capitalization passes');
    writeFileSync(planted, `${EXACT} came to visit\n`);
    assert.equal(run().code, 1, 'its own fails');
    rmSync(planted);
  });
  check('fails on a bundle that holds the word, as UTF-8 or UTF-16', () => {
    const bundles = join(scratch, 'export');
    mkdirSync(bundles, { recursive: true });
    writeFileSync(join(bundles, 'index.js'), 'console.log(1);');
    assert.equal(run(['--bundle', bundles]).code, 0, 'a clean bundle passes');
    writeFileSync(join(bundles, 'index.hbc'), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(`"${WORD}" `, 'utf16le')]));
    assert.equal(run(['--bundle', bundles]).code, 1, 'UTF-16, as Hermes keeps strings');
    writeFileSync(join(bundles, 'index.hbc'), Buffer.from(`"${WORD}"`, 'utf8'));
    assert.equal(run(['--bundle', bundles]).code, 1, 'UTF-8');
  });
  check('a ~ entry is checked in files but not in bundles', () => {
    writeFileSync(denylist, `# test entries\n${WORD}\n=${EXACT}\n~=${LIBRARY_WORD}\n`);
    const bundles = join(scratch, 'export-files-only');
    mkdirSync(bundles, { recursive: true });
    writeFileSync(join(bundles, 'index.hbc'), Buffer.from(`"${LIBRARY_WORD}"`, 'utf8'));
    assert.equal(run(['--bundle', bundles]).code, 0, 'not in bundles');
    writeFileSync(planted, `${LIBRARY_WORD}\n`);
    assert.equal(run().code, 1, 'but in files');
    rmSync(planted);
    writeFileSync(denylist, `# test entries\n${WORD}\n=${EXACT}\n`);
  });
  check('without a denylist it warns and passes, never failing for want of one', () => {
    const { code, said } = run([], { EVERMORE_DENYLIST: join(scratch, 'missing.txt') });
    assert.equal(code, 0);
    assert.ok(/WARN {2}no private denylist/.test(said));
  });
  check('fails on a photo tracked under assets/photos/, with or without a denylist', () => {
    copyFileSync(join(root, '.git', 'index'), index);
    writeFileSync(photo, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const add = spawnSync('git', ['add', '-f', 'assets/photos/__planted-by-test.png'], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: index } });
    assert.equal(add.status, 0, 'staged in the temporary index only');
    const { code, said } = run([], { GIT_INDEX_FILE: index, EVERMORE_DENYLIST: join(scratch, 'missing.txt') });
    assert.equal(code, 1);
    assert.ok(/FAIL {2}git tracks no photo under assets\/photos\/ \(1 found\)/.test(said));
    assert.equal(run([], { EVERMORE_DENYLIST: join(scratch, 'missing.txt') }).code, 0, 'the real index never had it');
  });
} finally {
  rmSync(planted, { force: true });
  rmSync(photo, { force: true });
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\nAll ${checks} real-data guard checks passed`);
