import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/theme/colors';

// The Insights tab's mark: a simple brain (two rounded halves, a few folds), in the outline style of
// the other tab icons. An original glyph, apart from the logo. Caregiver-only.

const HALF = 'M12 4.8C11.1 3.7 9.3 3.5 8.3 4.5C6.9 4.2 5.6 5.3 5.7 6.7C4.4 7.1 3.7 8.6 4.3 9.8C3.3 10.6 3.2 12.3 4.2 13.1C3.7 14.5 4.5 16 5.9 16.3C6.1 17.8 7.6 18.8 9.1 18.4C10 19.4 11.3 19.4 12 18.6';
const FOLDS = 'M8.3 4.5C8.6 5.6 9.6 6.2 10.4 6.1M5.7 6.7C6.4 7.5 7.4 7.7 8.2 7.4M4.3 9.8C5.4 10.6 6.9 10.4 7.6 9.6M4.2 13.1C5.2 12.6 6.5 12.9 7.1 13.8M9.1 18.4C9.4 17.4 10.3 16.8 11.2 16.9M9.4 10.4C10.4 10.6 11.2 11.4 11.2 12.4';

/** The brain, `size` across: outlined, or filled softly when its tab is chosen. */
export function BrainIcon({ size = 24, color = Colors.pinkInk, filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {[HALF, FOLDS].map((d) => (
        <Path key={d} d={`${d}`} stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill={d === HALF && filled ? Colors.pink1 : 'none'} />
      ))}
      {/* The right half is the left one, mirrored. */}
      {[HALF, FOLDS].map((d) => (
        <Path key={`r${d}`} d={d} transform="translate(24 0) scale(-1 1)" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill={d === HALF && filled ? Colors.pink1 : 'none'} />
      ))}
      <Path d="M12 4.8V18.6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
