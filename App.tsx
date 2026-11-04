// Import only the weights we use (the package index would bundle every weight).
import { Gaegu_400Regular } from '@expo-google-fonts/gaegu/400Regular';
import { Gaegu_700Bold } from '@expo-google-fonts/gaegu/700Bold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Onboarding } from './src/components/Onboarding';
import { PrivacyCover } from './src/components/PrivacyCover';
import { useStrings } from './src/i18n';
import { HomeScreen } from './src/screens/HomeScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SettingsProvider, useSettings } from './src/state/SettingsContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // Fonts are bundled with the app — no network needed at runtime.
  const [loaded, error] = useFonts({ Gaegu_400Regular, Gaegu_700Bold });

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
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
              update({ onboarded: false });
            }}
          />
        </SafeAreaProvider>
      </Modal>

      {!settings.onboarded && <Onboarding onDone={() => update({ onboarded: true })} />}

      {/* Hide the words from the app switcher / recents snapshot. */}
      {appState !== 'active' && <PrivacyCover label={t.home.privacyCover} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
