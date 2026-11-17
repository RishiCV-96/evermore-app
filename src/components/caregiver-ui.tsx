import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ScrollViewInstance,
  type TextInputInstance,
  type TextInputProps,
  type TextStyle,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BigButton } from '@/components/big-button';
import { Logo } from '@/components/logo';
import { useKeyboardOpen } from '@/components/use-keyboard-open';
import { NOT_APPLICABLE, REQUIRED_LEGEND, REQUIRED_MARK } from '@/data/questionnaire';
import { addMonths, monthOf } from '@/lib/facts';
import { asOfLabel } from '@/lib/stories';
import { useAccent } from '@/theme/accent';
import { Colors } from '@/theme/colors';
import { COMPACT_TAP, GUTTER, ICON, RADIUS, Space } from '@/theme/layout';
import { COMPACT_MAX_SCALE, Fonts, useCompact, useType } from '@/theme/type';

/** A fact is a short phrase that finishes a sentence. */
export const MEMORY_LIMIT = 80;

/** Long enough for the screen to have made room for the keyboard. */
const REVEAL_DELAY = 80;

/** The line heights of a form row's small label and its answer. */
const ROW_LABEL = 18;
const ROW_ANSWER = 22;

/** Anything on screen that can be brought into view: a field, or a question's whole row. */
type Revealable = Pick<ViewInstance, 'measureInWindow'>;

/** How a focused field (or a question jumped to) tells the screen around it to bring it into view. Sheets clear it. */
export const RevealContext = createContext<((target: Revealable | null) => void) | null>(null);

/** The widest a form's column grows: short answers on wide rows read as hugging the left. */
export const FORM_WIDTH = 520;
const SCREEN_WIDTH = 640;

/**
 * A step's text fields in the order they are shown, so the keyboard's key says Next and moves on,
 * and the last says Done. Each field registers itself under its id.
 */
export type FieldChainValue = { order: string[]; inputs: Map<string, TextInputInstance> };
export const FieldChain = createContext<FieldChainValue | null>(null);

/** The chain for a step: `order` is its text fields' ids, top to bottom. */
export function useFieldChain(order: string[]): FieldChainValue {
  const [inputs] = useState(() => new Map<string, TextInputInstance>());
  return { order, inputs };
}

type CaregiverScreenProps = {
  title?: string;
  /** Leave out on the dashboard, which has nothing behind it. */
  backLabel?: string;
  /** Where Back goes when there is no screen behind this one. */
  backTo?: Href;
  /** Back within the screen, such as to step 1, in place of leaving it. */
  onBack?: () => void;
  /** Fixed above the scrolling part, in place of the Back link and title. */
  header?: ReactNode;
  /** Pinned below the scrolling part. It rides above the keyboard. */
  footer?: ReactNode;
  /** The logo between Back and the title, with this test ID. It folds away while the keyboard is up. */
  logo?: string;
  /** A form: header, content and bar in the narrower centered column. */
  narrow?: boolean;
  children: ReactNode;
};

/**
 * A caregiver screen: a quiet Back link and a title (or a header of its own), a scrolling
 * middle, and an optional pinned bar. The keyboard never covers the focused field or the bar:
 * the bar rides above it, and the focused field is scrolled into the space left.
 */
