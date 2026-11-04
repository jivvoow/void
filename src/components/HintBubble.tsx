import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { fonts } from '../constants/theme';

/** Small speech bubble pointing down at a control (used above "훌훌 날리기"). */
export function HintBubble({ text }: { text: string }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      exiting={FadeOut.duration(220)}
      style={styles.wrap}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.bubble}>
        <Text style={styles.text} maxFontSizeMultiplier={1.3}>
          {text}
        </Text>
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#5E5A72',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  text: { fontFamily: fonts.hand, fontSize: 16, color: '#6B6480' },
  tail: {
    width: 10,
    height: 10,
    marginTop: -5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    transform: [{ rotate: '45deg' }],
  },
});
