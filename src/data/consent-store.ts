import { useSyncExternalStore } from 'react';

import { accountNow, watchAccount } from '@/data/account';
import { agreementRows, consentState, fromRow, researchRow, type ConsentKind, type ConsentRecord, type ConsentRow } from '@/lib/consent';
import { warnKind } from '@/lib/log';
import { supabase } from '@/lib/supabase';

// The signed-in caregiver's agreements (public.consents), with sign-in on. Read from the server each
// time the caregiver's app opens or comes back, and never kept on the phone: the app asks the caregiver
// to agree again only on a fresh answer from the server, so a phone that is offline is never locked out.
// Only the caregiver's login reads or adds them; the person's phone never asks for them.

export type ConsentStatus =
  /** Not known yet: the first read is on its way. */
  | 'checking'
  /** Both agreements recorded for the policy in force. */
  | 'current'
  /** The policy changed (or was never agreed to): ask before continuing. */
  | 'needed'
  /** The server couldn't be reached. Nothing is asked until it can be. */
  | 'unknown';

export type ConsentView = { status: ConsentStatus; research: boolean; researchAt?: string };

const START: ConsentView = { status: 'checking', research: false };
let view: ConsentView = START;
let records: ConsentRecord[] = [];
/** The caregiver whose records these are. */
let owner: string | null = null;
let reading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: ConsentView) {
  view = next;
  listeners.forEach((listener) => listener());
}

function fromRecords(): ConsentView {
  const state = consentState(records);
  return { status: state.agreed ? 'current' : 'needed', research: state.research, researchAt: state.researchAt };
}

/** The caregiver signed in now, or null for anyone else. */
function caregiverId() {
  const account = accountNow();
  return account.status === 'signed-in' && account.profile.role === 'caregiver' ? account.profile.id : null;
}

let watching = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    // Another caregiver signed in on this phone: their own agreements, from the start.
    watchAccount(() => {
      if (caregiverId() !== owner) void loadConsent();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useConsent() {
  return useSyncExternalStore(subscribe, () => view, () => view);
}

/** Reads the caregiver's agreements from the server. One read at a time. */
export function loadConsent(): Promise<void> {
  reading ??= read().finally(() => {
    reading = null;
  });
  return reading;
}

async function read() {
  const id = caregiverId();
  if (id !== owner) {
    owner = id;
    records = [];
    publish(START);
  }
  if (!id) return;
  const { data, error } = await supabase.from('consents').select('kind, policy_version, choice, agreed_at').eq('caregiver_id', id).order('agreed_at', { ascending: true });
  if (caregiverId() !== id) return;
  if (error) {
    warnKind('Could not read agreements', error);
    // What this session already read still stands; with nothing read yet, nothing is asked.
    if (!records.length) publish({ status: 'unknown', research: false });
    return;
  }
  records = (data as ConsentRow[]).map(fromRow).filter((record): record is ConsentRecord => record !== null);
  publish(fromRecords());
}

export type ConsentResult = { ok: true } | { ok: false };

async function add(rows: { caregiver_id: string; kind: ConsentKind; policy_version: string; choice: boolean }[]): Promise<ConsentResult> {
  const id = caregiverId();
  if (!id || id !== owner) return { ok: false };
  const { error } = await supabase.from('consents').insert(rows);
  if (error) {
    warnKind('Could not save an agreement', error);
    return { ok: false };
  }
  // The server's own times come with the next read; until then, now.
  const at = new Date().toISOString();
  records = [...records, ...rows.map((row) => ({ kind: row.kind, version: row.policy_version, choice: row.choice, at }))];
  publish(fromRecords());
  void loadConsent();
  return { ok: true };
}

/** The caregiver agreed to the policy in force, and confirmed they may add the people they include. */
export function agreeToPolicy() {
  const id = caregiverId();
  return id ? add(agreementRows(id)) : Promise.resolve<ConsentResult>({ ok: false });
}

/** The research choice, changed: a new record each time, so every change is kept. */
export function setResearch(on: boolean) {
  const id = caregiverId();
  return id ? add([researchRow(id, on)]) : Promise.resolve<ConsentResult>({ ok: false });
}

/** Signing out: nothing was kept on the phone, so only memory is cleared. */
export function forgetConsent() {
  owner = null;
  records = [];
  publish(START);
}
