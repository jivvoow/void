import type { FadeDelay } from '../types';
import type { Strings } from './ko';

/** English copy. Fill in as the English release approaches. */
export const en: Strings = {
  brand: { en: 'VOID', ko: '훌훌' },
  slogan: 'Type it out. Let it go.',
  sloganEn: 'Type it out. Let it go.',
  home: {
    prompt: "What's weighing on you?\nLet it out here.",
    placeholder: 'Write whatever you want...',
    pillVent: (delay: string) => `Letting it out · ${delay}`,
    timerChip: (s: FadeDelay) => (s == null ? 'Auto-fade off' : s === 'instant' ? 'Gone as you type' : `Gone ${s}s after you stop`),
    timerShort: (s: FadeDelay) => (s == null ? 'Off' : s === 'instant' ? 'Now' : `${s}s`),
    timerPickerTitle: 'Fade after you stop typing',
    a11yTimer: (s: FadeDelay) =>
      s == null
        ? 'Auto-fade off. Tap to change'
        : s === 'instant'
          ? 'Each word vanishes as soon as you finish it. Tap to change'
          : `Fades ${s} seconds after you stop. Tap to change`,
    restHint: 'The faster you pour it out, the more the cloud gulps',
    releaseBubble: 'Hold the cloud to blow it all away',
    a11yCloud: 'A cloud full of your feelings. Long-press to blow your words away.',
    a11yKeyboardDown: 'Hide keyboard',
    pillGrace: 'Floating away soon · tap to stop',
    pillFade: 'Slowly fading away…',
    pillPaused: 'Auto-fade off · hold to release',
    clear: "There. You've let it go.",
    release: 'Let it go',
    a11ySettings: 'Open settings',
    a11yInput: 'Text field for your feelings. Nothing is saved.',
    a11yRelease: 'Let it go. Long-press to erase what you wrote.',
    a11yGrace: 'Cancel auto-fade',
    privacyCover: 'VOID',
  },
  onboarding: {
    skip: 'Skip',
    tapNext: 'Tap the card to continue',
    tapStart: 'Tap the card to begin',
    steps: [
      { title: 'Pour it out', body: 'The faster you type, the more\nthe cloud gulps it down and swells.' },
      { title: 'Hold the cloud', body: 'When you are done, press and hold.\nWhoosh — it all blows away.' },
      { title: 'Or just stop', body: 'It fades on its own (pick with ⏱).\n“Now” blows away every word as you go.' },
    ],
  },
  settings: {
    title: 'Settings',
    replayGuide: 'Show the guide again',
    done: 'Done',
    sectionFade: 'Auto-fade',
    fadeCaption: 'Your words vanish after this long without typing.',
    fadeOption: (s: FadeDelay) => (s == null ? 'Off' : s === 'instant' ? 'Now' : `${s}s`),
    sectionFeel: 'Feel',
    haptics: 'Haptics',
    hapticsCaption: 'Gentle taps as feelings build and when words fade.',
    sound: 'Sound',
    soundCaption: 'Coming in a future update.',
    animation: 'Animation',
    animationSoft: 'Soft',
    animationFull: 'Full',
    animationCaption: 'Automatically softened when Reduce Motion is on.',
    sectionLanguage: 'Language',
    languageKo: '한국어',
    languageEnSoon: 'English (coming soon)',
    sectionPrivacy: 'Privacy',
    privacyItems: [
      'Your words live only briefly in app memory on this device. Never sent, never written to disk.',
      'No login, no history, no autosave. The app always reopens empty.',
      'When the words fade, the app drops its copy too.',
      'Content is hidden in the app switcher. (On Android, screen capture is blocked while writing.)',
      'Nothing is auto-copied to the clipboard or written to logs.',
    ],
    privacyLimits:
      "We can't promise to erase traces created outside the app, such as keyboard learning, screenshots you take, or OS backups.",
    version: (v: string) => `VOID ${v}`,
  },
};
