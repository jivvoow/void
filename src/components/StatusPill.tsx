import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fonts, glass, radius } from '../constants/theme';
import { BoltIcon, ChevronDownIcon, ClockIcon, LeafIcon } from './Icons';

export type PillKind = 'timer' | 'vent' | 'grace' | 'fade' | 'paused';

interface Props {
  kind: PillKind;
  label: string;
  /** Grace window length; the hairline inside the pill drains over this time. */
  graceMs?: number;
  onPress?: () => void;
  a11yLabel?: string;
  /** Shows a chevron: the pill opens the timer picker. */
  expandable?: boolean;
  expanded?: boolean;
}

/** Glassy status capsule at the top of the screen. */
function StatusPillBase({ kind, label, graceMs = 0, onPress, a11yLabel, expandable, expanded }: Props) {
  const drain = useSharedValue(1);

  useEffect(() => {
    drain.value = 1;
    if (kind === 'grace' && graceMs > 0) {
      drain.value = withTiming(0, { duration: graceMs, easing: Easing.linear });
    }
  }, [kind, graceMs, drain]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: drain.value }] }));
  const icon =
    kind === 'fade' ? <LeafIcon /> : kind === 'vent' ? <BoltIcon /> : kind === 'timer' || kind === 'paused' ? <ClockIcon /> : null;

  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={a11yLabel ?? label}
        accessibilityState={expandable ? { expanded: !!expanded } : undefined}
        accessibilityLiveRegion="polite"
        hitSlop={10}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        {icon}
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
        {expandable && (
          <View style={expanded ? styles.chevronUp : undefined}>
            <ChevronDownIcon />
          </View>
        )}
        {kind === 'grace' && (
          <View style={styles.track}>
            <Animated.View style={[styles.bar, barStyle]} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export const StatusPill = memo(StatusPillBase);

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    minHeight: 38,
    borderRadius: radius.pill,
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.border,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: glass.fillStrong },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  label: {
    fontFamily: fonts.hand,
    fontSize: 18,
    color: '#FFFFFF',
    includeFontPadding: false,
    flexShrink: 1,
  },
  track: { position: 'absolute', left: 18, right: 18, bottom: 5, height: 1.5 },
  bar: { flex: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.75)', transformOrigin: 'left center' },
});