export function CaregiverScreen({ title, backLabel, backTo, onBack, header, footer, logo, narrow = false, children }: CaregiverScreenProps) {
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const viewport = useRef<ViewInstance>(null);
  const scrolled = useRef(0);
  const focused = useRef<Revealable | null>(null);
  const keyboardOpen = useKeyboardOpen();
  const column = { maxWidth: narrow ? FORM_WIDTH : SCREEN_WIDTH };

  // A new step starts at the top.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [title]);

  /** Scrolls the focused field into the visible part, clear of the pinned bar and the keyboard. */
  const reveal = useCallback(() => {
    const input = focused.current;
    if (!input || !viewport.current) return;
    input.measureInWindow((_x, inputTop, _width, inputHeight) => {
      viewport.current?.measureInWindow((_vx, top, _vw, height) => {
        const below = inputTop + inputHeight + Space.m - (top + height);
        const above = top + Space.s - inputTop;
        if (below > 0) scroll.current?.scrollTo({ y: scrolled.current + below, animated: true });
        else if (above > 0) scroll.current?.scrollTo({ y: Math.max(scrolled.current - above, 0), animated: true });
      });
    });
  }, []);

  useEffect(() => {
    // Once it is up, and the screen has made room.
    const listener = Keyboard.addListener('keyboardDidShow', () => setTimeout(reveal, REVEAL_DELAY));
    return () => listener.remove();
  }, [reveal]);

  const onFocus = useCallback(
    (input: Revealable | null) => {
      focused.current = input;
      setTimeout(reveal, REVEAL_DELAY);
    },
    [reveal],
  );

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <View style={[styles.header, column, { paddingTop: insets.top + Space.s }]}>
        {header ?? (
          <>
            {backLabel && (backTo || onBack) ? (
              <Pressable
                testID="back"
                accessibilityRole="button"
                onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace(backTo!))}
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={ICON} color={accent} aria-hidden />
                <AppText fit color={accent}>
                  {backLabel}
                </AppText>
              </Pressable>
            ) : null}
            {logo ? <Logo size="form" testID={logo} foldWithKeyboard /> : null}
            {title ? (
              <AppText accessibilityRole="header" fit bold size="title">
                {title}
              </AppText>
            ) : null}
          </>
        )}
      </View>
      <View ref={viewport} style={styles.screen}>
        <ScrollView
          ref={scroll}
          style={styles.screen}
          keyboardShouldPersistTaps="handled"
          // On web any scroll counts as a drag, which would blur the field being revealed.
          keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          scrollEventThrottle={32}
          onScroll={(event) => {
            scrolled.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={[styles.content, column, { paddingBottom: footer ? Space.l : insets.bottom + Space.xl }]}>
          <RevealContext.Provider value={onFocus}>{children}</RevealContext.Provider>
        </ScrollView>
      </View>
      {footer ? (
        <View style={[styles.footer, column, { paddingBottom: keyboardOpen ? Space.s : insets.bottom + Space.m }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export type FieldProps = TextInputProps & {
  label: string;
  /** One line under the label, such as an example. */
  help?: string;
  value: string;
  maxLength?: number;
  /** Show "12 of 80 letters" under a field with a limit. */
  count?: boolean;
  /** A small control at the end of the label's line, such as Show for a password. */
  action?: ReactNode;
  /** A calm note under the box, such as what the field still needs. Never red. */
  note?: string;
  /** Added to the box's own look, such as larger digits. */
  inputStyle?: TextStyle;
};

/** A labelled text box, with a character count when it has a limit. */
export function Field({ label, help, value, maxLength, count = true, multiline, onFocus, onBlur, action, note, inputStyle, ...input }: FieldProps) {
  const type = useType();
  const compact = useCompact();
  const reveal = useContext(RevealContext);
  const box = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={compact ? styles.fieldCompact : styles.field}>
      <View style={styles.fieldLabel}>
        <AppText fit bold={!compact} size={compact ? 'caption' : 'body'} muted={compact} style={styles.fieldLabelText}>
          {label}
        </AppText>
        {action}
      </View>
      {help ? (
        <AppText size="caption" muted>
          {help}
        </AppText>
      ) : null}
      <TextInput
        ref={box}
        accessibilityLabel={label}
        accessibilityHint={help}
        value={value}
        maxLength={maxLength}
        placeholderTextColor={Colors.textMuted}
        maxFontSizeMultiplier={compact ? COMPACT_MAX_SCALE : undefined}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          reveal?.(box.current);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, compact && styles.inputCompact, multiline && styles.inputLines, { fontSize: type.body.fontSize }, inputStyle, focused && styles.inputFocused]}
        {...input}
      />
      {note ? <FieldNote>{note}</FieldNote> : null}
      {maxLength && count ? (
        <AppText size="caption" muted style={styles.count}>
          {value.length} of {maxLength} letters
        </AppText>
      ) : null}
    </View>
  );
}

/** A required question's quiet way out: "Not applicable", then Undo once it is marked. */
export type NotApplicable = {
  marked: boolean;
  onChange: (marked: boolean) => void;
  /** The question, for screen readers. */
  label: string;
  testID?: string;
};

/** "Not applicable", or Undo once marked. It sits at the end of the question's label line, everywhere. */
export function MarkLink({ marked, onChange, label, testID }: NotApplicable) {
  return (
    <QuietLink
      testID={testID}
      inline
      label={marked ? 'Undo' : NOT_APPLICABLE}
      accessibilityLabel={`${label}: ${marked ? `undo ${NOT_APPLICABLE}` : NOT_APPLICABLE}`}
      onPress={() => onChange(!marked)}
    />
  );
}

type LabelLineProps = {
  label: string;
  required?: boolean;
  color?: string;
  /** Offers "Not applicable" (or Undo) at the end of the line. */
  notApplicable?: NotApplicable;
  /** Something else at the end of the line, such as the Test data tag. */
  trailing?: ReactNode;
};

/** A question's label line: the small label and its asterisk, and at its end "Not applicable" when offered. One pattern for every kind of question. */
export function LabelLine({ label, required = false, color, notApplicable, trailing }: LabelLineProps) {
  return (
    <View pointerEvents="box-none" style={styles.labelLine}>
      <QuestionLabel label={label} required={required} color={color} style={styles.labelText} />
      {trailing}
      {notApplicable ? <MarkLink {...notApplicable} /> : null}
    </View>
  );
}

type FormRowProps = TextInputProps & {
  label: string;
  value: string;
  /** Marked with a small asterisk. */
  required?: boolean;
  /** Something quiet at the end of the row. */
  trailing?: ReactNode;
  /** Offers "Not applicable" on the label line while the row is empty and not being typed in. */
  notApplicable?: NotApplicable;
  /** A calm line under the row, shown once the field has been touched. */
  note?: string;
  /** Its id in the step's FieldChain: the keyboard's key then says Next (or Done on the last). */
  chain?: string;
  /** Its follow-ups come next ("This may change", a year): no hairline between them. */
  joined?: boolean;
  /** Takes the focus this many ms after it appears: after a step has slid in, when autoFocus would be too early. */
  focusAfter?: number;
};

/**
 * One question of a form: a small label that stays put, and the answer under it. The field fills
 * the whole row, so a tap anywhere on it focuses, and the row is the tap target.
 */
export function FormRow({ label, required = false, value, trailing, notApplicable, note, placeholder, chain, joined = false, focusAfter, onFocus, onBlur, onSubmitEditing, ...input }: FormRowProps) {
  const accent = useAccent();
  const type = useType();
  const reveal = useContext(RevealContext);
  const fields = useContext(FieldChain);
  const box = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const offered = notApplicable && !value && !focused;
  const place = chain && fields ? fields.order.indexOf(chain) : -1;
  const last = place >= 0 && place === (fields?.order.length ?? 0) - 1;

  useEffect(() => {
    if (!chain || !fields) return;
    const input = box.current;
    if (input) fields.inputs.set(chain, input);
    return () => {
      if (fields.inputs.get(chain) === input) fields.inputs.delete(chain);
    };
  }, [chain, fields]);

  useEffect(() => {
    if (focusAfter === undefined) return;
    const timer = setTimeout(() => box.current?.focus(), focusAfter);
    return () => clearTimeout(timer);
  }, [focusAfter]);

  /** Next moves to the following field; Done, on the last, closes the keyboard. */
  function submitted() {
    if (place < 0 || !fields) return;
    const following = fields.order[place + 1];
    if (following) fields.inputs.get(following)?.focus();
    else Keyboard.dismiss();
  }

  // The label sits on the field, so the phone's own text size has to make room for it.
  const scale = Math.min(useWindowDimensions().fontScale, COMPACT_MAX_SCALE);
  const top = Space.s + Math.ceil(ROW_LABEL * scale);
  const room = { paddingTop: top, minHeight: top + Space.s + Math.ceil(ROW_ANSWER * scale) };
  return (
    <View style={[styles.formRow, joined && styles.joined, focused && styles.formRowFocused]}>
      <View style={styles.formLine}>
        <TextInput
          ref={box}
          accessibilityLabel={required ? `${label}, required` : label}
          value={value}
          placeholder={notApplicable?.marked ? NOT_APPLICABLE : placeholder}
          placeholderTextColor={Colors.textMuted}
          maxFontSizeMultiplier={COMPACT_MAX_SCALE}
          returnKeyType={place < 0 ? undefined : last ? 'done' : 'next'}
          submitBehavior={place < 0 ? undefined : last ? 'blurAndSubmit' : 'submit'}
          onSubmitEditing={(event) => {
            submitted();
            onSubmitEditing?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            reveal?.(box.current);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.formInput, room, { fontSize: type.body.fontSize }]}
          {...input}
        />
        {trailing}
      </View>
      <View pointerEvents="box-none" style={styles.formLabel}>
        <LabelLine label={label} required={required} color={focused ? accent : undefined} notApplicable={offered ? notApplicable : undefined} />
      </View>
      {note ? <FieldNote>{note}</FieldNote> : null}
    </View>
  );
}

type QuestionLabelProps = { label: string; required?: boolean; color?: string; style?: TextStyle };

/** A question's small label, with an asterisk when it is required. Fields say "required" to screen readers themselves. */
export function QuestionLabel({ label, required = false, color, style }: QuestionLabelProps) {
  return (
    <AppText fit size="caption" muted={!color} color={color} accessibilityLabel={required ? `${label}, required` : label} style={style}>
      {label}
      {required ? <Asterisk /> : null}
    </AppText>
  );
}

/** Small and in the accent used for text: the logo's yellow is for fills only, and can't be read on white. */
function Asterisk() {
  const accent = useAccent();
  return (
    <AppText testID="required-mark" bold size="caption" color={accent}>
      {` ${REQUIRED_MARK}`}
    </AppText>
  );
}

/** One line at the top of each step, saying what the asterisk means. */
export function RequiredLegend() {
  const accent = useAccent();
  return (
    <AppText testID="required-legend" fit size="caption" muted>
      <AppText bold size="caption" color={accent}>
        {REQUIRED_MARK}
      </AppText>
      {` ${REQUIRED_LEGEND}`}
    </AppText>
  );
}

/** A calm note under a field. Never red. */
export function FieldNote({ children }: { children: ReactNode }) {
  return (
    <View testID="field-note" accessibilityLiveRegion="polite" style={styles.fieldNote}>
      <Ionicons name="information-circle-outline" size={Space.l} color={Colors.textMuted} aria-hidden />
      <AppText size="caption" muted style={styles.noticeText}>
        {children}
      </AppText>
    </View>
  );
}

/**
 * A row of a form that isn't a field: a photo, a checkbox, a month. It keeps the rows' edges and
 * hairline. `flush` leaves the padding to a child that should be the whole row's tap target.
 */
export function FormCell({ flush = false, joined = false, children }: { flush?: boolean; /** A follow-up comes next: no hairline. */ joined?: boolean; children: ReactNode }) {
  return <View style={[styles.formCell, flush && styles.formCellFlush, joined && styles.joined]}>{children}</View>;
}

/** One more answer, or questions waiting behind a tap: a row inside the card, a ⊕ and the words. The one pattern for adding. */
export function AddRow({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) {
  const accent = useAccent();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.addRow, pressed && styles.addRowPressed]}>
      <Ionicons name="add-circle-outline" size={ICON} color={accent} aria-hidden />
      <AppText fit color={accent} style={styles.labelText}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Related questions on one soft surface: no border, thin dividers between rows and whitespace
 * around it. The last row's hairline is clipped, so a group ends cleanly.
 */
export function FormGroup({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <View style={styles.formBlock}>
      {heading ? <GroupHeading>{heading}</GroupHeading> : null}
      <View style={styles.formGroup}>
        <View style={styles.formRows}>{children}</View>
      </View>
    </View>
  );
}

/** Beside a made-up answer, so nobody mistakes it for a real one. */
export function TestTag() {
  return (
    <View testID="test-tag" style={styles.tag}>
      <AppText fit size="caption" muted>
        Test data
      </AppText>
    </View>
  );
}

/** Small words at the top of a group of questions. */
export function GroupHeading({ children }: { children: string }) {
  const accent = useAccent();
  return (
    <AppText accessibilityRole="header" fit bold size="caption" color={accent} style={styles.groupHeading}>
      {children}
    </AppText>
  );
}

type QuietLinkProps = {
  label: string;
  onPress: () => void;
  /** An icon before the words, such as the info icon. */
  icon?: 'information-circle-outline';
  /** On a label line: its 44pt target overlaps the space around the line instead of making it taller. */
  inline?: boolean;
  accessibilityLabel?: string;
  /** Whether what it shows or hides is showing. */
  expanded?: boolean;
  /** Not yet, such as "Send again in 42 s": muted and does nothing. */
  disabled?: boolean;
  testID?: string;
};

/** A small action in a row: words only, so it never competes with the screen's one button. */
export function QuietLink({ label, onPress, icon, inline = false, accessibilityLabel, expanded, disabled = false, testID }: QuietLinkProps) {
  const accent = useAccent();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled } : undefined}
      aria-expanded={expanded}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.link, icon && styles.linkWithIcon, inline && styles.linkInline, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={Space.l + Space.xs} color={accent} aria-hidden /> : null}
      <AppText fit size="caption" color={disabled ? Colors.textMuted : accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

type StepButtonProps = { icon: 'add-outline' | 'remove-outline'; label: string; disabled?: boolean; onPress: () => void };

/** − or + beside a value, such as a month. */
export function StepButton({ icon, label, disabled = false, onPress }: StepButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.disabled]}>
      <Ionicons name={icon} size={ICON} color={Colors.primaryDark} aria-hidden />
    </Pressable>
  );
}

