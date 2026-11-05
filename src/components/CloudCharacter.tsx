import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { breathLoop, CLOUD_MOOD_TARGETS, floatLoop, toMoodScale } from '../animations/cloudAnimations';
import { BLOW } from '../animations/fadeAnimations';
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
  /** 0 → 1: how much feeling the cloud has swallowed. Swells and blushes the cloud. */
  charge?: SharedValue<number>;
  /** 0 → 1 → 0 "gulp" each time a spark of feeling lands. */
  pulse?: SharedValue<number>;
  /** 0 → 1 while the user is holding the cloud to release (it inhales, squishing down). */
  hold?: SharedValue<number>;
  /** 0 → 1 open mouth: catching the sparks that fly in (snaps shut on each gulp). */
  gape?: SharedValue<number>;
  /** The release progress (0 → 1): inhale, big "후우~" blow, relief — see BLOW. */
  blow?: SharedValue<number>;
}

/**
 * The one and only cloud. Mood changes colour, size and face — never the silhouette —
 * so every state reads as the same character.
 */
function CloudCharacterBase({
  mood,
  width,
  soft = false,
  charge: chargeIn,
  pulse: pulseIn,
  hold: holdIn,
  gape: gapeIn,
  blow: blowIn,
}: Props) {
  const height = width * CLOUD_ASPECT;
  const zero = useSharedValue(0);
  const charge = chargeIn ?? zero;
  const pulse = pulseIn ?? zero;
  const hold = holdIn ?? zero;
  const gape = gapeIn ?? zero;
  const blow = blowIn ?? zero;
  const rays = useSharedValue(0);

  const bob = useSharedValue(0);
  const breath = useSharedValue(1);
  const moodScale = useSharedValue(1);
  const pink = useSharedValue(0);
  const glow = useSharedValue(CLOUD_MOOD_TARGETS.rest.glow);
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

    // Burst: little anger rays flicker around the head.
    if (mood === 'burst') {
      rays.value = withRepeat(
        withSequence(withTiming(1, { duration: 140 }), withTiming(0.55, { duration: 220 })),
        -1,
        true,
      );
    } else {
      rays.value = withTiming(0, { duration: 250 });
    }
  }, [mood, soft, moodScale, pink, glow, zz, rays]);

  const bodyStyle = useAnimatedStyle(() => {
    const swell = 1 + charge.value * 0.24; // full of feelings → noticeably plumper
    // Gulp: squash wide, then (spring overshoot below 0) stretch tall — "꿀꺽".
    const gulpX = 1 + pulse.value * 0.11;
    const gulpY = 1 - pulse.value * 0.12;
    const squishX = 1 + hold.value * 0.1; // holding: the cloud draws a deep breath in
    const squishY = 1 - hold.value * 0.12;
    // Release: big inhale → squashed, trembling blow → small relieved settle.
    const g = soft ? 0 : blow.value;
    const K = [0, BLOW.inhaleEnd, BLOW.blowStart, BLOW.blowEnd, 0.86, 1];
    const bx = interpolate(g, K, [1, 1.12, 1.05, 1.02, 0.94, 1], Extrapolation.CLAMP);
    const by = interpolate(g, K, [1, 1.18, 0.84, 0.88, 0.96, 1], Extrapolation.CLAMP);
    const shake = g > BLOW.blowStart && g < BLOW.blowEnd ? Math.sin(g * 300) * 1.8 : 0;
    return {
      transform: [
        { translateX: shake },
        { translateY: bob.value },
        { scaleX: moodScale.value * swell * gulpX * squishX * (1 + (breath.value - 1) * 0.6) * bx },
        { scaleY: moodScale.value * swell * gulpY * squishY * breath.value * by },
      ],
    };
  });
  // Faces for the release, cross-faded on the same clock as the body.
  const inhaleFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blow.value, [0, 0.03, BLOW.inhaleEnd, BLOW.blowStart - 0.02], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const blowFaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blow.value, [BLOW.inhaleEnd, BLOW.blowStart - 0.02, BLOW.blowEnd, 0.8], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));
  const moodFaceStyle = useAnimatedStyle(() => {
    const g = blow.value;
    const special = g > 0.005 && g < 0.8 ? interpolate(g, [0, 0.03, 0.72, 0.8], [0, 1, 1, 0], Extrapolation.CLAMP) : 0;
    return { opacity: 1 - special };
  });
  const gapeStyle = useAnimatedStyle(() => ({
    opacity: blow.value > 0.005 && blow.value < 0.99 ? 0 : gape.value,
    transform: [{ scaleY: 0.5 + gape.value * 0.5 }],
  }));
  const pinkStyle = useAnimatedStyle(() => ({ opacity: Math.max(pink.value, charge.value * 0.8) }));
  const pinkGlowStyle = useAnimatedStyle(() => ({
    opacity: Math.max(pink.value, charge.value) * 0.9,
    transform: [{ scale: 0.95 + charge.value * 0.25 + pulse.value * 0.05 }],
  }));
  const raysStyle = useAnimatedStyle(() => ({
    opacity: rays.value,
    transform: [{ scale: 0.92 + rays.value * 0.12 + charge.value * 0.15 }],
  }));
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
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, pinkGlowStyle]}>
        <Glow width={width} height={height} color={C.pinkEdge} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, raysStyle]}>
        <BurstRays width={width} height={height} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        <GroundShadow width={width} height={height} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.bottomOrigin, bodyStyle]}>
        <Body width={width} height={height} tone="ivory" />
        <Animated.View style={[StyleSheet.absoluteFill, pinkStyle]}>
          <Body width={width} height={height} tone="pink" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, moodFaceStyle]}>
          <Face width={width} height={height} mood={mood} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.mouthOrigin, gapeStyle]}>
          <GapeMouth width={width} height={height} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, inhaleFaceStyle]}>
          <InhaleFace width={width} height={height} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, blowFaceStyle]}>
          <BlowFace width={width} height={height} />
        </Animated.View>
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

