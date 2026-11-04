import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  breathLoop,
  CLOUD_MOOD_TARGETS,
  exhaleSequence,
  floatLoop,
  toMoodScale,
} from '../animations/cloudAnimations';
import { FADE_DURATION_MS } from '../constants/config';
import { cloudColors as C } from '../constants/theme';
import type { CloudMood } from '../types';

/** Artboard. Everything in the SVG is drawn in these units. */
const VB_W = 240;
const VB_H = 160;
export const CLOUD_ASPECT = VB_H / VB_W;
/** Mouth position as a fraction of the artboard (used to aim the breath particles). */
export const CLOUD_MOUTH = { x: 120 / VB_W, y: 116 / VB_H };

interface Props {
  mood: CloudMood;
  width: number;
  /** Soft = minimal motion (Reduce Motion or user preference). */
  soft?: boolean;
}

/**
 * The one and only cloud. Mood changes colour, size and face — never the silhouette —
 * so every state reads as the same character.
 */
function CloudCharacterBase({ mood, width, soft = false }: Props) {
  const height = width * CLOUD_ASPECT;

  const bob = useSharedValue(0);
  const breath = useSharedValue(1);
  const moodScale = useSharedValue(1);
  const pink = useSharedValue(0);
  const glow = useSharedValue(CLOUD_MOOD_TARGETS.rest.glow);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const zz = useSharedValue(0);

  // Idle life: float + breathe. Agitated moods breathe faster.
  useEffect(() => {
    if (soft) {
      cancelAnimation(bob);
      cancelAnimation(breath);
      bob.value = withTiming(0);
      breath.value = withTiming(1);
      return;
    }
    const agitated = mood === 'building' || mood === 'burst';
    bob.value = floatLoop(agitated ? 3 : 5, agitated ? 1600 : 3600);
    breath.value = breathLoop(agitated ? 0.025 : 0.015, agitated ? 1400 : 4400);
  }, [mood, soft, bob, breath]);

  // Mood targets.
  useEffect(() => {
    const t = CLOUD_MOOD_TARGETS[mood];
    moodScale.value = soft ? withTiming(1 + (t.scale - 1) * 0.4) : toMoodScale(t.scale);
    pink.value = withTiming(t.pink, { duration: 600 });
    glow.value = withTiming(t.glow, { duration: 600 });

    if (mood === 'fade' && !soft) {
      const { scaleX, scaleY } = exhaleSequence(FADE_DURATION_MS);
      sx.value = scaleX;
      sy.value = scaleY;
    } else {
      sx.value = withTiming(1, { duration: 400 });
      sy.value = withTiming(1, { duration: 400 });
    }

    // Sleepy motion strokes only while resting.
    if (mood === 'rest' && !soft) {
      zz.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      zz.value = withTiming(mood === 'rest' ? 0.7 : 0, { duration: 300 });
    }
  }, [mood, soft, moodScale, pink, glow, sx, sy, zz]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { scaleX: moodScale.value * (1 + (breath.value - 1) * 0.6) * sx.value },
      { scaleY: moodScale.value * breath.value * sy.value },
    ],
  }));
  const pinkStyle = useAnimatedStyle(() => ({ opacity: pink.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.9 + glow.value * 0.2 }],
  }));
  const zzStyle = useAnimatedStyle(() => ({ opacity: zz.value }));
  const shadowStyle = useAnimatedStyle(() => ({
    // Shadow tightens as the cloud floats up.
    transform: [{ scaleX: 1 + bob.value * 0.012 }],
    opacity: 0.9 + bob.value * 0.02,
  }));

  return (
    <View style={{ width, height }} pointerEvents="none" accessible={false}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, glowStyle]}>
        <Glow width={width} height={height} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        <GroundShadow width={width} height={height} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.bottomOrigin, bodyStyle]}>
        <Body width={width} height={height} tone="ivory" />
        <Animated.View style={[StyleSheet.absoluteFill, pinkStyle]}>
          <Body width={width} height={height} tone="pink" />
        </Animated.View>
        <Face width={width} height={height} mood={mood} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, zzStyle]}>
        <SleepStrokes width={width} height={height} />
      </Animated.View>
    </View>
  );
}

export const CloudCharacter = memo(CloudCharacterBase);

/* ───────────────────────── SVG layers ───────────────────────── */

type Size = { width: number; height: number };

/** Silhouette pieces. Drawn twice (light + shading) with userSpace gradients → seamless. */
function Silhouette({ fill }: { fill: string }) {
  return (
    <G fill={fill}>
      <Path d="M46,140 C40,76 78,34 120,34 C162,34 200,76 194,140 Z" />
      <Ellipse cx={42} cy={126} rx={32} ry={21} />
      <Ellipse cx={198} cy={126} rx={32} ry={21} />
      <Rect x={18} y={124} width={204} height={22} rx={11} />
    </G>
  );
}

