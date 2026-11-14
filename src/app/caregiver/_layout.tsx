import { Stack } from 'expo-router';

import { PolicyGate } from '@/components/consent';
import { LOCAL_ONLY } from '@/data/app-data';
import { Colors } from '@/theme/colors';
import { CompactType } from '@/theme/type';

// The caregiver's screens as one group, so signing in always opens the dashboard (index)
// first; add a person and story approval are pushed on top of it. They use the compact type
// scale: very large text is for the person practicing. With sign-in on, a caregiver who hasn't agreed
// to the policy in force is asked to before continuing, over every caregiver screen (PolicyGate).
export const unstable_settings = { initialRouteName: 'index' };

export default function CaregiverLayout() {
  return (
    <CompactType value={true}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }} />
      {LOCAL_ONLY ? null : <PolicyGate />}
    </CompactType>
  );
}
