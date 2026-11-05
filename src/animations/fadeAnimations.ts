import { Easing } from 'react-native-reanimated';

/**
 * Release choreography ("후우~"). One shared `progress` (0 → 1 over FADE_DURATION_MS)
 * drives the cloud's body + face, the wind, and every flying glyph, so all of it stays in
 * sync and runs on the UI thread.
 *
 *   0 ──── INHALE ──── 0.2 ─ 0.25 ──────── BLOW ──────── 0.74 ──── RELIEF ──── 1
 *   cloud puffs up,        squashes, pursed "O" mouth,        deflates, smiles
 *   words tremble          gusts stream up, words get
 *   (slightly sucked in)   blown off the top of the screen
 */
export const BLOW = {
  inhaleEnd: 0.2,
  blowStart: 0.25,
  blowEnd: 0.74,
} as const;

export const fadeEasing = Easing.bezier(0.33, 0, 0.2, 1);

export interface Point {
  x: number;
  y: number;
}

/** breath = small sparkles riding the wind · gust = elongated wind streaks */
export type ParticleKind = 'breath' | 'gust';

export interface ParticleSpec {
  kind: ParticleKind;
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
  /** Fraction of the total progress at which this particle starts / ends. */
  start: number;
  end: number;
  /** Sparkle diameter, or streak length for gusts. */
  size: number;
  color: string;
}

const SPARKLE_COLORS = ['#FFFFFF', '#FFF3E6', '#FBD9DC', '#F7DCCB', '#EDE3F7'];

/** Small deterministic PRNG so a fade's layout is stable across renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The cloud's breath: a fan of wind streaks and sparkles streaming from its mouth up through
 * the text area and off the top of the screen, all inside the BLOW window.
 */
export function buildParticles(
  seed: number,
  textArea: { x: number; y: number; width: number; height: number },
  mouth: Point,
  count: { breath: number; gust: number },
): ParticleSpec[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const out: ParticleSpec[] = [];
  const span = BLOW.blowEnd - BLOW.blowStart;

  const fanPath = (k: number, spread: number) => {
    // k ∈ [0,1] → direction across the fan (left … right), slight S-curl like real breath.
    const angle = (-0.5 + k) * spread + (rnd() - 0.5) * 0.25; // radians from straight up
    const reach = mouth.y - textArea.y + 140 + rnd() * 120; // well past the top of the text
    const to = { x: mouth.x + Math.sin(angle) * reach * 0.9, y: mouth.y - Math.cos(angle) * reach };
    const curl = (rnd() - 0.5) * 90;
    return {
      from: { x: mouth.x + (rnd() - 0.5) * 14, y: mouth.y - 4 },
      c1: { x: mouth.x + (to.x - mouth.x) * 0.2 + curl, y: mouth.y - (mouth.y - to.y) * 0.3 },
      c2: { x: mouth.x + (to.x - mouth.x) * 0.7 - curl * 0.6, y: mouth.y - (mouth.y - to.y) * 0.7 },
      to,
    };
  };

  for (let i = 0; i < count.gust; i++) {
    const k = count.gust === 1 ? 0.5 : i / (count.gust - 1);
    const start = BLOW.blowStart - 0.02 + rnd() * span * 0.7;
    out.push({
      kind: 'gust',
      ...fanPath(k, 1.5),
      start,
      end: Math.min(1, start + 0.2 + rnd() * 0.1),
      size: 34 + rnd() * 46,
      color: pick(SPARKLE_COLORS),
    });
  }

  for (let i = 0; i < count.breath; i++) {
    const start = BLOW.blowStart + rnd() * span * 0.8;
    out.push({
      kind: 'breath',
      ...fanPath(rnd(), 1.7),
      start,
      end: Math.min(1, start + 0.28 + rnd() * 0.12),
      size: 2 + rnd() * 3,
      color: pick(SPARKLE_COLORS),
    });
  }
  return out;
}

/** Cubic bézier point. */
export function bezier(t: number, a: number, b: number, c: number, d: number) {
  'worklet';
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

/** Cubic bézier derivative (direction of travel). */
export function bezierSlope(t: number, a: number, b: number, c: number, d: number) {
  'worklet';
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
}
