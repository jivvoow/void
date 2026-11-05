import type { FadeDelay } from '../types';

/** Choices offered in Settings. `null` = auto-fade off. */
export const FADE_DELAY_OPTIONS: FadeDelay[] = ['instant', 3, 15, null];
export const DEFAULT_FADE_DELAY: FadeDelay = 15;

/**
 * The last N ms before an automatic fade are a "you can still stop this" window.
 * Typing (or tapping the pill) during this window cancels the fade.
 */
export const GRACE_WINDOW_MS = 5000;


/** Total length of the evaporation sequence (inhale → glyphs scatter → sparkles settle). */
export const FADE_DURATION_MS = 2400;

/** How long "훌훌, 이제 보내줬어요." stays on screen. */
export const CLEAR_MESSAGE_MS = 2400;

/** Long-press length required on "훌훌 날리기". */
export const RELEASE_HOLD_MS = 800;

/** Bump when the first-run guide changes so existing users see the new one once. */
export const GUIDE_VERSION = 2;

/** Min gap between sparks flung into the cloud while typing. */
export const SPARK_THROTTLE_MS = 70;

/** How long the "꾹 누르면 바로 날아가요" bubble stays up. */
export const RELEASE_HINT_MS = 3200;
