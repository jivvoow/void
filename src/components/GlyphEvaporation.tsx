import { memo, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { BLOW, mulberry32 } from '../animations/fadeAnimations';

/** Above this many characters we animate per word instead of per character (perf). */
const PER_CHAR_LIMIT = 180;
/** Hard cap on animated pieces; anything beyond is grouped. */
const MAX_PIECES = 220;

interface Props {
  /** Snapshot of the words being released. Dropped as soon as the fade completes. */
  text: string;
  progress: SharedValue<number>;
  /** Exactly the TextInput's text style, so the overlay lands where the words were. */
  textStyle: TextStyle;
  padding: { top: number; horizontal: number };
  scrollY: number;
  seed: number;
  /** The cloud's mouth, in this overlay's coordinates (the wind comes from here). */
  origin: { x: number; y: number };
  /** Distance at which glyphs are hit last (≈ the text area's height). */
  reach: number;
  /** Calm motion: seeds barely travel. */
  gentle?: boolean;
}

type Token = { kind: 'piece'; text: string; word: number } | { kind: 'break'; empty: boolean };
type Choreo = {
  j1: number;
  j2: number;
  travel: number;
  lift: number;
  fan: number;
  sway: number;
  freq: number;
  tilt: number;
  phase: number;
  tuft: number;
};

/**
 * The words being blown away like dandelion seeds. They are re-laid out as pieces (characters,
 * or words for long notes) that tremble while the cloud inhales; its breath then scatters them
 * wide — nearest lines first — and each drifts up on its own under a little white tuft.
 * The live TextInput is hidden underneath, so the IME is never touched.
 */
function GlyphEvaporationBase({ text, progress, textStyle, padding, scrollY, seed, origin, reach, gentle = false }: Props) {
  const { tokens, count } = useMemo(() => tokenize(text), [text]);
  const lineH = (textStyle.lineHeight as number) ?? 40;

  // Stable per-piece randomness for this fade.
  const choreo = useMemo(() => {
    const rnd = mulberry32(seed);
    const k = gentle ? 0.25 : 1;
    return Array.from({ length: count }, (): Choreo => ({
      j1: rnd(),
      j2: rnd(),
      travel: (210 + rnd() * 300) * k,
      lift: (120 + rnd() * 160) * k,
      fan: (rnd() - 0.5) * 1.9, // ±55° around "away from the mouth"
      sway: (12 + rnd() * 20) * k,
      freq: 0.7 + rnd() * 0.9,
      tilt: (rnd() - 0.5) * 50,
      phase: rnd() * Math.PI * 2,
      tuft: 4 + rnd() * 3,
    }));
  }, [seed, count, gentle]);

  // Group pieces by word so a word never breaks across lines (matches TextInput wrapping).
  const out: React.ReactNode[] = [];
  let word: { key: string; pieces: { text: string; idx: number; key: number }[] } | null = null;
  let currentWord = -1;
  let pieceIndex = 0;
  const flush = () => {
    if (word) out.push(<Word key={word.key} pieces={word.pieces} {...{ choreo, progress, textStyle, origin, reach }} />);
    word = null;
  };
  tokens.forEach((tk, i) => {
    if (tk.kind === 'break') {
      flush();
      out.push(<View key={`b${i}`} style={[styles.lineBreak, tk.empty && { height: lineH }]} />);
      currentWord = -1;
      return;
    }
    if (tk.word !== currentWord || !word) {
      flush();
      currentWord = tk.word;
      word = { key: `w${i}`, pieces: [] };
    }
    word.pieces.push({ text: tk.text, idx: pieceIndex++, key: i });
  });
  flush();

  return (
    <View
      style={[styles.wrap, { paddingTop: padding.top, paddingHorizontal: padding.horizontal, transform: [{ translateY: -scrollY }] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {out}
    </View>
  );
}

export const GlyphEvaporation = memo(GlyphEvaporationBase);

interface Shared {
  choreo: Choreo[];
  progress: SharedValue<number>;
  textStyle: TextStyle;
  origin: { x: number; y: number };
  reach: number;
}

function Word({ pieces, ...rest }: Shared & { pieces: { text: string; idx: number; key: number }[] }) {
  // Where this word sits inside the overlay; pieces add their own offset within it.
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const onLayout = (e: LayoutChangeEvent) => {
    ox.value = e.nativeEvent.layout.x;
    oy.value = e.nativeEvent.layout.y;
  };
  return (
    <View style={styles.word} onLayout={onLayout}>
      {pieces.map((p) => (
        <Piece key={p.key} text={p.text} c={rest.choreo[p.idx]} ox={ox} oy={oy} {...rest} />
      ))}
    </View>
  );
}

function Piece({
  text,
  c,
  ox,
  oy,
  progress,
  textStyle,
  origin,
  reach,
}: Shared & { text: string; c: Choreo; ox: SharedValue<number>; oy: SharedValue<number> }) {
  const cx = useSharedValue(0); // piece centre within its word
  const cy = useSharedValue(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout;
    cx.value = l.x + l.width / 2;
    cy.value = l.y + l.height / 2;
  };

  /** 0 → 1 flight clock of this seed (nearest to the cloud is puffed off first). */
  const flight = useDerivedValue(() => {
    const gx = ox.value + cx.value - origin.x;
    const gy = oy.value + cy.value - origin.y;
    const dist = Math.max(1, Math.sqrt(gx * gx + gy * gy));
    const start = Math.min(0.8, BLOW.blowStart + Math.min(1, dist / Math.max(1, reach)) * 0.2 + c.j1 * 0.12);
    const life = Math.max(0.12, Math.min(0.42 + c.j2 * 0.16, 0.995 - start));
    return interpolate(progress.value, [start, start + life], [0, 1], Extrapolation.CLAMP);
  });

  // Like dandelion seeds: a soft puff scatters them wide, then each one drifts up on its own,
  // swaying side to side under a little white tuft, and dissolves into the sky.
  const seedStyle = useAnimatedStyle(() => {
    const g = progress.value;
    const t = flight.value;
    const gx = ox.value + cx.value - origin.x;
    const gy = oy.value + cy.value - origin.y;
    const base = Math.atan2(gy, gx) + c.fan; // away from the mouth, fanned wide
    const dirX = Math.cos(base);
    const dirY = Math.sin(base);

    // Inhale: everything trembles and is drawn a hair toward the cloud.
    const inhale = interpolate(g, [0, BLOW.inhaleEnd, BLOW.blowStart], [0, 1, 0], Extrapolation.CLAMP);
    const shiver = t === 0 ? Math.sin(g * 80 + c.phase) * (0.5 + inhale * 1.3 + (g > BLOW.blowStart ? 1.2 : 0)) : 0;
    const len = Math.max(1, Math.sqrt(gx * gx + gy * gy));
    const pullX = (-gx / len) * inhale * 6;
    const pullY = (-gy / len) * inhale * 6;

    const puff = 1 - Math.pow(1 - t, 2.4); // quick scatter that slows to a float
    const sway = Math.sin(t * Math.PI * 2 * c.freq + c.phase) * c.sway * (0.25 + t);
    const tx = dirX * c.travel * puff + sway + pullX + shiver;
    const ty = dirY * c.travel * puff * 0.75 - c.lift * t + pullY;
    const tilt = c.tilt * puff + Math.cos(t * Math.PI * 2 * c.freq + c.phase) * 16 * t;

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${tilt}deg` },
        { scale: interpolate(t, [0, 0.1, 1], [1, 1.08, 0.55], Extrapolation.CLAMP) },
      ],
    };
  });
  // The letter thins out first; its tuft lingers a little longer.
  const glyphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flight.value, [0, 0.4, 0.85], [1, 0.85, 0], Extrapolation.CLAMP),
  }));
  const tuftStyle = useAnimatedStyle(() => {
    const t = flight.value;
    return {
      opacity: interpolate(t, [0, 0.12, 0.7, 1], [0, 0.95, 0.85, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(t, [0, 0.2, 1], [0.2, 1, 1.25], Extrapolation.CLAMP) }],
    };
  });

  const s = c.tuft;
  return (
    <View onLayout={onLayout}>
      <Animated.View style={seedStyle}>
        <Animated.Text style={[textStyle, styles.glyph, glyphStyle]} allowFontScaling maxFontSizeMultiplier={1.4}>
          {text}
        </Animated.Text>
        <Animated.View
          style={[styles.tuft, { width: s * 3.4, height: s * 3.4, borderRadius: s * 1.7, marginLeft: -s * 1.7 }, tuftStyle]}
          pointerEvents="none"
        >
          <View style={[styles.tuftCore, { width: s, height: s, borderRadius: s / 2 }]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Split into pieces (chars or words) + explicit line breaks. */
function tokenize(text: string): { tokens: Token[]; count: number } {
  const perChar = text.length <= PER_CHAR_LIMIT;
  const tokens: Token[] = [];
  let word = 0;
  let count = 0;
  const lines = text.split('\n');
  lines.forEach((line, li) => {
    const words = line.match(/[^ ]+ *| +/g) ?? []; // keep trailing spaces with their word
    for (const w of words) {
      if (perChar) {
        for (const ch of Array.from(w)) {
          tokens.push({ kind: 'piece', text: ch, word });
          count++;
        }
      } else {
        tokens.push({ kind: 'piece', text: w, word });
        count++;
      }
      word++;
    }
    if (li < lines.length - 1) tokens.push({ kind: 'break', empty: line.length === 0 });
  });

  // Very long notes: merge neighbours so we never animate more than MAX_PIECES views.
  if (count > MAX_PIECES) {
    const group = Math.ceil(count / MAX_PIECES);
    const merged: Token[] = [];
    let buf = '';
    let n = 0;
    let w = 0;
    const push = () => {
      if (buf) merged.push({ kind: 'piece', text: buf, word: w++ });
      buf = '';
      n = 0;
    };
    for (const tk of tokens) {
      if (tk.kind === 'break') {
        push();
        merged.push(tk);
        continue;
      }
      buf += tk.text;
      if (++n >= group) push();
    }
    push();
    return { tokens: merged, count: w };
  }
  return { tokens, count };
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', flexWrap: 'wrap', overflow: 'visible' },
  word: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: '100%' },
  lineBreak: { width: '100%', height: 0 },
  glyph: { includeFontPadding: false },
  // The seed's fluffy parachute, riding just above its letter.
  tuft: {
    position: 'absolute',
    left: '50%',
    top: -6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  tuftCore: { backgroundColor: '#FFFFFF' },
});
