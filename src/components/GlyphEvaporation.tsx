import { memo, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
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
}

type Token = { kind: 'piece'; text: string; word: number } | { kind: 'break'; empty: boolean };
type Choreo = { j1: number; j2: number; travel: number; rot: number; phase: number; side: number; spark: number };

/**
 * The words being blown away. They are re-laid out as pieces (characters, or words for long
 * notes) that tremble while the cloud inhales, then get caught by its breath — the lines
 * nearest the cloud first — and tumble off the top of the screen, each leaving a sparkle.
 * The live TextInput is hidden underneath, so the IME is never touched.
 */
function GlyphEvaporationBase({ text, progress, textStyle, padding, scrollY, seed, origin, reach }: Props) {
  const { tokens, count } = useMemo(() => tokenize(text), [text]);
  const lineH = (textStyle.lineHeight as number) ?? 40;

  // Stable per-piece randomness for this fade.
  const choreo = useMemo(() => {
    const rnd = mulberry32(seed);
    return Array.from({ length: count }, (): Choreo => ({
      j1: rnd(),
      j2: rnd(),
      travel: 380 + rnd() * 320,
      rot: (rnd() - 0.5) * 420,
      phase: rnd() * Math.PI * 2,
      side: rnd() < 0.5 ? -1 : 1,
      spark: 3 + rnd() * 3,
    }));
  }, [seed, count]);

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

  /** Shared math: where the wind carries this piece at progress g. */
  const glyphStyle = useAnimatedStyle(() => {
    const g = progress.value;
    const gx = ox.value + cx.value - origin.x;
    const gy = oy.value + cy.value - origin.y;
    const dist = Math.max(1, Math.sqrt(gx * gx + gy * gy));
    const nx = gx / dist;
    const ny = gy / dist;
    // Nearest to the cloud gets hit first; the far lines a beat later.
    const start = BLOW.blowStart + Math.min(1, dist / Math.max(1, reach)) * 0.26 + c.j1 * 0.06;
    const life = 0.26 + c.j2 * 0.12;
    const t = interpolate(g, [start, start + life], [0, 1], Extrapolation.CLAMP);

    // Inhale: everything trembles and is drawn a little toward the cloud.
    const inhale = interpolate(g, [0, BLOW.inhaleEnd, BLOW.blowStart], [0, 1, 0], Extrapolation.CLAMP);
    const waiting = g < start ? 1 : 0;
    const shiver = waiting * Math.sin(g * 90 + c.phase) * (0.6 + inhale * 1.4 + (g > BLOW.blowStart ? 1.8 : 0));
    const pull = inhale * 7;

    // Blown: accelerate away from the mouth and up, tumbling and swirling.
    const e = t * t * (1.6 - 0.6 * t);
    const swirl = Math.sin(t * Math.PI * 1.4 + c.phase) * 26 * t * c.side;
    const tx = nx * c.travel * e * 0.85 - ny * swirl - nx * pull + shiver;
    const ty = ny * c.travel * e - 160 * e + nx * swirl - ny * pull;

    return {
      opacity: interpolate(t, [0, 0.6, 1], [1, 0.95, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${c.rot * e}deg` },
        { scale: interpolate(t, [0, 0.12, 1], [1, 1.18, 0.6], Extrapolation.CLAMP) },
      ],
    };
  });

  // A sparkle left in the glyph's wake.
  const sparkStyle = useAnimatedStyle(() => {
    const g = progress.value;
    const gx = ox.value + cx.value - origin.x;
    const gy = oy.value + cy.value - origin.y;
    const dist = Math.max(1, Math.sqrt(gx * gx + gy * gy));
    const start = BLOW.blowStart + Math.min(1, dist / Math.max(1, reach)) * 0.26 + c.j1 * 0.06;
    const life = (0.26 + c.j2 * 0.12) * 1.3;
    const t = interpolate(g, [start, start + life], [0, 1], Extrapolation.CLAMP);
    const e = t * t * 0.75;
    return {
      opacity: interpolate(t, [0, 0.2, 0.55, 1], [0, 0.9, 0.7, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: (gx / dist) * c.travel * e * 0.85 },
        { translateY: (gy / dist) * c.travel * e - 160 * e },
        { scale: interpolate(t, [0, 0.3, 1], [0.3, 1, 0.4], Extrapolation.CLAMP) },
      ],
    };
  });

  const s = c.spark;
  return (
    <View onLayout={onLayout}>
      <Animated.View
        style={[styles.spark, { width: s * 3, height: s * 3, borderRadius: s * 1.5, marginLeft: -s * 1.5, marginTop: -s * 1.5 }, sparkStyle]}
      >
        <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#FFFFFF' }} />
      </Animated.View>
      <Animated.Text style={[textStyle, styles.glyph, glyphStyle]} allowFontScaling maxFontSizeMultiplier={1.4}>
        {text}
      </Animated.Text>
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
  spark: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 228, 232, 0.45)',
  },
});
