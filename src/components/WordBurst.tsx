import { memo, useEffect } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { GlyphEvaporation } from './GlyphEvaporation';
import { CANVAS_PADDING, CANVAS_TEXT_STYLE } from './EmotionTextInput';

export const WORD_BURST_MS = 1300;

/**
 * "즉시" mode: one finished word, drawn exactly where it was typed, that scatters into
 * sparkles the moment the user hits space. Owns its own clock; calls `onDone` to unmount
 * (which also drops this snapshot of the word from memory).
 */
function WordBurstBase({ id, text, onDone }: { id: number; text: string; onDone: (id: number) => void }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: WORD_BURST_MS, easing: Easing.linear }, (finished) => {
      if (finished) scheduleOnRN(onDone, id);
    });
  }, [id, onDone, progress]);

  return (
    <GlyphEvaporation
      text={text}
      progress={progress}
      textStyle={CANVAS_TEXT_STYLE}
      padding={CANVAS_PADDING}
      scrollY={0}
      seed={id * 7919 + 13}
    />
  );
}

export const WordBurst = memo(WordBurstBase);
