// How big a picked photo is kept: its long edge at most PHOTO_LONG_EDGE pixels. A phone's camera
// photo (often 4032 x 3024, 3 to 5 MB) is shown at 40 to 300 points, so the full size only costs
// upload time, data, memory and the image cache. Pure, so scripts/check-logic.mjs checks it.

/** The long edge of a kept photo: sharp on the largest phone at the largest place a photo is shown. */
export const PHOTO_LONG_EDGE = 1280;

/** The resize that brings a photo within PHOTO_LONG_EDGE, keeping its shape, or nothing if it already is. */
export function shrinkTo(width: number, height: number, longEdge = PHOTO_LONG_EDGE): { width: number } | { height: number } | undefined {
  if (!(width > 0 && height > 0) || Math.max(width, height) <= longEdge) return undefined;
  return width >= height ? { width: longEdge } : { height: longEdge };
}
