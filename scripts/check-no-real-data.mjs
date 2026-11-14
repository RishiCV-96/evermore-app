// No real family data in the repository:
//   node scripts/check-no-real-data.mjs                  every tracked file, and every new file not ignored
//   node scripts/check-no-real-data.mjs --bundle <dir>   also a release export's bundles
// Fails if any entry of the private denylist (scripts/private-denylist.local.txt, gitignored, which you
// fill in: scripts/private-denylist.example.txt) appears in a tracked file (code, fixtures, tests, docs,
// config), in a file about to be added, or in a bundle; and, with or without a denylist, if git tracks
// a photo under assets/photos/ (only its README.md may be tracked, so the folder exists in a clone),
// the local deck or the denylist. Without a denylist it warns and passes the name checks.
// It never prints an entry: only its line number in the denylist, and where it was found.
// scripts/check-no-real-data.test.mjs proves it fails on a planted word and passes once it is gone.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bundleHolds, findIn, isText, loadDenylist } from './denylist.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const problems = [];
const say = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) problems.push(what);
};

// What git holds, and what is about to be added (new files that aren't ignored).
const tracked = git('ls-files');
const files = [...new Set([...tracked, ...git('ls-files', '--others', '--exclude-standard')])];

const trackedPhotos = tracked.filter((path) => path.startsWith('assets/photos/') && path !== 'assets/photos/README.md');
say(trackedPhotos.length === 0, `git tracks no photo under assets/photos/ (${trackedPhotos.length} found)`);
const trackedPrivate = tracked.filter((path) => /(^|\/)deck\.local\.ts$|private-denylist\.local\.txt$|\.local\.(md|ts|txt)$/.test(path));
say(trackedPrivate.length === 0, `git tracks no local deck, denylist or local notes (${trackedPrivate.length} found)`);

const denylist = loadDenylist();
if (denylist.missing) {
  console.warn('WARN  no private denylist (scripts/private-denylist.local.txt): the name checks are skipped. See scripts/private-denylist.example.txt.');
} else {
  say(denylist.entries.length > 0, `the denylist has entries (${denylist.entries.length})`);
  let scanned = 0;
  const hits = [];
  for (const path of files) {
    let buffer;
    try {
      buffer = readFileSync(join(root, path));
    } catch {
      continue; // deleted in the working tree
    }
    if (!isText(buffer)) continue;
    scanned += 1;
    for (const hit of findIn(buffer.toString('utf8'), denylist.entries)) hits.push(`entry ${hit.number} in ${path}:${hit.line}`);
  }
  for (const hit of hits) console.log(`      ${hit}`);
  say(hits.length === 0, `no denylist entry in the ${scanned} tracked or new text files (${hits.length} found)`);

  const at = process.argv.indexOf('--bundle');
  if (at > 0) {
    const dir = process.argv[at + 1];
    const walk = (folder) => readdirSync(folder).flatMap((name) => (statSync(join(folder, name)).isDirectory() ? walk(join(folder, name)) : [join(folder, name)]));
    const bundles = walk(dir).filter((path) => /\.(hbc|js)$/.test(path));
    const inBundles = [...new Set(bundles.flatMap((path) => bundleHolds(readFileSync(path), denylist.entries)))];
    for (const number of inBundles) console.log(`      entry ${number} in a bundle`);
    say(bundles.length > 0 && inBundles.length === 0, `no denylist entry in the ${bundles.length} bundles (${inBundles.length} found)`);
  }
}

if (problems.length) {
  console.log(`\n${problems.length} real-data checks failed`);
  process.exit(1);
}
console.log('\nNo real data found');
