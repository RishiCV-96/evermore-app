import { Text, type TextProps } from 'react-native';

import { Colors } from '@/theme/colors';
import { COMPACT_MAX_SCALE, Fonts, MIN_FONT_SCALE, useCompact, useType, type TypeSize } from '@/theme/type';

type AppTextProps = TextProps & {
  size?: TypeSize;
  bold?: boolean;
  /** Secondary text. */
  muted?: boolean;
  color?: string;
  center?: boolean;
  /** One line that shrinks to fit rather than wrap: labels, buttons and headings. */
  fit?: boolean;
};

/** Every piece of text, so the type scale and the Text size setting apply everywhere. */
export function AppText({ size = 'body', bold = false, muted = false, color, center = false, fit = false, style, ...props }: AppTextProps) {
  const type = useType();
  const compact = useCompact();
  return (
    <Text
      {...(fit ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: MIN_FONT_SCALE } : null)}
      {...(compact ? { maxFontSizeMultiplier: COMPACT_MAX_SCALE } : null)}
      {...props}
      style={[
        type[size],
        { fontFamily: bold ? Fonts.bold : Fonts.regular, color: color ?? (muted ? Colors.textMuted : Colors.text) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
