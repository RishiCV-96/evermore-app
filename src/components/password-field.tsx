import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Field, type FieldProps } from '@/components/caregiver-ui';
import { passwordStrength } from '@/lib/auth-form';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, RADIUS, Space, TAP } from '@/theme/layout';
import { useCompact } from '@/theme/type';

type PasswordFieldProps = Omit<FieldProps, 'secureTextEntry' | 'action'> & {
  /** For a password being chosen: the calm strength hint under it. The email, so it can't be in the password. */
  strength?: { email?: string };
};

/**
 * A password box: hidden as it is typed, with Show and Hide at the end of its label. It is never
 * filled in from anything saved, and nothing it holds is logged or kept.
 */
export function PasswordField({ strength, label, testID, ...field }: PasswordFieldProps) {
  const accent = useAccent();
  const [shown, setShown] = useState(false);
  const compact = useCompact();
  const toggle = (
    <Pressable
      testID={testID ? `${testID}-show` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${shown ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      onPress={() => setShown((now) => !now)}
      hitSlop={Space.xs}
      // The full target, overlapping the space around the label rather than making its line taller,
      // so a password's label sits as close to its box as any other field's.
      style={({ pressed }) => [styles.toggle, compact ? styles.toggleCompact : styles.toggleLarge, pressed && styles.pressed]}>
      <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={compact ? Space.l : 22} color={accent} aria-hidden />
      <AppText size={compact ? 'caption' : 'body'} color={accent}>
        {shown ? 'Hide' : 'Show'}
      </AppText>
    </Pressable>
  );
  return (
    <View style={styles.block}>
      <Field
        {...field}
        testID={testID}
        label={label}
        action={toggle}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      {strength ? <StrengthHint password={field.value} email={strength.email} /> : null}
    </View>
  );
}

/** Three slim segments and a few calm words. Blue fills in as the password grows; nothing turns red. */
export function StrengthHint({ password, email }: { password: string; email?: string }) {
  const { level, words } = passwordStrength(password, email);
  return (
    <View testID="password-strength" style={styles.strength}>
      <View style={styles.segments} aria-hidden>
        {[1, 2, 3].map((step) => (
          <View key={step} style={[styles.segment, { backgroundColor: level >= step ? Colors.primary : Colors.skySoft }]} />
        ))}
      </View>
      <AppText size="caption" muted>
        {words}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Space.s,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.s,
    borderRadius: RADIUS,
  },
  toggleCompact: {
    minHeight: COMPACT_TAP,
    minWidth: COMPACT_TAP,
    marginVertical: -Space.m,
  },
  toggleLarge: {
    minHeight: TAP,
    minWidth: TAP,
    marginVertical: -Space.s,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  strength: {
    gap: Space.xs,
  },
  segments: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  segment: {
    flex: 1,
    height: Space.xs,
    borderRadius: Space.xs / 2,
  },
});
