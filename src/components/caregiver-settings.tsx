import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Field, Notice, Row } from '@/components/caregiver-ui';
import { Picker } from '@/components/choices';
import { PasswordField } from '@/components/password-field';
import { profileOf } from '@/components/person-photo';
import { Sheet } from '@/components/sheet';
import { REVEAL_CHOICES, SESSION_LENGTH_CHOICES, type RevealSetting, type SessionLength } from '@/config/schedule';
import { MIN_PASSWORD, USERNAME_PATTERN, changePassword, createPersonLogin, resetPersonLogin, useAccount } from '@/data/account';
import { LOCAL_ONLY, moveToNewWording, setAiOn, setRevealCards, setSessionLength } from '@/data/app-data';
import { refreshFamily, type Family, type PersonLogin } from '@/data/family-store';
import { RESET_LOGIN_TITLE, RESET_LOGIN_WORDS, isClear, newPasswordProblems } from '@/lib/auth-form';
import { confirm } from '@/lib/confirm';
import { cardsOf, dailyTarget, minutesLabel, practiceFrom } from '@/lib/session';
import { WORDING_UNAVAILABLE, olderWording } from '@/lib/wording';
import { COMPACT_TAP } from '@/theme/layout';

// Rows of the dashboard's Settings tab (laid out in src/components/settings-page.tsx). Each action
// opens a sheet rather than a new screen, to stay within the 8-screen budget.

const NOT_SAVED = LOCAL_ONLY ? 'That change couldn’t be saved. Please try again.' : 'That change couldn’t be saved. Please check the internet connection.';

/** How long a day of practice is, with what each choice means for this deck, in plain words. */
/**
 * "Refresh wording" for the whole family (Settings → Practice): every story still in an older wording is
 * written again with the current templates, after a confirmation that says what happens. Approved ones go
 * back to story approval, so no approved card changes without the caregiver reading it first. Shown only
 * while some story uses an older wording; each person's sheet has the same action for them alone.
 */
