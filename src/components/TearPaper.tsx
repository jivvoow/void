import { memo, useEffect, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { BLOW, mulberry32 } from '../animations/fadeAnimations';
import { fonts } from '../constants/theme';

/** Tear lines in paper coordinates: vertical cuts (x) and horizontal cuts (y). */
export interface Cuts {
  v: number[];
  h: number[];
}
export const MAX_CUTS_PER_AXIS = 3;
/** A new cut must be at least this far from the edges and from other cuts. */
export const MIN_CUT_GAP = 30;
/** While dragging, every this-many px of travel tears along that stretch. */
const SEGMENT = 60;

/** A sheet of soft, translucent "cloud tissue" — the sky shows through, white handwriting. */
const TISSUE_A = 'rgba(255, 244, 247, 0.62)';
const TISSUE_B = 'rgba(234, 226, 250, 0.40)';
const EDGE = 'rgba(255, 255, 255, 0.7)';
const FLUFF = 'rgba(255, 255, 255, 0.95)';
const FONT = 26;
const LINE = 36;
const PAD = 18;
/** Zigzag of a torn edge: sample spacing and amplitude (px). */
const ZIG_STEP = 7;
const ZIG_AMP = 3.2;
/** Pieces overlap this far past a cut so the zigzag fits; the text stops this far before it. */
const EXT = 5;
const INSET = 3.6;
const TUFTS = 4;

interface Props {
  text: string;
  width: number;
  height: number;
  /** Paper's top inside the layer. */
  top: number;
  cuts: Cuts;
  /** True while the user may tear; false once the cloud is blowing. */
  interactive: boolean;
  onCut: (dir: 'v' | 'h', pos: number) => void;
  onTap: () => void;
  /** Finger down / up on the sheet (the cloud waits while you are still tearing). */
  onDragStart: () => void;
  onDragEnd: () => void;
  progress: SharedValue<number>;
  /** The cloud's mouth in this layer's coordinates. */
  origin: { x: number; y: number };
  gentle: boolean;
  seed: number;
  hint: string;
  a11yLabel: string;
}

/**
 * "찢어서 홀씨": the note becomes a sheet of soft cloud tissue. Drag a finger across it and it rips
 * along the way — keep dragging and it keeps tearing (each stretch of travel tears in the direction
 * you moved). When the cloud blows, every scrap flutters away and crumbles into dandelion seeds.
 *
 * Pieces are rectangles of the same sheet, each showing its slice of the full page; the torn
 * look comes from a deterministic zigzag shared by both sides of a cut, so they fit together.
 */
function TearPaperBase(props: Props) {
  const { text, width: W, height: H, top, cuts, interactive, progress, origin, gentle, seed, hint, a11yLabel } = props;
  const latest = useRef(props);
  latest.current = props;
  const paperRef = useRef<ViewInstance>(null);
  const paperAt = useRef({ x: 0, y: 0 });
  const prevCuts = useRef<Cuts>({ v: [], h: [] });
  const seg = useRef({ x: 0, y: 0 });
  const tore = useRef(false);

  const cutAlong = (x0: number, y0: number, x1: number, y1: number) => {
    const p = latest.current;
    const midX = (x0 + x1) / 2 - paperAt.current.x;
    const midY = (y0 + y1) / 2 - paperAt.current.y;
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) p.onCut('h', midY);
    else p.onCut('v', midX);
    tore.current = true;
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.interactive,
        onMoveShouldSetPanResponder: () => latest.current.interactive,
        onPanResponderGrant: (e) => {
          paperRef.current?.measureInWindow((x, y) => (paperAt.current = { x, y }));
          seg.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          tore.current = false;
          latest.current.onDragStart();
        },
        // Keep tearing as long as the finger keeps moving.
        onPanResponderMove: (_, g) => {
          if (!latest.current.interactive) return;
          const s = seg.current;
          if (Math.hypot(g.moveX - s.x, g.moveY - s.y) >= SEGMENT) {
            cutAlong(s.x, s.y, g.moveX, g.moveY);
            seg.current = { x: g.moveX, y: g.moveY };
          }
        },
        onPanResponderRelease: (_, g) => {
          const p = latest.current;
          if (p.interactive) {
            const s = seg.current;
            const x1 = g.x0 + g.dx;
            const y1 = g.y0 + g.dy;
            if (!tore.current && Math.hypot(g.dx, g.dy) < 10) p.onTap();
            else if (Math.hypot(x1 - s.x, y1 - s.y) >= 30) cutAlong(s.x, s.y, x1, y1);
          }
          p.onDragEnd();
        },
        onPanResponderTerminate: () => latest.current.onDragEnd(),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  // Grid cells from the cuts.
  const xs = [0, ...[...cuts.v].sort((a, b) => a - b), W];
  const ys = [0, ...[...cuts.h].sort((a, b) => a - b), H];
  const cells: Cell[] = [];
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      cells.push({ x0: xs[c], x1: xs[c + 1], y0: ys[r], y1: ys[r + 1], L: c > 0, R: c < xs.length - 2, T: r > 0, B: r < ys.length - 2 });
    }
  }
  const before = prevCuts.current;
  useEffect(() => {
    prevCuts.current = cuts;
  }, [cuts]);

  const nCuts = cuts.v.length + cuts.h.length;

  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      <Animated.View
        ref={paperRef}
        entering={FadeIn.duration(260)}
        style={[styles.paper, { width: W, height: H }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onAccessibilityTap={() => latest.current.onTap()}
        {...pan.panHandlers}
      >
        {cells.map((cell) => {
          const key = `${Math.round(cell.x0)}-${Math.round(cell.y0)}-${Math.round(cell.x1)}-${Math.round(cell.y1)}`;
          return (
            <Piece
              key={key}
              cell={cell}
              W={W}
              H={H}
              text={text}
              from={spreadFor(before, W, H, cell)}
              to={spreadFor(cuts, W, H, cell)}
              params={paramsFor(seed, key, cell, top, gentle)}
              progress={progress}
              origin={origin}
            />
          );
        })}
      </Animated.View>
      {interactive && (
        <Animated.Text key={nCuts > 0 ? 'more' : 'first'} entering={FadeIn.duration(300)} style={styles.hint} maxFontSizeMultiplier={1.3}>
          {hint}
        </Animated.Text>
      )}
    </View>
  );
}

