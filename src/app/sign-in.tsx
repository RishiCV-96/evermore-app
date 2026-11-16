import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { CaregiverSignIn, ForgotPassword, NewPassword } from '@/components/sign-in/caregiver-sign-in';
import { CheckEmail, CreateAccount } from '@/components/sign-in/caregiver-sign-up';
import { PersonSignIn } from '@/components/sign-in/person-sign-in';
import { CaregiverChoice, Welcome } from '@/components/sign-in/welcome';

// Screen 1 (only with sign-in on), in steps rather than screens: the welcome with its two ways in;
// for the person (large type, one action), "Hello" with the User ID and password the caregiver made
// (Their login); for the caregiver, Sign in or Create an account and their forms (check your email,
// reset a password with the code from the email). Each step has a plain way back, and
// Android's back button goes back a step. Once someone signs in, the root layout moves them to their
// own screens, and the phone stays signed in.
type Step = 'welcome' | 'person' | 'caregiver' | 'sign-in' | 'create' | 'check-email' | 'forgot' | 'reset';

export default function SignIn() {
  const [step, setStep] = useState<Step>('welcome');
  // The email follows the caregiver from form to form.
  const [email, setEmail] = useState('');
  // Only while "Check your email" shows, in memory, so Continue can sign in once confirmed.
  const [pending, setPending] = useState<{ password: string; sentAt?: number; from: Step }>();
  const [resetSentAt, setResetSentAt] = useState(0);

  /** Where Back goes from each step. */
  const back: Record<Step, Step | null> = {
    welcome: null,
    person: 'welcome',
    caregiver: 'welcome',
    'sign-in': 'caregiver',
    create: 'caregiver',
    'check-email': pending?.from ?? 'caregiver',
    forgot: 'sign-in',
    reset: 'forgot',
  };

  function go(next: Step) {
    if (next !== 'check-email') setPending(undefined);
    setStep(next);
  }

  const previous = back[step];
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!previous) return false;
      if (previous !== 'check-email') setPending(undefined);
      setStep(previous);
      return true;
    });
    return () => listener.remove();
  }, [previous]);

  const checkEmail = (from: Step, sentAt?: number) => (password: string) => {
    setPending({ password, sentAt, from });
    setStep('check-email');
  };

  return (
    <>
      {step === 'welcome' ? <Welcome onPerson={() => go('person')} onCaregiver={() => go('caregiver')} /> : null}
      {step === 'person' ? <PersonSignIn onBack={() => go('welcome')} /> : null}
      {step === 'caregiver' ? <CaregiverChoice onBack={() => go('welcome')} onSignIn={() => go('sign-in')} onCreate={() => go('create')} /> : null}
      {step === 'sign-in' ? (
        <CaregiverSignIn
          email={email}
          onEmail={setEmail}
          onBack={() => go('caregiver')}
          onForgot={() => go('forgot')}
          onCreate={() => go('create')}
          onUnconfirmed={checkEmail('sign-in')}
        />
      ) : null}
      {step === 'create' ? (
        <CreateAccount
          email={email}
          onEmail={setEmail}
          onBack={() => go('caregiver')}
          onSignIn={() => go('sign-in')}
          onCheckEmail={(password) => checkEmail('create', Date.now())(password)}
        />
      ) : null}
      {step === 'check-email' && pending ? <CheckEmail email={email} password={pending.password} sentAt={pending.sentAt} onBack={() => go(pending.from)} /> : null}
      {step === 'forgot' ? (
        <ForgotPassword
          email={email}
          onEmail={setEmail}
          onBack={() => go('sign-in')}
          onSent={(at) => {
            setResetSentAt(at);
            go('reset');
          }}
        />
      ) : null}
      {step === 'reset' ? <NewPassword email={email} sentAt={resetSentAt} onBack={() => go('forgot')} onSignIn={() => go('sign-in')} /> : null}
    </>
  );
}
