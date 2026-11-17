import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { APP_NAME } from '@/config/brand';
import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen, Field, Notice, QuietLink } from '@/components/caregiver-ui';
import { PasswordField } from '@/components/password-field';
import { cancelPasswordReset, resetAwaitingPassword, resetPasswordWithCode, sendPasswordReset, signIn } from '@/data/account';
import { RESET_CODE_ACCEPTED, RESET_SENT, RESET_SENT_MORE, codeDigits, codeProblem, emailProblem, isClear, newPasswordProblems, resendLabel, secondsLeft, signInProblems } from '@/lib/auth-form';
import { Space } from '@/theme/layout';
import { CompactType } from '@/theme/type';

// Screen 1's caregiver sign-in, and a forgotten password: send the reset email, then the code from it
// and a new password. Compact caregiver style; notes in the neutral palette; nothing says whether an
// address has an account.

const EMAIL_FIELD = {
  autoCapitalize: 'none',
  autoCorrect: false,
  autoComplete: 'email',
  keyboardType: 'email-address',
  textContentType: 'username',
} as const;

type SignInProps = {
  email: string;
  onEmail: (email: string) => void;
  onBack: () => void;
  onForgot: () => void;
  onCreate: () => void;
  /** The address isn't confirmed yet: "Check your email", with the password in memory for Continue. */
  onUnconfirmed: (password: string) => void;
};

export function CaregiverSignIn({ email, onEmail, onBack, onForgot, onCreate, onUnconfirmed }: SignInProps) {
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const problems = signInProblems({ email, password });

  async function submit() {
    setTried(true);
    if (!isClear(problems)) return;
    setBusy(true);
    const result = await signIn('caregiver', email, password);
    setBusy(false);
    // Signed in: the app moves on by itself.
    if (result.ok) return;
    if (result.reason === 'unconfirmed') onUnconfirmed(password);
    else setMessage(result.message);
  }

  return (
    <CompactType value={true}>
      <CaregiverScreen
        title="Sign in"
        logo="logo-sign-in"
        backLabel="Back"
        onBack={onBack}
        footer={<BigButton testID="sign-in-submit" label={busy ? 'Signing in…' : 'Sign in'} primary disabled={busy} onPress={submit} />}>
        <Field testID="sign-in-email" label="Email" value={email} onChangeText={onEmail} note={tried ? problems.email : undefined} {...EMAIL_FIELD} />
        <PasswordField
          testID="sign-in-password"
          label="Password"
          value={password}
          onChangeText={setPassword}
          note={tried ? problems.password : undefined}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {message ? <Notice>{message}</Notice> : null}
        <View style={styles.links}>
          <QuietLink testID="forgot-password" label="Forgot password?" onPress={onForgot} />
          <QuietLink testID="sign-in-create" label="Create an account" onPress={onCreate} />
        </View>
        <AppText size="caption" muted>
          {APP_NAME} is a practice tool, not a medical device.
        </AppText>
      </CaregiverScreen>
    </CompactType>
  );
}

type ForgotProps = {
  email: string;
  onEmail: (email: string) => void;
  onBack: () => void;
  onSent: (sentAt: number) => void;
  /** The last code asked for in this visit, and for which address, so a second ask within the minute waits. */
  lastSent?: { to: string; at: number };
};

/** "Forgot password?": the address to send the code to. */
export function ForgotPassword({ email, onEmail, onBack, onSent, lastSent }: ForgotProps) {
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const problem = emailProblem(email);

  async function submit() {
    setTried(true);
    if (problem) return;
    // Asked for this address less than a minute ago: straight on to the code, with nothing sent again.
    if (lastSent && lastSent.to === email.trim().toLowerCase() && secondsLeft(lastSent.at, Date.now()) > 0) {
      onSent(lastSent.at);
      return;
    }
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (result.ok) onSent(Date.now());
    else setMessage(result.message);
  }

  return (
    <CompactType value={true}>
      <CaregiverScreen
        title="Reset password"
        backLabel="Back"
        onBack={onBack}
        footer={<BigButton testID="forgot-submit" label={busy ? 'Sending…' : 'Send code'} primary disabled={busy} onPress={submit} />}>
        <AppText>Type the email you signed up with. We’ll email a 6-digit code to type here with your new password.</AppText>
        <Field testID="forgot-email" label="Email" value={email} onChangeText={onEmail} note={tried ? problem : undefined} onSubmitEditing={submit} {...EMAIL_FIELD} />
        {message ? <Notice>{message}</Notice> : null}
      </CaregiverScreen>
    </CompactType>
  );
}

type ResetProps = { email: string; sentAt: number; onBack: () => void; onSignIn: () => void };

/**
 * The calm confirmation after "Send code", whether or not the address has an account, then the code
 * from the email and a new password. Saving signs in. If Supabase refuses the password after taking the
 * code, the code is used up, so only a new password is asked (src/data/account.ts holds the sign-in
 * until it is saved). Leaving this step before then forgets what the code gave. docs/FORGOT-PASSWORD.md.
 */
export function NewPassword({ email, sentAt: firstSent, onBack, onSignIn }: ResetProps) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(firstSent);
  const [now, setNow] = useState(firstSent);
  // The code was accepted, but the password wasn't: only a new password is asked now.
  const [accepted, setAccepted] = useState(false);
  const left = secondsLeft(sentAt, now);
  const codeNote = accepted ? undefined : codeProblem(code);
  const problems = { ...newPasswordProblems({ password, confirm }), ...(codeNote ? { code: codeNote } : {}) };

  // However this step is left before the password is saved (Back, Back to sign in, Android's back),
  // the session the code gave goes, so nobody is signed in by a reset that didn't finish.
  useEffect(() => () => void cancelPasswordReset(), []);

  useEffect(() => {
    if (left <= 0) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [left]);

  async function submit() {
    setTried(true);
    if (!isClear(problems)) return;
    setBusy(true);
    const result = await resetPasswordWithCode(email, code, password);
    setBusy(false);
    if (result.ok) return;
    const nowAccepted = resetAwaitingPassword();
    setAccepted(nowAccepted);
    setMessage(nowAccepted && result.reason !== 'offline' ? `${RESET_CODE_ACCEPTED} ${result.message}` : result.message);
  }

  async function resend() {
    const result = await sendPasswordReset(email);
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
        footer={<BigButton testID="reset-submit" label={busy ? 'Saving…' : 'Save new password'} primary disabled={busy} onPress={submit} />}>
        <AppText testID="reset-sent">
          <AppText bold>{RESET_SENT}</AppText> {RESET_SENT_MORE}
        </AppText>
        {accepted ? null : (
          <Field
            testID="reset-code"
            label="6-digit code from the email"
            value={code}
            onChangeText={(typed) => setCode(codeDigits(typed))}
            note={tried ? problems.code : undefined}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            count={false}
          />
        )}
        <PasswordField
          testID="reset-password"
          label="New password"
          value={password}
          onChangeText={setPassword}
          note={tried && !password ? problems.password : undefined}
          strength={{ email }}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordField
          testID="reset-confirm"
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          note={tried ? problems.confirm : undefined}
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {message ? <Notice>{message}</Notice> : null}
        <View style={styles.links}>
          {accepted ? null : <QuietLink testID="reset-resend" label={resendLabel(left)} disabled={left > 0} onPress={resend} />}
          <QuietLink testID="reset-back-to-sign-in" label="Back to sign in" onPress={onSignIn} />
        </View>
      </CaregiverScreen>
    </CompactType>
  );
}

const styles = StyleSheet.create({
  links: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
});
