/**
 * Main screen state machine (all inside ONE screen, never navigated):
 *
 *   rest ──type──▶ vent ──idle ≥ delay-grace──▶ grace ──idle ≥ delay──▶ fade ──▶ clear ──▶ rest
 *                   ▲                             │ type / tap                       │ type
 *                   └─────────────────────────────┘                                  ▼
 *                                                                                   vent
 */
export type VentPhase = 'rest' | 'vent' | 'grace' | 'fade' | 'clear';

/** Typing-speed bands (Phase 2). Derived only from input timing, never from content. */
export type Intensity = 'calm' | 'building' | 'burst';

/** What the cloud shows. One character, different moods. */
export type CloudMood = 'rest' | 'calm' | 'building' | 'burst' | 'fade';

/**
 * Seconds of inactivity before auto-fade. `null` = off.
 * `'instant'` = every word scatters the moment it is finished (space / enter).
 */
export type FadeDelay = 'instant' | 3 | 15 | null;

export type AnimationLevel = 'soft' | 'full';

export type Locale = 'ko' | 'en';

export interface Settings {
  fadeDelay: FadeDelay;
  haptics: boolean;
  sound: boolean;
  animationLevel: AnimationLevel;
  locale: Locale;
  /** Version of the first-run guide the user has finished (or skipped). 0 = never. */
  guideVersion: number;
}
