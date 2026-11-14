import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Notice, QuietLink, Row } from '@/components/caregiver-ui';
import { Sheet } from '@/components/sheet';
import { createPin, linkedPhones, removePhone, usePairing, type LinkedPhone } from '@/data/pairing';
import { confirm } from '@/lib/confirm';
import { expiresIn, expiresInWords, lastSeenWords, pairedWords, phonesCount, pinForDisplay, pinForScreenReader } from '@/lib/pairing';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space } from '@/theme/layout';

// Settings, "Pair the person's phone" (caregiver only, sign-in on): a 6-digit PIN for the person's
// phone, its countdown, a new one when needed, and the phones already linked, each with Remove phone.
// A sheet, not a screen. The PIN is shown here and nowhere else, and is kept only in memory.

/** While a PIN is showing, the list is checked this often, so a phone appears as soon as it pairs. */
const WATCH_MS = 4000;

type Listed = Awaited<ReturnType<typeof linkedPhones>>;

// The clock for the countdown: the current second, ticking only while something is listening.
const second = () => Math.floor(Date.now() / 1000);
const tickEverySecond = (listener: () => void) => {
  const timer = setInterval(listener, 1000);
  return () => clearInterval(timer);
};
const stayStill = () => () => {};

export function PairPhoneSetting() {
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<LinkedPhone[] | null>(null);
  const [listNotice, setListNotice] = useState<string>();

  const load = useCallback(async () => {
    const result = await linkedPhones();
    if ('phones' in result) {
      setPhones(result.phones);
      setListNotice(undefined);
    } else {
      setListNotice(result.message);
    }
    return result;
  }, []);

  // The row's count, once the Settings tab opens.
  useEffect(() => {
    let live = true;
    linkedPhones().then((result) => {
      if (live && 'phones' in result) setPhones(result.phones);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <Row
        testID="pair-phone"
        label="Pair the person’s phone"
        value={phones ? phonesCount(phones.length) : undefined}
        onPress={() => {
          setOpen(true);
          void load();
        }}
      />
      <Sheet visible={open} title="Pair the person’s phone" onClose={() => setOpen(false)}>
        <PinPanel open={open} phones={phones} reload={load} />
        <SendByEmail />
        <LinkedPhones phones={phones} notice={listNotice} reload={load} />
      </Sheet>
    </>
  );
}

/** The PIN, its countdown and New PIN; or Create a PIN. */
function PinPanel({ open, phones, reload }: { open: boolean; phones: LinkedPhone[] | null; reload: () => Promise<Listed> }) {
  const { pin, linked } = usePairing();
  const now = useSyncExternalStore(open && pin ? tickEverySecond : stayStill, second, second) * 1000;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const left = pin ? expiresIn(pin.expiresAt, now) : null;
  const active = Boolean(pin && left);

  // While it waits, look for the phone it is for: once a phone that wasn't linked before appears, the
  // PIN is used (src/data/pairing.ts) and the phone's name shows here.
  useEffect(() => {
    if (!open || !active) return;
    const timer = setInterval(() => void reload(), WATCH_MS);
    return () => clearInterval(timer);
  }, [open, active, reload]);

  async function make() {
    setBusy(true);
    const listed = await reload();
    const result = await createPin('phones' in listed ? listed.phones.map((phone) => phone.id) : (phones ?? []).map((phone) => phone.id));
    setBusy(false);
    setNotice(result.ok ? undefined : result.message);
  }

  if (!active) {
    return (
      <View style={styles.block}>
        {linked ? <Notice>{`${linked} is linked. You can close this.`}</Notice> : null}
        <AppText>On their phone, they choose “I am practicing”, then “Create my account”, and type your email and a PIN from here.</AppText>
        {pin && !left ? <Notice>That PIN has expired. Create a new one when they’re ready.</Notice> : null}
        {notice ? <Notice>{notice}</Notice> : null}
        <BigButton testID="create-pin" label={busy ? 'Creating…' : 'Create a PIN'} primary disabled={busy} onPress={make} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View testID="pin-card" style={styles.pinCard}>
        <AppText size="caption" muted center>
          Their PIN
        </AppText>
        <AppText
          testID="pin"
          bold
          center
          size="display"
          selectable
          accessibilityLabel={`PIN ${pinForScreenReader(pin!.pin)}`}
          style={styles.pin}>
          {pinForDisplay(pin!.pin)}
        </AppText>
        <AppText testID="pin-expires" size="caption" muted center accessibilityLabel={expiresInWords(pin!.expiresAt, now)} style={styles.tabular}>
          {left}
        </AppText>
      </View>
      <View style={styles.need}>
        <AppText size="caption" bold>
          What they need
        </AppText>
        <AppText>Your email and this PIN.</AppText>
        <AppText size="caption" muted>
          A PIN works once. Making a new one stops this one working.
        </AppText>
      </View>
      {notice ? <Notice>{notice}</Notice> : null}
      <BigButton testID="new-pin" label={busy ? 'Creating…' : 'New PIN'} disabled={busy} onPress={make} />
    </View>
  );
}

/** Clearly not available yet: sending the PIN needs email that reaches everyone (custom SMTP). */
function SendByEmail() {
  return (
    <View testID="send-pin-email" accessibilityRole="button" aria-disabled accessibilityState={{ disabled: true }} accessibilityHint="Not available yet" style={styles.disabledRow}>
      <AppText fit muted>
        Send the PIN by email
      </AppText>
      <AppText size="caption" muted>
        Not available yet. It needs Evermore’s email to be set up first.
      </AppText>
    </View>
  );
}

/** The phones linked to the family, each with Remove phone. */
function LinkedPhones({ phones, notice, reload }: { phones: LinkedPhone[] | null; notice?: string; reload: () => Promise<Listed> }) {
  const [message, setMessage] = useState<string>();
  const [removing, setRemoving] = useState<string>();

  async function remove(phone: LinkedPhone) {
    const sure = await confirm(`Remove ${phone.name}?`, 'It signs out as soon as it is online, and within the hour at the latest. To use it again, create a new PIN. Practice it already sent stays.', 'Remove phone');
    if (!sure) return;
    setRemoving(phone.id);
    const result = await removePhone(phone.id);
    setRemoving(undefined);
    setMessage(result.ok ? `${phone.name} was removed.` : result.message);
    await reload();
  }

  return (
    <View testID="linked-phones" style={styles.list}>
      <AppText accessibilityRole="header" bold>
        Linked phones
      </AppText>
      {notice ? <Notice>{notice}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}
      {phones === null && !notice ? (
        <AppText size="caption" muted>
          Looking for linked phones…
        </AppText>
      ) : null}
      {phones?.length === 0 ? (
        <AppText testID="no-phones" size="caption" muted>
          No phones are linked yet.
        </AppText>
      ) : null}
      {phones?.map((phone) => (
        <View key={phone.id} testID="linked-phone" style={styles.phone}>
          <View style={styles.phoneText}>
            <AppText>{phone.name}</AppText>
            <AppText size="caption" muted>
              {pairedWords(phone.pairedAt)}
            </AppText>
            <AppText size="caption" muted>
              {lastSeenWords(phone.lastSeenAt)}
            </AppText>
          </View>
          <QuietLink
            testID="remove-phone"
            label={removing === phone.id ? 'Removing…' : 'Remove phone'}
            accessibilityLabel={`Remove ${phone.name}`}
            disabled={removing === phone.id}
            onPress={() => remove(phone)}
          />
        </View>
      ))}
      <AppText size="caption" muted>
        A phone that signed in with a User ID and password isn’t listed here. Their login, in Settings, signs it out.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Space.m,
  },
  pinCard: {
    gap: Space.xs,
    paddingVertical: Space.l,
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
  pin: {
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  need: {
    gap: Space.xs,
  },
  disabledRow: {
    gap: 2,
    minHeight: COMPACT_TAP,
    justifyContent: 'center',
    paddingVertical: Space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  list: {
    gap: Space.s,
  },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  phoneText: {
    flex: 1,
    gap: 2,
  },
});
