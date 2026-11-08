import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { PanResponder, StyleSheet, Text, View, type TextLayoutEvent, type ViewInstance } from 'react-native';

type TextLayoutLine = TextLayoutEvent['nativeEvent']['lines'][number];
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { BLOW, mulberry32 } from '../animations/fadeAnimations';
import { fonts } from '../constants/theme';
import {
  bounds,
  centroid,
  extendThrough,
  pointInPoly,
  polyPaths,
  rectPoly,
  resample,
  roughen,
  splitByPath,
  type Poly,
  type Pt,
} from '../utils/tearGeometry';

/** Enough scraps to feel shredded, few enough to stay smooth. */
export const MAX_PIECES = 16;

/** Translucent pastel "cloud tissue" — the sky shows through, white handwriting. */
const TISSUE_A = 'rgba(255, 244, 247, 0.62)';
const TISSUE_B = 'rgba(234, 226, 250, 0.40)';
const EDGE = 'rgba(255, 255, 255, 0.7)';
const FLUFF = 'rgba(255, 255, 255, 0.95)';
const FONT = 26;
const LINE = 36;
const PAD = 18;
const TUFTS = 4;

export interface TearPaperHandle {
  /** Rip it once along a random wobbly line (timer releases / a tap without tearing). */
  tearRandom: () => void;
  pieces: () => number;
}

interface Props {
  ref?: Ref<TearPaperHandle>;
  text: string;
  width: number;
  height: number;
  /** Paper's top inside the layer. */
  top: number;
  /** True while the user may tear; false once the cloud is blowing. */
  interactive: boolean;
  /** A tear just happened; `pieces` = how many scraps there are now. */
  onTorn: (pieces: number) => void;
  onTap: () => void;
  /** Finger down / up on the sheet (the cloud waits while you are still tearing). */
  onDragStart: () => void;
  onDragEnd: () => void;
  /** Every drag move: finger speed (px/s) and distance since the last move (px). */
  onScrub: (speed: number, dist: number) => void;
  progress: SharedValue<number>;
  /** The cloud's mouth in this layer's coordinates. */
  origin: { x: number; y: number };
  gentle: boolean;
  seed: number;
  hint: string;
  a11yLabel: string;
}

interface Scrap {
  id: number;
  poly: Poly;
  /** Where it has drifted to (and drifted from, for the spring when it is born). */
  off: Pt;
  from: Pt;
}

/**
 * "찢어서 홀씨": the note becomes a sheet of soft cloud tissue that tears exactly where the finger
 * goes — curves, zigzags and all. A tear that stops inside the sheet runs on to the edge. When the
 * cloud blows, every scrap flutters away and crumbles into dandelion seeds.
 *
 * Each scrap is an SVG polygon clipping the same page (tissue + handwriting), so neighbouring
 * scraps share their torn edge exactly.
 */
