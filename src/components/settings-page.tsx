import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice, Row, TypeToConfirm } from '@/components/caregiver-ui';
import { AiSetting, ChangePasswordSetting, PersonLoginSetting, RevealCardsSetting, SessionLengthSetting, SignedInAs } from '@/components/caregiver-settings';
import { Note } from '@/components/dashboard';
import { ExportPanel, ExportSetting } from '@/components/export-data';
import { AiConsentSetting, ResearchSetting } from '@/components/consent';
import { PolicySheet, StoresSheet } from '@/components/privacy-policy';
import { Sheet } from '@/components/sheet';
import { TextSizeSetting } from '@/components/text-size';
import { LOCAL_ONLY, closeCaregiver, deleteFamilyHere, signOutCaregiver } from '@/data/app-data';
import type { Family } from '@/data/family-store';
import { confirm } from '@/lib/confirm';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { Space } from '@/theme/layout';

// The dashboard's Settings tab: Account, The person's phone (Their login), Practice, Privacy and data, About, and last,
// apart from everything else, Delete account. Nothing here is a developer tool: no control loads
// sample data, resets, clears or wipes anything (docs/SETTINGS-AUDIT.md, CLAUDE.md). Anything that
// deletes data names what goes and where, and needs "delete" typed first.

type SettingsPageProps = {
  /** The family, once it has loaded. Offline before it has, the practice rows wait for it. */
  family: Family | null;
  /** The family couldn't load; the dashboard says why above, with Try again. */
  failed: boolean;
};

export function SettingsPage({ family, failed }: SettingsPageProps) {
  const [privacy, setPrivacy] = useState(false);
  const [stores, setStores] = useState(false);
  return (
    <>
      {LOCAL_ONLY ? null : (
        <Section title="Account">
          <SignedInAs />
          <ChangePasswordSetting />
          <SignOutSetting />
        </Section>
      )}
      {LOCAL_ONLY ? null : (
        <Section title="The person’s phone">
          {family ? (
            <PersonLoginSetting person={family.person} />
          ) : (
            <View testID="person-login-waiting" style={styles.waiting}>
              <AppText size="caption" muted>
                {failed ? 'Their login appears once your family has loaded.' : 'Getting their login…'}
              </AppText>
            </View>
          )}
        </Section>
      )}
      <Section title="Practice">
        {family ? (
          <>
            <SessionLengthSetting family={family} />
            <RevealCardsSetting family={family} />
            {family.ai ? <AiSetting on={family.ai.on} /> : null}
          </>
        ) : (
          <View testID="settings-waiting" style={styles.waiting}>
            <AppText size="caption" muted>
              {failed ? 'Practice settings appear once your family has loaded.' : 'Getting your practice settings…'}
            </AppText>
          </View>
        )}
        <TextSizeSetting />
      </Section>
      {/* Privacy and data: the policy, a plain list of what is stored, the choices that can change at any time, and the export. Delete account sits last, apart. */}
      <Section title="Privacy and data">
        {LOCAL_ONLY ? (
          <AppText testID="kept-here" size="caption" muted style={styles.line}>
            {family?.ai?.on
              ? 'Everything is kept on this phone. Only a person’s approved facts are sent, without their name or photo, when you tap Generate.'
              : 'Everything is kept on this phone. Nothing is sent to a server.'}
          </AppText>
        ) : null}
        <Row testID="privacy-policy" label="Privacy policy" onPress={() => setPrivacy(true)} />
        <Row testID="what-we-store" label="What the app stores" onPress={() => setStores(true)} />
        {LOCAL_ONLY ? null : <ResearchSetting />}
        {family?.ai ? <AiConsentSetting consented={family.ai.consented} /> : null}
        <ExportSetting />
      </Section>
      <Section title="About">
        <Row testID="app-version" label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
        {LOCAL_ONLY ? <Row testID="close-caregiver" label="Back to the home screen" onPress={closeCaregiver} /> : null}
      </Section>
      {LOCAL_ONLY ? null : <DeleteAccountSetting />}
      <PolicySheet visible={privacy} onClose={() => setPrivacy(false)} />
      {/* "The privacy policy has the details" swaps one sheet for the other, so no sheet opens on a sheet. */}
      <StoresSheet
        visible={stores}
        onClose={() => setStores(false)}
        onPolicy={() => {
          setStores(false);
          setPrivacy(true);
        }}
      />
      <Note testID="footer" />
    </>
  );
}

/** A titled group of rows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const accent = useAccent();
  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" fit bold size="caption" color={accent}>
        {title}
      </AppText>
      <View>{children}</View>
    </View>
  );
}

/** Signs out on this phone only. The family stays in the account: nothing is deleted. */
function SignOutSetting() {
  async function signOut() {
    const sure = await confirm(
      'Sign out on this phone?',
      'Your people, stories and practice stay saved in your account. To sign in again you’ll need your email, your password and an internet connection.',
      'Sign out',
    );
    if (sure) await signOutCaregiver();
  }
  return <Row testID="sign-out" label="Sign out" onPress={signOut} />;
}

/** Deletes the whole family group, for good. Last on the tab, apart from everything else, and only once "delete" is typed. */
function DeleteAccountSetting() {
  const [open, setOpen] = useState(false);
  /** "Export my data first": the export's choices take the sheet's place, with Back, so no sheet opens on a sheet. */
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await deleteFamilyHere();
    setBusy(false);
    // On success the app signs out and returns to the sign-in screen.
    if (!result.ok) setNotice(result.message);
  }

  return (
    <View testID="danger-zone" style={styles.apart}>
      <Row
        testID="delete-account"
        label="Delete account"
        onPress={() => {
          setNotice(undefined);
          setExporting(false);
          setOpen(true);
        }}
      />
      <AppText size="caption" muted style={styles.line}>
        Deletes your family’s data for good. Archive a person instead to set them aside.
      </AppText>
      <Sheet visible={open} title={exporting ? 'Export my data' : 'Delete account'} onClose={() => setOpen(false)}>
        {exporting ? (
          <>
            <ExportPanel />
            <BigButton testID="delete-export-back" quiet label="Back" onPress={() => setExporting(false)} />
          </>
        ) : (
          <>
            <AppText>
              This deletes everything in your family group, from the server and from every phone: every person, photo, fact, story and practice
              record, Insights, your login, and every login and phone of the person practicing. It can’t be undone.
            </AppText>
            <BigButton testID="delete-export-first" quiet label="Export my data first" onPress={() => setExporting(true)} />
            <TypeToConfirm testID="delete-confirm" label="Delete everything" busy={busy} onConfirm={remove} />
            {notice ? <Notice>{notice}</Notice> : null}
            <BigButton testID="delete-keep" label="Keep my account" onPress={() => setOpen(false)} />
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Space.xs,
  },
  waiting: {
    gap: Space.s,
    paddingVertical: Space.s,
  },
  line: {
    paddingVertical: Space.s,
  },
  // Apart from everything else: space above, and a hairline.
  apart: {
    marginTop: Space.l,
    paddingTop: Space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
});
