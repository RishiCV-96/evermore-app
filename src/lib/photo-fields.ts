// What the app knows about a person's picture, apart from showing it. Pure, so
// scripts/check-logic.mjs can check it. src/components/person-photo.tsx shows the pictures.

/** What a person's picture can come from: an uploaded photo, a sample illustration, or a bundled photo. */
export type PhotoFields = {
  /** Path in the private photo bucket. Also the cache key, so the photo shows offline. */
  photoPath?: string;
  /** A short-lived signed URL for photoPath. */
  photoUrl?: string;
  samplePortrait?: string;
  /** A photo bundled with the app: the example deck when sign-in is off (src/data/photos.ts). */
  bundledPhoto?: number;
  /** A photo the caregiver picked with sign-in off, kept in the app's folder on the phone. */
  photoUri?: string;
};

/** True when the person has a picture of their own, not the placeholder. */
export function hasPhoto(person: PhotoFields) {
  return Boolean(person.photoUri || person.bundledPhoto || (person.photoPath && person.photoUrl) || person.samplePortrait);
}

type Profiled = PhotoFields & { name: string; relationship?: string; bestClue?: string; notApplicable?: string[]; testMarks?: string[] };

/**
 * A saved person, as the profile's rules read them. A saved photo counts even when its link
 * didn't load, so a failed request can't drop someone from the deck.
 */
export function profileOf({ name, relationship, bestClue, notApplicable, testMarks, ...photo }: Profiled) {
  return { name, relationship, bestClue, notApplicable, testMarks, hasPhoto: Boolean(photo.photoPath) || hasPhoto(photo) };
}
