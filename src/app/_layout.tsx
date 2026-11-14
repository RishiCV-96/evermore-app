import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
  useFonts,
} from '@expo-google-fonts/atkinson-hyperlegible';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AUTH_ENABLED } from '@/config/features';
import { useWho } from '@/data/app-data';
import { forgetReminders } from '@/data/reminders';
import { useStudyDay } from '@/data/study-clock';
import { useTextSizeLoaded } from '@/data/text-size';
import { Colors } from '@/theme/colors';

SplashScreen.preventAutoHideAsync();

// Navigation's own background and colors, from the palette, so nothing gray shows between screens.
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.divider,
  },
};

// Each role reaches only its own screens: signed out, the sign-in screen; the person, home
// and practice; the caregiver, the dashboard and the screens it opens. With sign-in off
// (src/config/features.ts) there is no sign-in screen: the app opens as the person, and
// holding Caregiver switches to the dashboard.
export default function RootLayout() {
  const [loaded, error] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const who = useWho();
  const textSizeLoaded = useTextSizeLoaded();
  // This device's study day, read before anything decides what today is (src/data/study-clock.ts).
  const studyDay = useStudyDay();
  const ready = (loaded || error) && who.ready && textSizeLoaded && studyDay !== undefined;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Reminders belong to a signed-in person's phone. Opened signed out or as the caregiver, this phone
  // keeps none, whatever happened while the app was closed (src/data/forget.ts cancels them on sign-out).
  useEffect(() => {
    if (AUTH_ENABLED && who.ready && who.role !== 'person') void forgetReminders();
  }, [who.ready, who.role]);

  if (!ready) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Protected guard={AUTH_ENABLED && who.role === null}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={who.role === 'person'}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="practice" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={who.role === 'caregiver'}>
          <Stack.Screen name="caregiver" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
