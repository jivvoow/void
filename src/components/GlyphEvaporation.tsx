import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { mulberry32 } from '../animations/fadeAnimations';

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
}

type Token = { kind: 'piece'; text: string; word: number } | { kind: 'break'; empty: boolean };

/**
 * Phase 3 evaporation: the words are re-laid out as individual pieces (characters, or words
 * for long notes) that tremble in the cloud's breath, lift, scatter and each turn into
 * a tiny sparkle. The live TextInput is hidden underneath, so the IME is never touched.
 */
function GlyphEvaporationBase({ text, progress, textStyle, padding, scrollY, seed }: Props) {
  const { tokens, count } = useMemo(() => tokenize(text), [text]);
  const lineH = (textStyle.lineHeight as number) ?? 40;

  let pieceIndex = 0;
  const rnd = mulberry32(seed);
  // Group pieces by word so a word never breaks across lines (matches TextInput wrapping).
  const lines: React.ReactNode[] = [];
  let wordBuf: React.ReactNode[] = [];
  let currentWord = -1;
  const flushWord = (key: string) => {
    if (wordBuf.length) {
      lines.push(
        <View key={key} style={styles.word}>
          {wordBuf}
        </View>,
      );
      wordBuf = [];
    }
  };

  tokens.forEach((tk, i) => {
    if (tk.kind === 'break') {
      flushWord(`w${i}`);
      lines.push(<View key={`b${i}`} style={[styles.lineBreak, tk.empty && { height: lineH }]} />);
      currentWord = -1;
      return;
    }
    if (tk.word !== currentWord) {
      flushWord(`w${i}`);
      currentWord = tk.word;
    }
    const order = pieceIndex++ / Math.max(1, count - 1);
    wordBuf.push(<Piece key={i} text={tk.text} order={order} rnd={rnd} progress={progress} textStyle={textStyle} />);
  });
  flushWord('wlast');

  return (
    <View
      style={[styles.wrap, { paddingTop: padding.top, paddingHorizontal: padding.horizontal, transform: [{ translateY: -scrollY }] }]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {lines}
    </View>
  );
}

export const GlyphEvaporation = memo(GlyphEvaporationBase);

function Piece({
  text,
  order,
  rnd,
  progress,
  textStyle,
}: {
  text: string;
  order: number;
  rnd: () => number;
  progress: SharedValue<number>;
  textStyle: TextStyle;
}) {
  // Stable per-piece choreography (computed once per render of the overlay).
  const p = useMemo(() => {
    const start = 0.14 + order * 0.46 + rnd() * 0.08; // reading order, with a little randomness
    return {
      start,
      life: 0.3 + rnd() * 0.14,
      dx: (rnd() - 0.5) * 70,
      dy: -(36 + rnd() * 80),
      rot: (rnd() - 0.5) * 50,
      phase: rnd() * Math.PI * 2,
      sparkSize: 3 + rnd() * 3,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glyphStyle = useAnimatedStyle(() => {
    const g = progress.value;
    const t = interpolate(g, [p.start, p.start + p.life], [0, 1], Extrapolation.CLAMP);
    // Before leaving, each glyph trembles in the incoming breath.
    const shiver = g < p.start ? Math.sin(g * 70 + p.phase) * Math.min(1, g / p.start) * 1.2 : 0;
    const ease = t * t * (3 - 2 * t);
    return {
      opacity: interpolate(t, [0, 0.15, 0.75], [1, 0.95, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: p.dx * ease + shiver },
        { translateY: p.dy * Math.pow(t, 1.25) },
        { rotate: `${p.rot * ease}deg` },
        { scale: 1 - 0.45 * ease },
      ],
    };
  });

  const sparkStyle = useAnimatedStyle(() => {
    const g = progress.value;
    const t = interpolate(g, [p.start, p.start + p.life * 1.5], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(t, [0, 0.35, 0.6, 1], [0, 0, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: p.dx * t * 1.3 },
        { translateY: p.dy * 1.35 * t },
        { scale: interpolate(t, [0.35, 0.6, 1], [0.3, 1, 0.4], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View>
      <Animated.Text style={[textStyle, styles.glyph, glyphStyle]} allowFontScaling maxFontSizeMultiplier={1.4}>
        {text}
      </Animated.Text>
      <Animated.View
        style={[
          styles.spark,
          { width: p.sparkSize * 3, height: p.sparkSize * 3, borderRadius: p.sparkSize * 1.5, marginLeft: -p.sparkSize * 1.5, marginTop: -p.sparkSize * 1.5 },
          sparkStyle,
        ]}
      >
        <View style={{ width: p.sparkSize, height: p.sparkSize, borderRadius: p.sparkSize / 2, backgroundColor: '#FFFFFF' }} />
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
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', flexWrap: 'wrap' },
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
