// A fingerprint of every version-1 sentence (the wording every card approved before 2026-11-18 keeps):
// every fact kind and answer in scripts/sentence-inputs.mjs, under every relationship and lead, through
// the approved sentence, every phrasing and the fact hint. scripts/check-sentences.mjs compares it with
// the value recorded when version 2 was added, so version 1 can never change by accident.
import { createHash } from 'node:crypto';

import { ANSWERS, LEADS, RELATIONSHIPS } from './sentence-inputs.mjs';

export function versionOneFingerprint(stories) {
  const lines = [];
  for (const type of stories.FACT_TYPES) {
    for (const [text] of ANSWERS[type]) {
      for (const relationship of RELATIONSHIPS) {
        for (const lead of LEADS) {
          const fact = { type, text, timeSensitive: false, ...lead };
          const about = { relationship, hasPhoto: true, name: 'June' };
          lines.push(stories.sentenceFor(about, fact));
          for (const phrasing of stories.phrasingsFor(about, fact)) lines.push(`${phrasing.id}|${phrasing.kind}|${phrasing.ask}|${phrasing.reveal}`);
          lines.push(stories.clueFor(fact));
        }
      }
    }
  }
  return { count: lines.length, sha256: createHash('sha256').update(lines.join('\n')).digest('hex') };
}
