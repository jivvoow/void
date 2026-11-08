import { memo, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, type TextStyle } from 'react-native';

import { fonts, palette } from '../constants/theme';

/** Shared with GlyphEvaporation so the dissolving overlay lands exactly on the typed words. */
export const CANVAS_TEXT_STYLE: TextStyle = {
  fontFamily: fonts.handBold,
  fontSize: 32,
  lineHeight: Platform.select({ ios: 43, default: 45 }),
  color: '#FFFFFF',
  textShadowColor: 'rgba(110, 90, 140, 0.25)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};
export const CANVAS_PADDING = { top: 8, horizontal: 18 };

interface Props {
  ref?: Ref<TextInput>;
  /** `card` = resting glass card at the bottom, `canvas` = big handwriting while venting. */
  mode: 'card' | 'canvas';
  /** Draw the native glyphs transparent (caret stays) — "즉시" mode paints them via TrailingText. */
  ghost?: boolean;
  placeholder: string;
  editable: boolean;
  accessibilityLabel: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** Content height — where the words currently end (sparks launch from there). */
  onContentSizeChange?: (height: number) => void;
  /** Scroll offset of long notes, so the evaporation overlay can line up. */
  onScrollY?: (y: number) => void;
}

/**
 * The writing surface.
 *
 * IME safety (Korean 조합형 input):
 *  - The input is UNCONTROLLED (no `value` prop). Re-setting `value` on every keystroke is what
 *    breaks Hangul composition on iOS (duplicated jamo / jumping caret). We only read text out.
 *  - Clearing is done by remounting with a new `key` from the parent, which also lets the native
 *    view release its text buffer.
 *  - Typing effects (kick, shake) transform the WRAPPER view only; the evaporation is a separate
 *    overlay. Nothing ever rewrites the native text, so caret and composition are never disturbed.
 *
 * Privacy: autocorrect/suggestions/autofill are turned off to reduce what keyboards learn
 * (keyboard apps may still keep their own data — see the privacy note in Settings).
 */
function EmotionTextInputBase(props: Props) {
  const { ref, mode, ghost, placeholder, editable, accessibilityLabel, onChangeText, onFocus, onBlur, onContentSizeChange, onScrollY } =
    props;
  const canvas = mode === 'canvas';
  return (
    <TextInput
      ref={ref}
      style={[styles.base, canvas ? styles.canvas : styles.card, canvas && ghost && styles.ghost]}
      multiline
      scrollEnabled
      textAlignVertical="top"
      placeholder={placeholder}
      placeholderTextColor={canvas ? 'rgba(255,255,255,0.55)' : palette.inkSoft}
      selectionColor={canvas ? '#FFFFFF' : palette.dusk}
      cursorColor={canvas ? '#FFFFFF' : palette.dusk}
      editable={editable}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      onContentSizeChange={(e) => onContentSizeChange?.(e.nativeEvent.contentSize.height)}
      onScroll={(e) => onScrollY?.(e.nativeEvent.contentOffset.y)}
      autoCorrect={false}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="none"
      textContentType="none"
      importantForAutofill="no"
      dataDetectorTypes="none"
      keyboardAppearance="light"
      maxFontSizeMultiplier={1.4}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export const EmotionTextInput = memo(EmotionTextInputBase);

const styles = StyleSheet.create({
  ghost: { color: 'transparent', textShadowColor: 'transparent' },
  base: {
    flex: 1,
    margin: 0,
    paddingHorizontal: CANVAS_PADDING.horizontal,
    includeFontPadding: false,
  },
  card: {
    fontFamily: fonts.hand,
    fontSize: 21,
    lineHeight: 30,
    color: palette.ink,
    paddingTop: 18,
    paddingBottom: 18,
  },
  canvas: {
    ...CANVAS_TEXT_STYLE,
    paddingTop: CANVAS_PADDING.top,
    // Leave room above the cloud for the release chip.
    paddingBottom: 56,
  },
});
