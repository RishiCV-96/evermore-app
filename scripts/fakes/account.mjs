// The signed-in caregiver, for scripts/check-server-family.mjs.
export const CAREGIVER = '00000000-0000-4000-8000-00000000000a';

/** Who is signed in: the caregiver unless a check signs in the person's login, or signs out. */
export const who = { role: 'caregiver', signedIn: true };
export const PERSON = '00000000-0000-4000-8000-0000000000aa';

export function currentProfile() {
  if (!who.signedIn) throw new Error('Nobody is signed in.');
  if (who.role === 'person') return { id: PERSON, role: 'person', displayName: 'Rose', caregiverId: CAREGIVER, createdAt: '2026-01-01T00:00:00.000Z' };
  return { id: CAREGIVER, role: 'caregiver', displayName: 'Pat', caregiverId: null, createdAt: '2026-01-01T00:00:00.000Z' };
}
