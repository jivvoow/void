import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, skyGradient } from '../constants/theme';
import { CloudCharacter } from './CloudCharacter';

/**
 * Opaque cover shown whenever the app isn't active, so the OS app-switcher snapshot
 * shows a sleeping cloud instead of the user's words.
 * (Paired with expo-screen-capture: iOS app-switcher blur, Android FLAG_SECURE.)
 */
export function PrivacyCover({ label }: { label: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={skyGradient.base} locations={skyGradient.baseLocations} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <CloudCharacter mood="rest" width={150} soft />
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  label: { fontFamily: fonts.hand, fontSize: 25, color: '#FFFFFF', letterSpacing: 2 },
});
