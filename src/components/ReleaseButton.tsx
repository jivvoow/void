import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { RELEASE_HOLD_MS } from '../constants/config';
import { fonts, glass, radius } from '../constants/theme';
import { FeatherIcon } from './Icons';

interface Props {
  label: string;
  a11yLabel: string;
  disabled?: boolean;
  onHoldStart?: () => void;
  onRelease: () => void;
  /** Let go before the hold completed — a chance to teach "hold, don't tap". */
  onShortTap?: () => void;
}

/**
 * "훌훌 날리기" — must be HELD for RELEASE_HOLD_MS. A tap does nothing,
 * so a stray touch never erases anything. The fill shows hold progress.
 */
function ReleaseButtonBase({ label, a11yLabel, disabled, onHoldStart, onRelease, onShortTap }: Props) {
  const hold = useSharedValue(0);

  const onPressIn = () => {
    if (disabled) return;
    onHoldStart?.();
    hold.value = withTiming(1, { duration: RELEASE_HOLD_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) scheduleOnRN(onRelease);
    });
  };
  const onPressOut = () => {
    // Releasing early cancels the in-flight timing → its callback gets finished=false.
    const early = hold.value < 1;
    hold.value = withTiming(0, { duration: early ? 220 : 500 });
    if (early && !disabled) onShortTap?.();
  };

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: hold.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - hold.value * 0.05 }] }));

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: !!disabled }}
      // Screen-reader users can't "hold"; double-tap activation is the explicit action for them.
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !disabled) onRelease();
      }}
      hitSlop={8}
    >
      <Animated.View style={[styles.button, disabled && styles.disabled, bodyStyle]}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <FeatherIcon />
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export const ReleaseButton = memo(ReleaseButtonBase);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.border,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.4 },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 236, 228, 0.55)',
    transformOrigin: 'left center',
  },
  label: { fontFamily: fonts.handBold, fontSize: 17, color: '#FFFFFF', includeFontPadding: false },
});
