import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useSettings } from '../state/SettingsContext';

/* Tiny original effects, synthesised for this app and bundled (no network). */
const SRC = {
  gulp: require('../../assets/sounds/gulp.wav'),
  blow: require('../../assets/sounds/blow.wav'),
  seeds: require('../../assets/sounds/seeds.wav'),
  clear: require('../../assets/sounds/clear.wav'),
  puff: require('../../assets/sounds/puff.wav'),
  rip: require('../../assets/sounds/rip.wav'),
  tearLoop: require('../../assets/sounds/tear_loop.wav'),
};

let modeSet = false;

/** Drag speed (px/s) at which the tearing sound is at its loudest / fastest. */
const SCRUB_FULL = 1100;
/** No movement for this long → the tearing sound stops (the finger is resting). */
const SCRUB_IDLE_MS = 110;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Sound effects, gated by the Settings toggle. They mix with the user's music and respect the
 * iPhone silent switch — a venting app should never suddenly make noise in a quiet room.
 */
export function useSoundFx() {
  const { settings } = useSettings();
  const on = useRef(settings.sound);
  on.current = settings.sound;

  const gulp = useAudioPlayer(SRC.gulp);
  const blow = useAudioPlayer(SRC.blow);
  const seeds = useAudioPlayer(SRC.seeds);
  const clear = useAudioPlayer(SRC.clear);
  const puff = useAudioPlayer(SRC.puff);
  const rip = useAudioPlayer(SRC.rip);
  const tearLoop = useAudioPlayer(SRC.tearLoop);

  useEffect(() => {
    if (modeSet) return;
    modeSet = true;
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  useEffect(() => {
    gulp.volume = 0.45;
    blow.volume = 0.8;
    seeds.volume = 0.55;
    clear.volume = 0.5;
    puff.volume = 0.5;
    rip.volume = 1;
    tearLoop.loop = true;
    tearLoop.volume = 0;
    // Faster drag → faster, higher fibres (like real paper); no pitch correction on purpose.
    tearLoop.shouldCorrectPitch = false;
  }, [gulp, blow, seeds, clear, puff, rip, tearLoop]);

  const play = useCallback((p: AudioPlayer) => {
    if (!on.current) return;
    try {
      p.seekTo(0).catch(() => {});
      p.play();
    } catch {
      // Sound is decoration; never let it break the screen.
    }
  }, []);

  /* ───────── tearing that follows the finger ───────── */
  const scrubbing = useRef(false);
  const level = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tearStop = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
    if (!scrubbing.current) return;
    scrubbing.current = false;
    level.current = 0;
    try {
      tearLoop.volume = 0;
      tearLoop.pause();
    } catch {}
  }, [tearLoop]);

  /** Call on every drag move with the finger's speed (px/s). */
  const tearScrub = useCallback(
    (speed: number) => {
      if (!on.current) return;
      const target = clamp(speed / SCRUB_FULL, 0, 1);
      // Rise fast, fall a bit slower — sounds like the tear catching and running.
      level.current = target > level.current ? level.current + (target - level.current) * 0.7 : level.current * 0.8 + target * 0.2;
      try {
        tearLoop.volume = 0.25 + 0.75 * Math.sqrt(level.current);
        tearLoop.setPlaybackRate(0.8 + 0.55 * level.current);
        if (!scrubbing.current) {
          scrubbing.current = true;
          // Start somewhere new in the loop each time so repeated tears don't sound identical.
          tearLoop.seekTo(Math.random() * 1.4).catch(() => {});
          tearLoop.play();
        }
      } catch {}
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(tearStop, SCRUB_IDLE_MS);
    },
    [tearLoop, tearStop],
  );

  useEffect(() => () => tearStop(), [tearStop]);

  return useMemo(
    () => ({
      gulp: () => play(gulp),
      blow: () => play(blow),
      seeds: () => play(seeds),
      clear: () => play(clear),
      puff: () => play(puff),
      rip: () => play(rip),
      tearScrub,
      tearStop,
    }),
    [play, gulp, blow, seeds, clear, puff, rip, tearScrub, tearStop],
  );
}
