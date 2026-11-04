import { memo, useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';

import type { Intensity } from '../types';

/** Colour of a spark by typing intensity: lavender → blush → coral. */
const SPARK_COLORS = ['#F3E9FF', '#FFC9D0', '#FF9E94'];
const POOL = 14;
export const SPARK_FLIGHT_MS = 520;

export interface EmotionStreamHandle {
  /** Shoot one spark of feeling from (x0,y0) into the cloud at (x1,y1). */
  emit: (from: { x: number; y: number }, to: { x: number; y: number }, intensity: Intensity) => void;
}

/**
 * "와다다" — every burst of typing flings small sparks from the words into the cloud.
 * A fixed pool of views is recycled, so fast typing never allocates or re-renders;
 * each emit just rewrites a few shared values.
 */
function EmotionStreamBase({ ref }: { ref?: Ref<EmotionStreamHandle> }) {
  const sparks = useRef<SparkHandle[]>([]);
  const next = useRef(0);

  useImperativeHandle(ref, () => ({
    emit(from, to, intensity) {
      const s = sparks.current[next.current];
      next.current = (next.current + 1) % POOL;
      s?.launch(from, to, intensity === 'burst' ? 2 : intensity === 'building' ? 1 : 0);
    },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: POOL }, (_, i) => (
        <Spark key={i} ref={(h) => void (h && (sparks.current[i] = h))} />
      ))}
    </View>
  );
}

export const EmotionStream = memo(EmotionStreamBase);

interface SparkHandle {
  launch: (from: { x: number; y: number }, to: { x: number; y: number }, level: number) => void;
}

const SIZE = 18;

function Spark({ ref }: { ref?: Ref<SparkHandle> }) {
  const t = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const x1 = useSharedValue(0);
  const y1 = useSharedValue(0);
  const bend = useSharedValue(0);
  const level = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    launch(from, to, lv) {
      x0.value = from.x;
      y0.value = from.y;
      x1.value = to.x;
      y1.value = to.y;
      bend.value = (Math.random() - 0.5) * 140;
      level.value = lv;
      t.value = 0;
      t.value = withTiming(1, { duration: SPARK_FLIGHT_MS + Math.random() * 120, easing: Easing.in(Easing.quad) });
    },
  }));

  const style = useAnimatedStyle(() => {
    const p = t.value;
    // Quadratic arc: sideways bend, then dives into the cloud.
    const cx = (x0.value + x1.value) / 2 + bend.value;
    const cy = Math.min(y0.value, y1.value) - 30;
    const u = 1 - p;
    const x = u * u * x0.value + 2 * u * p * cx + p * p * x1.value;
    const y = u * u * y0.value + 2 * u * p * cy + p * p * y1.value;
    const lv = level.value;
    const color = SPARK_COLORS[lv] ?? SPARK_COLORS[0];
    return {
      opacity: p >= 1 ? 0 : interpolate(p, [0, 0.1, 0.85, 1], [0, 1, 0.9, 0], Extrapolation.CLAMP),
      backgroundColor: color,
      transform: [
        { translateX: x - SIZE / 2 },
        { translateY: y - SIZE / 2 },
        { scale: interpolate(p, [0, 0.2, 1], [0.5, 0.75 + lv * 0.18, 0.35], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.spark, style]}>
      <View style={styles.core} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
  },
  core: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
});
