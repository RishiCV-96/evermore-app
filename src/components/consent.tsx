import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice, QuietLink, Row } from '@/components/caregiver-ui';
import { Picker } from '@/components/choices';
import { PolicyText } from '@/components/privacy-policy';
import { Checkbox, Sheet } from '@/components/sheet';
import { agreeToPolicy, loadConsent, setResearch, signOutCaregiver, useConsent, withdrawAiConsent } from '@/data/app-data';
import { confirm } from '@/lib/confirm';
import {
  AGREE_POLICY,
  AGREE_RESPONSIBILITY,
  NEED_BOTH,
  NOT_SAVED,
  POLICY_CHANGED,
  POLICY_CHANGED_TITLE,
  RESEARCH_CHOICE,
  RESEARCH_NOTE,
  SIGN_UP_SUMMARY,
  type Agreement,
} from '@/lib/consent';
import { Colors } from '@/theme/colors';
import { RADIUS, Space } from '@/theme/layout';

// The caregiver's agreements (src/lib/consent.ts): the boxes on Create an account, asking again when
// the policy changes, and the research and AI choices in Settings. Compact caregiver style. Nothing is
// ever ticked for the caregiver, and the person practicing never sees any of it.

/** The short summary of what is stored and who sees it, before anything is sent. */
export function ConsentSummary() {
  return (
    <View testID="consent-summary" style={styles.summary}>
      {SIGN_UP_SUMMARY.map((line) => (
        <AppText key={line} size="caption">
          {line}
        </AppText>
      ))}
    </View>
  );
}

type AgreementBoxesProps = {
  value: Agreement;
  onChange: (next: Agreement) => void;
  /** The calm notes under a required box, once Create account or Continue was tapped. */
  notes: { policy?: string; responsibility?: string };
  onReadPolicy: () => void;
  /** Sign-up offers the research choice too; asking again leaves it as it was. */
  withResearch?: boolean;
};

/** The summary, a link to the full policy, the two required boxes and, at sign-up, the optional research choice. All start unticked. */
export function AgreementBoxes({ value, onChange, notes, onReadPolicy, withResearch = false }: AgreementBoxesProps) {
  return (
    <View style={styles.group}>
      <ConsentSummary />
      <View style={styles.link}>
        <QuietLink testID="privacy-link" label="Read the privacy policy" onPress={onReadPolicy} />
      </View>
      <Checkbox testID="agree-policy" checked={value.policy} onChange={(policy) => onChange({ ...value, policy })}>
        {AGREE_POLICY}
      </Checkbox>
      {notes.policy ? <Notice>{notes.policy}</Notice> : null}
      <Checkbox testID="agree-responsibility" checked={value.responsibility} onChange={(responsibility) => onChange({ ...value, responsibility })}>
        {AGREE_RESPONSIBILITY}
      </Checkbox>
      {notes.responsibility ? <Notice>{notes.responsibility}</Notice> : null}
      {withResearch ? (
        <View style={styles.research}>
          <Checkbox testID="agree-research" checked={value.research} onChange={(research) => onChange({ ...value, research })}>
            {RESEARCH_CHOICE}
          </Checkbox>
          <AppText size="caption" muted>
            {RESEARCH_NOTE}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Asks a signed-in caregiver to read and agree again when the policy's version changed (or when they
 * signed up before versions). Over every caregiver screen, with no Close: Agree and continue, or Sign
 * out. Nothing is deleted or changed while it waits. Shown only on a fresh answer from the server.
 */
export function PolicyGate() {
  const { status } = useConsent();
  const [agreement, setAgreement] = useState<Agreement>({ policy: false, responsibility: false, research: false });
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Read when the caregiver's app opens, and again whenever it comes back to the front.
  useEffect(() => {
    void loadConsent();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadConsent();
    });
    return () => listener.remove();
  }, []);

  async function agree() {
    if (!agreement.policy || !agreement.responsibility) {
      setNotice(NEED_BOTH);
      return;
    }
    setBusy(true);
    const result = await agreeToPolicy();
    setBusy(false);
    setNotice(result.ok ? undefined : NOT_SAVED);
  }

  async function signOut() {
    const sure = await confirm(
      'Sign out on this phone?',
      'Your people, stories and practice stay saved in your account. You can agree the next time you sign in.',
      'Sign out',
    );
    if (sure) await signOutCaregiver();
  }

  return (
    <Sheet visible={status === 'needed'} title={reading ? 'Privacy policy' : POLICY_CHANGED_TITLE}>
      {reading ? (
        <>
          <PolicyText />
          <BigButton testID="gate-policy-back" label="Back" onPress={() => setReading(false)} />
        </>
      ) : (
        <View testID="policy-gate" style={styles.gate}>
          <AppText>{POLICY_CHANGED}</AppText>
          <AgreementBoxes
            value={agreement}
            onChange={setAgreement}
            notes={{}}
            onReadPolicy={() => setReading(true)}
          />
          {notice ? <Notice>{notice}</Notice> : null}
          <BigButton testID="gate-agree" primary label={busy ? 'Saving…' : 'Agree and continue'} disabled={busy} onPress={agree} />
          <BigButton testID="gate-sign-out" quiet label="Sign out" onPress={signOut} />
        </View>
      )}
    </Sheet>
  );
}

const RESEARCH_CHOICES = [
  { value: 'off', label: 'Off', hint: 'Nothing is used for research. The app works the same.' },
  { value: 'on', label: 'On', hint: 'De-identified information may be used for research, once the policy says how.' },
];

/** The research choice, changed at any time. Each change is kept as its own record. */
export function ResearchSetting() {
  const { status, research } = useConsent();
  const [notice, setNotice] = useState<string>();
  const known = status === 'current' || status === 'needed';

  async function choose(next: string) {
    if ((next === 'on') === research) return;
    const result = await setResearch(next === 'on');
    setNotice(result.ok ? undefined : NOT_SAVED);
  }

  if (!known) {
    return <Row testID="research-setting" label="Research use" icon="flask-outline" value={status === 'checking' ? 'Checking…' : 'Shown once online'} />;
  }
  return (
    <View>
      <Picker
        testID="research-setting"
        label="Research use"
        icon="flask-outline"
        subtitle="Optional. You can change this at any time."
        value={research ? 'on' : 'off'}
        options={RESEARCH_CHOICES}
        clearable={false}
        onChange={(next) => void choose(next)}
      />
      {notice ? <Notice>{notice}</Notice> : null}
    </View>
  );
}

/** AI questions' agreement (sign-in off, where AI is available): given on a person's sheet, taken back here. */
export function AiConsentSetting({ consented }: { consented: boolean }) {
  async function withdraw() {
    const sure = await confirm(
      'Take back your agreement?',
      'Nothing more is sent for AI questions until you agree again on a person’s sheet. Approved AI sentences leave practice until then.',
      'Take it back',
    );
    if (sure) withdrawAiConsent();
  }
  return consented ? (
    <Row testID="ai-consent" label="AI questions agreement" icon="checkmark-done-outline" value="Given" onPress={withdraw} />
  ) : (
    <Row testID="ai-consent" label="AI questions agreement" icon="checkmark-done-outline" value="Not given" />
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Space.s,
  },
  summary: {
    gap: Space.xs,
    padding: Space.m,
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
  link: {
    alignItems: 'flex-start',
    marginLeft: -Space.xs,
  },
  research: {
    gap: Space.xs,
    marginTop: Space.s,
  },
  gate: {
    gap: Space.l,
  },
  line: {
    paddingVertical: Space.xs,
  },
});
