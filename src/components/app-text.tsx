import { Text, type TextProps } from 'react-native';

import { Colors } from '@/theme/colors';
import { COMPACT_MAX_SCALE, Fonts, MIN_FONT_SCALE, useCompact, useType, type TextRole } from '@/theme/type';

type AppTextProps = TextProps & {
  /** `headline` and `largeTitle` are the caregiver's; on the person's screens they are body and title. */
  size?: TextRole;
  bold?: boolean;
  /** Secondary text. */
  muted?: boolean;
  color?: string;
  center?: boolean;
  /** One line that shrinks to fit rather than wrap: labels, buttons and headings. */
  fit?: boolean;
  /** Figures of one width, for a number that changes, so it doesn't shift as it does. */
  tabular?: boolean;
};

const TABULAR = { fontVariant: ['tabular-nums' as const] };

/** Every piece of text, so the type scale and the Text size setting apply everywhere. */
export function AppText({ size = 'body', bold = false, muted = false, color, center = false, fit = false, tabular = false, style, ...props }: AppTextProps) {
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
        tabular && TABULAR,
        style,
      ]}
    />
  );
}
