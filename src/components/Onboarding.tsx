import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, glass } from '../constants/theme';
import { useStrings } from '../i18n';
import type { CloudMood } from '../types';
import { CloudCharacter } from './CloudCharacter';

const MOODS: CloudMood[] = ['burst', 'calm', 'fade'];

/**
 * Three-card first-run guide. Tap the card itself to move on (no "next" button).
 * Shown once; can be replayed from Settings.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const t = useStrings().onboarding;
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const last = step === t.steps.length - 1;
  const { title, body } = t.steps[step];
  const advance = () => (last ? onDone() : setStep(step + 1));

  // The guide covers the whole screen: never leave the keyboard up underneath it.
  // (Replayed from Settings, the input can regain focus while the sheet animates away → retry.)
  useEffect(() => {
    Keyboard.dismiss();
    const t1 = setTimeout(() => Keyboard.dismiss(), 400);
    const t2 = setTimeout(() => Keyboard.dismiss(), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(350)} style={styles.backdrop}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button" style={styles.skip}>
          <Text style={styles.skipText}>{t.skip}</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Animated.View key={step} entering={FadeInRight.duration(320)} exiting={FadeOutLeft.duration(200)}>
          <Pressable
            onPress={advance}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${body}`}
            accessibilityHint={last ? t.tapStart : t.tapNext}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <CloudCharacter mood={MOODS[step] ?? 'rest'} width={170} />
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            <Text style={styles.body} maxFontSizeMultiplier={1.3}>
              {body}
            </Text>
            <Text style={styles.tapHint} maxFontSizeMultiplier={1.3}>
              {last ? t.tapStart : t.tapNext}  ›
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.dots} accessibilityElementsHidden>
          {t.steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(92, 84, 122, 0.55)' },
  top: { alignItems: 'flex-end', paddingHorizontal: 20 },
  skip: { paddingVertical: 8, paddingHorizontal: 6 },
  skipText: { fontFamily: fonts.hand, fontSize: 19, color: 'rgba(255,255,255,0.85)' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderRadius: 32,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
    gap: 14,
  },
  cardPressed: { backgroundColor: glass.fillStrong, transform: [{ scale: 0.98 }] },
  title: { fontFamily: fonts.handBold, fontSize: 32, color: '#FFFFFF', textAlign: 'center', marginTop: 8 },
  body: { fontFamily: fonts.hand, fontSize: 21, lineHeight: 30, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  tapHint: { fontFamily: fonts.hand, fontSize: 17, color: 'rgba(255,255,255,0.7)', marginTop: 6 },
  bottom: { alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { width: 22, backgroundColor: '#FFFFFF' },
});
