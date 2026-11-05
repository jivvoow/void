import { memo, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts } from '../constants/theme';

const POOL = 4;
const LIFE_MS = 820;

export interface GulpPopsHandle {
  /** Pop a little "꿀꺽" at (x, y) (main-area coords), drifting up and away on `side`. */
  pop: (at: { x: number; y: number }, label: string, side: -1 | 1) => void;
}

/**
 * Comic onomatopoeia next to the cloud each time it swallows — "꿀꺽", "냠냠".
 * A tiny recycled pool; nothing here ever contains the user's words.
 */
function GulpPopsBase({ ref }: { ref?: Ref<GulpPopsHandle> }) {
  const items = useRef<PopHandle[]>([]);
  const next = useRef(0);

  useImperativeHandle(ref, () => ({
    pop(at, label, side) {
      const it = items.current[next.current];
      next.current = (next.current + 1) % POOL;
      it?.launch(at, label, side);
    },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: POOL }, (_, i) => (
        <Pop key={i} ref={(h) => void (h && (items.current[i] = h))} />
      ))}
    </View>
  );
}

export const GulpPops = memo(GulpPopsBase);

interface PopHandle {
  launch: (at: { x: number; y: number }, label: string, side: -1 | 1) => void;
}

function Pop({ ref }: { ref?: Ref<PopHandle> }) {
  const [label, setLabel] = useState('');
  const t = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dir = useSharedValue(1);

  useImperativeHandle(ref, () => ({
    launch(at, l, side) {
      setLabel(l);
      x.value = at.x;
      y.value = at.y;
      dir.value = side;
      t.value = 0;
      t.value = withTiming(1, { duration: LIFE_MS, easing: Easing.out(Easing.quad) });
    },
  }));

  const style = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: p >= 1 ? 0 : interpolate(p, [0, 0.12, 0.65, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: x.value + dir.value * 18 * p - 60 },
        { translateY: y.value - 30 * p - 16 },
        { rotate: `${dir.value * (8 + 6 * p)}deg` },
        { scale: interpolate(p, [0, 0.18, 0.4, 1], [0.4, 1.25, 1, 0.92], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.Text style={[styles.pop, style]} maxFontSizeMultiplier={1.2}>
      {label}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  pop: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 120,
    textAlign: 'center',
    fontFamily: fonts.hand,
    fontSize: 24,
    color: '#FFFFFF',
    textShadowColor: 'rgba(200, 120, 140, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    opacity: 0,
  },
});