export const TearPaper = memo(TearPaperBase);

/* ───────────────────────── geometry ───────────────────────── */

interface Cell {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Which sides are torn (internal) edges. */
  L: boolean;
  R: boolean;
  T: boolean;
  B: boolean;
}

/** Deterministic zigzag offset of the cut at `pos` (its key) at coordinate `c` along it. */
function zigAt(pos: number, c: number) {
  const key = Math.round(pos);
  const z = (s: number) => {
    const v = Math.sin(key * 12.9898 + s * 78.233) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * 2 * ZIG_AMP;
  };
  const s0 = Math.floor(c / ZIG_STEP);
  const f = c / ZIG_STEP - s0;
  return z(s0) * (1 - f) + z(s0 + 1) * f;
}

function samples(a: number, b: number) {
  const out = [a];
  for (let s = Math.ceil(a / ZIG_STEP) * ZIG_STEP; s < b; s += ZIG_STEP) if (s > a) out.push(s);
  out.push(b);
  return out;
}

/** Outline of a piece (local coords) + its torn edges as separate polylines (for the fibres). */
function outline(cell: Cell, ox: number, oy: number) {
  const { x0, x1, y0, y1, L, R, T, B } = cell;
  const pts: [number, number][] = [];
  const torn: [number, number][][] = [];
  const top = samples(x0, x1).map((x): [number, number] => [x, T ? y0 + zigAt(y0, x) : y0]);
  const right = samples(y0, y1).map((y): [number, number] => [R ? x1 + zigAt(x1, y) : x1, y]);
  const bottom = samples(x0, x1)
    .reverse()
    .map((x): [number, number] => [x, B ? y1 + zigAt(y1, x) : y1]);
  const left = samples(y0, y1)
    .reverse()
    .map((y): [number, number] => [L ? x0 + zigAt(x0, y) : x0, y]);
  pts.push(...top, ...right, ...bottom, ...left);
  if (T) torn.push(top);
  if (R) torn.push(right);
  if (B) torn.push(bottom);
  if (L) torn.push(left);
  const d = (list: [number, number][], close: boolean) =>
    list.map(([x, y], i) => `${i ? 'L' : 'M'}${(x - ox).toFixed(1)},${(y - oy).toFixed(1)}`).join(' ') + (close ? ' Z' : '');
  return { fill: d(pts, true), fibres: torn.map((t) => d(t, false)) };
}

/** Pieces drift a few px apart from the centre of the sheet, the more cuts the wider. */
function spreadFor(cuts: Cuts, W: number, H: number, cell: Cell) {
  const cx = (cell.x0 + cell.x1) / 2;
  const cy = (cell.y0 + cell.y1) / 2;
  const col = cuts.v.filter((v) => v < cx).length;
  const row = cuts.h.filter((h) => h < cy).length;
  return { x: (col - cuts.v.length / 2) * 9, y: (row - cuts.h.length / 2) * 9 };
}

