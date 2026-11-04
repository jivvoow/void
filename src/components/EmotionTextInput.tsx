import { memo, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputInstance } from 'react-native';

import { fonts, palette } from '../constants/theme';

interface Props {
  ref?: Ref<TextInputInstance>;
  /** `card` = resting glass card at the bottom, `canvas` = big handwriting while venting. */
  mode: 'card' | 'canvas';
  placeholder: string;
  editable: boolean;
  accessibilityLabel: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  /** Content height, used to aim the fade particles at where the words actually are. */
  onContentSizeChange?: (height: number) => void;
}

/**
 * The writing surface.
 *
 * IME safety (Korean 조합형 input):
 *  - The input is UNCONTROLLED (no `value` prop). Re-setting `value` on every keystroke is what
 *    breaks Hangul composition on iOS (duplicated jamo / jumping caret). We only read text out.
 *  - Clearing is done by remounting with a new `key` from the parent, which also lets the native
 *    view release its text buffer.
 *  - No per-glyph effects are applied to the live input; visual effects live in separate layers,
 *    so the caret and keyboard are never disturbed.
 *
 * Privacy: autocorrect/suggestions/autofill are turned off to reduce what keyboards learn
 * (keyboard apps may still keep their own data — see the privacy note in Settings).
 */
function EmotionTextInputBase({ ref, mode, placeholder, editable, accessibilityLabel, onChangeText, onFocus, onBlur, onContentSizeChange }: Props) {
  const canvas = mode === 'canvas';
  return (
    <TextInput
      ref={ref}
      style={[styles.base, canvas ? styles.canvas : styles.card]}
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
  base: {
    flex: 1,
    margin: 0,
    paddingHorizontal: 18,
    includeFontPadding: false,
  },
  card: {
    fontFamily: fonts.hand,
    fontSize: 20,
    lineHeight: 28,
    color: palette.ink,
    paddingTop: 18,
    paddingBottom: 18,
  },
  canvas: {
    fontFamily: fonts.handBold,
    fontSize: 30,
    lineHeight: Platform.select({ ios: 40, default: 42 }),
    color: '#FFFFFF',
    paddingTop: 8,
    // Leave room for the release button floating in the bottom-right corner.
    paddingBottom: 60,
    textShadowColor: 'rgba(110, 90, 140, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
