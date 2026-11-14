import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Note, Stat } from '@/components/dashboard';
import { FoundRows } from '@/components/insight-found';
import { ScoreRing } from '@/components/insight-ring';
import { Sheet } from '@/components/sheet';
import { MEMORY_SCORE } from '@/config/insights';
import { foundGroups, personScore, secondsText, wholePercents, type PersonInsight } from '@/lib/insights';
import { Space } from '@/theme/layout';

// A person's page on Insights → People: how that person's cards were found over the last two weeks,
// headed by the same score ring as everywhere else, smaller. About the cards with their photo and
// facts, never a judgment of anyone; a way to see which photos and hints might help. Caregiver-only.

type PersonInsightSheetProps = {
  person: PersonInsight;
  name: string;
  visible: boolean;
  onClose: () => void;
  /** Opens their sheet on People, to look over the photo, stories and hints. */
  onOpenProfile: () => void;
};

export function PersonInsightSheet({ person, name, visible, onClose, onOpenProfile }: PersonInsightSheetProps) {
  const scored = personScore(person);
  const groups = foundGroups(person.resolutions);
  const spoken = scored
    ? `Memory score for ${name}’s cards ${scored.score} out of 100, ${scored.band}, last 14 days`
    : `Memory score for ${name}’s cards: needs ${MEMORY_SCORE.minCards} cards, ${MEMORY_SCORE.minCards - person.cards} to go`;
  return (
    <Sheet visible={visible} title={name} onClose={onClose}>
      <View testID="person-insight" style={styles.top} accessible accessibilityLabel={spoken}>
        <ScoreRing testID="person-ring" small decorative size={84} score={scored?.score} band={scored?.band} spoken={spoken} />
        <View style={styles.topText}>
          <AppText fit size="caption" muted>
            Memory score of their cards
          </AppText>
          <AppText fit bold size="title">
            {scored ? scored.band : 'Not enough cards'}
          </AppText>
          <AppText size="caption" muted>
            {scored ? `${scored.score} out of 100, last 14 days` : `${person.cards} of the ${MEMORY_SCORE.minCards} cards a score needs`}
          </AppText>
        </View>
      </View>
      <Note start />
      <View style={styles.group}>
        <AppText fit bold accessibilityRole="header">
          How their cards were found
        </AppText>
        {person.shares ? (
          <FoundRows groups={groups} percents={wholePercents([person.shares[1], person.shares[2], person.shares[3]])} />
        ) : (
          <AppText muted>{`${person.cards} ${person.cards === 1 ? 'card' : 'cards'} so far. Shares show from 5.`}</AppText>
        )}
      </View>
      <View>
        <Stat label="Cards, last 14 days" value={String(person.cards)} />
        {person.medianFirstMs !== undefined ? <Stat label="Middle time to the first name" value={secondsText(person.medianFirstMs)} /> : null}
      </View>
      <AppText size="caption" muted>
        Worked out like a day’s score, over this person’s cards in the last 14 days. Familiar photos and gentle hints help when cards take more tries.
      </AppText>
      <BigButton testID="person-open-profile" small label={`Open ${name}’s profile`} onPress={onOpenProfile} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  group: {
    gap: Space.s,
  },
});
