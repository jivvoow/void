import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { Intensity } from '../types';

interface Props {
  intensity: Intensity;
  active: boolean;
  size: number;
}

/**
 * Soft pressure ripples around the cloud. BUILDING: faint pink, slow.
 * BURST: coral, quicker. Animations stop entirely when calm (battery).
 */
function RippleRingsBase({ intensity, active, size }: Props) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  const level = useSharedValue(0);

  const on = active && intensity !== 'calm';
  const burst = intensity === 'burst';

  useEffect(() => {
    level.value = withTiming(on ? (burst ? 1 : 0.55) : 0, { duration: 400 });
    if (!on) {
      cancelAnimation(a);
      cancelAnimation(b);
      a.value = 0;
      b.value = 0;
      return;
    }
    const dur = burst ? 900 : 1600;
    a.value = 0;
    b.value = 0;
    a.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }), -1);
    b.value = withDelay(dur / 2, withRepeat(withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }), -1));
  }, [on, burst, a, b, level]);

  const color = burst ? 'rgba(255, 158, 148, 0.85)' : 'rgba(255, 214, 220, 0.8)';
  return (
    <View style={[styles.wrap, { width: size, height: size * 0.7 }]} pointerEvents="none">
      <Ring t={a} level={level} color={color} size={size} />
      <Ring t={b} level={level} color={color} size={size} />
    </View>
  );
}

export const RippleRings = memo(RippleRingsBase);

function Ring({ t, level, color, size }: { t: SharedValue<number>; level: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: level.value * interpolate(t.value, [0, 0.2, 1], [0, 0.9, 0]),
    transform: [{ scale: 0.75 + t.value * 0.7 }],
  }));
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size * 0.62, borderRadius: size, borderColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
});
