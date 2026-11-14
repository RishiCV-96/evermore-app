import { AUTH_ENABLED } from '@/config/features';
import { phoneCopySource, readServerExport, readServerPhotos } from '@/data/export-store';
import { localExportSource, readLocalPhotos } from '@/data/local-store';
import type { Cancel, ExportProgress, ExportRead, ExportSource } from '@/lib/export';

// Export my data: where the copy comes from, chosen once, the way src/data/app-data.ts chooses for
// everything else. Kept apart from app-data so only the caregiver's Settings imports it:
// scripts/check-logic.mjs checks no person-facing screen reaches it.
//   Sign-in on: the server, with the caregiver's own session (src/data/export-store.ts); offline, the
//   caregiver may choose this phone's copy, labelled as such.
//   Sign-in off: this phone, where everything is kept.

export const readExport: (onProgress: (progress: ExportProgress) => void, cancel: Cancel) => Promise<ExportRead<ExportSource>> = AUTH_ENABLED
  ? readServerExport
  : () => localExportSource();

/** Offline with sign-in on only: this phone's copy. Sign-in off has no other copy to fall back from. */
export const readPhoneCopy: (() => Promise<ExportRead<ExportSource>>) | undefined = AUTH_ENABLED ? phoneCopySource : undefined;

export const readPhotos: (onProgress: (progress: ExportProgress) => void, cancel: Cancel) => Promise<ExportRead<{ zip: Uint8Array; count: number }>> = AUTH_ENABLED
  ? readServerPhotos
  : readLocalPhotos;
