import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Card, Enter, FormGroup, Notice, Row, TypeToConfirm } from '@/components/caregiver-ui';
import { FamilyBoardSetting } from '@/components/family-board-editor';
import { AiSetting, ChangePasswordSetting, PersonLoginSetting, RevealCardsSetting, SessionLengthSetting, SignedInAs } from '@/components/caregiver-settings';
import { Note } from '@/components/dashboard';
import { ExportPanel, ExportSetting } from '@/components/export-data';
import { AiConsentSetting, ResearchSetting } from '@/components/consent';
import { PolicySheet, StoresSheet } from '@/components/privacy-policy';
import { Sheet } from '@/components/sheet';
import { TandemLogo } from '@/components/tandem-logo';
import { TextSizeSetting } from '@/components/text-size';
import { APP_NAME } from '@/config/brand';
import { LOCAL_ONLY, closeCaregiver, deleteFamilyHere, signOutCaregiver } from '@/data/app-data';
import type { Family } from '@/data/family-store';
import { confirm } from '@/lib/confirm';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { ROW_ICON, Space } from '@/theme/layout';

// The dashboard's Settings tab (since 2026-11-17, docs/UI-POLISH-PLAN.md): a short status card (who is
// signed in, whether the person's phone is set up), then the sections by how often they are used:
// Practice, The person's phone (Their login), Privacy and data, Account, and About in local-only mode;
// then, last and apart from everything else, Delete account; then the footer. Nothing here is a
// developer tool: no control loads sample data, resets, clears or wipes anything (docs/SETTINGS-AUDIT.md,
// CLAUDE.md). Anything that deletes data names what goes and where, and needs "delete" typed first.

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
        <Enter index={0}>
          <StatusCard family={family} failed={failed} />
        </Enter>
      )}
      <Enter index={1}>
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
      </Enter>
      {/* The person's phone: Their login (sign-in on), and the Family board, whose notes show on their home. */}
      <Enter index={2}>
        <Section title="The person’s phone">
          {LOCAL_ONLY ? null : family ? (
            <PersonLoginSetting person={family.person} />
          ) : (
            <View testID="person-login-waiting" style={styles.waiting}>
              <AppText size="caption" muted>
                {failed ? 'Their login appears once your family has loaded.' : 'Getting their login…'}
              </AppText>
            </View>
          )}
          <FamilyBoardSetting />
        </Section>
      </Enter>
      {/* Privacy and data: the policy, a plain list of what is stored, the choices that can change at any time, and the export. Delete account sits last, apart. */}
      <Enter index={3}>
        <Section title="Privacy and data">
          {LOCAL_ONLY ? (
            <AppText testID="kept-here" size="caption" muted style={styles.line}>
              {family?.ai?.on
                ? 'Everything is kept on this phone. Only a person’s approved facts are sent, without their name or photo, when you tap Generate.'
                : 'Everything is kept on this phone. Nothing is sent to a server.'}
            </AppText>
          ) : null}
          <Row testID="privacy-policy" label="Privacy policy" icon="document-text-outline" onPress={() => setPrivacy(true)} />
          <Row testID="what-we-store" label="What the app stores" icon="list-outline" onPress={() => setStores(true)} />
          {LOCAL_ONLY ? null : <ResearchSetting />}
          {family?.ai ? <AiConsentSetting consented={family.ai.consented} /> : null}
          <ExportSetting />
        </Section>
      </Enter>
      {LOCAL_ONLY ? null : (
        <Enter index={4}>
          <Section title="Account">
            <ChangePasswordSetting />
            <SignOutSetting />
          </Section>
        </Enter>
      )}
      {LOCAL_ONLY ? (
        <Section title="About">
          <Row testID="close-caregiver" label="Back to the home screen" icon="home-outline" onPress={closeCaregiver} />
        </Section>
      ) : null}
      {LOCAL_ONLY ? null : <DeleteAccountSetting />}
      <View testID="settings-footer" style={styles.footer}>
        <TandemLogo size="about" testID="logo-about" />
        <AppText testID="app-version" size="caption" muted center tabular>
          {APP_NAME} · Version {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
      </View>
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

/**
 * At a glance, in place of a hero: who is signed in, and whether the person's phone has its login.
 * Each with an icon and words, so the state never rests on color.
 */
function StatusCard({ family, failed }: { family: Family | null; failed: boolean }) {
  const accent = useAccent();
  const phone = family ? (family.person ? 'Set up' : 'Not set up yet') : failed ? 'Shown once your family has loaded' : 'Checking…';
  return (
    <Card testID="settings-status">
      <View style={styles.statusRow}>
        <Ionicons name="person-circle-outline" size={ROW_ICON + 4} color={accent} aria-hidden />
        <SignedInAs />
      </View>
      <View style={styles.statusDivider} />
      <View testID="phone-status" accessible accessibilityLabel={`The person’s phone: ${phone}`} style={styles.statusRow}>
        <Ionicons name={family?.person ? 'checkmark-circle-outline' : 'phone-portrait-outline'} size={ROW_ICON + 4} color={accent} aria-hidden />
        <View style={styles.statusText}>
          <AppText size="caption" muted>
            The person’s phone
          </AppText>
          <AppText>{phone}</AppText>
        </View>
      </View>
    </Card>
  );
}

/** A titled group of rows: a section header, then the rows on one inset card. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <FormGroup heading={title}>{children}</FormGroup>;
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
  return <Row testID="sign-out" label="Sign out" icon="log-out-outline" onPress={signOut} />;
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
      <FormGroup footnote="Deletes your family’s data for good. Archive a person instead to set them aside.">
        <Row
          testID="delete-account"
          label="Delete account"
          icon="trash-outline"
          inkIcon
          onPress={() => {
            setNotice(undefined);
            setExporting(false);
            setOpen(true);
          }}
        />
      </FormGroup>
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
  waiting: {
    gap: Space.s,
    paddingVertical: Space.m,
    paddingHorizontal: Space.l,
  },
  line: {
    paddingVertical: Space.m,
    paddingHorizontal: Space.l,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  statusText: {
    flex: 1,
    gap: 2,
  },
  statusDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: ROW_ICON + 4 + Space.m,
    backgroundColor: Colors.divider,
  },
  // Apart from everything else: 48pt above, the page's 16 included. Its own card; never red.
  apart: {
    marginTop: Space.xxl,
  },
  footer: {
    alignItems: 'center',
    gap: Space.xs,
    paddingTop: Space.l,
  },
});
