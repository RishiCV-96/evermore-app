import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { placeholderPhoto, samplePortraits } from '@/data/portraits';
import { hasPhoto, profileOf, type PhotoFields } from '@/lib/photo-fields';
import { Colors } from '@/theme/colors';
import { RADIUS } from '@/theme/layout';
import { Fonts } from '@/theme/type';

export { hasPhoto, profileOf, type PhotoFields };

/**
 * The picture practice shows for a person. Without a photo it is the neutral placeholder,
 * not initials, because initials would give away the first-letter hint.
 */
export function photoSource(person: PhotoFields): ImageProps['source'] {
  if (person.photoUri) return { uri: person.photoUri };
  if (person.bundledPhoto) return person.bundledPhoto;
  if (person.photoPath && person.photoUrl) return { uri: person.photoUrl, cacheKey: person.photoPath };
  if (person.samplePortrait) return samplePortraits[person.samplePortrait] ?? placeholderPhoto;
  return placeholderPhoto;
}

// Shown whole, never cropped, so a face is never cut off. It takes whatever space its area
// gives it and is sized to the photo's own shape so its corners round. The picture sits on
// a layer of its own, so it never holds its area open when the area needs to shrink, and
// the area is never taller than the picture, so spare space goes below what follows it.
export function FittedPhoto({ source, style }: { source: ImageProps['source']; style?: ViewStyle }) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const size = area && ratio ? fitInside(area, ratio) : null;

  return (
    <View
      style={[styles.area, style, area && ratio ? { maxHeight: area.width / ratio } : null]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setArea({ width, height });
      }}>
      <View style={styles.layer}>
        <Image
          testID="photo"
          source={failed ? placeholderPhoto : source}
          accessibilityLabel="Photo of the person in this story"
          contentFit="cover"
          transition={200}
          style={size ? [styles.photo, size] : styles.loading}
          onLoad={(event) => setRatio(event.source.width / event.source.height)}
          onError={() => setFailed(true)}
        />
      </View>
    </View>
  );
}

function fitInside(area: { width: number; height: number }, ratio: number) {
  return area.width / area.height > ratio
    ? { width: area.height * ratio, height: area.height }
    : { width: area.width, height: area.width / ratio };
}

type AvatarProps = {
  name: string;
  /** A picture to show; without one, the name's initials in a circle. */
  source?: ImageProps['source'];
  size?: number;
};

/** A small round picture for the caregiver screens. */
export function Avatar({ name, source, size = 72 }: AvatarProps) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (source) {
    return <Image source={source} contentFit="cover" style={round} accessibilityElementsHidden importantForAccessibility="no" />;
  }
  return (
    <View style={[styles.initials, round]} accessibilityElementsHidden importantForAccessibility="no">
      <Text style={[styles.initialsText, { fontSize: size * 0.4 }]}>{initials(name)}</Text>
    </View>
  );
}

/** The avatar picture for a person: their photo or illustration, or none for initials. */
export function avatarSource(person: PhotoFields) {
  return hasPhoto(person) ? photoSource(person) : undefined;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  area: {
    minHeight: 0,
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    borderRadius: RADIUS,
  },
  loading: {
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.skySoft,
  },
  initialsText: {
    fontFamily: Fonts.bold,
    color: Colors.primaryDark,
  },
});
