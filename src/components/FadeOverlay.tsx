import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { bezier, type ParticleSpec } from '../animations/fadeAnimations';

interface Props {
  /** Shared 0 → 1 fade progress (same driver as the text + cloud). */
  progress: SharedValue<number>;
  particles: ParticleSpec[];
}

/**
 * Sparkles for the evaporation moment. Purely decorative and non-interactive.
 * Everything is driven by one shared value, so N particles cost N cheap UI-thread styles
 * and zero JS work per frame.
 */
function FadeOverlayBase({ progress, particles }: Props) {
  if (particles.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) => (
        <Sparkle key={i} spec={p} progress={progress} />
      ))}
    </View>
  );
}

export const FadeOverlay = memo(FadeOverlayBase);

function Sparkle({ spec, progress }: { spec: ParticleSpec; progress: SharedValue<number> }) {
  const { from, c1, c2, to, start, end, size, color, kind } = spec;
  const halo = size * 3.2;

  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP);
    const x = bezier(t, from.x, c1.x, c2.x, to.x);
    const y = bezier(t, from.y, c1.y, c2.y, to.y);
    const peak = kind === 'breath' ? 0.9 : 1;
    const opacity =
      progress.value < start ? 0 : interpolate(t, [0, 0.15, 0.6, 1], [0, peak, peak * 0.8, 0], Extrapolation.CLAMP);
    const scale = interpolate(t, [0, 0.2, 1], [0.4, 1, 0.5], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateX: x - halo / 2 }, { translateY: y - halo / 2 }, { scale }],
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: halo, height: halo }, style]}>
      <View style={[styles.halo, { borderRadius: halo / 2, backgroundColor: color }]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFFFFF' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.35 },
});
