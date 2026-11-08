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
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { BLOW, buildParticles, type ParticleSpec } from '../animations/fadeAnimations';
import { CloudCharacter, CLOUD_ASPECT, CLOUD_MOUTH } from '../components/CloudCharacter';
import { CANVAS_PADDING, CANVAS_TEXT_STYLE, EmotionTextInput } from '../components/EmotionTextInput';
import { FadeOverlay } from '../components/FadeOverlay';
import { GlyphEvaporation } from '../components/GlyphEvaporation';
import { HintBubble } from '../components/HintBubble';
import { KeyboardDownIcon, SettingsIcon } from '../components/Icons';
import { IntensityIndicator } from '../components/IntensityIndicator';
import { ReleaseButton } from '../components/ReleaseButton';
import { RippleRings } from '../components/RippleRings';
import { SkyBackground } from '../components/SkyBackground';
import { StatusPill, type PillKind } from '../components/StatusPill';
import { MAX_PIECES, TearPaper, type TearPaperHandle } from '../components/TearPaper';
import { TimerPicker } from '../components/TimerPicker';
import { TrailingText, TRAIL_LIFE_MS, type TrailingTextHandle } from '../components/TrailingText';
import {
  CLEAR_MESSAGE_MS,
  FADE_DURATION_MS,
  RELEASE_HINT_MS,
  SPARK_THROTTLE_MS,
} from '../constants/config';
import { fonts, space } from '../constants/theme';
import { useAutoFade } from '../hooks/useAutoFade';
import { useHoldToRelease } from '../hooks/useHoldToRelease';
import { useTypingIntensity } from '../hooks/useTypingIntensity';
import { useStrings } from '../i18n';
import { useSettings } from '../state/SettingsContext';
import type { CloudMood, FadeDelay, Intensity, VentPhase } from '../types';
import { useHaptics } from '../utils/haptics';
import { useSoundFx } from '../utils/sound';

const GUTTER = 20;
const HEADER_H = 56;
const CARD_BOTTOM = 18;
/** Cloud scale while venting: keyboard hidden / keyboard shown. */
const CANVAS_SCALE_OPEN = 0.86;
const CANVAS_SCALE_KBD = 0.62;
const CHIP_GAP = 58;

/** How much each spark of feeling fills the cloud, by intensity. ~60 calm keystrokes ≈ full. */
const CHARGE_STEP: Record<Intensity, number> = { calm: 0.016, building: 0.026, burst: 0.04 };
/** Text "kick" per keystroke: how far the words hop and jitter. */
const KICK: Record<Intensity, { lift: number; jitter: number }> = {
  calm: { lift: 0.8, jitter: 0 },
  building: { lift: 2, jitter: 2.5 },
  burst: { lift: 3.6, jitter: 6 },
};
/** Mouth open → swallow delay for each "꿀꺽". */
const GULP_DELAY_MS = 200;
const WARMTH: Record<Intensity, number> = { calm: 0.2, building: 0.5, burst: 0.85 };
/** Minimum gap between gulp sounds, by intensity (faster venting → more gulping). */
const GULP_SOUND_MS: Record<Intensity, number> = { calm: 900, building: 560, burst: 340 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  onOpenSettings: () => void;
  /** Countdown pauses while Settings is open. */
  settingsOpen: boolean;
}

/**
 * The one screen. REST → VENT → (GRACE) → FADE → CLEAR all happen here as state,
 * never as navigation, so the cloud and the sky can flow between them.
 *
 * The loop the user should *feel*:
 *   type ("와다다") → sparks fly from the words into the cloud → it gulps, swells, blushes, scowls
 *   → hold the cloud (or stop typing) → it exhales "후우" → every glyph scatters into sparkles.
 */
