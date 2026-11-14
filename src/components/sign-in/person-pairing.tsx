import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen, Field, Notice } from '@/components/caregiver-ui';
import { Logo } from '@/components/logo';
import { PolicyLink, PolicySheet } from '@/components/privacy-policy';
import { signInPairedPhone } from '@/data/account';
import { pairPhone } from '@/data/pairing';
import { SET_UP_FOR_YOU } from '@/lib/consent';
import { pairEmailProblem, pinDigits, pinProblem } from '@/lib/pairing';
import { Colors } from '@/theme/colors';
import { GUTTER, ICON, RADIUS, Space, TAP } from '@/theme/layout';
import { Fonts, useType } from '@/theme/type';

// Screen 1's steps for the person practicing, after "I am practicing": a choice between Create my
// account (the caregiver's email, then a PIN from the caregiver) and Sign in (a User ID and password).
// The person's own large type (the Text size setting), 48pt targets, one action per step, a plain Back,
// nothing timed against them. The email and PIN live only in memory while these steps are open, and are
// cleared once used. After pairing, no screen shows the caregiver's email or any account detail.
// The person is never shown legal text: their first step says, in one large sentence, that their caregiver
// set this up, with a link to the privacy policy at the ordinary reading size for anyone who wants it.

type BackProps = { onBack: () => void; testID: string };

/** The person's Back: 48pt, the chevron and the word. */
function Back({ onBack, testID }: BackProps) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={ICON} color={Colors.primaryDark} aria-hidden />
      <AppText fit color={Colors.primaryDark}>
        Back
      </AppText>
    </Pressable>
  );
}

/** "I am practicing": Create my account, or Sign in with a User ID. */
export function PersonChoice({ onBack, onCreate, onSignIn }: { onBack: () => void; onCreate: () => void; onSignIn: () => void }) {
  const [policy, setPolicy] = useState(false);
  return (
    <CaregiverScreen
      header={
        <View style={styles.header}>
          <Back testID="person-choice-back" onBack={onBack} />
          <Logo size="form" testID="logo-person-choice" />
          <AppText accessibilityRole="header" fit bold size="display">
            Hello
          </AppText>
        </View>
      }
      footer={
        <View style={styles.choices}>
          <BigButton testID="person-create" label="Create my account" primary large onPress={onCreate} />
          <BigButton testID="person-sign-in" label="Sign in" large onPress={onSignIn} />
        </View>
      }>
      <AppText testID="set-up-for-you" bold>
        {SET_UP_FOR_YOU}
      </AppText>
      <AppText>
        <AppText bold>Create my account</AppText> with your caregiver’s email and a PIN from them.
      </AppText>
      <AppText>
        <AppText bold>Sign in</AppText> with a User ID and password from your caregiver.
      </AppText>
      <PolicyLink testID="person-policy" onPress={() => setPolicy(true)} />
      <PolicySheet visible={policy} onClose={() => setPolicy(false)} />
    </CaregiverScreen>
  );
}

/** Step 1 of Create my account: the caregiver's email. */
export function PairEmail({ email, onEmail, onBack, onContinue }: { email: string; onEmail: (email: string) => void; onBack: () => void; onContinue: () => void }) {
  const [tried, setTried] = useState(false);
  const problem = pairEmailProblem(email);

  function next() {
    setTried(true);
    if (!problem) onContinue();
  }

  return (
    <CaregiverScreen
      header={
        <View style={styles.header}>
          <Back testID="pair-email-back" onBack={onBack} />
          <Logo size="form" testID="logo-pair-email" foldWithKeyboard />
          <AppText accessibilityRole="header" bold size="title">
            Your caregiver’s email
          </AppText>
          <AppText muted>The email they use for Evermore.</AppText>
        </View>
      }
      footer={<BigButton testID="pair-email-continue" label="Continue" primary large onPress={next} />}>
      <Field
        testID="pair-email"
        label="Email"
        value={email}
        onChangeText={onEmail}
        note={tried ? problem : undefined}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        // Not saved by the phone's autofill: it is typed here once, to pair, and kept nowhere.
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        returnKeyType="next"
        onSubmitEditing={next}
      />
    </CaregiverScreen>
  );
}

/** Step 2 of Create my account: the PIN. On success, "You are all set". */
export function PairPin({ email, onBack, onPaired }: { email: string; onBack: () => void; onPaired: () => void }) {
  const [pin, setPin] = useState('');
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const problem = pinProblem(pin);
  const type = useType();

  async function submit() {
    setTried(true);
    if (problem || busy) return;
    setBusy(true);
    setMessage(undefined);
    const result = await pairPhone(email, pin);
    // Used once, then gone, whatever the answer.
    setPin('');
    setTried(false);
    setBusy(false);
    if (result.ok) onPaired();
    else setMessage(result.message);
  }

  return (
    <CaregiverScreen
      header={
        <View style={styles.header}>
          <Back testID="pair-pin-back" onBack={onBack} />
          <Logo size="form" testID="logo-pair-pin" foldWithKeyboard />
          <AppText accessibilityRole="header" bold size="title">
            The PIN from your caregiver
          </AppText>
          <AppText muted>It has 6 numbers.</AppText>
        </View>
      }
      footer={<BigButton testID="pair-pin-continue" label={busy ? 'One moment…' : 'Continue'} primary large disabled={busy} onPress={submit} />}>
      <Field
        testID="pair-pin"
        label="PIN"
        value={pin}
        onChangeText={(typed) => setPin(pinDigits(typed))}
        note={tried ? problem : undefined}
        // Large, spaced digits, easy to check against the caregiver's screen.
        inputStyle={{ fontSize: type.display.fontSize, fontFamily: Fonts.bold, letterSpacing: 8, textAlign: 'center', minHeight: type.display.fontSize * 1.9 }}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {message ? <Notice>{message}</Notice> : null}
    </CaregiverScreen>
  );
}

/** How long "You are all set" shows before their home opens. Nothing waits on the person: there is nothing to tap. */
const ALL_SET_MS = 1500;

/** A warm "You are all set", then straight to their home. */
export function AllSet() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(true);

  const opened = (result: Awaited<ReturnType<typeof signInPairedPhone>>) => {
    // Signed in: the app opens their home by itself, and stays signed in.
    if (result.ok) return;
    setBusy(false);
    setMessage(result.message);
  };

  useEffect(() => {
    const timer = setTimeout(() => void signInPairedPhone().then(opened), ALL_SET_MS);
    return () => clearTimeout(timer);
  }, []);

  function retry() {
    setBusy(true);
    setMessage(undefined);
    void signInPairedPhone().then(opened);
  }

  return (
    <View style={[styles.allSet, { paddingTop: insets.top + Space.xl, paddingBottom: insets.bottom + Space.l }]}>
      <ScrollView style={styles.middle} contentContainerStyle={styles.middleContent}>
        <Logo size="hero" testID="logo-all-set" />
        <AppText testID="all-set" accessibilityRole="header" accessibilityLiveRegion="polite" center bold size="display">
          You are all set
        </AppText>
        <AppText center muted>
          {busy ? 'Your home is opening.' : 'Almost there.'}
        </AppText>
        {message ? <Notice>{message}</Notice> : null}
      </ScrollView>
      {!busy ? <BigButton testID="all-set-retry" label="Try again" primary large onPress={retry} /> : null}
    </View>
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
  choices: {
    gap: Space.m,
  },
  allSet: {
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
});
