import * as ScreenCapture from 'expo-screen-capture';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type TextInputInstance,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { buildParticles, textEvaporation, type ParticleSpec } from '../animations/fadeAnimations';
import { CloudCharacter, CLOUD_ASPECT, CLOUD_MOUTH } from '../components/CloudCharacter';
import { EmotionTextInput } from '../components/EmotionTextInput';
import { FadeOverlay } from '../components/FadeOverlay';
import { HintBubble } from '../components/HintBubble';
import { KeyboardDownIcon, SettingsIcon } from '../components/Icons';
import { IntensityIndicator } from '../components/IntensityIndicator';
import { ReleaseButton } from '../components/ReleaseButton';
import { SkyBackground } from '../components/SkyBackground';
import { StatusPill, type PillKind } from '../components/StatusPill';
import { TimerPicker } from '../components/TimerPicker';
import { CLEAR_MESSAGE_MS, FADE_DURATION_MS, RELEASE_HINT_MS } from '../constants/config';
import { fonts, space } from '../constants/theme';
import { useAutoFade } from '../hooks/useAutoFade';
import { useStrings } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import type { CloudMood, FadeDelay, VentPhase } from '../types';
import { useHaptics } from '../utils/haptics';

const GUTTER = 20;
const HEADER_H = 56;
const CARD_BOTTOM = 18;
/** Cloud scale while venting: keyboard hidden / keyboard shown. */
const CANVAS_SCALE_OPEN = 0.86;
const CANVAS_SCALE_KBD = 0.62;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  onOpenSettings: () => void;
  /** Countdown pauses while Settings is open. */
  settingsOpen: boolean;
}

/**
 * The one screen. REST → VENT → (GRACE) → FADE → CLEAR all happen here as state,
 * never as navigation, so the cloud and the sky can flow between them.
 */