const Glow = memo(function Glow({ width, height, color = C.glow }: Size & { color?: string }) {
  const id = `halo-${color.replace('#', '')}`;
  return (
    <Svg width={width * 1.6} height={height * 1.6} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx={0.5} cy={0.55} r={0.5}>
          <Stop offset="0" stopColor={color} stopOpacity={0.75} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={50} cy={55} rx={50} ry={42} fill={`url(#${id})`} />
    </Svg>
  );
});

/** Short coral strokes radiating from the head — only visible in BURST. */
const BurstRays = memo(function BurstRays({ width, height }: Size) {
  // Drawn on a 1.6× canvas centred on the cloud, angles fanned over the top half.
  const angles = [-160, -135, -112, -90, -68, -45, -20];
  return (
    <Svg width={width * 1.6} height={height * 1.6} viewBox="0 0 200 200">
      <G stroke="#FFD9D2" strokeWidth={3} strokeLinecap="round">
        {angles.map((a) => {
          const r = (a * Math.PI) / 180;
          const cx = 100;
          const cy = 118;
          const r1 = 70;
          const r2 = a === -90 ? 88 : 82;
          return (
            <Path
              key={a}
              d={`M${cx + Math.cos(r) * r1 * 1.25},${cy + Math.sin(r) * r1} L${cx + Math.cos(r) * r2 * 1.25},${cy + Math.sin(r) * r2}`}
            />
          );
        })}
      </G>
      <G stroke="#F2A3A0" strokeWidth={1.6} strokeLinecap="round" opacity={0.9}>
        <Path d="M160,40 l6,-6 M166,46 l8,-2 M158,48 l-1,7" />
      </G>
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
      mouth = <Path d="M114,115 Q120,121 126,115" {...stroke} />;
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

/** "아~" — open mouth catching the incoming sparks. */
const GapeMouth = memo(function GapeMouth({ width, height }: Size) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Ellipse cx={120} cy={117.5} rx={7.5} ry={7} fill={C.face} />
      <Ellipse cx={120} cy={121.2} rx={4.4} ry={2.6} fill={C.cheek} />
    </Svg>
  );
});

/** Deep breath in: eyes squeezed, cheeks puffed, lips pressed. */
const InhaleFace = memo(function InhaleFace({ width, height }: Size) {
  const stroke = { stroke: C.face, strokeWidth: 2.8, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Ellipse cx={89} cy={114} rx={12} ry={8} fill={C.cheek} opacity={0.75} />
      <Ellipse cx={151} cy={114} rx={12} ry={8} fill={C.cheek} opacity={0.75} />
      <G {...stroke}>
        <Path d="M97,101 L109,105 L97,108" />
        <Path d="M143,101 L131,105 L143,108" />
        <Path d="M116,117 Q120,115.5 124,117" />
      </G>
    </Svg>
  );
});

/** "후우~": pursed "O" lips, puffed cheeks, eyes shut tight with effort. */
const BlowFace = memo(function BlowFace({ width, height }: Size) {
  const stroke = { stroke: C.face, strokeWidth: 2.8, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Ellipse cx={88} cy={113} rx={13} ry={9} fill={C.cheek} opacity={0.8} />
      <Ellipse cx={152} cy={113} rx={13} ry={9} fill={C.cheek} opacity={0.8} />
      <G {...stroke}>
        <Path d="M97,101 Q104,97 111,101" />
        <Path d="M129,101 Q136,97 143,101" />
      </G>
      <Ellipse cx={120} cy={117} rx={6} ry={6.5} fill="none" stroke={C.face} strokeWidth={3} />
      <Ellipse cx={120} cy={117} rx={3} ry={3.4} fill={C.face} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  mouthOrigin: { transformOrigin: '50% 73%' },
  bottomOrigin: { transformOrigin: 'center bottom' },
  glow: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
});
