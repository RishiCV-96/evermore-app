import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { RevealContext } from '@/components/caregiver-ui';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, GUTTER, ICON, RADIUS, Space, TAP } from '@/theme/layout';
import { useCompact } from '@/theme/type';

type SheetProps = {
  visible: boolean;
  title: string;
  /** Leave it out for a sheet that must be answered, such as agreeing to a changed policy: no Close, and Back does nothing. */
  onClose?: () => void;
  children: ReactNode;
  /** Something pinned over the sheet rather than scrolling with it, such as a toast. */
  overlay?: ReactNode;
  /** Shown in the header in place of the title, such as a day with arrows either side. */
  header?: ReactNode;
};

/** A full-height sheet over the current screen, used instead of adding screens. */
export function Sheet({ visible, title, onClose, children, overlay, header }: SheetProps) {
  const insets = useSafeAreaInsets();
  const compact = useCompact();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose ?? (() => {})}>
      {/* iOS moves the scroll view's contents by itself; Android apps are edge-to-edge, so the
          window doesn't resize for the keyboard. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'padding' : undefined} style={styles.screen}>
        <ScrollView
          style={styles.screen}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.content,
            compact && styles.contentCompact,
            // An iOS page sheet already sits below the status bar.
            { paddingTop: Platform.OS === 'ios' ? Space.xl : insets.top + Space.l, paddingBottom: insets.bottom + Space.xl },
          ]}>
          <View style={styles.header}>
            {header ?? (
              <AppText accessibilityRole="header" fit bold size="title" style={styles.title}>
                {title}
              </AppText>
            )}
            {onClose ? (
              <Pressable
                testID="sheet-close"
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={({ pressed }) => [styles.close, compact && styles.closeCompact, pressed && styles.pressed]}>
                <AppText fit bold color={Colors.primaryDark}>
                  Close
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <RevealContext.Provider value={null}>{children}</RevealContext.Provider>
        </ScrollView>
      </KeyboardAvoidingView>
      {overlay}
    </Modal>
  );
}

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  testID?: string;
};

/** A large checkbox: the whole row is the tap target. */
export function Checkbox({ checked, onChange, children, testID }: CheckboxProps) {
  const compact = useCompact();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, compact && styles.checkRowCompact, pressed && styles.pressed]}>
      <View style={[styles.box, compact && styles.boxCompact, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={compact ? Space.l : ICON} color={Colors.onPrimary} aria-hidden /> : null}
      </View>
      <AppText style={styles.checkText}>{children}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    gap: Space.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  contentCompact: {
    gap: Space.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  title: {
    flex: 1,
  },
  close: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: Space.s,
    borderRadius: RADIUS,
  },
  closeCompact: {
    minHeight: COMPACT_TAP,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.l,
    minHeight: 56,
    padding: Space.xs,
    borderRadius: RADIUS,
  },
  checkRowCompact: {
    minHeight: COMPACT_TAP,
    gap: Space.m,
    paddingVertical: Space.xs,
    paddingHorizontal: 0,
  },
  boxCompact: {
    width: Space.xl,
    height: Space.xl,
    borderRadius: Space.s,
    borderWidth: 1.5,
  },
  box: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
  },
  boxChecked: {
    backgroundColor: Colors.primary,
  },
  checkText: {
    flex: 1,
  },
});
