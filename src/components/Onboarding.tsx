import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, glass, palette, radius } from '../constants/theme';
import { useStrings } from '../i18n';
import type { CloudMood } from '../types';
import { CloudCharacter } from './CloudCharacter';

const MOODS: CloudMood[] = ['burst', 'calm', 'fade'];

/** Three-card first-run guide. Shown once; can be replayed from Settings. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useStrings().onboarding;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const last = step === t.steps.length - 1;
  const { title, body } = t.steps[step];

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(350)} style={styles.backdrop}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" style={styles.skip}>
          <Text style={styles.skipText}>{t.skip}</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Animated.View key={step} entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(200)} style={styles.card}>
          <CloudCharacter mood={MOODS[step] ?? 'rest'} width={170} />
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.3}>
            {body}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots} accessibilityElementsHidden>
          {t.steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        <Pressable
          onPress={() => (last ? onDone() : setStep(step + 1))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>{last ? t.start : t.next}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(92, 84, 122, 0.55)' },
  top: { alignItems: 'flex-end', paddingHorizontal: 20 },
  skip: { paddingVertical: 8, paddingHorizontal: 6 },
  skipText: { fontFamily: fonts.hand, fontSize: 18, color: 'rgba(255,255,255,0.85)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 32,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    gap: 14,
  },
  title: { fontFamily: fonts.handBold, fontSize: 30, color: '#FFFFFF', textAlign: 'center', marginTop: 8 },
  body: { fontFamily: fonts.hand, fontSize: 20, lineHeight: 28, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  bottom: { alignItems: 'center', gap: 20, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
  cta: {
    alignSelf: 'stretch',
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.handBold, fontSize: 22, color: palette.dusk },
});
