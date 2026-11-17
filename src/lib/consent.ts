// The caregiver's agreements (pure; its one import is the app's name, src/config/brand.ts): the words they agree to, what a sign-up must carry,
// and whether the caregiver has agreed to the policy in force. Kept as versioned records in
// public.consents (supabase/schema.sql): one row per agreement or choice, never changed, never
// removed except with the whole account. The person practicing is never asked anything here.
//
// DRAFT: every word below needs review by a lawyer or privacy professional (docs/privacy-policy-draft.md).

import { APP_NAME } from '@/config/brand';

/**
 * The version of the privacy policy and the agreements in force: the date it was written. Changing the
 * policy's text means a new version (scripts/check-privacy.mjs refuses a changed text under an old
 * version), and every caregiver is asked to read and agree again before continuing.
 */
export const POLICY_VERSION = '2026-11-17';

/** The version recorded for caregivers who signed up before agreements were versioned. */
export const LEGACY_VERSION = 'legacy';

/** What a record is about. 'research' is the optional choice; the other two are required to have an account. */
export const CONSENT_KINDS = ['policy', 'responsibility', 'research'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/** The short summary on Create an account, before anything is sent. */
export const SIGN_UP_SUMMARY = [
  `${APP_NAME} keeps your email, the people you add with their photos and stories, and how practice goes.`,
  'You can see all of it. The person practicing sees only the stories you approve.',
  `It is stored with our hosting provider, Supabase. ${APP_NAME}’s developer can technically reach it to keep the service running.`,
  'No ads, no tracking, and nothing is sold.',
  `${APP_NAME} is a practice tool, not a medical device.`,
];

/** Required: the privacy policy. */
export const AGREE_POLICY = 'I have read and agree to the privacy policy.';

/** Required: the caregiver is entering information about other people, and may. */
export const AGREE_RESPONSIBILITY =
  `I’m adding photos and details about other people. I have the right to do this, and the person I’m helping (or whoever is legally responsible for them) knows I’m using ${APP_NAME}.`;

/** Optional, and off unless chosen. */
export const RESEARCH_CHOICE =
  `Optional: ${APP_NAME} may use de-identified information (no names, photos, words or account details) for research to improve the app.`;
export const RESEARCH_NOTE = 'You can change this at any time in Settings. Saying no changes nothing in the app.';

/** Calm notes when a required box isn't ticked. */
export const NEED_POLICY = 'Please agree to the privacy policy to create an account.';
export const NEED_RESPONSIBILITY = 'Please confirm this to create an account.';

/** Asking again after the policy changed. */
export const POLICY_CHANGED_TITLE = 'Before you continue';
export const POLICY_CHANGED =
  `${APP_NAME}’s privacy policy has changed. Please read it and agree to keep using ${APP_NAME}. Everything you added is still here.`;
export const NEED_BOTH = 'Please tick both boxes to continue.';
export const NOT_SAVED = 'That didn’t save. Please check the internet connection and try again.';

/** The one sentence the person sees, on their own phone, while it is set up. */
export const SET_UP_FOR_YOU = 'Your caregiver set this up for you.';

export type Agreement = { policy: boolean; responsibility: boolean; research: boolean };

/** What the sign-up form still needs before an account can be made. */
export function agreementProblems(agreement: Agreement) {
  return {
    policy: agreement.policy === true ? undefined : NEED_POLICY,
    responsibility: agreement.responsibility === true ? undefined : NEED_RESPONSIBILITY,
  };
}

/**
 * What a caregiver's sign-up carries to the database, whose sign-up trigger refuses an account without
 * both agreements and records each one. Null without both: no request may be sent then.
 */
export function signUpData(agreement: Agreement, at = new Date()) {
  if (agreement.policy !== true || agreement.responsibility !== true) return null;
  return {
    consented_at: at.toISOString(),
    policy_version: POLICY_VERSION,
    agreed_policy: true,
    agreed_responsibility: true,
    research: agreement.research === true,
  };
}

/** One agreement or choice, as the app reads it. */
export type ConsentRecord = { kind: ConsentKind; version: string; choice: boolean; at: string };

/** A row of public.consents, as the caregiver's login reads it. */
export type ConsentRow = { kind: string; policy_version: string; choice: boolean; agreed_at: string };

export function fromRow(row: ConsentRow): ConsentRecord | null {
  if (!(CONSENT_KINDS as readonly string[]).includes(row.kind)) return null;
  return { kind: row.kind as ConsentKind, version: row.policy_version, choice: row.choice === true, at: row.agreed_at };
}

/** The rows a caregiver adds when agreeing to the policy in force. The server sets the time. */
export function agreementRows(caregiverId: string, version = POLICY_VERSION) {
  return (['policy', 'responsibility'] as const).map((kind) => ({ caregiver_id: caregiverId, kind, policy_version: version, choice: true }));
}

/** The row a caregiver adds when changing the research choice. */
export function researchRow(caregiverId: string, on: boolean, version = POLICY_VERSION) {
  return { caregiver_id: caregiverId, kind: 'research' as const, policy_version: version, choice: on };
}

export type ConsentState = {
  /** Both required agreements recorded for this version. */
  agreed: boolean;
  /** The research choice: the newest record's, and off when there is none. */
  research: boolean;
  /** When the research choice was last made, if ever. */
  researchAt?: string;
  /** The newest version agreed to, if any. */
  lastVersion?: string;
};

export function consentState(records: ConsentRecord[], version = POLICY_VERSION): ConsentState {
  const sorted = [...records].sort((a, b) => a.at.localeCompare(b.at));
  const agreedTo = (kind: ConsentKind) => sorted.some((record) => record.kind === kind && record.version === version && record.choice);
  const research = sorted.filter((record) => record.kind === 'research').at(-1);
  const policies = sorted.filter((record) => record.kind !== 'research' && record.choice);
  return {
    agreed: agreedTo('policy') && agreedTo('responsibility'),
    research: research?.choice === true,
    researchAt: research?.at,
    lastVersion: policies.at(-1)?.version,
  };
}
