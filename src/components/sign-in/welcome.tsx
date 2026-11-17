import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_NAME, TAGLINE } from '@/config/brand';
import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen } from '@/components/caregiver-ui';
import { TandemLogo } from '@/components/tandem-logo';
import { Colors } from '@/theme/colors';
import { GUTTER, Space } from '@/theme/layout';
import { CompactType } from '@/theme/type';

// The first steps of screen 1 (sign-in). The welcome is for everyone, so it uses the person's large
// type; everything past "I am a caregiver" uses the caregiver's compact scale.

/** Screen 1's first step: the logo and the two ways in. */
export function Welcome({ onPerson, onCaregiver }: { onPerson: () => void; onCaregiver: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + Space.xl, paddingBottom: insets.bottom + Space.l }]}>
      {/* Scrolls only if very large text on a small phone needs it, so the two ways in stay on screen. */}
      <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent}>
        <TandemLogo size="hero" testID="logo-welcome" />
        <AppText accessibilityRole="header" center bold size="title">
          Welcome
        </AppText>
        <AppText center muted>
          {TAGLINE}
        </AppText>
      </ScrollView>
      <View style={styles.choices}>
        <BigButton testID="role-person" label="I am practicing" primary large onPress={onPerson} />
        <BigButton testID="role-caregiver" label="I am a caregiver" large onPress={onCaregiver} />
      </View>
    </View>
  );
}

/** "I am a caregiver": sign in, or make an account. */
export function CaregiverChoice({ onBack, onSignIn, onCreate }: { onBack: () => void; onSignIn: () => void; onCreate: () => void }) {
  return (
    <CompactType value={true}>
      <CaregiverScreen
        title="Caregiver"
        backLabel="Back"
        onBack={onBack}
        footer={
          <View style={styles.footer}>
            <BigButton testID="caregiver-sign-in" label="Sign in" primary onPress={onSignIn} />
            <BigButton testID="caregiver-create" label="Create an account" onPress={onCreate} />
          </View>
        }>
        <AppText>Sign in to your account, or create one to set up {APP_NAME} for someone you care for.</AppText>
        <AppText size="caption" muted>
          {APP_NAME} is a practice tool, not a medical device.
        </AppText>
      </CaregiverScreen>
    </CompactType>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    gap: Space.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    backgroundColor: Colors.background,
  },
  middle: {
    flex: 1,
  },
  middleContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Space.m,
  },
  choices: {
    gap: Space.m,
  },
  footer: {
    gap: Space.s,
  },
});
