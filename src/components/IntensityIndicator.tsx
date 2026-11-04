import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import type { Intensity } from '../types';

/**
 * The little "~" in the top-right corner.
 * Phase 1: a calm wave. Phase 2: the wave follows typing intensity.
 */
const WAVES: Record<Intensity, string> = {
  calm: 'M2 13c3-4 5-4 7 0s4 4 6 0 4-4 7 0',
  building: 'M2 13c2-6 4-6 5 0s3 6 5 0 3-6 5 0 3 6 5 0',
  burst: 'M2 13l2-6 2 10 2-12 2 14 2-12 2 10 2-8 2 6 2-4',
};

function IntensityIndicatorBase({ intensity = 'calm', color = '#FFFFFF' }: { intensity?: Intensity; color?: string }) {
  return (
    <Svg
      width={30}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={WAVES[intensity]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export const IntensityIndicator = memo(IntensityIndicatorBase);