export function HomeScreen({ onOpenSettings, settingsOpen }: Props) {
  const t = useStrings();
  const { settings, update } = useSettings();
  const haptics = useHaptics();
  const sfx = useSoundFx();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const soft = settings.animationLevel === 'soft';

  /* ───────── session state ───────── */
  const [phase, setPhaseState] = useState<VentPhase>('rest');
  const phaseRef = useRef<VentPhase>('rest');
  const setPhase = useCallback((p: VentPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  // The user's words live ONLY here (and in the native input). Never in storage or logs.
  // `fadeText` holds a snapshot for the ~3s evaporation and is dropped right after.
  const textRef = useRef('');
  const [fadeText, setFadeText] = useState<string | null>(null);
  const [hasText, setHasText] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [focused, setFocused] = useState(false);
  const [graceMs, setGraceMs] = useState(0);
  const [particles, setParticles] = useState<ParticleSpec[]>([]);
  // Where the release wind comes from (the cloud's mouth) in the text overlay's coordinates.
  const [blowGeo, setBlowGeo] = useState({ origin: { x: 0, y: 0 }, reach: 300 });
  // "찢어서 홀씨": the paper being torn (only exists during a release in that style).
  // `pieces` = how many scraps the sheet is in right now.
  const [tear, setTearState] = useState<{ interactive: boolean; pieces: number; paperH: number; seed: number } | null>(null);
  const paperRef = useRef<TearPaperHandle>(null);
  const tearRef = useRef(tear);
  const setTear = useCallback((v: typeof tear) => {
    tearRef.current = v;
    setTearState(v);
  }, []);
  const tearTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tearDragging = useRef(false);
  const autoTearRef = useRef<() => void>(() => {});
  const clearTearTimers = () => {
    tearTimers.current.forEach(clearTimeout);
    tearTimers.current = [];
  };
  const releaseStyleRef = useRef(settings.releaseStyle);
  releaseStyleRef.current = settings.releaseStyle;
  const inputRef = useRef<TextInputInstance>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeSeed = useRef(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [releaseHint, setReleaseHint] = useState(false);
  const releaseHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseHintShown = useRef(false);
  // "즉시" mode: the visible, self-fading copy of the text (glyphs melt oldest-first).
  const trailRef = useRef<TrailingTextHandle>(null);
  /**
   * Bumped to empty the native input. The clear must run AFTER React has committed the
   * TextInput's latest event count — calling clear() inside onChangeText uses a stale count
   * and the native side silently ignores it (the word would stay on screen).
   */
  const [clearTick, setClearTick] = useState(0);
  useEffect(() => {
    if (clearTick > 0) inputRef.current?.clear();
  }, [clearTick]);

  const instant = settings.fadeDelay === 'instant';
  const instantRef = useRef(instant);
  instantRef.current = instant;

  const writing = focused || hasText || phase === 'fade';

  /* ───────── typing intensity (speed only, never content) ───────── */
  const { intensity, recordInput, reset: resetIntensity } = useTypingIntensity();
  const intensityRef = useRef<Intensity>('calm');
  intensityRef.current = intensity;

  /* ───────── layout ───────── */
  const cloudW = clamp(win.width * 0.6, 190, 270);
  const cloudH = cloudW * CLOUD_ASPECT;
  const cardH = clamp(win.height * 0.17, 118, 160);

  const mainH = useSharedValue(win.height * 0.7);
  const fullMainH = useRef(win.height * 0.7); // main height with the keyboard hidden
  const [kbdVisible, setKbdVisible] = useState(false);
  const contentH = useRef(0);
  const scrollY = useRef(0);

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
  const charge = useSharedValue(0); // how full of feelings the cloud is
  const chargeTarget = useRef(0);
  const pulse = useSharedValue(0); // cloud "gulp"
  const gape = useSharedValue(0); // cloud's mouth open, catching sparks
  const lastGulpSound = useRef(0);
  const kick = useSharedValue(0); // words hop on each keystroke
  const kickLift = useSharedValue(0);
  const kickX = useSharedValue(0);
  const lastGulp = useRef(0);
  const lastGulpHaptic = useRef(0);

  useEffect(() => {
    morph.value = withTiming(writing ? 1 : 0, { duration: soft ? 200 : 460, easing: Easing.bezier(0.3, 0.1, 0.2, 1) });
  }, [writing, soft, morph]);

  useEffect(() => {
    kbd.value = withTiming(kbdVisible ? 1 : 0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [kbdVisible, kbd]);

  useEffect(() => {
    const target = phase === 'vent' ? WARMTH[intensity] : phase === 'grace' ? 0.15 : 0;
    warmth.value = withTiming(target, { duration: intensity === 'burst' ? 400 : 900 });
    hush.value = withTiming(phase === 'fade' ? 0.85 : 0, { duration: phase === 'fade' ? 700 : 1400 });
  }, [phase, intensity, warmth, hush]);

  // Haptic punctuation when the feeling escalates (not on every key — battery & nerves).
  const prevIntensity = useRef<Intensity>('calm');
  useEffect(() => {
    if (phaseRef.current === 'vent') {
      if (intensity === 'building' && prevIntensity.current === 'calm') haptics.soft();
      if (intensity === 'burst') haptics.medium();
    }
    prevIntensity.current = intensity;
  }, [intensity, haptics]);

  // Bring the fresh, empty input back only after the old one has unmounted.
  useEffect(() => {
    fadeProgress.value = 0;
  }, [inputKey, fadeProgress]);

  /** One keystroke of venting: words hop, the cloud opens wide, gulps and fills. */
  const onVentInput = useCallback(() => {
    recordInput();
    const lv = intensityRef.current;

    if (!soft) {
      kickLift.value = KICK[lv].lift;
      kickX.value = (Math.random() - 0.5) * KICK[lv].jitter;
      kick.value = withSequence(withTiming(1, { duration: 45 }), withSpring(0, { damping: 9, stiffness: 320 }));
    }

    const now = Date.now();
    if (now - lastGulp.current < SPARK_THROTTLE_MS) return;
    lastGulp.current = now;

    const landing = soft ? 0 : GULP_DELAY_MS;
    // "아~ 앙, 냠" — the mouth opens for the feeling, snaps shut on it, then a little munch.
    gape.value = withSequence(
      withTiming(1, { duration: 110 }),
      withDelay(Math.max(0, landing - 150), withTiming(0, { duration: 90 })),
      withTiming(0.4, { duration: 90 }),
      withTiming(0, { duration: 110 }),
    );
    chargeTarget.current = Math.min(1, chargeTarget.current + CHARGE_STEP[lv]);
    charge.value = withDelay(landing, withTiming(chargeTarget.current, { duration: 260 }));
    // "꿀꺽": squash on the swallow, springing past rest into a little stretch.
    pulse.value = withDelay(
      landing,
      withSequence(withTiming(1, { duration: 70 }), withSpring(0, { damping: 5, stiffness: 300, mass: 0.6 })),
    );

    if (now - lastGulpSound.current > GULP_SOUND_MS[lv]) {
      lastGulpSound.current = now;
      setTimeout(sfx.gulp, landing);
    }

    if (lv === 'burst' && now - lastGulpHaptic.current > 220) {
      lastGulpHaptic.current = now;
      setTimeout(haptics.light, landing);
    }
  }, [recordInput, soft, kickLift, kickX, kick, charge, pulse, gape, haptics, sfx]);

  /**
   * "즉시" mode: once every glyph has melted (a short pause), quietly empty the native input
   * so nothing invisible lingers in it. The keyboard stays up; the cloud breathes out a little.
   */
  const quietClear = useCallback(() => {
    setClearTick((n) => n + 1); // deferred: clear() inside onChangeText would be ignored
    textRef.current = '';
    contentH.current = 0;
    scrollY.current = 0;
    trailRef.current?.reset();
    setHasText(false);
    sfx.puff();
    pulse.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 320 }));
    chargeTarget.current = chargeTarget.current * 0.6;
    charge.value = withTiming(chargeTarget.current, { duration: 700 });
  }, [pulse, charge, sfx]);

  /* ───────── fade lifecycle ───────── */
  const finishFade = useCallback(() => {
    textRef.current = '';
    contentH.current = 0;
    scrollY.current = 0;
    setFadeText(null); // drop the snapshot
    clearTearTimers();
    setTear(null);
    setHasText(false);
    setParticles([]);
    setInputKey((k) => k + 1); // remount → native buffer released
    setPhase('clear');
    haptics.done();
    sfx.clear();
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      if (phaseRef.current === 'clear') setPhase('rest');
    }, CLEAR_MESSAGE_MS);
  }, [haptics, setPhase, sfx, setTear]);

  /** Keyboard-down layout of the canvas and the cloud's mouth (main-area coords). */
  const releaseLayout = useCallback(() => {
    const H = fullMainH.current;
    const sCloud = CANVAS_SCALE_OPEN;
    const canvasH = Math.max(140, H - cloudH * sCloud * 0.92 - 4);
    const mouth = { x: win.width / 2, y: H + 6 - cloudH * sCloud * (1 - CLOUD_MOUTH.y) };
    return { canvasH, mouth };
  }, [cloudH, win.width]);

  /**
   * The cloud's "후우~" over `area` (main coords), carrying away whatever is drawn there.
   * `origin` is the mouth in the flying layer's own coordinates.
   */
  const runBlow = useCallback(
    (area: { y: number; height: number }, origin: { x: number; y: number }) => {
      const { mouth } = releaseLayout();
      fadeSeed.current = (fadeSeed.current * 9301 + 49297) % 233280;
      setParticles(
        soft
          ? []
          : buildParticles(
              fadeSeed.current,
              { x: GUTTER + 12, y: area.y, width: win.width - GUTTER * 2 - 24, height: area.height },
              mouth,
              { breath: 22, gust: 14 },
            ),
      );
      setBlowGeo({ origin, reach: Math.max(160, area.height + 60) });

      const duration = soft ? 1400 : FADE_DURATION_MS;
      // Everything it swallowed goes out with the breath.
      chargeTarget.current = 0;
      charge.value = withDelay(duration * BLOW.blowStart, withTiming(0, { duration: duration * 0.45 }));
      gape.value = 0;
      if (!soft) setTimeout(haptics.medium, duration * BLOW.blowStart); // the "후우~" itself
      setTimeout(sfx.blow, duration * BLOW.inhaleEnd);
      setTimeout(sfx.seeds, duration * (BLOW.blowStart + 0.08));

      fadeProgress.value = 0;
      fadeProgress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(finishFade);
      });
    },
    [releaseLayout, soft, win.width, charge, gape, haptics, sfx, fadeProgress, finishFade],
  );

  /* ───────── "찢어서 홀씨" ───────── */
  const paperW = win.width - GUTTER * 2;
  const PAPER_TOP = 12;

  const blowTear = useCallback(() => {
    const cur = tearRef.current;
    if (!cur || !cur.interactive) return;
    clearTearTimers();
    tearDragging.current = false;
    sfx.tearStop();
    setTear({ ...cur, interactive: false });
    const { mouth } = releaseLayout();
    // The paper layer sits at the canvas' left edge, top of the main area.
    runBlow({ y: PAPER_TOP, height: cur.paperH }, { x: mouth.x - GUTTER, y: mouth.y });
  }, [releaseLayout, runBlow, setTear, sfx]);

  /** Keep tearing, or the cloud blows once you pause (sooner when it's in tatters). */
  const scheduleTearBlow = useCallback(() => {
    clearTearTimers();
    const cur = tearRef.current;
    if (!cur?.interactive || tearDragging.current) return; // still tearing — wait for the finger
    if (cur.pieces <= 1) {
      // Touched but didn't tear: let them try again, and tear it for them after a while.
      tearTimers.current.push(setTimeout(() => autoTearRef.current(), 7000));
      return;
    }
    tearTimers.current.push(setTimeout(blowTear, cur.pieces >= MAX_PIECES ? 550 : 1500));
  }, [blowTear]);
  const onTearDragStart = useCallback(() => {
    tearDragging.current = true;
    clearTearTimers();
  }, []);
  const onTearDragEnd = useCallback(() => {
    tearDragging.current = false;
    sfx.tearStop();
    scheduleTearBlow();
  }, [scheduleTearBlow, sfx]);

  /** The finger is dragging across the sheet: tearing sound + little fibre ticks under it. */
  const scrubTick = useRef(0);
  const onTearScrub = useCallback(
    (speed: number, dist: number) => {
      sfx.tearScrub(speed);
      scrubTick.current += dist;
      if (scrubTick.current >= 36) {
        scrubTick.current = 0;
        haptics.tick();
      }
    },
    [sfx, haptics],
  );

  /** The sheet just ripped (by finger or by autoTear). */
  const onTorn = useCallback(
    (pieces: number) => {
      const cur = tearRef.current;
      if (!cur || !cur.interactive) return;
      setTear({ ...cur, pieces });
      haptics.medium();
      sfx.rip();
      scheduleTearBlow();
    },
    [setTear, haptics, sfx, scheduleTearBlow],
  );

  /** Tear it for the user (timer expiry, a tap without tearing, or no tearing for a while). */
  const autoTear = useCallback(() => {
    const cur = tearRef.current;
    if (!cur || !cur.interactive) return;
    clearTearTimers();
    const need = cur.pieces <= 1;
    if (need) {
      tearTimers.current.push(
        setTimeout(() => paperRef.current?.tearRandom(), 160),
        setTimeout(() => {
          const t2 = tearRef.current;
          if (t2 && t2.paperH > 120) paperRef.current?.tearRandom();
        }, 430),
      );
    }
    // onTorn re-schedules; this is the backstop.
    tearTimers.current.push(setTimeout(blowTear, need ? 1150 : 150));
  }, [blowTear]);
  autoTearRef.current = autoTear;

  const onPaperTap = useCallback(() => {
    const cur = tearRef.current;
    if (!cur || !cur.interactive) return;
    if (cur.pieces <= 1) autoTear();
    else blowTear();
  }, [autoTear, blowTear]);

  /**
   * Release the words. `byHand` = the user pressed "훌훌 날리기" / held the cloud: in the tear
   * style they then get to rip the paper themselves; a timer release tears it automatically.
   */
  const startFade = useCallback(
    (byHand = false) => {
      if (phaseRef.current === 'fade') return; // no double triggers
      if (!textRef.current) {
        setPhase('rest');
        return;
      }
      setFadeText(textRef.current);
      setPhase('fade');
      inputRef.current?.blur();
      Keyboard.dismiss();
      haptics.soft();
      resetIntensity();

      const { canvasH, mouth } = releaseLayout();
      if (releaseStyleRef.current === 'tear') {
        const paperH = clamp((contentH.current || 80) * 0.82 + 40, 150, canvasH - 80);
        fadeSeed.current = (fadeSeed.current * 9301 + 49297) % 233280;
        setTear({ interactive: true, pieces: 1, paperH, seed: fadeSeed.current });
        clearTearTimers();
        if (byHand) tearTimers.current.push(setTimeout(() => autoTear(), 7000));
        else tearTimers.current.push(setTimeout(() => autoTear(), 350));
        return;
      }

      const textH = clamp((contentH.current || 80) - scrollY.current, 60, canvasH - 40);
      // Text overlay coords: left edge of the canvas, and content (not screen) y → add the scroll.
      runBlow({ y: 8, height: textH }, { x: mouth.x - GUTTER, y: mouth.y + scrollY.current });
    },
    [haptics, setPhase, resetIntensity, releaseLayout, setTear, autoTear, runBlow],
  );

  const delayMs =
    settings.fadeDelay == null ? null : settings.fadeDelay === 'instant' ? TRAIL_LIFE_MS + 250 : settings.fadeDelay * 1000;
  const { touch } = useAutoFade({
    delayMs,
    armed: hasText && (phase === 'vent' || phase === 'grace') && !settingsOpen,
    onGrace: (remaining) => {
      setGraceMs(remaining);
      setPhase('grace');
    },
    onExpire: () => (instantRef.current ? quietClear() : startFade(false)),
    grace: !instant,
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

      // "즉시": every glyph starts its own fade clock — the oldest melts first.
      if (instantRef.current) trailRef.current?.set(text);

      const grew = text.length >= textRef.current.length; // Hangul composition keeps length equal
      textRef.current = text;
      const nonEmpty = text.length > 0;
      setHasText(nonEmpty);
      if (nonEmpty) {
        if (phaseRef.current !== 'vent') setPhase('vent');
        touch();
        if (grew) onVentInput();
      } else {
        if (phaseRef.current !== 'rest') setPhase('rest');
        chargeTarget.current = 0;
        charge.value = withTiming(0, { duration: 600 });
        resetIntensity();
      }
    },
    [setPhase, touch, onVentInput, charge, resetIntensity],
  );

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (releaseHintTimer.current) clearTimeout(releaseHintTimer.current);
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

  /**
   * Crossing the "즉시" boundary (from the picker OR Settings) remounts the input — see its `key`.
   * The native view keeps the old glyph colour on text it already holds (and new characters inherit
   * it), so a ghost input switched back to normal would stay invisible. The words on screen go too:
   * melted glyphs must never reappear, and a remounted input starts empty anyway.
   */
  const prevInstant = useRef(instant);
  useEffect(() => {
    if (prevInstant.current === instant) return;
    prevInstant.current = instant;
    if (textRef.current) quietClear();
    setFocused(false); // the old input unmounts without firing onBlur
    if (phaseRef.current === 'vent' || phaseRef.current === 'grace') setPhase('rest');
  }, [instant, quietClear, setPhase]);

  useEffect(() => {
    if (phase === 'fade' || phase === 'grace') setPickerOpen(false);
  }, [phase]);

  const flashReleaseHint = useCallback(() => {
    setReleaseHint(true);
    if (releaseHintTimer.current) clearTimeout(releaseHintTimer.current);
    releaseHintTimer.current = setTimeout(() => setReleaseHint(false), RELEASE_HINT_MS);
  }, []);

  // The first time there is something to release in a session, explain the cloud once.
  useEffect(() => {
    if (hasText && !releaseHintShown.current) {
      releaseHintShown.current = true;
      flashReleaseHint();
    }
    if (!hasText) setReleaseHint(false);
  }, [hasText, flashReleaseHint]);

  /* ───────── hold the cloud (or the chip) to release ───────── */
  // In "즉시" mode the words leave by themselves (and melted glyphs must not come back in a fade).
  const canRelease = hasText && phase !== 'fade' && !instant;
  const venting = phase === 'vent' && (hasText || (instant && focused));
  const { hold, onPressIn, onPressOut } = useHoldToRelease({
    disabled: !canRelease,
    onHoldStart: haptics.tick,
    onRelease: () => startFade(true),
    onShortTap: () => {
      flashReleaseHint();
      pulse.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 300 }));
    },
  });

  /** Tapping the sleeping cloud wakes it up and opens the keyboard. */
  const onCloudPress = useCallback(() => {
    if ((!hasText || instant) && phaseRef.current !== 'fade') inputRef.current?.focus();
  }, [hasText, instant]);

  /* ───────── privacy guards ───────── */
  useEffect(() => {
    if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
  }, []);
  useEffect(() => {
    // Android: FLAG_SECURE while there are words on screen → blank in Recents, no screenshots.
    if (Platform.OS !== 'android') return;
    const key = 'void-writing';
    const sensitive = hasText || phase === 'fade';
    (sensitive ? ScreenCapture.preventScreenCaptureAsync(key) : ScreenCapture.allowScreenCaptureAsync(key)).catch(() => {});
  }, [hasText, phase]);

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

  // "훌훌 날리기" chip rides just above the cloud's head while venting.
  const chipStyle = useAnimatedStyle(() => {
    const H = mainH.value;
    const s = interpolate(kbd.value, [0, 1], [CANVAS_SCALE_OPEN, CANVAS_SCALE_KBD]);
    const cloudTop = H + 6 - cloudH * s * (1 + charge.value * 0.15);
    return { transform: [{ translateY: cloudTop - CHIP_GAP }] };
  });

  const promptStyle = useAnimatedStyle(() => ({
    opacity: 1 - morph.value,
    transform: [{ translateY: -16 * morph.value }],
  }));

  const kickStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: kickX.value * kick.value },
      { translateY: -kickLift.value * kick.value },
    ],
  }));

  /* ───────── derived UI ───────── */
  const tearing = phase === 'fade' && tear?.interactive === true;
  const mood: CloudMood =
    tearing
      ? 'building' // eager: "찢어, 찢어!"
      : phase === 'fade'
      ? 'fade'
      : phase === 'grace'
        ? 'calm'
        : venting
          ? intensity
          : focused
            ? 'calm' // awake and listening
            : 'rest';

  const delay = settings.fadeDelay;
  const pill = useMemo((): { kind: PillKind; label: string } => {
    if (tearing) return { kind: 'fade', label: t.home.pillTear };
    if (phase === 'fade') return { kind: 'fade', label: t.home.pillFade };
    if (phase === 'grace') return { kind: 'grace', label: t.home.pillGrace };
    if (venting) {
      return delay == null
        ? { kind: 'paused', label: t.home.pillPaused }
        : { kind: 'vent', label: t.home.pillVent(t.home.timerShort(delay)) };
    }
    // Rest: the auto-fade time is always visible (and tappable) at the top.
    return { kind: 'timer', label: t.home.timerChip(delay) };
  }, [phase, venting, delay, t, tearing]);
  const pillOpensPicker = pill.kind === 'timer' || pill.kind === 'vent' || pill.kind === 'paused';

  const fadeSeedForGlyphs = fadeSeed.current;

  return (
    <View style={styles.root}>
      <SkyBackground warmth={warmth} hush={hush} soft={soft} />

      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              dismissKeyboard(); // otherwise it pops back up over the guide / after the sheet closes
              onOpenSettings();
            }}
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
              a11yLabel={pill.kind === 'grace' ? t.home.a11yGrace : pillOpensPicker ? t.home.a11yTimer(delay) : undefined}
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
              <IntensityIndicator intensity={phase === 'vent' ? intensity : 'calm'} />
            </View>
          )}
        </View>

        {pickerOpen && (
          <View style={[styles.pickerLayer, { top: insets.top + HEADER_H }]}>
            <TimerPicker title={t.home.timerPickerTitle} value={delay} labelFor={t.home.timerShort} onSelect={selectDelay} />
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
                    {t.home.restHint}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            {/* Cloud — swallows feelings while you type, hold it to blow them away */}
            <Animated.View
              style={[styles.cloud, { width: cloudW, height: cloudH, left: (win.width - cloudW) / 2 }, cloudStyle]}
              pointerEvents="box-none"
            >
              <View style={[styles.ripples, { left: -cloudW * 0.1, top: cloudH * 0.5 - cloudW * 0.42 }]} pointerEvents="none">
                <RippleRings intensity={intensity} active={venting && !soft} size={cloudW * 1.2} />
              </View>
              <Pressable
                onPress={onCloudPress}
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                accessibilityRole="button"
                accessibilityLabel={t.home.a11yCloud}
                accessibilityActions={canRelease ? [{ name: 'activate' }] : undefined}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'activate' && canRelease) startFade(true);
                }}
              >
                <CloudCharacter
                  mood={mood}
                  width={cloudW}
                  soft={soft}
                  charge={charge}
                  pulse={pulse}
                  hold={hold}
                  gape={gape}
                  blow={fadeProgress}
                />
              </Pressable>
            </Animated.View>

            {/* Writing surface: glass card at rest, open canvas while venting */}
            <Animated.View style={[styles.shell, shellStyle]}>
              <Animated.View style={[styles.flex, kickStyle, phase === 'fade' && styles.hidden]}>
                <EmotionTextInput
                  key={`${inputKey}${instant ? '-ghost' : ''}`}
                  ref={inputRef}
                  mode={writing ? 'canvas' : 'card'}
                  ghost={instant}
                  placeholder={t.home.placeholder}
                  editable={phase !== 'fade'}
                  accessibilityLabel={t.home.a11yInput}
                  onChangeText={onChangeText}
                  onFocus={() => setFocused(true)}
                  onBlur={() => {
                    setFocused(false);
                    if (!textRef.current && phaseRef.current === 'vent') setPhase('rest');
                  }}
                  onContentSizeChange={(h) => (contentH.current = h)}
                  onScrollY={(y) => (scrollY.current = y)}
                />
                {instant && writing && (
                  <TrailingText ref={trailRef} textStyle={CANVAS_TEXT_STYLE} padding={CANVAS_PADDING} scrollY={scrollY} />
                )}
              </Animated.View>
            </Animated.View>

            {/* The words, blown off by the cloud's breath (unclipped: they fly off-screen) */}
            {fadeText != null && tear && (
              <View style={styles.glyphLayer} pointerEvents="box-none">
                <TearPaper
                  ref={paperRef}
                  text={fadeText}
                  width={paperW}
                  height={tear.paperH}
                  top={PAPER_TOP}
                  interactive={tear.interactive}
                  onTorn={onTorn}
                  onTap={onPaperTap}
                  onDragStart={onTearDragStart}
                  onDragEnd={onTearDragEnd}
                  onScrub={onTearScrub}
                  progress={fadeProgress}
                  origin={blowGeo.origin}
                  gentle={soft}
                  seed={tear.seed}
                  hint={tear.pieces > 1 ? t.home.tearHintMore : t.home.tearHint}
                  a11yLabel={t.home.a11yPaper}
                />
              </View>
            )}
            {fadeText != null && !tear && (
              <View style={styles.glyphLayer} pointerEvents="none">
                <GlyphEvaporation
                  text={fadeText}
                  progress={fadeProgress}
                  textStyle={CANVAS_TEXT_STYLE}
                  padding={CANVAS_PADDING}
                  scrollY={scrollY.current}
                  seed={fadeSeedForGlyphs}
                  gentle={soft}
                  origin={blowGeo.origin}
                  reach={blowGeo.reach}
                />
              </View>
            )}

            {/* Sparks of feeling flying from the words into the cloud */}

            {/* "훌훌 날리기" chip above the cloud + one-time hint */}
            {canRelease && (
              <Animated.View style={[styles.chipLayer, chipStyle]} pointerEvents="box-none">
                <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.chipCol}>
                  {releaseHint && (
                    <View style={styles.bubble} pointerEvents="none">
                      <HintBubble text={t.home.releaseBubble} />
                    </View>
                  )}
                  <ReleaseButton
                    label={t.home.release}
                    a11yLabel={t.home.a11yRelease}
                    hold={hold}
                    soft={soft}
                    onRelease={() => {
                      haptics.tick();
                      startFade(true);
                    }}
                  />
                </Animated.View>
              </Animated.View>
            )}

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
  hidden: { opacity: 0 },
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
    fontSize: 32,
    lineHeight: 43,
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
    fontSize: 19,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  pickerLayer: { position: 'absolute', left: 0, right: 0, zIndex: 10 },
  cloud: { position: 'absolute', top: 0, transformOrigin: 'center bottom' },
  ripples: { position: 'absolute' },
  shell: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipLayer: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  glyphLayer: { position: 'absolute', top: 0, left: GUTTER, right: GUTTER, bottom: 0, overflow: 'visible' },
  chipCol: { alignItems: 'center' },
  bubble: { position: 'absolute', bottom: 58, width: 280, alignItems: 'center' },
});
