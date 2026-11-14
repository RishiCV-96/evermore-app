import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { useTextSize, type TextSize } from '@/data/text-size';
import { COMPACT_SCALE, TYPE_SCALE, type TypeSize } from '@/theme/type-scale';

export { COMPACT_MAX_SCALE, MIN_FONT_SCALE, type TypeSize } from '@/theme/type-scale';

// Atkinson Hyperlegible, designed for readers with low vision. Loaded in src/app/_layout.tsx.
export const Fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
};

function stylesFor(s: Record<TypeSize, number>) {
  return StyleSheet.create({
    display: { fontSize: s.display, lineHeight: Math.round(s.display * 1.2) },
    title: { fontSize: s.title, lineHeight: Math.round(s.title * 1.3) },
    body: { fontSize: s.body, lineHeight: Math.round(s.body * 1.4) },
    caption: { fontSize: s.caption, lineHeight: Math.round(s.caption * 1.35) },
  });
}

const STYLES: Record<TextSize, ReturnType<typeof stylesFor>> = {
  small: stylesFor(TYPE_SCALE.small),
  medium: stylesFor(TYPE_SCALE.medium),
  large: stylesFor(TYPE_SCALE.large),
  xlarge: stylesFor(TYPE_SCALE.xlarge),
};

const COMPACT = stylesFor(COMPACT_SCALE);

const CompactContext = createContext(false);

/** Wraps the caregiver's screens: everything inside uses the compact scale. */
export const CompactType = CompactContext.Provider;

/** True on the caregiver's screens. */
export function useCompact() {
  return useContext(CompactContext);
}

/** The type scale at a given Text size. */
export function typeFor(size: TextSize) {
  return STYLES[size];
}

/** The type scale here: compact for the caregiver, the chosen Text size for the person. */
export function useType() {
  const size = useTextSize();
  return useCompact() ? COMPACT : STYLES[size];
}
