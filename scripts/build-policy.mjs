// Writes the privacy policy's documents from its one source (src/lib/privacy-policy.ts and the agreement
// words in src/lib/consent.ts):
//   docs/privacy-policy-draft.md   the draft for the lawyer, with every [REVIEW] note
//   docs/privacy-policy.html       one file to host, no scripts, nothing loaded from elsewhere
//   docs/privacy-policy.lock.json  each version and the fingerprint of the words it covers
//
//   node scripts/build-policy.mjs           after changing the words: refuses a changed text under a
//                                           version already recorded, so bump POLICY_VERSION first
//   node scripts/build-policy.mjs --amend   only while the version has never been shown to a caregiver
//
// A new POLICY_VERSION asks every caregiver to read and agree again (src/components/consent.tsx).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { HTML_PATH, LOCK_PATH, MD_PATH, fingerprint, html, markdown, policy } from './policy-source.mjs';

const lock = existsSync(LOCK_PATH) ? JSON.parse(readFileSync(LOCK_PATH, 'utf8')) : {};
const version = policy.POLICY_VERSION;
const print = fingerprint();
if (lock[version] && lock[version] !== print && !process.argv.includes('--amend')) {
  console.error(`The policy's words changed, but version ${version} is already recorded with other words.`);
  console.error('Set a new POLICY_VERSION in src/lib/consent.ts (today’s date), then run this again.');
  process.exit(1);
}
lock[version] = print;
writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
writeFileSync(MD_PATH, markdown());
writeFileSync(HTML_PATH, html());
console.log(`Wrote the policy, version ${version}.`);
