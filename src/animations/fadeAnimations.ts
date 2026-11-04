import { Easing } from 'react-native-reanimated';

/**
 * Evaporation choreography. One shared `progress` (0 → 1 over FADE_DURATION_MS)
 * drives the text, the cloud's breath and every particle, so all of it stays in sync
 * and runs on the UI thread.
 *
 * The words themselves dissolve glyph-by-glyph in components/GlyphEvaporation.tsx;
 * this module builds the cloud's breath ribbon.
 */
export const fadeEasing = Easing.bezier(0.33, 0, 0.2, 1);

export interface Point {
  x: number;
  y: number;
}

export type ParticleKind = 'dust' | 'breath';

export interface ParticleSpec {
  kind: ParticleKind;
  from: Point;
  c1: Point;
  c2: Point;
  to: Point;
  /** Fraction of the total progress at which this particle starts / ends. */
  start: number;
  end: number;
  size: number;
  color: string;
}

const SPARKLE_COLORS = ['#FFFFFF', '#FFF3E6', '#FBD9DC', '#F7DCCB', '#EDE3F7'];

/** Small deterministic PRNG so a fade's particle layout is stable across renders. */
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
 * dust   — sparkles shed from the words, drifting up and outward.
 * breath — the cloud's "후우": a curling ribbon of sparkles from its mouth up through the text.
 */
export function buildParticles(
  seed: number,
  textArea: { x: number; y: number; width: number; height: number },
  mouth: Point,
  count: { dust: number; breath: number },
): ParticleSpec[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const out: ParticleSpec[] = [];

  for (let i = 0; i < count.dust; i++) {
    const from = {
      x: textArea.x + rnd() * textArea.width,
      y: textArea.y + rnd() * Math.max(40, textArea.height * 0.85),
    };
    const drift = (rnd() - 0.5) * 120;
    const rise = 70 + rnd() * 130;
    const start = 0.18 + rnd() * 0.42;
    out.push({
      kind: 'dust',
      from,
      c1: { x: from.x + drift * 0.2, y: from.y - rise * 0.4 },
      c2: { x: from.x + drift * 0.8, y: from.y - rise * 0.8 },
      to: { x: from.x + drift, y: from.y - rise },
      start,
      end: Math.min(1, start + 0.38 + rnd() * 0.18),
      size: 2 + rnd() * 3.2,
      color: pick(SPARKLE_COLORS),
    });
  }

  // Breath ribbon: an S-curve from the mouth to the upper text area.
  const top = { x: textArea.x + textArea.width * (0.55 + rnd() * 0.3), y: textArea.y + 10 };
  for (let i = 0; i < count.breath; i++) {
    const k = i / Math.max(1, count.breath - 1);
    const spread = 26 + k * 40;
    const jitter = () => (rnd() - 0.5) * spread;
    const start = 0.08 + k * 0.38;
    out.push({
      kind: 'breath',
      from: { x: mouth.x + (rnd() - 0.5) * 18, y: mouth.y },
      c1: { x: mouth.x - 90 + jitter(), y: mouth.y - (mouth.y - top.y) * 0.35 + jitter() },
      c2: { x: top.x + 70 + jitter(), y: top.y + (mouth.y - top.y) * 0.45 + jitter() },
      to: { x: top.x + jitter(), y: top.y + jitter() },
      start,
      end: Math.min(1, start + 0.5),
      size: 1.6 + rnd() * 2.6,
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
