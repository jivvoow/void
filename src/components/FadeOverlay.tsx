import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { bezier, bezierSlope, type ParticleSpec } from '../animations/fadeAnimations';

interface Props {
  /** Shared 0 → 1 fade progress (same driver as the text + cloud). */
  progress: SharedValue<number>;
  particles: ParticleSpec[];
}

/**
 * The visible wind of the cloud's "후우~": streaks and sparkles fanning out of its mouth.
 * Purely decorative. Everything is driven by one shared value → zero JS work per frame.
 */
function FadeOverlayBase({ progress, particles }: Props) {
  if (particles.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {particles.map((p, i) =>
        p.kind === 'gust' ? <Gust key={i} spec={p} progress={progress} /> : <Sparkle key={i} spec={p} progress={progress} />,
      )}
    </View>
  );
}

export const FadeOverlay = memo(FadeOverlayBase);

function Sparkle({ spec, progress }: { spec: ParticleSpec; progress: SharedValue<number> }) {
  const { from, c1, c2, to, start, end, size, color } = spec;
  const halo = size * 3.2;

  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP);
    const x = bezier(t, from.x, c1.x, c2.x, to.x);
    const y = bezier(t, from.y, c1.y, c2.y, to.y);
    const opacity =
      progress.value < start ? 0 : interpolate(t, [0, 0.12, 0.65, 1], [0, 1, 0.8, 0], Extrapolation.CLAMP);
    const scale = interpolate(t, [0, 0.2, 1], [0.4, 1.1, 0.5], Extrapolation.CLAMP);
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

/** A soft white streak of wind, stretched along its direction of travel. */
function Gust({ spec, progress }: { spec: ParticleSpec; progress: SharedValue<number> }) {
  const { from, c1, c2, to, start, end, size } = spec;
  const H = 5;

  const style = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP);
    const e = 1 - (1 - t) * (1 - t); // fast out of the mouth, easing off
    const x = bezier(e, from.x, c1.x, c2.x, to.x);
    const y = bezier(e, from.y, c1.y, c2.y, to.y);
    const dx = bezierSlope(e, from.x, c1.x, c2.x, to.x);
    const dy = bezierSlope(e, from.y, c1.y, c2.y, to.y);
    const angle = Math.atan2(dy, dx);
    const opacity =
      progress.value < start ? 0 : interpolate(t, [0, 0.12, 0.6, 1], [0, 0.75, 0.5, 0], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { translateX: x - size / 2 },
        { translateY: y - H / 2 },
        { rotate: `${angle}rad` },
        { scaleX: interpolate(t, [0, 0.3, 1], [0.3, 1.2, 0.6], Extrapolation.CLAMP) },
      ],
    };
  });

  return <Animated.View style={[styles.gust, { width: size, height: H, borderRadius: H / 2 }, style]} />;
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.35 },
  gust: { position: 'absolute', left: 0, top: 0, backgroundColor: 'rgba(255,255,255,0.9)' },
});