/** "True as of May 2026", a month at a time. Never later than this month. */
export function MonthStepper({ value, onChange, testID }: { value: string; onChange: (value: string) => void; testID?: string }) {
  const latest = monthOf(new Date());
  return (
    <View testID={testID} style={styles.monthBlock}>
      <AppText fit muted size="caption">
        True as of
      </AppText>
      <View style={styles.month}>
        <StepButton icon="remove-outline" label="A month earlier" onPress={() => onChange(addMonths(value, -1))} />
        <AppText
          fit
          center
          accessibilityLabel={`True as of ${asOfLabel(value)}`}
          accessibilityLiveRegion="polite"
          color={Colors.primaryDark}
          style={styles.monthText}>
          {asOfLabel(value)}
        </AppText>
        <StepButton icon="add-outline" label="A month later" disabled={value >= latest} onPress={() => onChange(addMonths(value, 1))} />
      </View>
    </View>
  );
}

/** A calm note, such as what is still needed. Never red. */
export function Notice({ children }: { children: ReactNode }) {
  const accent = useAccent();
  const compact = useCompact();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, compact && styles.noticeCompact]}>
      <Ionicons name="information-circle-outline" size={ICON} color={accent} aria-hidden />
      <AppText style={styles.noticeText}>{children}</AppText>
    </View>
  );
}

