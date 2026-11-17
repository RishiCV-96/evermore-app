import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Row } from '@/components/caregiver-ui';
import { ReminderRow, ReminderSettings } from '@/components/reminders';
import { Sheet } from '@/components/sheet';
import { REMINDERS_AVAILABLE } from '@/data/reminders';
import { setTextSize, TEXT_SIZES, textSizeLabel, useTextSize } from '@/data/text-size';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { ICON, RADIUS, Space, TAP, touchSlop } from '@/theme/layout';
import { Fonts, MIN_FONT_SCALE, typeFor } from '@/theme/type';

/**
 * The four Text size levels, each shown at its own size. A choice applies at once. On the person's
 * home it is also their own settings: a Reminders row below the sizes opens their daily reminder in
 * the same sheet (src/components/reminders.tsx), so no sheet opens on a sheet. The caregiver's copy
 * has no Reminders: they live on the person's phone only.
 */
export function TextSizeSheet({ visible, onClose, reminders = false }: { visible: boolean; onClose: () => void; reminders?: boolean }) {
  const accent = useAccent();
  const current = useTextSize();
  const [view, setView] = useState<'size' | 'reminders'>('size');
  const close = () => {
    setView('size');
    onClose();
  };
  if (view === 'reminders') {
    return (
      <Sheet visible={visible} title="Reminders" onClose={close}>
        <ReminderSettings />
        <BigButton testID="reminders-done" label="Done" primary onPress={close} />
      </Sheet>
    );
  }
  return (
    <Sheet visible={visible} title="Text size" onClose={close}>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {TEXT_SIZES.map(({ size, label }) => {
          const chosen = size === current;
          return (
            <Pressable
              key={size}
              testID={`text-size-${size}`}
              accessibilityRole="radio"
              aria-checked={chosen}
              onPress={() => setTextSize(size)}
              style={({ pressed }) => [styles.option, chosen && styles.chosen, pressed && styles.pressed]}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={MIN_FONT_SCALE}
                style={[styles.optionText, typeFor(size).body, chosen && styles.chosenText]}>
                {label}
              </Text>
              {chosen ? <Ionicons name="checkmark-circle-outline" size={ICON} color={accent} aria-hidden /> : null}
            </Pressable>
          );
        })}
      </View>
      {reminders ? <ReminderRow onPress={() => setView('reminders')} /> : null}
      <BigButton testID="text-size-done" label="Done" primary onPress={close} />
    </Sheet>
  );
}

/** "Aa" on the person's home: opens the Text size sheet, with their Reminders where the phone has notifications. */
export function TextSizeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID="text-size-button"
        accessibilityRole="button"
        accessibilityLabel={REMINDERS_AVAILABLE ? 'Text size and reminders' : 'Text size'}
        onPress={() => setOpen(true)}
        hitSlop={touchSlop()}
        style={({ pressed }) => [styles.aa, pressed && styles.pressed]}>
        <AppText bold color={Colors.primaryDark}>
          Aa
        </AppText>
      </Pressable>
      <TextSizeSheet visible={open} onClose={() => setOpen(false)} reminders={REMINDERS_AVAILABLE} />
    </>
  );
}

/** The Text size row in the caregiver's settings. */
export function TextSizeSetting() {
  const size = useTextSize();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Row testID="text-size-setting" label="Practice text size" icon="text-outline" subtitle="Words on the person’s screens." value={textSizeLabel(size)} onPress={() => setOpen(true)} />
      <TextSizeSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: Space.s,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: 64,
    paddingHorizontal: Space.l,
    borderRadius: RADIUS,
  },
  chosen: {
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.skySoft,
  },
  optionText: {
    flex: 1,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  chosenText: {
    fontFamily: Fonts.bold,
  },
  aa: {
    minWidth: TAP,
    minHeight: TAP,
    paddingHorizontal: Space.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
});
