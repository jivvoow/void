import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { FADE_DELAY_OPTIONS } from '../constants/config';
import { fonts, glass, radius } from '../constants/theme';
import type { FadeDelay } from '../types';

interface Props {
  title: string;
  value: FadeDelay;
  labelFor: (v: FadeDelay) => string;
  onSelect: (v: FadeDelay) => void;
}

/** Quick auto-fade picker that drops down from the top pill (3s · 15s · 30s · 60s · off). */
function TimerPickerBase({ title, value, labelFor, onSelect }: Props) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(160)} style={styles.panel}>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {FADE_DELAY_OPTIONS.map((opt) => {
          const selected = opt === value;
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onSelect(opt)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              hitSlop={4}
              style={({ pressed }) => [styles.item, selected && styles.selected, pressed && !selected && styles.pressed]}
            >
              <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
                {labelFor(opt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export const TimerPicker = memo(TimerPickerBase);

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 20,
    padding: 12,
    paddingTop: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(120, 112, 145, 0.55)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: glass.border,
    gap: 8,
  },
  title: { fontFamily: fonts.hand, fontSize: 16, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  item: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fill,
  },
  pressed: { backgroundColor: glass.fillStrong },
  selected: { backgroundColor: '#FFFFFF' },
  label: { fontFamily: fonts.handBold, fontSize: 17, color: '#FFFFFF', includeFontPadding: false },
  labelSelected: { color: '#77758F' },
});