type RowProps = {
  label: string;
  value?: string;
  /** Makes the row a button with a chevron. */
  onPress?: () => void;
  testID?: string;
  /** A control on the right, in place of a value. */
  children?: ReactNode;
};

/** One line of a settings list: a label, then a value or a control. No box, just a hairline. */
export function Row({ label, value, onPress, testID, children }: RowProps) {
  const content = (
    <>
      <AppText fit style={styles.rowLabel}>
        {label}
      </AppText>
      {children ??
        (value ? (
          <AppText fit muted style={styles.rowValue}>
            {value}
          </AppText>
        ) : null)}
      {onPress ? <Ionicons name="chevron-forward" size={ICON} color={Colors.textMuted} aria-hidden /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    width: '100%',
    alignSelf: 'center',
    gap: Space.xs,
    paddingHorizontal: GUTTER,
    paddingBottom: Space.m,
  },
  content: {
    flexGrow: 1,
    gap: Space.l,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
  },
  footer: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: GUTTER,
    paddingTop: Space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: COMPACT_TAP,
    paddingRight: Space.m,
    marginLeft: -Space.xs,
    borderRadius: RADIUS,
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  field: {
    gap: Space.s,
  },
  fieldCompact: {
    gap: Space.xs,
  },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  fieldLabelText: {
    flex: 1,
  },
  input: {
    minHeight: 56,
    paddingHorizontal: Space.l,
    paddingVertical: Space.m,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.surface,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  inputCompact: {
    minHeight: COMPACT_TAP,
    paddingHorizontal: Space.m,
    paddingVertical: Space.s,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inputLines: {
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  formBlock: {
    gap: Space.s,
  },
  formGroup: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  formRows: {
    marginBottom: -StyleSheet.hairlineWidth,
  },
  formRow: {
    marginLeft: Space.l,
    paddingRight: Space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  formRowFocused: {
    borderBottomColor: Colors.primary,
  },
  joined: {
    borderBottomWidth: 0,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: COMPACT_TAP + Space.xs,
    marginLeft: Space.l,
    paddingRight: Space.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  addRowPressed: {
    opacity: 0.6,
  },
  labelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
    minHeight: ROW_LABEL,
  },
  labelText: {
    flex: 1,
  },
  formCell: {
    marginLeft: Space.l,
    paddingRight: Space.l,
    paddingVertical: Space.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  formCellFlush: {
    paddingVertical: 0,
  },
  formLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s,
  },
  formLabel: {
    position: 'absolute',
    top: Space.s,
    left: 0,
    right: Space.l,
  },
  formInput: {
    flex: 1,
    minWidth: 0,
    paddingBottom: Space.s,
    paddingHorizontal: 0,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  fieldNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingBottom: Space.s,
  },
  groupHeading: {
    paddingHorizontal: Space.l,
  },
  tag: {
    paddingHorizontal: Space.s,
    paddingVertical: 2,
    borderRadius: Space.s,
    backgroundColor: Colors.surface,
  },
  link: {
    minWidth: COMPACT_TAP,
    minHeight: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xs,
    borderRadius: RADIUS,
  },
  linkWithIcon: {
    flexDirection: 'row',
    gap: Space.xs,
  },
  linkInline: {
    marginVertical: -(COMPACT_TAP - ROW_LABEL) / 2,
    marginRight: -Space.xs,
  },
  count: {
    alignSelf: 'flex-end',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    padding: Space.l,
    borderRadius: RADIUS,
    backgroundColor: Colors.surface,
  },
  noticeCompact: {
    padding: Space.m,
  },
  noticeText: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    flexShrink: 1,
    maxWidth: '50%',
  },
  step: {
    width: COMPACT_TAP,
    height: COMPACT_TAP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS,
    backgroundColor: Colors.skySoft,
  },
  stepPressed: {
    backgroundColor: Colors.sky,
  },
  disabled: {
    opacity: 0.4,
  },
  monthBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.m,
    minHeight: COMPACT_TAP,
    paddingVertical: Space.xs,
  },
  month: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  monthText: {
    flex: 1,
  },
});

/** The word typed to confirm something that can't be undone. */
export const CONFIRM_WORD = 'delete';

type TypeToConfirmProps = {
  /** The button's words, such as "Delete June permanently". */
  label: string;
  busy?: boolean;
  onConfirm: () => void;
  testID?: string;
};

/**
 * The deliberate second step before anything is deleted for good: the caregiver types "delete", and
 * only then does the button work. Never just an OK. Used by Delete permanently and Delete account.
 */
export function TypeToConfirm({ label, busy = false, onConfirm, testID }: TypeToConfirmProps) {
  const [typed, setTyped] = useState('');
  const ready = typed.trim().toLowerCase() === CONFIRM_WORD;
  return (
    <>
      <Field
        testID={testID ? `${testID}-word` : undefined}
        label={`Type “${CONFIRM_WORD}” to confirm`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        count={false}
      />
      <BigButton
        testID={testID}
        label={busy ? 'Deleting…' : label}
        primary
        disabled={!ready || busy}
        accessibilityHint={ready ? 'Deletes it for good.' : `Type “${CONFIRM_WORD}” first.`}
        onPress={onConfirm}
      />
    </>
  );
}