function TearPaperBase(props: Props) {
  const { ref, text, width: W, height: H, top, interactive, progress, origin, gentle, seed, hint, a11yLabel } = props;
  const latest = useRef(props);
  latest.current = props;

  const [scraps, setScraps] = useState<Scrap[]>(() => [
    { id: 0, poly: rectPoly(W, H), off: { x: 0, y: 0 }, from: { x: 0, y: 0 } },
  ]);
  const scrapsRef = useRef(scraps);
  const nextId = useRef(1);
  const tearNo = useRef(0);
  const [lines, setLines] = useState<TextLayoutLine[]>([]);

  /** Tear every scrap the path runs through. */
  const tearAlong = useCallback(
    (raw: Pt[]) => {
      if (raw.length < 2) return;
      const cur = scrapsRef.current;
      let room = MAX_PIECES - cur.length;
      if (room <= 0) return;
      const path = roughen(extendThrough(resample(raw, 5), W, H), seed + ++tearNo.current);
      const next: Scrap[] = [];
      for (const s of cur) {
        const parts = room > 0 ? splitByPath(s.poly, path) : [s.poly];
        if (parts.length === 1 || parts.length - 1 > room) {
          next.push(s);
          continue;
        }
        room -= parts.length - 1;
        const c0 = centroid(s.poly.pts);
        for (const poly of parts) {
          const c = centroid(poly.pts);
          const len = Math.hypot(c.x - c0.x, c.y - c0.y) || 1;
          const give = 4.5; // the halves give a little as they come apart
          next.push({
            id: nextId.current++,
            poly,
            from: s.off,
            off: { x: s.off.x + ((c.x - c0.x) / len) * give, y: s.off.y + ((c.y - c0.y) / len) * give },
          });
        }
      }
      if (next.length === cur.length) return;
      scrapsRef.current = next;
      setScraps(next);
      latest.current.onTorn(next.length);
    },
    [W, H, seed],
  );

  useImperativeHandle(
    ref,
    () => ({
      tearRandom() {
        const vertical = tearNo.current % 2 === 0;
        const base = 0.35 + 0.3 * Math.random();
        const f1 = 1.2 + Math.random() * 1.5;
        const ph = Math.random() * 6;
        const pts: Pt[] = [];
        for (let i = 0; i <= 10; i++) {
          const k = i / 10;
          const wob = Math.sin(k * Math.PI * f1 + ph) * 18;
          pts.push(vertical ? { x: W * base + wob, y: -10 + (H + 20) * k } : { x: -10 + (W + 20) * k, y: H * base + wob });
        }
        tearAlong(pts);
      },
      pieces: () => scrapsRef.current.length,
    }),
    [W, H, tearAlong],
  );

  /* ───────── the finger ───────── */
  const paperRef = useRef<ViewInstance>(null);
  const paperAt = useRef({ x: 0, y: 0 });
  const stroke = useRef<Pt[]>([]);
  const moved = useRef(0);
  const lastMove = useRef({ t: 0, speed: 0 });
  const tore = useRef(false);
  const live = useRef<LiveTearHandle>(null);
  const tearRef = useRef(tearAlong);
  tearRef.current = tearAlong;

  const pan = useMemo(() => {
    const toLocal = (pageX: number, pageY: number) => ({ x: pageX - paperAt.current.x, y: pageY - paperAt.current.y });
    const inside = (p: Pt) => {
      const { width, height } = latest.current;
      return p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.interactive,
      onMoveShouldSetPanResponder: () => latest.current.interactive,
      onPanResponderGrant: (e) => {
        const { pageX, pageY, locationX, locationY } = e.nativeEvent;
        // Close enough right away (the touch lands on the sheet); refined by an async measure.
        paperAt.current = { x: pageX - locationX, y: pageY - locationY };
        paperRef.current?.measureInWindow((x, y) => (paperAt.current = { x, y }));
        stroke.current = [toLocal(pageX, pageY)];
        moved.current = 0;
        lastMove.current = { t: Date.now(), speed: 0 };
        tore.current = false;
        latest.current.onDragStart();
      },
      onPanResponderMove: (_, g) => {
        if (!latest.current.interactive) return;
        const p = toLocal(g.moveX, g.moveY);
        const s = stroke.current;
        const last = s[s.length - 1];
        const d = Math.hypot(p.x - last.x, p.y - last.y);
        if (d < 3) return;
        moved.current += d;
        // The tearing sound follows the finger: how fast it is moving right now.
        const now = Date.now();
        const dt = Math.max(8, now - lastMove.current.t);
        const speed = lastMove.current.speed * 0.4 + ((d / dt) * 1000) * 0.6;
        lastMove.current = { t: now, speed };
        latest.current.onScrub(speed, d);
        s.push(p);
        live.current?.set(s);
        // Ran off the sheet: that tear is complete — rip now and keep going with a fresh one.
        if (!inside(p) && s.some(inside) && pathLength(s) > 24) {
          tearRef.current(s);
          tore.current = true;
          stroke.current = [p];
          live.current?.set([]);
        }
      },
      onPanResponderRelease: () => {
        const p = latest.current;
        if (p.interactive) {
          if (!tore.current && moved.current < 10) p.onTap();
          else if (stroke.current.length > 1 && pathLength(stroke.current) > 24) tearRef.current(stroke.current);
        }
        stroke.current = [];
        live.current?.set([]);
        p.onDragEnd();
      },
      onPanResponderTerminate: () => {
        stroke.current = [];
        live.current?.set([]);
        latest.current.onDragEnd();
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, []);

  const many = scraps.length > 1;

  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      {/* Invisible twin of the page, only to learn where the lines break. */}
      <Text
        style={[styles.measure, { width: W - PAD * 2 }]}
        onTextLayout={(e) => setLines(e.nativeEvent.lines)}
        maxFontSizeMultiplier={1.2}
        accessible={false}
        importantForAccessibility="no"
      >
        {text}
      </Text>
      <Animated.View
        ref={paperRef}
        entering={FadeIn.duration(260)}
        style={{ width: W, height: H }}
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onAccessibilityTap={() => latest.current.onTap()}
        {...pan.panHandlers}
      >
        {scraps.map((s) => (
          <Piece key={s.id} scrap={s} W={W} H={H} lines={lines} top={top} seed={seed} gentle={gentle} progress={progress} origin={origin} />
        ))}
        <LiveTear ref={live} W={W} H={H} />
      </Animated.View>
      {interactive && (
        <Animated.Text key={many ? 'more' : 'first'} entering={FadeIn.duration(300)} style={styles.hint} maxFontSizeMultiplier={1.3}>
          {hint}
        </Animated.Text>
      )}
    </View>
  );
}

export const TearPaper = memo(TearPaperBase);

function pathLength(p: Pt[]) {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
  return l;
}

/* ───────── the tear following the finger, before it rips ───────── */

interface LiveTearHandle {
  set: (pts: Pt[]) => void;
}

function LiveTear({ ref, W, H }: { ref?: Ref<LiveTearHandle>; W: number; H: number }) {
  const [pts, setPts] = useState('');
  useImperativeHandle(ref, () => ({
    set: (p) => setPts(p.length > 1 ? p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ') : ''),
  }));
  if (!pts) return null;
  return (
    <Svg width={W} height={H} style={styles.abs} pointerEvents="none">
      <Polyline points={pts} stroke="rgba(255,255,255,0.5)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Polyline points={pts} stroke="#FFFFFF" strokeWidth={2.2} strokeDasharray="3 5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ───────── flight ───────── */

interface FlightParams {
  /** Paper top in the layer (tufts live inside the paper; flight maths uses layer coords). */
  top: number;
  cx: number;
  cy: number;
  j1: number;
  j2: number;
  travel: number;
  lift: number;
  fan: number;
  spin: number;
  flutter: number;
  sway: number;
  freq: number;
  phase: number;
  tufts: { lx: number; ly: number; dx: number; dy: number; size: number }[];
}

function paramsFor(seed: number, s: Scrap, top: number, gentle: boolean): FlightParams {
  const rnd = mulberry32((seed * 31 + s.id * 7919) >>> 0);
  const k = gentle ? 0.3 : 1;
  const c = centroid(s.poly.pts);
  const b = bounds(s.poly.pts);
  // Seeds are released from inside the scrap.
  const tufts: FlightParams['tufts'] = [];
  for (let tries = 0; tufts.length < TUFTS && tries < 40; tries++) {
    const q = { x: b.x0 + rnd() * (b.x1 - b.x0), y: b.y0 + rnd() * (b.y1 - b.y0) };
    if (!pointInPoly(q, s.poly.pts)) continue;
    tufts.push({ lx: q.x - c.x, ly: q.y - c.y, dx: (rnd() - 0.5) * 140 * k, dy: -(40 + rnd() * 90) * k, size: 4 + rnd() * 3 });
  }
  return {
    top,
    cx: c.x,
    cy: top + c.y,
    j1: rnd(),
    j2: rnd(),
    travel: (320 + rnd() * 320) * k,
    lift: (160 + rnd() * 180) * k,
    fan: (rnd() - 0.5) * 1.2,
    spin: (rnd() - 0.5) * 300 * k,
    flutter: (40 + rnd() * 40) * k,
    sway: (14 + rnd() * 20) * k,
    freq: 0.8 + rnd() * 0.8,
    phase: rnd() * Math.PI * 2,
    tufts,
  };
}

/** Shared flight math (UI thread): 0→1 clock of a scrap and where the wind has carried it. */
function flight(g: number, p: FlightParams, ox: number, oy: number) {
  'worklet';
  const gx = p.cx - ox;
  const gy = p.cy - oy;
  const ang = Math.atan2(gy, gx) + p.fan;
  const start = Math.min(0.7, BLOW.blowStart + p.j1 * 0.1);
  const life = Math.max(0.15, Math.min(0.5 + p.j2 * 0.2, 0.995 - start));
  const t = Math.min(1, Math.max(0, (g - start) / life));
  const e = 1 - Math.pow(1 - t, 2.2);
  const sway = Math.sin(t * Math.PI * 2 * p.freq + p.phase) * p.sway * t;
  return {
    t,
    e,
    start,
    tx: Math.cos(ang) * p.travel * e + sway,
    ty: Math.sin(ang) * p.travel * e * 0.8 - p.lift * t,
  };
}

/* ───────── a scrap ───────── */

const Piece = memo(function Piece({
  scrap,
  W,
  H,
  lines,
  top,
  seed,
  gentle,
  progress,
  origin,
}: {
  scrap: Scrap;
  W: number;
  H: number;
  lines: TextLayoutLine[];
  top: number;
  seed: number;
  gentle: boolean;
  progress: SharedValue<number>;
  origin: { x: number; y: number };
}) {
  const p = useMemo(() => paramsFor(seed, scrap, top, gentle), [seed, scrap, top, gentle]);
  const paths = useMemo(() => polyPaths(scrap.poly), [scrap.poly]);
  const clipId = `scrap-${scrap.id}`;

  const offX = useSharedValue(scrap.from.x);
  const offY = useSharedValue(scrap.from.y);
  useEffect(() => {
    offX.value = withSpring(scrap.off.x, { damping: 11, stiffness: 190 });
    offY.value = withSpring(scrap.off.y, { damping: 11, stiffness: 190 });
  }, [scrap.off.x, scrap.off.y, offX, offY]);

  const style = useAnimatedStyle(() => {
    const g = progress.value;
    const f = flight(g, p, origin.x, origin.y);
    const inhale = interpolate(g, [0, BLOW.inhaleEnd, BLOW.blowStart], [0, 1, 0.6], Extrapolation.CLAMP);
    const shiver = g < f.start ? Math.sin(g * 90 + p.phase) * inhale * 1.6 : 0;
    return {
      opacity: interpolate(f.t, [0, 0.45, 0.78], [1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: offX.value + f.tx + shiver },
        { translateY: offY.value + f.ty },
        { perspective: 600 },
        { rotateY: `${Math.sin(f.t * Math.PI * 2.2 + p.phase) * p.flutter * f.t}deg` },
        { rotate: `${p.spin * f.e}deg` },
        { scale: 1 - 0.35 * f.t },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, { width: W, height: H, transformOrigin: [p.cx, p.cy - p.top, 0] }, style]}
      >
        <Svg width={W} height={H}>
          <Defs>
            <ClipPath id={clipId}>
              <Path d={paths.fill} />
            </ClipPath>
            {/* One gradient across the whole sheet, so the scraps still read as one piece. */}
            <LinearGradient id={`${clipId}-g`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={H}>
              <Stop offset="0" stopColor={TISSUE_A} />
              <Stop offset="1" stopColor={TISSUE_B} />
            </LinearGradient>
          </Defs>
          <Path d={paths.fill} fill={`url(#${clipId}-g)`} stroke={EDGE} strokeWidth={1.2} />
          <G clipPath={`url(#${clipId})`}>
            {lines.map((l, i) => {
              const y = PAD + l.y + l.height / 2 + FONT * 0.34;
              const x = PAD + l.x;
              const str = l.text.replace(/\n$/, '');
              return (
                <G key={i}>
                  <SvgText x={x} y={y + 1.2} fontFamily={fonts.hand} fontSize={FONT} fill="rgba(110, 90, 140, 0.28)">
                    {str}
                  </SvgText>
                  <SvgText x={x} y={y} fontFamily={fonts.hand} fontSize={FONT} fill="#FFFFFF">
                    {str}
                  </SvgText>
                </G>
              );
            })}
          </G>
          {paths.torn ? (
            <Path d={paths.torn} stroke={FLUFF} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ) : null}
        </Svg>
      </Animated.View>
      {p.tufts.map((tf, i) => (
        <Tuft key={i} tuft={tf} params={p} progress={progress} origin={origin} />
      ))}
    </>
  );
});

/** A seed released from a scrap as it crumbles, carried on by the same breath. */
function Tuft({
  tuft,
  params: p,
  progress,
  origin,
}: {
  tuft: FlightParams['tufts'][number];
  params: FlightParams;
  progress: SharedValue<number>;
  origin: { x: number; y: number };
}) {
  const s = tuft.size;
  const style = useAnimatedStyle(() => {
    const f = flight(progress.value, p, origin.x, origin.y);
    const u = interpolate(f.t, [0.38, 1], [0, 1], Extrapolation.CLAMP);
    const sway = Math.sin(u * Math.PI * 2 + p.phase + tuft.dx) * 10 * u;
    return {
      opacity: interpolate(u, [0, 0.12, 0.75, 1], [0, 1, 0.85, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: p.cx + tuft.lx + f.tx + tuft.dx * u + sway - s * 1.7 },
        { translateY: p.cy - p.top + tuft.ly + f.ty + tuft.dy * u - s * 1.7 },
        { scale: 0.5 + 0.7 * u },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.tuft, { width: s * 3.4, height: s * 3.4, borderRadius: s * 1.7 }, style]}>
      <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#FFFFFF' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'visible' },
  abs: { position: 'absolute', left: 0, top: 0 },
  measure: {
    position: 'absolute',
    left: PAD,
    top: 0,
    opacity: 0,
    fontFamily: fonts.hand,
    fontSize: FONT,
    lineHeight: LINE,
    includeFontPadding: false,
  },
  hint: {
    marginTop: 14,
    alignSelf: 'center',
    fontFamily: fonts.hand,
    fontSize: 19,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(90, 80, 120, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tuft: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
});
