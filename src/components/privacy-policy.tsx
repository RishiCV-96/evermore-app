import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Notice } from '@/components/caregiver-ui';
import { Sheet } from '@/components/sheet';
import { CONTACT, DRAFT_LINE, EFFECTIVE_DATE, POLICY, POLICY_VERSION, WHAT_WE_STORE } from '@/lib/privacy-policy';
import { Colors } from '@/theme/colors';
import { RADIUS, Space, TAP } from '@/theme/layout';
import { CompactType } from '@/theme/type';

// The privacy policy and "What the app stores", in the app. The words are in src/lib/privacy-policy.ts,
// the one source the docs are written from. Always on the compact scale: it is reading for the caregiver,
// or for anyone who opens it from the person's phone, and the person is never asked to read it.

/** The whole policy: the draft line, its version, and every section. */
export function PolicyText() {
  return (
    <CompactType value={true}>
      <View style={styles.body}>
        <Notice>{DRAFT_LINE}.</Notice>
        <AppText testID="policy-version" size="caption" muted>
          Version {POLICY_VERSION}. Effective date: {EFFECTIVE_DATE}.
        </AppText>
        {POLICY.map((section) => (
          <View key={section.id} style={styles.section}>
            <AppText accessibilityRole="header" bold>
              {section.heading}
            </AppText>
            {section.points.map((point) => (
              <Bullet key={point.text}>{point.text}</Bullet>
            ))}
          </View>
        ))}
        <AppText size="caption" muted>
          Contact: {CONTACT}
        </AppText>
      </View>
    </CompactType>
  );
}

/** The policy as a sheet: from sign-up, Settings and the person's first step. */
export function PolicySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Privacy policy" onClose={onClose}>
      <PolicyText />
    </Sheet>
  );
}

/** "What the app stores": the plain version of the data inventory, for Settings. */
export function StoresSheet({ visible, onClose, onPolicy }: { visible: boolean; onClose: () => void; onPolicy: () => void }) {
  return (
    <Sheet visible={visible} title="What the app stores" onClose={onClose}>
      <CompactType value={true}>
        <View style={styles.body}>
          {WHAT_WE_STORE.map((group) => (
            <View key={group.heading} style={styles.section}>
              <AppText accessibilityRole="header" bold>
                {group.heading}
              </AppText>
              {group.points.map((point) => (
                <Bullet key={point}>{point}</Bullet>
              ))}
            </View>
          ))}
          <Pressable testID="stores-policy" accessibilityRole="button" onPress={onPolicy} style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
            <AppText size="caption" color={Colors.primaryDark}>
              The privacy policy has the details.
            </AppText>
          </Pressable>
        </View>
      </CompactType>
    </Sheet>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.point}>
      <AppText bold muted aria-hidden>
        •
      </AppText>
      <AppText style={styles.pointText}>{children}</AppText>
    </View>
  );
}

/**
 * The person's way to the policy, on their first step: at the ordinary reading size rather than their
 * large type, so it never competes with their one action, but with their full 48pt target.
 */
export function PolicyLink({ onPress, testID }: { onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel="Read the privacy policy" onPress={onPress} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <CompactType value={true}>
        <AppText color={Colors.primaryDark} style={styles.underline}>
          Privacy policy
        </AppText>
      </CompactType>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Space.l,
  },
  section: {
    gap: Space.m,
  },
  point: {
    flexDirection: 'row',
    gap: Space.m,
  },
  pointText: {
    flex: 1,
  },
  more: {
    minHeight: TAP,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: {
    minHeight: TAP,
    minWidth: TAP,
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
});