const Body = memo(function Body({ width, height, tone }: Size & { tone: 'ivory' | 'pink' }) {
  const hi = tone === 'ivory' ? C.bodyHighlight : C.pinkHighlight;
  const mid = tone === 'ivory' ? C.bodyMid : C.pinkMid;
  const edge = tone === 'ivory' ? C.bodyEdge : C.pinkEdge;
  const id = tone;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <RadialGradient id={`${id}-body`} cx={98} cy={58} r={150} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={hi} />
          <Stop offset="0.45" stopColor={mid} />
          <Stop offset="1" stopColor={edge} />
        </RadialGradient>
        <LinearGradient id={`${id}-shade`} x1={0} y1={70} x2={0} y2={150} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={C.bodyShade} stopOpacity={0} />
          <Stop offset="1" stopColor={C.bodyShade} stopOpacity={tone === 'ivory' ? 0.55 : 0.25} />
        </LinearGradient>
        <RadialGradient id={`${id}-paw`} cx={0.4} cy={0.3} r={0.8}>
          <Stop offset="0" stopColor={hi} />
          <Stop offset="1" stopColor={mid} />
        </RadialGradient>
        <RadialGradient id={`${id}-spec`} cx={0.5} cy={0.5} r={0.5}>
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Silhouette fill={`url(#${id}-body)`} />
      <Silhouette fill={`url(#${id}-shade)`} />

      {/* soft specular highlight, top-left */}
      <Ellipse cx={92} cy={60} rx={34} ry={16} fill={`url(#${id}-spec)`} transform="rotate(-18 92 60)" />

      {/* little front paws */}
      <Ellipse cx={90} cy={141} rx={17} ry={10.5} fill={`url(#${id}-paw)`} stroke={edge} strokeOpacity={0.55} strokeWidth={1} />
      <Ellipse cx={150} cy={141} rx={17} ry={10.5} fill={`url(#${id}-paw)`} stroke={edge} strokeOpacity={0.55} strokeWidth={1} />
    </Svg>
  );
});

const GroundShadow = memo(function GroundShadow({ width, height }: Size) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Defs>
        <RadialGradient id="ground" cx={0.5} cy={0.5} r={0.5}>
          <Stop offset="0" stopColor={C.shadow} stopOpacity={0.32} />
          <Stop offset="1" stopColor={C.shadow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={120} cy={151} rx={112} ry={9} fill="url(#ground)" />
    </Svg>
  );
});

const Glow = memo(function Glow({ width, height }: Size) {
  return (
    <Svg width={width * 1.6} height={height * 1.6} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="halo" cx={0.5} cy={0.55} r={0.5}>
          <Stop offset="0" stopColor={C.glow} stopOpacity={0.75} />
          <Stop offset="0.55" stopColor={C.glow} stopOpacity={0.22} />
          <Stop offset="1" stopColor={C.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={50} cy={55} rx={50} ry={42} fill="url(#halo)" />
    </Svg>
  );
});

const SleepStrokes = memo(function SleepStrokes({ width, height }: Size) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <G stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeOpacity={0.9}>
        <Path d="M196,40 L201,27" />
        <Path d="M207,48 L217,38" />
        <Path d="M212,60 L224,56" />
      </G>
    </Svg>
  );
});

/**
 * Face. Small, quiet, never exaggerated.
 *  rest  ‿ ‿  sleeping        calm  • •  awake
 *  building  • •  flatter mouth, warmer cheeks
 *  burst  > <  scrunched      fade  ‿ ‿  + "o" exhale
 */
const Face = memo(function Face({
  width,
  height,
  mood,
}: Size & { mood: CloudMood }) {
  const stroke = { stroke: C.face, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  const cheekOpacity = mood === 'burst' ? 0.75 : mood === 'building' ? 0.6 : 0.4;

  let eyes: React.ReactNode;
  let mouth: React.ReactNode;
  switch (mood) {
    case 'calm':
    case 'building':
      eyes = (
        <G fill={C.face}>
          <Ellipse cx={104} cy={105} rx={2.8} ry={3.6} />
          <Ellipse cx={136} cy={105} rx={2.8} ry={3.6} />
        </G>
      );
      mouth =
        mood === 'calm' ? (
          <Path d="M115,115 Q120,119 125,115" {...stroke} />
        ) : (
          <Path d="M116,116 L124,116" {...stroke} />
        );
      break;
    case 'burst':
      eyes = (
        <G {...stroke} strokeLinejoin="round">
          <Path d="M97,99 L108,105 L97,111" />
          <Path d="M143,99 L132,105 L143,111" />
        </G>
      );
      mouth = <Path d="M116,118 Q120,113 124,118" {...stroke} />;
      break;
    case 'fade':
      eyes = (
        <G {...stroke}>
          <Path d="M97,104 Q104,110 111,104" />
          <Path d="M129,104 Q136,110 143,104" />
        </G>
      );
      mouth = <Ellipse cx={120} cy={117} rx={3.2} ry={3.8} fill={C.face} fillOpacity={0.85} />;
      break;
    case 'rest':
    default:
      eyes = (
        <G {...stroke}>
          <Path d="M97,104 Q104,110 111,104" />
          <Path d="M129,104 Q136,110 143,104" />
        </G>
      );
      mouth = <Path d="M117,115 Q120,117.5 123,115" {...stroke} strokeWidth={2.2} />;
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} style={StyleSheet.absoluteFill}>
      <Ellipse cx={92} cy={115} rx={8} ry={4.5} fill={C.cheek} opacity={cheekOpacity} />
      <Ellipse cx={148} cy={115} rx={8} ry={4.5} fill={C.cheek} opacity={cheekOpacity} />
      {eyes}
      {mouth}
    </Svg>
  );
});

const styles = StyleSheet.create({
  bottomOrigin: { transformOrigin: 'center bottom' },
  glow: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
});