export function RefreshWordingSetting({ family }: { family: Family }) {
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const archived = new Set(family.people.filter((person) => person.archivedAt).map((person) => person.id));
  const older = olderWording(family.cards, archived);
  if (older.length === 0 && !notice) return null;

  async function refresh() {
    const approved = older.filter((card) => card.status === 'approved').length;
    const sure = await confirm(
      'Refresh wording?',
      `${older.length} ${older.length === 1 ? 'story is' : 'stories are'} written again with the current wording, so they read more naturally. ${approved ? `${approved} approved ${approved === 1 ? 'story goes' : 'stories go'} back to story approval so you can read each one first. Until you approve them, they aren’t in practice.` : 'You can read each one in story approval.'}`,
      'Refresh wording',
    );
    if (!sure) return;
    setBusy(true);
    let moved = 0;
    try {
      for (const personId of new Set(older.map((card) => card.personId))) moved += await moveToNewWording(personId);
      setNotice(`${moved} ${moved === 1 ? 'story uses' : 'stories use'} the new wording. Open each person on People, then Stories, to read and approve them.`);
    } catch (error) {
      setNotice(error instanceof Error && error.message === WORDING_UNAVAILABLE ? WORDING_UNAVAILABLE : NOT_SAVED);
    }
    setBusy(false);
  }

  return (
    <>
      {older.length ? (
        <Row
          testID="refresh-wording"
          label="Refresh wording"
          icon="refresh-outline"
          subtitle={busy ? 'Refreshing…' : `${older.length} ${older.length === 1 ? 'story uses' : 'stories use'} the old wording.`}
          onPress={busy ? () => undefined : refresh}
        />
      ) : null}
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

export function SessionLengthSetting({ family }: { family: Family }) {
  const [notice, setNotice] = useState<string>();
  const deck = practiceFrom(family.people, family.cards, profileOf);
  const cards = cardsOf(deck.people, deck.cards);
  const options = SESSION_LENGTH_CHOICES.map(({ value, label }) => {
    const target = dailyTarget(cards, value);
    const each = Math.round(target / Math.max(deck.people.length, 1));
    return { value, label, hint: target ? `${minutesLabel(target)}, about ${each} per person` : undefined };
  });

  async function change(next: string) {
    try {
      await setSessionLength(next as SessionLength);
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  return (
    <>
      <Picker testID="session-length" label="Session length" icon="time-outline" subtitle="Cards in a day of practice." value={family.sessionLength} options={options} clearable={false} onChange={change} />
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

/** How often a card's photo starts behind the "?". */
export function RevealCardsSetting({ family }: { family: Family }) {
  const [notice, setNotice] = useState<string>();

  async function change(next: string) {
    try {
      await setRevealCards(next as RevealSetting);
      setNotice(undefined);
    } catch {
      setNotice(NOT_SAVED);
    }
  }

  return (
    <>
      <Picker testID="reveal-cards" label="Reveal cards" icon="eye-outline" subtitle="Some photos start hidden behind a “?”." value={family.revealCards} options={REVEAL_CHOICES} clearable={false} onChange={change} />
      {notice ? <Notice>{notice}</Notice> : null}
    </>
  );
}

const AI_CHOICES = [
  { value: 'on', label: 'On', hint: 'You can generate new questions, and approved ones join practice.' },
  { value: 'off', label: 'Off', hint: 'Nothing is sent, and AI questions stay out of practice.' },
];

/** AI off at any time. Sentences already approved are kept, and come back if it is turned on again. */
export function AiSetting({ on }: { on: boolean }) {
  return <Picker testID="ai-setting" label="AI questions" icon="chatbubble-ellipses-outline" subtitle="New sentences from approved facts." value={on ? 'on' : 'off'} options={AI_CHOICES} clearable={false} onChange={(next) => setAiOn(next === 'on')} />;
}

/** Make the person's login, or give it a new password. */
export function PersonLoginSetting({ person }: { person: PersonLogin | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState(person?.username ?? '');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);

  function show() {
    setUsername(person?.username ?? '');
    setPassword('');
    setNotice(undefined);
    setDone(undefined);
    setOpen(true);
  }

  async function save() {
    const id = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(id)) {
      setNotice('Choose a User ID of 3 to 30 lowercase letters, numbers, dots, dashes or underscores.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setNotice(`Choose a password with at least ${MIN_PASSWORD} characters.`);
      return;
    }
    // A new password signs their phone out, so ask first, naming what changes and what doesn't.
    if (person && !(await confirm(RESET_LOGIN_TITLE, RESET_LOGIN_WORDS, 'Save new password'))) return;
    setBusy(true);
    const result = person ? await resetPersonLogin(id, password) : await createPersonLogin(id, password, name);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setNotice(undefined);
    setDone(
      person
        ? `Saved. Their phone will ask them to sign in again, within the hour. Then choose “I am practicing” and sign in with User ID “${id}” and the new password.`
        : `Saved. On their phone, choose “I am practicing” and sign in with User ID “${id}” and the password you chose. The phone stays signed in after that.`,
    );
    refreshFamily();
  }

  return (
    <>
      <Row testID="person-login" label="Their login" icon="phone-portrait-outline" subtitle="What their phone signs in with." value={person ? person.username : 'Not made yet'} onPress={show} />
      <Sheet visible={open} title={person ? 'Their login' : 'Make their login'} onClose={() => setOpen(false)}>
        {done ? (
          <>
            <Notice>{done}</Notice>
            <BigButton label="Done" primary onPress={() => setOpen(false)} />
          </>
        ) : (
          <>
            {person ? (
              <AppText>Choose a new password. You can change the User ID too. Their phone will ask them to sign in again.</AppText>
            ) : (
              <>
                <AppText>On their phone, they choose “I am practicing” and sign in once with this User ID and password. The phone stays signed in.</AppText>
                <Field
                  label="Their first name"
                  help="Shown on their home screen."
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="off"
                />
              </>
            )}
            <Field
              testID="person-username"
              label="User ID"
              help="Lowercase letters and numbers, such as rose.m or sam42."
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <PasswordField
              testID="person-password"
              label="Password"
              help={`At least ${MIN_PASSWORD} characters. Tap Show to see it, so you can write it down for them.`}
              value={password}
              onChangeText={setPassword}
              autoComplete="off"
            />
            {notice ? <Notice>{notice}</Notice> : null}
            <BigButton testID="person-login-save" label={busy ? 'Saving…' : 'Save'} primary disabled={busy} onPress={save} />
          </>
        )}
      </Sheet>
    </>
  );
}

/** Who is signed in on this phone: the caregiver's email, on the caregiver's screens only. */
export function SignedInAs() {
  const account = useAccount();
  if (account.status !== 'signed-in' || !account.email) return null;
  return (
    <View testID="signed-in-as" style={styles.signedIn}>
      <AppText size="caption" muted>
        Signed in as
      </AppText>
      <AppText selectable>{account.email}</AppText>
    </View>
  );
}

/** A new password for the caregiver's own account, after the current one. */
export function ChangePasswordSetting() {
  const account = useAccount();
  const email = account.status === 'signed-in' ? (account.email ?? undefined) : undefined;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState('');
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const problems = { ...newPasswordProblems({ password, confirm: confirmed }), ...(current ? {} : { current: 'Please type your current password.' }) };

  function show() {
    setCurrent('');
    setPassword('');
    setConfirmed('');
    setTried(false);
    setSaved(false);
    setNotice(undefined);
    setOpen(true);
  }

  async function save() {
    setTried(true);
    if (!isClear(problems)) return;
    setBusy(true);
    const result = await changePassword(current, password);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      setNotice(undefined);
    } else {
      setNotice(result.message);
    }
  }

  return (
    <>
      <Row testID="change-password" label="Change password" icon="key-outline" onPress={show} />
      <Sheet visible={open} title="Change password" onClose={() => setOpen(false)}>
        {saved ? (
          <>
            <Notice>Your password is changed. Use the new one next time you sign in.</Notice>
            <BigButton testID="change-password-done" label="Done" primary onPress={() => setOpen(false)} />
          </>
        ) : (
          <>
            <PasswordField
              testID="current-password"
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              note={tried ? problems.current : undefined}
              autoComplete="current-password"
              textContentType="password"
            />
            <PasswordField
              testID="new-password"
              label="New password"
              value={password}
              onChangeText={setPassword}
              note={tried && !password ? problems.password : undefined}
              strength={{ email }}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <PasswordField
              testID="confirm-new-password"
              label="Confirm new password"
              value={confirmed}
              onChangeText={setConfirmed}
              note={tried ? problems.confirm : undefined}
              autoComplete="new-password"
              textContentType="newPassword"
              onSubmitEditing={save}
            />
            {notice ? <Notice>{notice}</Notice> : null}
            <BigButton testID="change-password-save" label={busy ? 'Saving…' : 'Save new password'} primary disabled={busy} onPress={save} />
          </>
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  // A row's place in the list, with its hairline, but two lines: the email may be long, and wraps.
  // In the status card at the top of Settings: no hairline of its own.
  signedIn: {
    flex: 1,
    gap: 2,
    minHeight: COMPACT_TAP,
    justifyContent: 'center',
  },
});
