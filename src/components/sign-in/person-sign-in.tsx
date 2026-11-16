import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen, Field, Notice } from '@/components/caregiver-ui';
import { Logo } from '@/components/logo';
import { PasswordField } from '@/components/password-field';
import { PolicyLink, PolicySheet } from '@/components/privacy-policy';
import { signIn } from '@/data/account';
import { personProblems } from '@/lib/auth-form';
import { SET_UP_FOR_YOU } from '@/lib/consent';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space, TAP } from '@/theme/layout';

// Screen 1's step for the person practicing: "Hello", the User ID and password the caregiver made
// under Settings, Their login, and one big Continue. The person's own large type (the Text size
// setting), 48pt targets, one action, nothing timed. Signing in once keeps this phone signed in, so
// they aren't asked again unless the caregiver signs the phone out. Nothing about any account shows.
// The person is never shown legal text: this first step says, in one large sentence, that their
// caregiver set this up, with a link to the privacy policy at the ordinary reading size.

export function PersonSignIn({ onBack }: { onBack: () => void }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState(false);
  const problems = personProblems({ userId, password });

  async function submit() {
    setTried(true);
    if (problems.userId || problems.password) return;
    setBusy(true);
    const result = await signIn('person', userId, password);
    setBusy(false);
    // Signed in: the app opens their home by itself, and stays signed in.
    if (!result.ok) setMessage(result.message);
  }

  return (
    <CaregiverScreen
      header={
        <View style={styles.header}>
          <Pressable
            testID="person-back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={ICON} color={Colors.primaryDark} aria-hidden />
            <AppText fit color={Colors.primaryDark}>
              Back
            </AppText>
          </Pressable>
          <Logo size="form" testID="logo-person-sign-in" foldWithKeyboard />
          <AppText accessibilityRole="header" fit bold size="display">
            Hello
          </AppText>
          <AppText muted>Type the User ID and password from your caregiver.</AppText>
        </View>
      }
      footer={<BigButton testID="person-continue" label={busy ? 'One moment…' : 'Continue'} primary large disabled={busy} onPress={submit} />}>
      <AppText testID="set-up-for-you" bold>
        {SET_UP_FOR_YOU}
      </AppText>
      <Field
        testID="person-user-id"
        label="User ID"
        value={userId}
        onChangeText={setUserId}
        note={tried ? problems.userId : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <PasswordField
        testID="person-password"
        label="Password"
        value={password}
        onChangeText={setPassword}
        note={tried ? problems.password : undefined}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {message ? <Notice>{message}</Notice> : null}
      <PolicyLink testID="person-policy" onPress={() => setPolicy(true)} />
      <PolicySheet visible={policy} onClose={() => setPolicy(false)} />
    </CaregiverScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Space.s,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: TAP,
    paddingRight: Space.m,
    marginLeft: -Space.xs,
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
});
