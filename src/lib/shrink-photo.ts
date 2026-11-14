import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedPhoto } from '@/lib/facts';
import { shrinkTo } from '@/lib/photo-size';

/**
 * A photo just picked from the library, made no bigger than it needs to be (src/lib/photo-size.ts),
 * before it is kept on the phone or uploaded. If that can't be done, the original is used.
 */
export async function shrinkPhoto(asset: { uri: string; width: number; height: number; mimeType?: string | null }): Promise<PickedPhoto> {
  const original: PickedPhoto = { uri: asset.uri, mimeType: asset.mimeType ?? undefined };
  const resize = shrinkTo(asset.width, asset.height);
  if (!resize) return original;
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    context.resize(resize);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: 'image/jpeg' };
  } catch {
    return original;
  }
}
