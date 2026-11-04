import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { fonts, glass, radius } from '../constants/theme';
import { FeatherIcon } from './Icons';

interface Props {
  label: string;
  a11yLabel: string;
  /** Shared hold progress from useHoldToRelease (the cloud uses the same value). */
  hold: SharedValue<number>;
  onPressIn: () => void;
  onPressOut: () => void;
  /** Screen readers can't "hold"; their activate action releases directly. */
  onAccessibleRelease: () => void;
}

/** "훌훌 날리기" chip. Fills up while held; a tap alone does nothing destructive. */
function ReleaseButtonBase({ label, a11yLabel, hold, onPressIn, onPressOut, onAccessibleRelease }: Props) {
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: hold.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - hold.value * 0.05 }] }));

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') onAccessibleRelease();
      }}
      hitSlop={8}
    >
      <Animated.View style={[styles.button, bodyStyle]}>
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
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 236, 228, 0.6)',
    transformOrigin: 'left center',
  },
  label: { fontFamily: fonts.handBold, fontSize: 16, color: '#FFFFFF', includeFontPadding: false },
});
