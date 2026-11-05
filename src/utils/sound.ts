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
};

let modeSet = false;

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
    rip.volume = 0.7;
  }, [gulp, blow, seeds, clear, puff, rip]);

  const play = useCallback((p: AudioPlayer) => {
    if (!on.current) return;
    try {
      p.seekTo(0).catch(() => {});
      p.play();
    } catch {
      // Sound is decoration; never let it break the screen.
    }
  }, []);

  return useMemo(
    () => ({
      gulp: () => play(gulp),
      blow: () => play(blow),
      seeds: () => play(seeds),
      clear: () => play(clear),
      puff: () => play(puff),
      rip: () => play(rip),
    }),
    [play, gulp, blow, seeds, clear, puff, rip],
  );
}
