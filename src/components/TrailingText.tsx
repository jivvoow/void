import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

/** "즉시" mode timing: each glyph stays fully visible this long, then melts away. */
export const TRAIL_HOLD_MS = 450;
export const TRAIL_FADE_MS = 1000;
export const TRAIL_LIFE_MS = TRAIL_HOLD_MS + TRAIL_FADE_MS;

export interface TrailingTextHandle {
  /** Mirror the native input's current text (called from onChangeText). */
  set: (text: string) => void;
  /** Drop everything (the input was emptied). */
  reset: () => void;
}

interface Props {
  ref?: Ref<TrailingTextHandle>;
  textStyle: TextStyle;
  padding: { top: number; horizontal: number };
  /** The native input's scroll offset, so long notes stay aligned. */
  scrollY: RefObject<number>;
}

const STEPS = 24; // opacity quantisation → adjacent glyphs merge into one span

function alphaFor(age: number) {
  if (age <= TRAIL_HOLD_MS) return 1;
  const t = Math.min(1, (age - TRAIL_HOLD_MS) / TRAIL_FADE_MS);
  const eased = 1 - t * t * (3 - 2 * t); // smoothstep out
  return Math.round(eased * STEPS) / STEPS;
}

/**
 * "즉시" mode: the visible copy of what is being typed, where every glyph fades on its own clock —
 * type "아아아아아" and the first "아" melts first, then the next, like ink evaporating behind the pen.
 *
 * The real TextInput stays untouched (only its glyphs are drawn transparent), so Hangul
 * composition and the caret are never disturbed. The text and birth times live in refs only —
 * never in React state, storage or logs — and are dropped on `reset()`.
 */
export function TrailingText({ ref, textStyle, padding, scrollY }: Props) {
  const text = useRef('');
  const births = useRef<number[]>([]); // per UTF-16 unit
  const raf = useRef<number | null>(null);
  const [, setFrame] = useState(0);

  const loop = useCallback(() => {
    setFrame((f) => (f + 1) % 1_000_000);
    const last = births.current[births.current.length - 1] ?? 0; // births never decrease
    if (text.current && Date.now() - last < TRAIL_LIFE_MS + 50) {
      raf.current = requestAnimationFrame(loop);
    } else {
      raf.current = null;
    }
  }, []);

  const kick = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(loop);
  }, [loop]);

  useImperativeHandle(
    ref,
    () => ({
      set(next) {
        const prev = text.current;
        let p = 0;
        const n = Math.min(prev.length, next.length);
        while (p < n && prev.charCodeAt(p) === next.charCodeAt(p)) p++;
        // Unchanged prefix keeps its clock; anything new or re-composed starts fresh.
        const now = Date.now();
        const b = births.current.slice(0, p);
        for (let i = p; i < next.length; i++) b.push(now);
        births.current = b;
        text.current = next;
        kick();
      },
      reset() {
        text.current = '';
        births.current = [];
        setFrame((f) => (f + 1) % 1_000_000);
      },
    }),
    [kick],
  );

  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      text.current = '';
      births.current = [];
    },
    [],
  );

  const s = text.current;
  if (!s) return null;

  // Group consecutive glyphs with the same opacity into spans (never splitting surrogate pairs).
  const now = Date.now();
  const spans: { a: number; str: string }[] = [];
  for (let i = 0; i < s.length; ) {
    const code = s.charCodeAt(i);
    const len = code >= 0xd800 && code <= 0xdbff && i + 1 < s.length ? 2 : 1;
    const a = alphaFor(now - (births.current[i] ?? now));
    const ch = s.slice(i, i + len);
    const tail = spans[spans.length - 1];
    if (tail && tail.a === a) tail.str += ch;
    else spans.push({ a, str: ch });
    i += len;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { paddingTop: padding.top, paddingHorizontal: padding.horizontal }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text
        style={[textStyle, styles.text, { transform: [{ translateY: -(scrollY.current ?? 0) }] }]}
        textBreakStrategy="simple"
        maxFontSizeMultiplier={1.4}
        allowFontScaling
      >
        {spans.map((sp, i) => (
          <Text
            key={i}
            style={{
              color: `rgba(255,255,255,${sp.a})`,
              textShadowColor: `rgba(110,90,140,${(0.25 * sp.a).toFixed(3)})`,
            }}
          >
            {sp.str}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  text: { includeFontPadding: false },
});
