import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { hasPhoto, photoSource } from '@/components/person-photo';
import { PracticeScreen } from '@/components/practice-screen';
import { DEFAULT_REVEAL_CARDS } from '@/config/schedule';
import {
  askedToday,
  completedToday,
  deckCards,
  doneToday,
  finishSession,
  lastSeen,
  newSessionId,
  recordAttempt,
  recordCard,
  sessionCards,
  startSession,
  usePractice,
  type Practice,
  type SessionKind,
} from '@/data/app-data';
import { studyToday, useStudyDay } from '@/data/study-clock';
import { ONE_PERSON_SPACING, sentenceKey, spacingIn } from '@/lib/session';
import { makeRounds } from '@/lib/stories';

// Screens 3 and 7: the practice cards, then the wrap-up. "more" practices a mix after the day's
// target is met; "person" practices one person's cards. The person can stop at any card and pick
// up later: everything finished is saved as it happens, so there is nothing to lose. Practice is
// never refused, at any hour. A round keeps the study day it began in (src/lib/study-day.ts): one
// still going at 05:30 runs on undisturbed and counts toward the day it started in.
export default function PracticeRoute() {
  const { more, person } = useLocalSearchParams<{ more?: string; person?: string }>();
  const practice = usePractice();
  if (!practice) return null;
  return <Session practice={practice} kind={person ? { person } : more === '1' ? 'more' : 'today'} />;
}

function Session({ practice, kind }: { practice: Practice; kind: SessionKind }) {
  // The cards are chosen once, when practice opens. Changes the caregiver makes meanwhile
  // wait for the next session.
  // Re-rendered when a new study day begins, so a round from the day before stays on its own day.
  const today = useStudyDay() ?? studyToday();
  const [plan] = useState(() => {
    const deck = deckCards(practice);
    return {
      sessionId: newSessionId(),
      studyDay: studyToday(),
      goal: practice.goal,
      rounds: makeRounds(sessionCards(practice, kind), deck, lastSeen(practice)),
      deck,
      asked: askedToday(practice),
      photos: Object.fromEntries(practice.people.map((person) => [person.id, photoSource(person)])),
      faces: Object.fromEntries(practice.people.filter(hasPhoto).map((person) => [person.id, photoSource(person)])),
      memoryPhotos: Object.fromEntries(practice.cards.filter(hasPhoto).map((card) => [card.id, photoSource(card)])),
    };
  });

  useEffect(() => {
    if (plan.rounds.length) startSession(plan.sessionId);
  }, [plan]);

  if (plan.rounds.length === 0) return <Redirect href="/" />;

  return (
    <PracticeScreen
      rounds={plan.rounds}
      deck={plan.deck}
      asked={plan.asked}
      photos={plan.photos}
      faces={plan.faces}
      memoryPhotos={plan.memoryPhotos}
      progress={{ completed: completedToday(practice, plan.studyDay), goal: plan.studyDay === today ? practice.goal : plan.goal }}
      dayDone={plan.studyDay === today ? doneToday(practice) : completedToday(practice, plan.studyDay) >= plan.goal}
      studyDay={plan.studyDay}
      revealCards={practice.revealCards ?? DEFAULT_REVEAL_CARDS}
      apart={typeof kind === 'object' ? ONE_PERSON_SPACING : spacingIn(plan.deck)}
      onRemembered={(card, result) =>
        recordCard(plan.sessionId, card.id, result, {
          personId: card.personId,
          phrasing: card.phrasing.id,
          choices: card.choices,
          kind: card.phrasing.kind,
          key: sentenceKey(card.personId, card.phrasing),
          extra: Boolean(card.again),
        })
      }
      onCardLeft={(card, timing) => recordAttempt(plan.sessionId, card, timing)}
      onFinish={() => finishSession(plan.sessionId)}
      onHome={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
