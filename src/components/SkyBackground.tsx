import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, RadialGradient, Stop } from 'react-native-svg';

import { skyGradient } from '../constants/theme';

interface Props {
  /** 0 → 1: how much of the warm (venting) sky shows. */
  warmth: SharedValue<number>;
  /** 0 → 1: the hushed sky during the fade. */
  hush: SharedValue<number>;
  soft?: boolean;
}

/** Layered sky: base gradient + two cross-fading moods + a slow cloud bank at the bottom. */
function SkyBackgroundBase({ warmth, hush, soft }: Props) {
  const warmStyle = useAnimatedStyle(() => ({ opacity: warmth.value }));
  const hushStyle = useAnimatedStyle(() => ({ opacity: hush.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={skyGradient.base} locations={skyGradient.baseLocations} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, warmStyle]}>
        <LinearGradient colors={skyGradient.warm} locations={skyGradient.baseLocations} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, hushStyle]}>
        <LinearGradient colors={skyGradient.hush} locations={skyGradient.baseLocations} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <CloudBank soft={soft} />
    </View>
  );
}

export const SkyBackground = memo(SkyBackgroundBase);

/** Distant, hazy cloud bank hugging the bottom edge. Drifts a few px — barely noticeable. */
const CloudBank = memo(function CloudBank({ soft }: { soft?: boolean }) {
  const { width, height } = useWindowDimensions();
  const drift = useSharedValue(-14);

  useEffect(() => {
    if (soft) {
      drift.value = withTiming(0);
      return;
    }
    drift.value = withRepeat(withTiming(14, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [soft, drift]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }] }));
  const bankH = Math.min(260, height * 0.3);

  return (
    <Animated.View style={[styles.bank, { height: bankH, width: width + 60, left: -30 }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="puff" cx={0.5} cy={0.45} r={0.5}>
            <Stop offset="0" stopColor="#FFF4EC" stopOpacity={0.8} />
            <Stop offset="0.6" stopColor="#FBE3D6" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#F7DCCB" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G fill="url(#puff)">
          <Circle cx={30} cy={170} r={90} />
          <Circle cx={140} cy={190} r={85} />
          <Circle cx={250} cy={175} r={95} />
          <Circle cx={370} cy={165} r={95} />
          <Circle cx={90} cy={215} r={80} />
          <Circle cx={320} cy={220} r={80} />
        </G>
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  bank: { position: 'absolute', bottom: 0 },
});
