import { GamjaFlower_400Regular } from '@expo-google-fonts/gamja-flower/400Regular';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Onboarding } from './src/components/Onboarding';
import { GUIDE_VERSION } from './src/constants/config';
import { PrivacyCover } from './src/components/PrivacyCover';
import { useStrings } from './src/i18n';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Fonts are bundled with the app — no network needed at runtime.
  const [loaded, error] = useFonts({ GamjaFlower_400Regular });

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      {/*
        By default Reanimated jumps every animation straight to its end when the OS asks for
        reduced motion (iOS "Reduce Motion", Android "Remove animations", Samsung power saving…).
        Here that made the whole release vanish in one frame. Motion is governed instead by the
        in-app "애니메이션 강도" setting, whose first value follows the OS preference.
      */}
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <SettingsProvider>
        <Root />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const t = useStrings();
  const { settings, hydrated, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus | null) ?? 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  // Keep the splash up until saved preferences (timer, guide-seen flag) are read.
  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync().catch(() => {});
  }, [hydrated]);

  if (!hydrated) return null;

  return (
    <View style={styles.root}>
      <StatusBar style={settingsOpen ? 'dark' : 'light'} />
      <HomeScreen onOpenSettings={() => setSettingsOpen(true)} settingsOpen={settingsOpen} />

      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SafeAreaProvider>
          <SettingsScreen
            onClose={() => setSettingsOpen(false)}
            onReplayGuide={() => {
              setSettingsOpen(false);
              update({ guideVersion: 0 });
            }}
          />
        </SafeAreaProvider>
      </Modal>

      {settings.guideVersion < GUIDE_VERSION && <Onboarding onDone={() => update({ guideVersion: GUIDE_VERSION })} />}

      {/* Hide the words from the app switcher / recents snapshot. */}
      {appState !== 'active' && <PrivacyCover label={t.home.privacyCover} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