export function HomeScreen({ onOpenSettings, settingsOpen }: Props) {
  const t = useStrings();
  const { settings, update } = useSettings();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const systemReduced = useReducedMotion();
  const soft = systemReduced || settings.animationLevel === 'soft';

  /* ───────── session state ───────── */
  const [phase, setPhaseState] = useState<VentPhase>('rest');
  const phaseRef = useRef<VentPhase>('rest');
  const setPhase = useCallback((p: VentPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  // The user's words live ONLY here (and in the native input). Never in state, storage, or logs.
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [graceMs, setGraceMs] = useState(0);
  const [particles, setParticles] = useState<ParticleSpec[]>([]);
  const inputRef = useRef<TextInputInstance>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeSeed = useRef(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [releaseHint, setReleaseHint] = useState(false);
  const releaseHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseHintShown = useRef(false);

  const writing = focused || hasText || phase === 'fade';

  /* ───────── layout ───────── */
  const cloudW = clamp(win.width * 0.6, 190, 270);
  const cloudH = cloudW * CLOUD_ASPECT;
  const cardH = clamp(win.height * 0.17, 118, 160);

  const mainH = useSharedValue(win.height * 0.7);
  const fullMainH = useRef(win.height * 0.7); // main height with the keyboard hidden
  const [kbdVisible, setKbdVisible] = useState(false);
  const contentH = useRef(0);

  const onMainLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    mainH.value = h;
    if (!kbdVisible) fullMainH.current = h;
  };

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, () => setKbdVisible(true));
    const b = Keyboard.addListener(hideEvt, () => setKbdVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  /* ───────── animation drivers ───────── */
  const morph = useSharedValue(0); // 0 = resting card, 1 = writing canvas
  const kbd = useSharedValue(0);
  const fadeProgress = useSharedValue(0);
  const warmth = useSharedValue(0);
  const hush = useSharedValue(0);

  useEffect(() => {
    morph.value = withTiming(writing ? 1 : 0, { duration: soft ? 200 : 460, easing: Easing.bezier(0.3, 0.1, 0.2, 1) });
  }, [writing, soft, morph]);

  useEffect(() => {
    kbd.value = withTiming(kbdVisible ? 1 : 0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [kbdVisible, kbd]);

  useEffect(() => {
    warmth.value = withTiming(phase === 'vent' ? 0.35 : phase === 'grace' ? 0.15 : 0, { duration: 900 });
    hush.value = withTiming(phase === 'fade' ? 0.85 : 0, { duration: phase === 'fade' ? 700 : 1400 });
  }, [phase, warmth, hush]);

  // Bring the fresh, empty input back to full opacity only after the old one has unmounted.
  useEffect(() => {
    fadeProgress.value = 0;
  }, [inputKey, fadeProgress]);

  /* ───────── fade lifecycle ───────── */
  const finishFade = useCallback(() => {
    textRef.current = '';
    contentH.current = 0;
    setHasText(false);
    setParticles([]);
    setInputKey((k) => k + 1); // remount → native buffer released
    setPhase('clear');
    haptics.done();
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      if (phaseRef.current === 'clear') setPhase('rest');
    }, CLEAR_MESSAGE_MS);
  }, [haptics, setPhase]);

  const startFade = useCallback(() => {
    if (phaseRef.current === 'fade') return; // no double triggers
    if (!textRef.current) {
      setPhase('rest');
      return;
    }
    setPhase('fade');
    inputRef.current?.blur();
    Keyboard.dismiss();
    haptics.soft();

    // Aim particles at the layout we're heading to (keyboard down).
    const H = fullMainH.current;
    const sCloud = CANVAS_SCALE_OPEN;
    const canvasH = Math.max(140, H - cloudH * sCloud * 0.92 - 4);
    const textH = clamp(contentH.current || 80, 60, canvasH - 40);
    const mouth = {
      x: win.width / 2, // the main area spans the full window width
      y: H + 6 - cloudH * sCloud * (1 - CLOUD_MOUTH.y),
    };
    fadeSeed.current = (fadeSeed.current * 9301 + 49297) % 233280;
    setParticles(
      buildParticles(
        fadeSeed.current,
        { x: GUTTER + 12, y: 8, width: win.width - GUTTER * 2 - 24, height: textH },
        mouth,
        soft ? { dust: 8, breath: 0 } : { dust: 22, breath: 16 },
      ),
    );

    fadeProgress.value = 0;
    fadeProgress.value = withTiming(1, { duration: FADE_DURATION_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(finishFade);
    });
  }, [cloudH, fadeProgress, finishFade, haptics, setPhase, soft, win.width]);

  const delayMs = settings.fadeDelay == null ? null : settings.fadeDelay * 1000;
  const { touch } = useAutoFade({
    delayMs,
    armed: hasText && (phase === 'vent' || phase === 'grace') && !settingsOpen,
    onGrace: (remaining) => {
      setGraceMs(remaining);
      setPhase('grace');
    },
    onExpire: startFade,
  });

  // Coming back from Settings restarts the countdown instead of fading instantly.
  useEffect(() => {
    if (!settingsOpen && textRef.current) {
      touch();
      if (phaseRef.current === 'grace') setPhase('vent');
    }
  }, [settingsOpen, touch, setPhase]);

  /** "Keep it" during the grace window. */
  const keep = useCallback(() => {
    touch();
    setPhase('vent');
    haptics.tick();
  }, [touch, setPhase, haptics]);

  const onChangeText = useCallback(
    (text: string) => {
      if (phaseRef.current === 'fade') return;
      textRef.current = text;
      const nonEmpty = text.length > 0;
      setHasText(nonEmpty);
      if (nonEmpty) {
        if (phaseRef.current !== 'vent') setPhase('vent');
        touch();
      } else if (phaseRef.current !== 'rest') {
        setPhase('rest');
      }
    },
    [setPhase, touch],
  );

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      textRef.current = '';
    },
    [],
  );

  /* ───────── keyboard / picker / hints ───────── */
  const dismissKeyboard = useCallback(() => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    setPickerOpen(false);
  }, []);

  const togglePicker = useCallback(() => {
    haptics.tick();
    setPickerOpen((o) => !o);
  }, [haptics]);

  const selectDelay = useCallback(
    (v: FadeDelay) => {
      update({ fadeDelay: v });
      setPickerOpen(false);
      haptics.tick();
      // Restart the countdown under the new delay rather than fading on the spot.
      if (textRef.current) {
        touch();
        if (phaseRef.current === 'grace') setPhase('vent');
      }
    },
    [update, haptics, touch, setPhase],
  );

  useEffect(() => {
    if (phase === 'fade' || phase === 'grace') setPickerOpen(false);
  }, [phase]);

  const flashReleaseHint = useCallback(() => {
    setReleaseHint(true);
    if (releaseHintTimer.current) clearTimeout(releaseHintTimer.current);
    releaseHintTimer.current = setTimeout(() => setReleaseHint(false), RELEASE_HINT_MS);
  }, []);

  // The first time the release button appears in a session, explain it once.
  useEffect(() => {
    if (hasText && !releaseHintShown.current) {
      releaseHintShown.current = true;
      flashReleaseHint();
    }
    if (!hasText) setReleaseHint(false);
  }, [hasText, flashReleaseHint]);

  useEffect(
    () => () => {
      if (releaseHintTimer.current) clearTimeout(releaseHintTimer.current);
    },
    [],
  );

  /* ───────── privacy guards ───────── */
  useEffect(() => {
    if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
  }, []);
  useEffect(() => {
    // Android: FLAG_SECURE while there are words on screen → blank in Recents, no screenshots.
    if (Platform.OS !== 'android') return;
    const key = 'void-writing';
    (hasText ? ScreenCapture.preventScreenCaptureAsync(key) : ScreenCapture.allowScreenCaptureAsync(key)).catch(() => {});
  }, [hasText]);

  /* ───────── animated layout ───────── */
  const shellStyle = useAnimatedStyle(() => {
    const H = mainH.value;
    const w = morph.value;
    const s = interpolate(kbd.value, [0, 1], [CANVAS_SCALE_OPEN, CANVAS_SCALE_KBD]);
    const restTop = H - CARD_BOTTOM - cardH;
    const canvasH = Math.max(110, H - cloudH * s * 0.92 - 4);
    return {
      top: interpolate(w, [0, 1], [restTop, 0]),
      height: interpolate(w, [0, 1], [cardH, canvasH]),
      backgroundColor: `rgba(255,255,255,${0.26 * (1 - w)})`,
      borderColor: `rgba(255,255,255,${0.62 * (1 - w)})`,
    };
  });

  const cloudStyle = useAnimatedStyle(() => {
    const H = mainH.value;
    const w = morph.value;
    const sCanvas = interpolate(kbd.value, [0, 1], [CANVAS_SCALE_OPEN, CANVAS_SCALE_KBD]);
    const bottomRest = H - CARD_BOTTOM - cardH - 14;
    const bottomCanvas = H + 6;
    return {
      transform: [
        { translateY: interpolate(w, [0, 1], [bottomRest, bottomCanvas]) - cloudH },
        { scale: interpolate(w, [0, 1], [1, sCanvas]) },
      ],
    };
  });

  const promptStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
    transform: [{ translateY: -16 * morph.value }],
  }));

  const textStyle = useAnimatedStyle(() => {
    const e = textEvaporation(fadeProgress.value);
    return { opacity: e.opacity, transform: [{ translateY: e.translateY }, { scale: e.scale }] };
  });

  /* ───────── derived UI ───────── */
  const mood: CloudMood = phase === 'fade' ? 'fade' : phase === 'vent' || phase === 'grace' ? 'calm' : 'rest';

  const delay = settings.fadeDelay;
  const pill = useMemo((): { kind: PillKind; label: string } => {
    if (phase === 'fade') return { kind: 'fade', label: t.home.pillFade };
    if (phase === 'grace') return { kind: 'grace', label: t.home.pillGrace };
    if (phase === 'vent' && hasText) {
      return delay == null
        ? { kind: 'paused', label: t.home.pillPaused }
        : { kind: 'vent', label: t.home.pillVent(t.home.timerShort(delay)) };
    }
    // Rest: the auto-fade time is always visible (and tappable) at the top.
    return { kind: 'timer', label: t.home.timerChip(delay) };
  }, [phase, hasText, delay, t]);
  const pillOpensPicker = pill.kind === 'timer' || pill.kind === 'vent' || pill.kind === 'paused';

  return (
    <View style={styles.root}>
      <SkyBackground warmth={warmth} hush={hush} soft={soft} />

      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onOpenSettings}
            disabled={phase === 'fade'}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t.home.a11ySettings}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <SettingsIcon />
          </Pressable>
          <View style={styles.pillSlot} pointerEvents="box-none">
            <StatusPill
              key={pill.kind}
              kind={pill.kind}
              label={pill.label}
              graceMs={graceMs}
              onPress={pill.kind === 'grace' ? keep : pillOpensPicker ? togglePicker : undefined}
              a11yLabel={
                pill.kind === 'grace' ? t.home.a11yGrace : pillOpensPicker ? t.home.a11yTimer(delay) : undefined
              }
              expandable={pillOpensPicker}
              expanded={pickerOpen}
            />
          </View>
          {kbdVisible ? (
            <Pressable
              onPress={dismissKeyboard}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t.home.a11yKeyboardDown}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            >
              <KeyboardDownIcon />
            </Pressable>
          ) : (
            <View style={styles.iconBtn}>
              <IntensityIndicator />
            </View>
          )}
        </View>

        {pickerOpen && (
          <View style={[styles.pickerLayer, { top: insets.top + HEADER_H }]}>
            <TimerPicker
              title={t.home.timerPickerTitle}
              value={delay}
              labelFor={t.home.timerShort}
              onSelect={selectDelay}
            />
          </View>
        )}

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <View style={styles.flex} onLayout={onMainLayout}>
            {/* Tapping anywhere outside the text hides the keyboard (and closes the picker). */}
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissKeyboard} accessible={false} />

            {/* Prompt / clear message */}
            <Animated.View style={[styles.promptWrap, promptStyle]} pointerEvents="none">
              {phase === 'clear' ? (
                <Animated.Text
                  key="clear"
                  entering={FadeInDown.duration(500)}
                  exiting={FadeOut.duration(500)}
                  style={styles.prompt}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLiveRegion="polite"
                >
                  {t.home.clear}
                </Animated.Text>
              ) : (
                <Animated.View key="prompt" entering={FadeIn.duration(700)} style={styles.center}>
                  <Text style={styles.prompt} maxFontSizeMultiplier={1.3}>
                    {t.home.prompt}
                  </Text>
                  <BrushUnderline />
                  <Text style={styles.restHint} maxFontSizeMultiplier={1.3}>
                    {t.home.restHint(delay)}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            {/* Cloud */}
            <Animated.View
              style={[styles.cloud, { width: cloudW, height: cloudH, left: (win.width - cloudW) / 2 }, cloudStyle]}
              pointerEvents="none"
            >
              <CloudCharacter mood={mood} width={cloudW} soft={soft} />
            </Animated.View>

            {/* Writing surface: glass card at rest, open canvas while venting */}
            <Animated.View style={[styles.shell, shellStyle]}>
              <Animated.View style={[styles.flex, textStyle]}>
                <EmotionTextInput
                  key={inputKey}
                  ref={inputRef}
                  mode={writing ? 'canvas' : 'card'}
                  placeholder={t.home.placeholder}
                  editable={phase !== 'fade'}
                  accessibilityLabel={t.home.a11yInput}
                  onChangeText={onChangeText}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onContentSizeChange={(h) => (contentH.current = h)}
                />
              </Animated.View>
              {hasText && phase !== 'fade' && (
                <Animated.View style={styles.release} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
                  {releaseHint && <HintBubble text={t.home.releaseBubble} />}
                  <ReleaseButton
                    label={t.home.release}
                    a11yLabel={t.home.a11yRelease}
                    onHoldStart={haptics.tick}
                    onRelease={startFade}
                    onShortTap={flashReleaseHint}
                  />
                </Animated.View>
              )}
            </Animated.View>

            <FadeOverlay progress={fadeProgress} particles={particles} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

/** Pastel brush stroke under the prompt, as in the mockup. */
function BrushUnderline() {
  return (
    <Svg width={130} height={16} viewBox="0 0 130 16" style={styles.underline}>
      <Path d="M6 10 C40 4, 90 3, 124 6" stroke="#E9BDC1" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.9} />
      <Path d="M18 13 C50 9, 92 9, 116 10" stroke="#B9A8C8" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#9C93AE' },
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { opacity: 0.6 },
  pillSlot: { flex: 1, alignItems: 'center', paddingHorizontal: space.sm },
  promptWrap: { position: 'absolute', top: '10%', left: GUTTER, right: GUTTER, alignItems: 'center' },
  prompt: {
    fontFamily: fonts.hand,
    fontSize: 30,
    lineHeight: 40,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(90, 80, 120, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  underline: { marginTop: 6 },
  restHint: {
    marginTop: 14,
    fontFamily: fonts.hand,
    fontSize: 18,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  pickerLayer: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  cloud: { position: 'absolute', top: 0, transformOrigin: 'center bottom' },
  shell: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  release: { position: 'absolute', right: 8, bottom: 10, alignItems: 'flex-end', gap: 6 },
});
