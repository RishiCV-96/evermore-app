import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { signOut } from '@/data/account';
import { LOCAL_ONLY, openCaregiver } from '@/data/app-data';
import { confirm } from '@/lib/confirm';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space, TAP, touchSlop } from '@/theme/layout';

// Small and quiet, at the top of the person's home screen. It opens only when held, so a tap
// by the person does nothing but show how to use it. With sign-in on, holding it (and confirming)
// signs the person out on this phone so the caregiver can sign in: the only way the person's phone
// is ever signed out from here. With sign-in off, it opens the dashboard.
export function CaregiverButton() {
  const [tapped, setTapped] = useState(false);

  async function open() {
    setTapped(false);
    if (LOCAL_ONLY) {
      openCaregiver();
      return;
    }
    const sure = await confirm(
      'Switch to the caregiver?',
      'This signs this phone out of practice. To practice on it again, choose “I am practicing” and sign in with the User ID and password from Settings, Their login.',
      'Sign out',
    );
    if (sure) await signOut();
  }

  return (
    <Pressable
      testID="caregiver-button"
      accessibilityRole="button"
      accessibilityLabel="Caregiver"
      accessibilityHint={LOCAL_ONLY ? 'Hold to open the caregiver dashboard.' : 'Hold to sign out so the caregiver can sign in.'}
      delayLongPress={1000}
      onPress={() => setTapped(true)}
      onLongPress={open}
      hitSlop={touchSlop()}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="lock-closed-outline" size={ICON} color={Colors.textMuted} aria-hidden />
      <AppText fit bold size="caption" muted>
        {tapped ? 'Hold to open' : 'Caregiver'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: TAP,
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
});
