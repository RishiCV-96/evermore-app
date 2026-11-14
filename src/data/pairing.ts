import { FunctionsHttpError } from '@supabase/supabase-js';
import * as Device from 'expo-device';
import { useSyncExternalStore } from 'react';

import { PAIR_PHONE_FUNCTION } from '@/config/functions';
import { OFFLINE } from '@/lib/auth-form';
import { PAIR_NOT_MATCHED, phoneName } from '@/lib/pairing';
import { saveDeviceCredential } from '@/lib/session-storage';
import { supabase } from '@/lib/supabase';

// Pairing the person's phone through the pair-phone Edge Function (supabase/functions/pair-phone).
// The caregiver's side: a 6-digit PIN, and the phones linked to the family. The PIN lives only in memory
// on the caregiver's phone until it expires or they sign out: never saved, never logged. The server
// keeps only a keyed hash of it. The person's side: the caregiver's email and the PIN, once, which make
// this phone a login of its own. Sign-in on only.

/** The PIN, when it expires, and the phones already linked when it was made, to spot the one it links. */
export type Pin = { pin: string; expiresAt: number; linkedBefore: string[] };
export type LinkedPhone = { id: string; name: string; pairedAt: string; lastSeenAt: string | null };
export type Outcome = { ok: true } | { ok: false; message: string };
/** The PIN on show (expired PINs stay until replaced, to say so), or the phone it just linked. */
export type Pairing = { pin: Pin | null; linked?: string };

let current: Pairing = { pin: null };
const listeners = new Set<() => void>();

function set(next: Pairing) {
  current = next;
  listeners.forEach((listener) => listener());
}

/** The PIN made in this run of the app, if any, or the name of the phone it linked. */
export function usePairing() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => current,
  );
}

/** Forgets the PIN, as when the caregiver signs out here. */
export function forgetPin() {
  set({ pin: null });
}

const CAREGIVER_WORDS: Record<string, string> = {
  busy: 'You’ve made several PINs in the last hour. Please wait a little, then try again.',
  off: 'Pairing is turned off on the server for now. Please try again later.',
  'not-configured': 'Pairing isn’t set up on the server yet. Please try again later.',
  'no-device': 'That phone is no longer linked.',
};
const SERVER = 'Something didn’t work on the server. Please try again in a moment.';

async function call(body: Record<string, string>): Promise<{ data?: Record<string, unknown>; message?: string }> {
  const { data, error } = await supabase.functions.invoke(PAIR_PHONE_FUNCTION, { body });
  if (!error) return { data };
  if (error instanceof FunctionsHttpError) {
    const reply = await error.context.json().catch(() => ({}));
    return { message: CAREGIVER_WORDS[reply.error] ?? SERVER };
  }
  return { message: OFFLINE };
}

/** A new PIN for 15 minutes. The one still waiting stops working. */
export async function createPin(linkedBefore: string[]): Promise<Outcome> {
  const { data, message } = await call({ action: 'create-pin' });
  const pin = typeof data?.pin === 'string' && /^\d{6}$/.test(data.pin) ? data.pin : null;
  const expiresAt = typeof data?.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
  if (!pin || Number.isNaN(expiresAt)) return { ok: false, message: message ?? SERVER };
  set({ pin: { pin, expiresAt, linkedBefore } });
  return { ok: true };
}

/**
 * The phones paired with a PIN and not removed, oldest first. Row Level Security limits it to this
 * family. A phone that wasn't linked when the PIN on show was made is the one it linked: the PIN is
 * used up, so it goes, and the phone's name shows in its place.
 */
export async function linkedPhones(): Promise<{ phones: LinkedPhone[] } | { message: string }> {
  const { data, error } = await supabase.from('devices').select('id, name, paired_at, last_seen_at').is('revoked_at', null).order('paired_at');
  if (error) return { message: error.code ? SERVER : OFFLINE };
  const phones: LinkedPhone[] = (data ?? []).map((row) => ({ id: row.id, name: row.name, pairedAt: row.paired_at, lastSeenAt: row.last_seen_at }));
  const before = current.pin?.linkedBefore;
  const fresh = before && phones.find((phone) => !before.includes(phone.id));
  if (fresh) set({ pin: null, linked: fresh.name });
  return { phones };
}

/**
 * "Remove phone": its access ends at once on the server, and it returns to the welcome as soon as it
 * is online (within the hour at the latest). It needs a new PIN to come back. Its practice stays.
 */
export async function removePhone(id: string): Promise<Outcome> {
  const { data, message } = await call({ action: 'revoke-device', deviceId: id });
  return data?.removed ? { ok: true } : { ok: false, message: message ?? SERVER };
}

// ---------------------------------------------------------------------------------------
// The person's side: Create my account
// ---------------------------------------------------------------------------------------

/**
 * Pairs this phone with the caregiver's email and PIN. On success the login and credential the server
 * made for this phone go into secure storage, and the phone signs in with them (signInPairedPhone in
 * src/data/account.ts). The email and PIN are sent once, over HTTPS, and kept nowhere on the phone. Every
 * failure reads the same, whatever happened; only no connection reads differently, since that says
 * nothing about any account.
 */
export async function pairPhone(email: string, pin: string): Promise<Outcome> {
  const { data, error } = await supabase.functions.invoke(PAIR_PHONE_FUNCTION, {
    body: { action: 'redeem', email: email.trim(), pin, deviceName: phoneName(Device.deviceName) },
  });
  if (error) return { ok: false, message: error instanceof FunctionsHttpError ? PAIR_NOT_MATCHED : OFFLINE };
  const login = typeof data?.login === 'string' ? data.login : null;
  const credential = typeof data?.credential === 'string' ? data.credential : null;
  if (!login || !credential) return { ok: false, message: PAIR_NOT_MATCHED };
  try {
    await saveDeviceCredential({ login, credential });
  } catch {
    return { ok: false, message: PAIR_NOT_MATCHED };
  }
  return { ok: true };
}
