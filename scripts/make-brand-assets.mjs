// Writes the app's logo assets from the brand kit (brand-kit/, the designer's files):
//   assets/images/icon.png, favicon.png, splash-logo.png   the kit's own PNGs, copied as they are
//   assets/images/splash-logo-dark.png                     the stacked logo in the kit's reversed colors
//   assets/images/android-icon-foreground.png              the mark inside Android's safe zone
//   src/components/tandem-logo-data.ts                     the shapes and colors <TandemLogo /> draws
//
//   node scripts/make-brand-assets.mjs     after replacing the kit; scripts/check-brand.mjs then passes
//
// The composed images are drawn by scripts/brand-kit.mjs, which must first reproduce the kit's own
// stacked PNG, so nothing here is redrawn by hand.
import { copyFileSync, writeFileSync } from 'node:fs';

import { ASSETS, COPIED, KIT, LOGO_DATA, composed, encodePng, logoData, readKit, rendererFidelity } from './brand-kit.mjs';

const kit = readKit();
const fidelity = rendererFidelity(kit);
if (fidelity.mean > 0.05 || fidelity.max > 48) {
  console.error(`The renderer no longer reproduces the kit's stacked PNG (mean ${fidelity.mean}, largest ${fidelity.max}). Nothing was written.`);
  process.exit(1);
}
for (const [asset, source] of Object.entries(COPIED)) copyFileSync(new URL(source, KIT), new URL(asset, ASSETS));
for (const [asset, make] of Object.entries(composed(kit))) writeFileSync(new URL(asset, ASSETS), encodePng(make()));
writeFileSync(LOGO_DATA, logoData(kit));
console.log(`Wrote ${Object.keys(COPIED).length + Object.keys(composed(kit)).length} images and the logo data from the kit.`);
