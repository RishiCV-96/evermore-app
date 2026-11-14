import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { CaregiverScreen } from '@/components/caregiver-ui';
import { Questionnaire } from '@/components/questionnaire';
import { useFamilyView } from '@/data/app-data';

// Screen 5: add a person, or change one (opened with their id, and a step to pick up at). The
// first step is quick: name, photo, relationship and one fact. Then the guided profile, one
// section per step (src/components/questionnaire.tsx). Everything saves as a draft as it is
// typed, so a new person's id is made here, before anything is saved.
export default function AddPerson() {
  const params = useLocalSearchParams<{ id?: string; step?: string }>();
  const family = useFamilyView();
  const [id] = useState(() => params.id ?? Crypto.randomUUID());
  const [step, setStep] = useState(Number(params.step) || 0);
  if (!family) return null;
  const person = family.people.find((candidate) => candidate.id === id);

  if (params.id && !person) {
    return (
      <CaregiverScreen title="Edit details" backLabel="Dashboard" backTo="/caregiver">
        <AppText>This person is no longer saved.</AppText>
        <BigButton label="Done" primary onPress={() => (router.canGoBack() ? router.back() : router.replace('/caregiver'))} />
      </CaregiverScreen>
    );
  }
  return <Questionnaire id={id} person={person} cards={family.cards.filter((card) => card.personId === id)} step={step} onStep={setStep} />;
}
