import { samplePortraits } from '@/data/portraits';

// Photos for the local deck's real people, named by person id in assets/photos/ (gitignored).
// DEVELOPMENT ONLY. The folder stays out of git and out of EAS uploads (.easignore); in a release
// build __DEV__ is false, this branch is removed before the bundle is made, and no real photo is in
// it (scripts/check-release.mjs). In development, Metro bundles whichever files exist, so a missing
// photo shows the placeholder. Photos only travel from this computer's dev server to the phone.
// The fictional sample people use their illustrations (src/data/portraits.ts).
const added = __DEV__ ? require.context('../../assets/photos', false, /\.(jpe?g|png)$/) : null;

export const placeholderPhoto = require('@/assets/images/photo-placeholder.png');

export function photoFor(personId: string) {
  const file = added?.keys().find((key) => key.replace(/^\.\//, '').replace(/\.\w+$/, '') === personId);
  return file && added ? added(file) : (samplePortraits[personId] ?? placeholderPhoto);
}
