import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { fonts, radius } from '../constants/theme';
import { FeatherIcon } from './Icons';

const ROSE = '#A8687E';

interface Props {
  label: string;
  a11yLabel: string;
  /** Hold progress of the cloud (holding the cloud fills this button too). */
  hold: SharedValue<number>;
  /** A single tap blows everything away. */
  onRelease: () => void;
  /** Calm motion (in-app animation setting). */
  soft?: boolean;
}

/**
 * "훌훌 날리기" — the one call to action while venting, so it is the warmest thing on screen:
 * a blush→peach pill with a soft glow that gently breathes. Fills up white while held;
 * a tap alone does nothing destructive.
 */
function ReleaseButtonBase({ label, a11yLabel, hold, onRelease, soft: reduced = false }: Props) {
  const beat = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [reduced, beat]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: hold.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + beat.value * 0.04) * (1 - hold.value * 0.06) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + beat.value * 0.35 + hold.value * 0.3,
    transform: [{ scaleX: 1.04 + beat.value * 0.06 }, { scaleY: 1.12 + beat.value * 0.18 }],
  }));

  return (
    <Pressable onPress={onRelease} accessibilityRole="button" accessibilityLabel={a11yLabel} hitSlop={10}>
      {({ pressed }) => (
      <Animated.View style={[bodyStyle, pressed && styles.pressed]}>
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        <View style={styles.shadow}>
          <View style={styles.button}>
            <LinearGradient
              colors={['#F9D3DA', '#FBE0D6', '#FDEDE3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.fill, fillStyle]} />
            <FeatherIcon color={ROSE} />
            <Text style={styles.label} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
          </View>
        </View>
      </Animated.View>
      )}
    </Pressable>
  );
}

export const ReleaseButton = memo(ReleaseButtonBase);

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  halo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 214, 222, 0.6)',
  },
  shadow: {
    borderRadius: radius.pill,
    backgroundColor: '#FBE0D6', // Android elevation needs a solid surface to cast from
    ...Platform.select({
      ios: { shadowColor: '#C9708A', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      default: { elevation: 6 },
    }),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transformOrigin: 'left center',
  },
  label: {
    fontFamily: fonts.handBold,
    fontSize: 21,
    // Dusky rose on the pale pill — keeps the label readable now that the pill is lighter.
    color: ROSE,
    includeFontPadding: false,
  },
});
