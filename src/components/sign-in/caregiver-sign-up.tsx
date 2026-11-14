import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen, Field, Notice, QuietLink } from '@/components/caregiver-ui';
import { AgreementBoxes } from '@/components/consent';
import { PasswordField } from '@/components/password-field';
import { PolicySheet } from '@/components/privacy-policy';
import { confirmEmail, resendConfirmation, signIn, signUpCaregiver } from '@/data/account';
import { isClear, resendLabel, secondsLeft, signUpProblems } from '@/lib/auth-form';
import type { Agreement } from '@/lib/consent';
import { Space } from '@/theme/layout';
import { CompactType } from '@/theme/type';

// Screen 1's caregiver sign-up, and "Check your email" after it. Compact caregiver style. Notes under
// the fields are calm and neutral, shown once a field has been left or Create account tapped.
//
// Nothing is sent before both agreements are ticked (src/lib/consent.ts): the short summary, a link
// to the full policy, the privacy policy and the responsibility statement, both unticked; and the
// optional research choice, unticked. The database refuses an account without both, too.

type SignUpProps = {
  email: string;
  onEmail: (email: string) => void;
  onBack: () => void;
  onSignIn: () => void;
  /** Supabase sent a confirmation email: the password goes along in memory, to sign in once confirmed. */
  onCheckEmail: (password: string) => void;
};

export function CreateAccount({ email, onEmail, onBack, onSignIn, onCheckEmail }: SignUpProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Nothing is ever ticked for the caregiver.
  const [agreement, setAgreement] = useState<Agreement>({ policy: false, responsibility: false, research: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const problems = signUpProblems({ email, password, confirm, ...agreement });
  const show = (field: keyof typeof problems) => (tried || touched[field] ? problems[field] : undefined);
  const leave = (field: string) => () => setTouched((now) => ({ ...now, [field]: true }));

  async function submit() {
    setTried(true);
    if (!isClear(problems)) {
      setMessage(undefined);
      return;
    }
    setBusy(true);
    const result = await signUpCaregiver(email, password, agreement);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    // With Confirm email off the account is signed in, and the app moves on by itself.
    if (result.checkEmail) onCheckEmail(password);
  }

  return (
    <CompactType value={true}>
      <CaregiverScreen
        title="Create an account"
        logo="logo-create-account"
        backLabel="Back"
        onBack={onBack}
        footer={
          <View style={styles.footer}>
            <BigButton testID="create-submit" label={busy ? 'Creating your account…' : 'Create account'} primary disabled={busy} onPress={submit} />
            <BigButton testID="have-account" quiet label="I already have an account" onPress={onSignIn} />
          </View>
        }>
        <Field
          testID="signup-email"
          label="Email"
          value={email}
          onChangeText={onEmail}
          onBlur={leave('email')}
          note={show('email')}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
        />
        <PasswordField
          testID="signup-password"
          label="Password"
          value={password}
          onChangeText={setPassword}
          onBlur={leave('password')}
          // The strength hint says what a new password needs; a note only when nothing is typed.
          note={password ? undefined : show('password')}
          strength={{ email }}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordField
          testID="signup-confirm"
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          onBlur={leave('confirm')}
          note={show('confirm')}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        <AgreementBoxes
          value={agreement}
          onChange={setAgreement}
          notes={tried ? { policy: problems.policy, responsibility: problems.responsibility } : {}}
          onReadPolicy={() => setPrivacy(true)}
          withResearch
        />
        {message ? <Notice>{message}</Notice> : null}
        {tried && !isClear(problems) && !message ? <Notice>Please check the notes above.</Notice> : null}
        <PolicySheet visible={privacy} onClose={() => setPrivacy(false)} />
      </CaregiverScreen>
    </CompactType>
  );
}

type CheckEmailProps = {
  email: string;
  /** In memory only, so Continue can sign in once the address is confirmed. */
  password: string;
  /** When an email went out, if one just did, so "Send again" waits its minute. */
  sentAt?: number;
  onBack: () => void;
};

/**
 * Supabase sent a confirmation email. Its link confirms the address in a browser, on this phone or
 * another, and Continue (or coming back to the app) then signs in. A code from the email works too,
 * where the email has one.
 */
export function CheckEmail({ email, password, sentAt: firstSent, onBack }: CheckEmailProps) {
  const [sentAt, setSentAt] = useState(firstSent);
  // The clock, moved on by the countdown below and by each tap.
  const [now, setNow] = useState(firstSent ?? 0);
  const [code, setCode] = useState('');
  const [withCode, setWithCode] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const left = secondsLeft(sentAt, now);
  const trying = useRef(false);

  // "Send again" counts down on the caregiver's screen only.
  useEffect(() => {
    if (left <= 0) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [left]);

  // Back from the browser after tapping the link: sign in quietly. Nothing is said if it isn't confirmed yet.
  useEffect(() => {
    const listener = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || trying.current) return;
      trying.current = true;
      await signIn('caregiver', email, password);
      trying.current = false;
    });
    return () => listener.remove();
  }, [email, password]);

  async function proceed() {
    setBusy(true);
    trying.current = true;
    const result = withCode ? await confirmEmail(email, code) : await signIn('caregiver', email, password);
    trying.current = false;
    setBusy(false);
    if (result.ok) return;
    setMessage(result.reason === 'unconfirmed' ? 'Your email isn’t confirmed yet. Open the link in the email, then tap Continue.' : result.message);
  }

  async function resend() {
    const result = await resendConfirmation(email);
    const at = Date.now();
    setNow(at);
    if (result.ok) {
      setSentAt(at);
      setMessage('Sent again. It can take a few minutes to arrive.');
    } else {
      setMessage(result.message);
    }
  }

  return (
    <CompactType value={true}>
      <CaregiverScreen
        title="Check your email"
        backLabel="Back"
        onBack={onBack}
        footer={
          <View style={styles.footer}>
            <BigButton
              testID="check-email-continue"
              label={busy ? 'Please wait…' : withCode ? 'Confirm' : 'Continue'}
              primary
              disabled={busy || (withCode && code.trim().length < 6)}
              onPress={proceed}
            />
          </View>
        }>
        <AppText testID="check-email-to">
          We sent an email to {email.trim()}. Open the link in it to confirm your address, then come back here and tap Continue.
        </AppText>
        <AppText size="caption" muted>
          It can take a few minutes. If it isn’t there, look in the spam folder.
        </AppText>
        {withCode ? (
          <Field
            testID="confirm-code"
            label="Code from the email"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            count={false}
          />
        ) : null}
        {message ? <Notice>{message}</Notice> : null}
        <View style={styles.links}>
          <QuietLink testID="resend" label={resendLabel(left)} disabled={left > 0} onPress={resend} />
          {withCode ? null : <QuietLink testID="use-code" label="Enter a code instead" onPress={() => setWithCode(true)} />}
          <QuietLink testID="other-email" label="Use a different email" onPress={onBack} />
        </View>
      </CaregiverScreen>
    </CompactType>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: Space.xs,
  },
  links: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
});
