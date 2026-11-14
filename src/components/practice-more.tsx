import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { PeopleGrid } from '@/components/people-grid';
import { Sheet } from '@/components/sheet';
import type { PracticePerson } from '@/data/practice-store';

/**
 * "Keep practicing" on the person's home, once the day's session is finished: always there, at any
 * hour, as many times as they like (extra practice). A sheet, not a screen:
 * tap someone's picture to practice them again, or take a mix, which the schedule fills
 * with the cards that need it most. It only ever counts finished cards.
 */
export function PracticeMore({ people }: { people: PracticePerson[] }) {
  const [open, setOpen] = useState(false);

  function practice(params: { person: string } | { more: '1' }) {
    setOpen(false);
    router.push({ pathname: '/practice', params });
  }

  return (
    <>
      <BigButton testID="practice-more" label="Keep practicing" primary large onPress={() => setOpen(true)} />
      <Sheet visible={open} title="Keep practicing" onClose={() => setOpen(false)}>
        {/* The one main action first, so it is in view however many people there are. */}
        <BigButton testID="practice-mix" label="A mix of people" primary onPress={() => practice({ more: '1' })} />
        <AppText fit bold>
          Or choose someone:
        </AppText>
        <PeopleGrid people={people} onOpen={(person) => practice({ person })} openHint="Practices their stories." />
      </Sheet>
    </>
  );
}