interface FlightParams {
  /** Paper top in the layer (tufts live inside the paper, flight maths uses layer coords). */
  top: number;
  cx: number;
  cy: number;
  j1: number;
  j2: number;
  travel: number;
  lift: number;
  fan: number;
  spin: number;
  tilt: number;
  flutter: number;
  sway: number;
  freq: number;
  phase: number;
  tufts: { lx: number; ly: number; dx: number; dy: number; size: number }[];
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function paramsFor(seed: number, key: string, cell: Cell, top: number, gentle: boolean): FlightParams {
  const rnd = mulberry32(seed ^ hash(key));
  const k = gentle ? 0.3 : 1;
  const w = cell.x1 - cell.x0;
  const h = cell.y1 - cell.y0;
  return {
    top,
    cx: (cell.x0 + cell.x1) / 2,
    cy: top + (cell.y0 + cell.y1) / 2,
    j1: rnd(),
    j2: rnd(),
    travel: (320 + rnd() * 320) * k,
    lift: (160 + rnd() * 180) * k,
    fan: (rnd() - 0.5) * 1.2,
    spin: (rnd() - 0.5) * 300 * k,
    tilt: (rnd() - 0.5) * 6,
    flutter: (40 + rnd() * 40) * k,
    sway: (14 + rnd() * 20) * k,
    freq: 0.8 + rnd() * 0.8,
    phase: rnd() * Math.PI * 2,
    tufts: Array.from({ length: TUFTS }, () => ({
      lx: (rnd() - 0.5) * w * 0.7,
      ly: (rnd() - 0.5) * h * 0.7,
      dx: (rnd() - 0.5) * 140 * k,
      dy: -(40 + rnd() * 90) * k,
      size: 4 + rnd() * 3,
    })),
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

/* ───────────────────────── a scrap of paper ───────────────────────── */

function Piece({
  cell,
  W,
  H,
  text,
  from,
  to,
  params: p,
  progress,
  origin,
}: {
  cell: Cell;
  W: number;
  H: number;
  text: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  params: FlightParams;
  progress: SharedValue<number>;
  origin: { x: number; y: number };
}) {
  const offX = useSharedValue(from.x);
  const offY = useSharedValue(from.y);
  const rip = useSharedValue(0);
  useEffect(() => {
    offX.value = withSpring(to.x, { damping: 11, stiffness: 190 });
    offY.value = withSpring(to.y, { damping: 11, stiffness: 190 });
    rip.value = withSpring(1, { damping: 9, stiffness: 160 });
  }, [to.x, to.y, offX, offY, rip]);

  const bx0 = cell.x0 - (cell.L ? EXT : 0);
  const by0 = cell.y0 - (cell.T ? EXT : 0);
  const bx1 = cell.x1 + (cell.R ? EXT : 0);
  const by1 = cell.y1 + (cell.B ? EXT : 0);
  const shape = useMemo(() => outline(cell, bx0, by0), [cell, bx0, by0]);

  const clipL = cell.x0 + (cell.L ? INSET : 0);
  const clipT = cell.y0 + (cell.T ? INSET : 0);
  const clipR = cell.x1 - (cell.R ? INSET : 0);
  const clipB = cell.y1 - (cell.B ? INSET : 0);

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
        { rotate: `${p.tilt * rip.value + p.spin * f.e}deg` },
        { scale: 1 - 0.35 * f.t },
      ],
    };
  });

  return (
    <>
      <Animated.View
        style={[styles.piece, { left: bx0, top: by0, width: bx1 - bx0, height: by1 - by0 }, style]}
        pointerEvents="none"
      >
        <Svg width={bx1 - bx0} height={by1 - by0} style={styles.svg}>
          <Defs>
            {/* One gradient across the whole sheet, so the scraps still read as one piece. */}
            <LinearGradient id="tissue" gradientUnits="userSpaceOnUse" x1={-bx0} y1={-by0} x2={W - bx0} y2={H - by0}>
              <Stop offset="0" stopColor={TISSUE_A} />
              <Stop offset="1" stopColor={TISSUE_B} />
            </LinearGradient>
          </Defs>
          <Path d={shape.fill} fill="url(#tissue)" stroke={EDGE} strokeWidth={1.2} />
          {shape.fibres.map((d, i) => (
            <Path key={i} d={d} stroke={FLUFF} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
        <View
          style={[
            styles.clip,
            { left: clipL - bx0, top: clipT - by0, width: Math.max(0, clipR - clipL), height: Math.max(0, clipB - clipT) },
          ]}
        >
          <View style={[styles.page, { left: -clipL, top: -clipT, width: W, height: H }]}>
            <Text style={styles.text} maxFontSizeMultiplier={1.2}>
              {text}
            </Text>
          </View>
        </View>
      </Animated.View>
      {p.tufts.map((tf, i) => (
        <Tuft key={i} tuft={tf} params={p} progress={progress} origin={origin} />
      ))}
    </>
  );
}

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
    <Animated.View
      pointerEvents="none"
      style={[styles.tuft, { width: s * 3.4, height: s * 3.4, borderRadius: s * 1.7 }, style]}
    >
      <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#FFFFFF' }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'visible' },
  paper: { transform: [{ rotate: '-1.2deg' }] },
  piece: { position: 'absolute', overflow: 'visible' },
  svg: { position: 'absolute', left: 0, top: 0 },
  clip: { position: 'absolute', overflow: 'hidden' },
  page: { position: 'absolute', paddingHorizontal: PAD, paddingTop: PAD },
  text: {
    fontFamily: fonts.hand,
    fontSize: FONT,
    lineHeight: LINE,
    color: '#FFFFFF',
    includeFontPadding: false,
    textShadowColor: 'rgba(110, 90, 140, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
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
