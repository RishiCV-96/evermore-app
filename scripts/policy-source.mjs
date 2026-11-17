// The privacy policy's source (src/lib/privacy-policy.ts and the agreement words in src/lib/consent.ts),
// rendered as the two documents in docs/: the Markdown draft with every [REVIEW] note for the lawyer, and
// a single-file HTML page to host, with no scripts and nothing loaded from elsewhere. Shared by
// scripts/build-policy.mjs (writes them) and scripts/check-privacy.mjs (checks they are in step).
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = fileURLToPath(new URL('../src/', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      const file = `${src}${specifier.slice(2)}.ts`;
      if (existsSync(file)) return { url: pathToFileURL(file).href, format: 'module-typescript', shortCircuit: true };
    }
    return next(specifier, context);
  },
});

export const policy = await import('@/lib/privacy-policy');
export const consent = await import('@/lib/consent');

export const MD_PATH = new URL('../docs/privacy-policy-draft.md', import.meta.url);
export const HTML_PATH = new URL('../docs/privacy-policy.html', import.meta.url);
export const LOCK_PATH = new URL('../docs/privacy-policy.lock.json', import.meta.url);

/** The agreement words a caregiver ticks or reads, in the app: part of what a version covers. */
export const AGREEMENT_WORDS = [
  { label: 'Summary shown on Create an account', text: consent.SIGN_UP_SUMMARY.join(' '), review: 'Whether this short summary is accurate and enough before an account is made.' },
  { label: 'Required box 1', text: consent.AGREE_POLICY },
  {
    label: 'Required box 2',
    text: consent.AGREE_RESPONSIBILITY,
    review: 'Consent on behalf of a person with memory loss: whether this confirmation is the right wording, whether “knows” is enough or their agreement (or a legal representative’s) is needed, and whether the other people added (family members, children) need anything.',
  },
  {
    label: 'Optional box (unticked)',
    text: `${consent.RESEARCH_CHOICE} ${consent.RESEARCH_NOTE}`,
    review: 'Whether a research choice may be collected before any research exists, and the definition of de-identified.',
  },
  { label: 'Asked again when the policy changes', text: consent.POLICY_CHANGED },
  { label: 'The one sentence on the person’s phone', text: consent.SET_UP_FOR_YOU, review: 'Whether the person practicing must be told more, and how, given memory loss.' },
];

/** What a version covers: the policy's text and the agreement words. Changing either needs a new version. */
export function fingerprint() {
  const text = [policy.policyText(), ...AGREEMENT_WORDS.map((one) => one.text)].join('\n');
  return createHash('sha256').update(text).digest('hex');
}

/** Every [REVIEW] note, numbered in the order they appear. */
export function reviewNotes() {
  const notes = [];
  for (const section of policy.POLICY) for (const point of section.points) if (point.review) notes.push({ where: section.heading, text: point.text, note: point.review });
  for (const one of AGREEMENT_WORDS) if (one.review) notes.push({ where: one.label, text: one.text, note: one.review });
  return notes;
}

export function markdown() {
  let n = 0;
  const lines = [
    `# ${policy.POLICY_TITLE}`,
    '',
    `> **${policy.DRAFT_LINE}.** This is not legal advice, and it has not been reviewed. Every statement marked **[REVIEW n]** needs a lawyer's decision; the numbered notes are at the end. It must not claim compliance with any law or certification.`,
    '>',
    '> Written from `src/lib/privacy-policy.ts` and `src/lib/consent.ts` by `node scripts/build-policy.mjs`: edit those, never this file. The facts behind it are in `docs/DATA-INVENTORY.md`.',
    '',
    `**Version:** ${policy.POLICY_VERSION} · **Effective date:** ${policy.EFFECTIVE_DATE} · **Contact:** ${policy.CONTACT}`,
    '',
  ];
  for (const section of policy.POLICY) {
    lines.push(`## ${section.heading}`, '');
    for (const point of section.points) lines.push(`- ${point.text}${point.review ? ` **[REVIEW ${++n}]**` : ''}`);
    lines.push('');
  }
  lines.push('## The agreements in the app', '', 'Shown to the caregiver only. Nothing is ticked for them, and no account is made without both required boxes.', '');
  for (const one of AGREEMENT_WORDS) lines.push(`- **${one.label}:** “${one.text}”${one.review ? ` **[REVIEW ${++n}]**` : ''}`);
  lines.push('', '## Notes for the reviewer', '');
  reviewNotes().forEach((one, i) => lines.push(`${i + 1}. **${one.where}.** ${one.note}`));
  lines.push('');
  return lines.join('\n');
}

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function html() {
  const sections = policy.POLICY.map(
    (section) => `    <section id="${section.id}">
      <h2>${escape(section.heading)}</h2>
      <ul>
${section.points.map((point) => `        <li>${escape(point.text)}</li>`).join('\n')}
      </ul>
    </section>`,
  ).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escape(policy.POLICY_TITLE)}</title>
  <!-- Written from src/lib/privacy-policy.ts by node scripts/build-policy.mjs. No scripts, no tracking, nothing loaded from elsewhere. -->
  <style>
    :root { --bg: #ffffff; --text: #1f2b4d; --muted: #4d5d76; --accent: #b0467f; --tint: #eaf3fb; --line: #d3e0ec; }
    @media (prefers-color-scheme: dark) { :root { --bg: #1f2b4d; --text: #f3f6fa; --muted: #c3cddb; --accent: #f27bb0; --tint: #2a3961; --line: #3b4b78; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 18px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    main { max-width: 42rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
    h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 1rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 0.5rem; color: var(--accent); }
    ul { padding-left: 1.25rem; margin: 0; }
    li { margin: 0.4rem 0; }
    .draft { background: var(--tint); border: 1px solid var(--line); border-radius: 12px; padding: 0.75rem 1rem; font-weight: 600; }
    .meta { color: var(--muted); font-size: 0.95rem; }
  </style>
</head>
<body>
  <main>
    <h1>${escape(policy.POLICY_TITLE)}</h1>
    <p class="draft">${escape(policy.DRAFT_LINE)}.</p>
    <p class="meta">Version ${escape(policy.POLICY_VERSION)}. Effective date: ${escape(policy.EFFECTIVE_DATE)}.</p>
${sections}
  </main>
</body>
</html>
`;
}
