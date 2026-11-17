import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Field, FieldNote, FormCell, FormGroup, LabelLine, MarkLink, Row, type NotApplicable } from '@/components/caregiver-ui';
import { Sheet } from '@/components/sheet';
import { NOT_APPLICABLE, displayValue, type Option } from '@/data/questionnaire';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { Elevation } from '@/theme/elevation';
import { COMPACT_TAP, ICON, RADIUS, Radius, Space } from '@/theme/layout';
import { useCompact } from '@/theme/type';

// Tappable answers for the profile form: chips for a few short choices, and a row that opens a
// list for many. Same surface, radius and selected fill as the buttons.

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** One answer of several (radio), or any number (checkbox). */
  role?: 'radio' | 'checkbox';
  testID?: string;
};

export function Chip({ label, selected, onPress, role = 'checkbox', testID }: ChipProps) {
  // The caregiver's chips are pills with a hairline edge; anywhere else they keep the one radius.
  const compact = useCompact();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.chipOn : styles.chipOff, compact && styles.chipPill, compact && !selected && styles.chipEdge, pressed && styles.pressed]}>
      <AppText fit size="caption" color={selected ? Colors.onPrimary : Colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Chips({ children }: { children: React.ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

type PickerProps = {
  label: string;
  /** The saved value. */
  value: string;
  options: Option[];
  /** Also takes the caregiver's own words. */
  other?: boolean;
  placeholder?: string;
  limit?: number;
  onChange: (value: string) => void;
  /** Offers "Not applicable" at the end of the label line while there is no answer, as every question does. */
  notApplicable?: NotApplicable;
  /** A row of a form, with its label over the answer. Otherwise a settings row. */
  inForm?: boolean;
  /** Marked with a small asterisk. */
  required?: boolean;
  /** A calm line under the row, shown once it has been touched. */
  note?: string;
  /** The list closed. */
  onClose?: () => void;
  /** Offers "Leave it blank" once there is an answer. */
  clearable?: boolean;
  testID?: string;
};

/** One choice of many: a settings row that opens the list, so the form stays short. */
export function Picker({ label, value, options, other = false, placeholder, limit, onChange, notApplicable, inForm = false, required = false, note, onClose, clearable = true, testID }: PickerProps) {
  const [open, setOpen] = useState(false);
  const known = options.find((option) => option.value === value);
  const [own, setOwn] = useState(known ? '' : value);

  /** Closing the list keeps words typed in "Something else", so nothing typed is lost. */
  function close() {
    const typed = own.trim();
    if (other && typed && typed !== value) onChange(typed);
    setOpen(false);
    onClose?.();
  }

  function choose(next: string) {
    onChange(next);
    if (next !== own.trim()) setOwn('');
    setOpen(false);
  }

  const empty = notApplicable?.marked ? NOT_APPLICABLE : 'Choose';
  const answer = known?.label ?? (displayValue(value) || empty);

  return (
    <>
      {inForm ? (
        <FormCell flush>
          <Pressable
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={`${label}${required ? ', required' : ''}: ${answer}`}
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.formPicker, pressed && styles.formPickerPressed]}>
            <View style={styles.optionText}>
              {/* Room at the end of the label line for "Not applicable", which sits over it. */}
              <LabelLine label={label} required={required} trailing={notApplicable && !value ? <View style={styles.markRoom} /> : null} />
              <AppText fit muted={!value && !notApplicable?.marked}>
                {answer}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden />
          </Pressable>
          {notApplicable && !value ? (
            <View pointerEvents="box-none" style={styles.markSpot}>
              <MarkLink {...notApplicable} />
            </View>
          ) : null}
          {note ? <FieldNote>{note}</FieldNote> : null}
        </FormCell>
      ) : (
        <Row testID={testID} label={label} value={answer} onPress={() => setOpen(true)} />
      )}
      <Sheet visible={open} title={label} onClose={close}>
        <View accessibilityRole="radiogroup">
          <FormGroup>
            {options.map((option) => (
              <PickerOption key={option.value} testID={`${testID}-${option.value}`} label={option.label} hint={option.hint} chosen={option.value === value} onPress={() => choose(option.value)} />
            ))}
          </FormGroup>
        </View>
        {other ? (
          <>
            <Field
              testID={`${testID}-own`}
              label="Something else"
              placeholder={placeholder}
              value={own}
              maxLength={limit}
              count={false}
              onChangeText={setOwn}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {own.trim() ? <BigButton testID={`${testID}-use`} small label="Use this" onPress={() => choose(own.trim())} /> : null}
          </>
        ) : null}
        {value && clearable ? <BigButton testID={`${testID}-clear`} quiet label="Leave it blank" onPress={() => choose('')} /> : null}
      </Sheet>
    </>
  );
}

type PickerOptionProps = { label: string; hint?: string; chosen: boolean; onPress: () => void; testID?: string };

/** One line of a Picker's list, with a check on the chosen one, as a phone's own lists have. */
function PickerOption({ label, hint, chosen, onPress, testID }: PickerOptionProps) {
  const accent = useAccent();
  return (
    <Pressable testID={testID} accessibilityRole="radio" aria-checked={chosen} onPress={onPress} style={({ pressed }) => pressed && styles.optionPressed}>
      <FormCell flush>
        <View style={styles.option}>
          <View style={styles.optionText}>
            <AppText fit bold={chosen}>
              {label}
            </AppText>
            {hint ? (
              <AppText size="caption" muted>
                {hint}
              </AppText>
            ) : null}
          </View>
          {chosen ? <Ionicons name="checkmark" size={ICON} color={accent} aria-hidden /> : null}
        </View>
      </FormCell>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.s,
  },
  chip: {
    minHeight: COMPACT_TAP,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: Space.m,
    borderRadius: RADIUS,
  },
  chipPill: {
    borderRadius: Radius.pill,
  },
  chipOn: {
    backgroundColor: Colors.primary,
  },
  // Chips sit on a form's soft surface.
  chipOff: {
    backgroundColor: Colors.background,
  },
  // White on Mist: a hairline edge so each reads as a shape.
  chipEdge: {
    ...Elevation.edge,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.s,
  },
  optionPressed: {
    backgroundColor: Colors.skySoft,
  },
  optionText: {
    flex: 1,
  },
  formPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.s,
  },
  formPickerPressed: {
    opacity: 0.7,
  },
  // "Not applicable" on the label line, clear of the chevron.
  markSpot: {
    position: 'absolute',
    top: Space.s,
    right: Space.l + ICON + Space.s,
  },
  markRoom: {
    width: 96,
  },
});
