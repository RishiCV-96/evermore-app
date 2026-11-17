# Evermore UI brief

The visual contract for the redesign of 2026-11-03. It says what each reference screenshot lends to Evermore, and the design system every screen follows. The product rules in `CLAUDE.md` come first: where a reference conflicts with them, the rule wins.

The standard is restraint: calm, spacious, sleek. One focal point and one primary action per screen. When something looks busy, boxy, crowded or inconsistent, remove it.

## The references and the screens they inform

The references are used for layout, structure and feel only. No brand names, logos, wordmarks, mascots or artwork are copied, and the people in them are not described.

| Ref | What it shows | Evermore screens it informs |
| --- | --- | --- |
| 1 | The updated Evermore wordmark | The palette. The logo on sign-in, the person's home and the dashboard header. |
| 2 | The updated Evermore app icon | The palette. The mark on the wrap-up. The app icon and splash already use it. |
| 3 | A picture-choice question: picture tiles with captions, then a soft success banner with one wide button | **Deck of cards**: people shown as picture cards (dashboard People tab). **Questioning**: big answer choices and the success banner (screen 3). |
| 4 | One short message centered on an empty page, one wide button at the bottom | **Deck of cards**: one card as the hero on a quiet page (practice card, story approval). Also the person's home (screen 2) and the wrap-up (screen 7). |
| 5 | Fill in the missing word: a picture, a sentence with an underlined blank, a success banner that shows the whole sentence, one wide button | **Questioning**: the practice card (screen 3): sentence, blank, hint and success. |
| 6 | An activity dashboard: tabs with an underline, rows with slim bars and direct labels, lots of padding | **Caregiver dashboard** (screen 4). |

## (a) Caregiver dashboard, from reference 6

| | Borrowed | Evermore version |
| --- | --- | --- |
| Layout | A header, then text tabs with an underline under the active one. Each tab is one page. | A compact header: the logo's mark (32pt) and the tab's name in the title size, on a hairline (the large wordmark until 2026-11-10). Since 2026-11-10 a tab bar pinned at the bottom: **Today, Trends, Insights, People, Settings**, each an Ionicons icon (a drawn pink brain for Insights) over a 12pt label, a full fifth of the width and 52pt tall, the chosen one in bold on a soft pill (pink for Insights, `surface` otherwise). Labels fit on one line from 375pt up and shrink no further than 70% at 320pt and the largest caregiver text scale. |
| Proportions | The summary takes the top of the page; detail sits below it. | The Today tab opens on one hero number: today's completion. |
| Spacing | Wide padding and clear gaps between groups. | 24 between groups, 8 to 12 inside a group, 24 side margins. |
| Card style | Content sits on the page, divided by space and hairlines rather than boxes. | No panels and no boxes inside boxes. Settings are a plain list with hairline dividers. |
| Buttons | Few, quiet controls. | At most one filled button per tab (**Add a person** on People). Settings are rows. |
| Rows | List rows with the value at the end, divided by hairlines. | The supporting figures are rows: label on the left, figure on the right. "Times practiced this week" is a compact table of names and counts, three to a row (bars didn't fit beside the calendar on a small phone). |
| Charts | Minimal chart furniture. | Bars with direct labels and one dashed goal line, no other gridlines. The 30-day calendar uses three neutral levels with direct legend labels. |
| Typography | Bold headings, regular rows, bold figures. | Figures in bold dark blue. Labels on one line. |
| Grouping | Summary, then detail. | **Today**: the hero figure, three rows (sessions, average session, average day over 4 weeks), the 7-day chart. **Trends**: the 30-day calendar, times practiced. **People**: the deck as picture cards. **Settings**: a list. On phones shorter than 700pt the header drops the logo to give the tabs its room. |
| Empty space | Generous around the main figure. | The hero number has the top of the page to itself. |
| Not borrowed | Red and green correctness bars, per-question results, filters. | Completion only, never correctness. Every chart and the page footer say "Practice activity, not a medical measure." |

## (b) Deck of cards, from references 3 and 4

| | Borrowed | Evermore version |
| --- | --- | --- |
| Layout | One hero in the middle of a quiet page (4). Tiles in a grid (3). | Practice and story approval show one card at a time: the photo, whole, as the hero. The People tab shows the deck as a 3-column grid of picture cards. |
| Proportions | The hero takes most of the height. | The photo takes the height the sentence and answers leave, up to its own shape. Photo and sentence stay together at the top; spare space sits above the answers. |
| Card style | Clean rounded tiles, picture first, caption below. | Photo with rounded corners (the one radius), no outline, no shadow. Name and relationship below it. |
| Background | Plain white, nothing behind the hero. | White page. Nothing decorative. |
| Buttons | One wide button at the bottom (4). | One full-width primary button at the bottom of each person screen. |
| Empty space | Lots of it above and below the hero (4). | The person's home centers the logo, the greeting and the progress in open space. |

## (c) Questioning, from references 3 and 5

| | Borrowed | Evermore version |
| --- | --- | --- |
| Top bar | A small exit control at the left and a slim rounded progress bar filling the rest. | A Home icon (not an X, which can read as "wrong") and a slim progress bar with no numbers on it. |
| Instruction | A short instruction near the question. | "Choose a name", small and quiet, right above the names. |
| Question | A sentence with an underlined blank. | The story sentence, large, with the blank as a line. The photo above it. |
| Answer choices | Big tappable choices. | Up to 3 names as full-width, 64pt-tall, rounded buttons in the soft surface color. No outlines and no raised edge. |
| Hint | (none in the references) | A soft yellow panel in the instruction's place, with a bulb icon. No border. |
| Success | A soft banner rises from the bottom, edge to edge, with a short message and one wide button; the whole sentence is shown. | A sage banner rises from the bottom: a heart, "Yes, that's June." and one full-width button (**Next story** or **Finish**), ready at once. The blank fills in with the name, highlighted. |
| Not borrowed | Hearts or lives, points, streaks, praise words like "Excellent!", sound effects, the X. | No red, no "wrong", no scores or streaks. Every card ends on a success. |

## Design system

### Palette

**Superseded 2026-11-16** by "The Tandem brand" at the end of this file: the palette below is the old logo's, kept as a record.

All colors live in `src/theme/colors.ts` and come from the logo. There is no red anywhere, and no tan, beige or cream.

| Role | Hex | From the logo | Used for |
| --- | --- | --- | --- |
| primary | `#3E6FB0` | letters and claw | filled buttons, progress fill, chart bars, "goal met" days |
| primaryDark | `#2B5791` | the blue, darker | pressed buttons, figures, links |
| accent | `#FFD93B` | orb | fills only, never text |
| background | `#FFFFFF` | | every page |
| surface | `#EAF5FC` | sky, at a quarter | answer buttons, quiet buttons, fields, notices, "no practice" days |
| text | `#1C2F4D` | the blue, near black | all body text |
| textMuted | `#4D5D76` | the blue, grayed | captions and secondary text |
| softSuccess | `#D8E6CA` | orb halo (sage) | the success banner |

Derived from those: `onPrimary` white; `sky` `#A9D8F5` (the logo background: "some practice" days); `skySoft` `#D3E9F8` (progress tracks, pressed surfaces); `accentSoft` `#FFEEA7` (the logo's orb squiggle: hint panel, filled-in name); `onSoftSuccess` `#2F5A2A` (text on the success banner); `divider` `#D3E0EC`.

Contrast (`scripts/check-logic.mjs` checks every text pairing):

| Text | On | Ratio |
| --- | --- | --- |
| text | background / surface | 13.4 / 12.1 |
| textMuted | background / surface | 6.7 / 6.0 |
| white | primary / primaryDark | 5.1 / 7.3 |
| primaryDark | background / surface | 7.3 / 6.6 |
| text | accent / accentSoft | 9.8 / 11.5 |
| text / onSoftSuccess | softSuccess | 10.3 / 6.2 |
| text | sky | 8.9 |

**Logo colors that fail as text** (on white): sky 1.5, yellow 1.4, sage 1.3, pinks 1.3 to 2.2. They are used only as fills behind dark text, so no darker shade is needed unless you want one of them as a text color. Muted text on sky is 4.4, so text on sky is always the full text color. White on the logo blue is 5.1:1: it passes 4.5:1 but not 7:1. If you want 7:1 on buttons too, `primaryDark` is the darker shade. The pinks stay off every person screen, where they would sit too close to red; since 2026-11-10 they are the Insights accent and the Memory score's color on the caregiver's Insights tab (below).

### The Insights pinks (2026-11-10)

The one deliberate addition to the palette. Sampled from the logo's brain (`assets/images/logo-mark.png`: fill `#EED9EB`, outline `#FFB8D2`, folds `#F192B6`, all at a hue of about 337°), then extended light and deep at the same rose hue. **Since the Insights redesign of 2026-11-10 pink is the Insights brand accent, not only the Memory score's color** (this supersedes "used only for the Memory score"): the Insights tab's brain icon and chosen state, the page header and segmented controls, chart colors (pink first, `primary` blue for a second series), card accents and the soft tint behind the hero, as well as the score's ring, line, calendar shading and key. Text and surfaces stay neutral, so the page stays clean. Soft rose only: lower scores are lighter, higher deeper, so a low day never looks like a warning. **Never on a person's screen**: `scripts/check-logic.mjs` allows them only in the Insights files (`insight*`, `score-*`, `day-sheet`) and the dashboard that hosts the tab, follows every import from the person's screens to make sure none is reached, and fails if any pink is outside the rose hues (325° to 345°) or anything in the palette is red. (The tokens were `scorePink*` until this change.)

| Token | Hex | Used for | Text on it | Marks on it |
| --- | --- | --- | --- | --- |
| pinkTint | `#FFF0F5` | the hero card, the segmented track, the chosen tab's pill, the score chart's Building band | text 12.2, textMuted 6.1, pinkInk 5.4 | pinkInk 5.4 |
| pink1 | `#FFE1EC` | the ring's track; Getting started (calendar, key); the chart's Steady band; the brain filled when chosen | text 11.0, textMuted 5.5, pinkInk 4.9 | pinkInk 4.9, text 11.0 |
| pink2 | `#FFB8D2` | Building; "On a second try"; the chart's Strong band; a partial day's bar | text 8.3 | pinkInk 3.7, text 8.3 |
| pink3 | `#F192B6` | Steady; the ring's arc for Getting started | text 6.1 | text 6.1 |
| pink4 | `#E07AA5` | Strong; the ring's arc for Building | text 4.8 | text 4.8 |
| pinkDeep | `#C4578A` | the ring's arc for Steady | | |
| pinkInk | `#A3416F` | the score's figure and line, the ring's arc for Strong, "Right away", finished days' bars, the chart callouts (white on it, 5.9), the Insights title, links and the chosen tab | on white 5.9, on surface 5.4 | |
| blueGray | `#8A9FB9` | "With help" in how answers were found: apart from both pinks in lightness (1.7:1 from pink2, 2.2:1 from pinkInk) | | |

Every text pairing is in `TEXT_PAIRS` (4.5:1) and every mark pairing in `MARK_PAIRS` (3:1), both checked.

**The score range key** (`src/components/score-key.tsx`), plain until the Insights redesign: "Memory score ranges" in the bold caption; a 12pt bar of the four band pinks with 2pt white gaps; the cutoffs in the muted caption under it; a 3pt `text` mark where random guessing would score, repeated beside the line that explains it; then one 44pt row per band (a pink dot, the name, the range muted) on hairlines, whose tap shows the band's meaning in the caption size below it. For screen readers the bar is one image whose label says every range and the chance level, and each row is a button with its expanded state. It wraps rather than shrinks at large text.

### Type

Atkinson Hyperlegible, regular and bold. One scale with 4 sizes. The **Text size** setting picks the row; Medium is the default.

| Size | Small | Medium | Large | Extra large | Used for |
| --- | --- | --- | --- | --- | --- |
| display | 34 | 40 | 44 | 48 | greeting, wrap-up heading, the dashboard's hero figure |
| title | 22 | 26 | 29 | 32 | story sentence, names, primary buttons, sheet titles |
| body | 18 | 21 | 24 | 27 | body text, rows, caregiver buttons |
| caption | 15 | 17 | 19 | 21 | notes, labels, tabs, chart labels |

The display size grows least because it is already large; body text grows most.

Very large text is for the person practicing. The caregiver's screens (everything in the `caregiver` route group: dashboard, questionnaire, story approval, and the sheets they open) use one **compact scale** and ignore the Text size setting. They still follow the phone's own accessibility text size, capped at 1.3× so layouts hold.

| Size | Compact | Used for |
| --- | --- | --- |
| display | 30 | the dashboard's hero figure |
| title | 21 | step and sheet titles |
| body | 16 | answers, rows, buttons |
| caption | 13 | helper text, field labels, tabs, chips |

Atkinson comes in regular and bold only, so "light" means regular: labels, links and values are regular, and bold is kept for titles, filled buttons and sub-group headings.

### Capitalization

**Sentence case everywhere:** section titles, category names, picker options, chips, buttons and labels. Only the first word and proper names take a capital ("Work and school", "Add a person", "User ID"). Labels and buttons have no end punctuation; help text and notices are full sentences with a period.

- **It comes from one place.** Questions, options and step titles live in `src/data/questionnaire.ts`. `choices()` makes an option's label from its value, and `scripts/check-logic.mjs` fails on anything in that file, or any `label=` or `title=` in a screen, that isn't sentence case.
- **Values are never rewritten.** What the caregiver typed is saved exactly as typed, so McDonald and DeShawn stay as they are, and an option's saved value stays lowercase because it finishes a sentence ("My mom, ______, ..."). `displayValue()` gives an all-lowercase picker or chip value a capital at the display layer only, and leaves anything with a capital alone.
- **Examples are written as they'd be typed,** because the words finish a sentence: "e.g. a nurse", "e.g. the Otters", "e.g. Ohio".
- **Keyboards.** Names and places (`properName` on a question) use `autoCapitalize="words"`. Answers that finish a sentence don't.
- **Punctuation.** Curly quotes and apostrophes, a real ellipsis (…), and "couldn’t" rather than "could not".

### Layout

- **Spacing:** 4, 8, 12, 16, 24, 32 only. Side margins 24.
- **Radius:** 16 for everything on the person's screens. A slim bar is shorter than 32, so its ends come out fully round. **The caregiver's screens have a radius scale since 2026-11-17** ("The caregiver's design system", below).
- **Borders:** none on cards, buttons or tiles. Hairline dividers in lists. Fields have a hairline edge, except on a form's soft groups, which have none.
- **Shadows:** none on the person's screens. The caregiver's screens have three hairline levels since 2026-11-17 (below).
- **Icons:** Ionicons outline style, 24pt.
- **Buttons:** full width, rounded, at least 64 tall on person screens and 44 on caregiver screens. Primary: filled blue, white label. Secondary: surface fill, text label. Quiet: label only, for low-emphasis actions such as "Forgot password?".
- **Tap targets:** at least 48 on person screens at every text size, and at least 44 on caregiver screens.
- **Progress bar:** 10 tall (4 on caregiver screens), a skySoft track and a blue fill, round ends. The fill eases to its new length.
- **Motion:** pressed controls darken and shrink to 98%. Hints and the success banner fade up in 250 ms. Each card fades in. Form steps slide in from the side the caregiver is heading, in 200 ms. A reveal card turns over in 450 ms. Nothing bounces. With Reduce Motion on, entrances are skipped and the reveal card crossfades in 250 ms.

### Fit

- Every person screen aims to fit 375x667, 390x844 and 430x932 without scrolling. The photo is the flexible part, so it gives way first, down to 80pt. Caregiver tabs aim for the same.
- Labels, buttons and headings stay on one line: `numberOfLines={1}`, `adjustsFontSizeToFit`, smallest 70%. Copy is shortened rather than wrapped. Story sentences, help text and notices may wrap.
- A scroll view remains underneath as a safety net, so nothing is ever cut off.

### Text size setting

Four levels (Small, Medium, Large, Extra large), saved on the device, applied through the type scale. It controls the person's screens only. The caregiver changes it in Settings (as "Practice text size"); the person has a small **Aa** control on their home screen. Both open the same sheet.

## Verification, 2026-11-03

Checked in the web build with headless Chrome, at 375x667, 390x844 and 430x932, and again at the heights a real iPhone leaves after its status bar and home indicator (375x647, 390x763, 430x839), at Medium and Extra large. Every screen was screenshotted and checked automatically for scrolling, one-line labels that would need more than 30% shrinking, text contrast under 4.5:1, tap targets under 48pt, and tan, beige or cream anywhere on screen. The family photos were replaced by neutral stand-ins of the same shape in every screenshot.

- **Fits without scrolling:** every screen at Medium on all three sizes, insets included; every screen at Extra large on the 390 and 430 phones.
- **Still scrolls:** at Extra large on the 375-wide phone, the hint states, Trends and People. The scroll view underneath catches them, and the hint keeps the sentence in view.
- **Contrast, targets, colors:** no text under 4.5:1, no target under 48pt, and only palette colors rendered.
- **Fixed after comparing with the references:** the wrap-up heading was too long ("All done today."); hints pushed the sentence under the answers; the 7-day labels collided at Extra large; "Approve" didn't fit beside Edit and Skip; long sheet titles; the photo floated away from its sentence; navigation's gray background; two sample portraits on peach and cream backgrounds.
- **Web is not the phone:** web truncates a one-line label where iOS shrinks it to fit, so labels were judged by how far they would shrink. Fonts, safe areas and Text size need a look in Expo Go.

## Profiles, hints and question variety (2026-11-03)

Built from the same components and tokens; no new colors, styles or screens.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Person's sheet | People tab, a tap on a picture card | A `Sheet`: the avatar and relationship, then settings-style rows (Stories, Edit details), one soft button (Practice with them now, sign-in off), the Hints checkboxes, and Remove as a quiet button at the end. |
| Add a person, two steps | Screen 5 | Step 1 is the old form with one fact: four fields and Preview stories (the one filled button). Step 2 is a step within the screen: a quiet back link, section labels in the caption style, the same fields without a letter count, and "This may change" as the large checkbox with a month stepper (− and + buttons) under it. |
| Kinds and ways to ask | Screen 6 | Each story's label adds its kind ("Story 2 of 6 · Work"). "Ways to ask" is a quiet button opening a list of large checkboxes, each phrasing in body text with its kind in a muted caption. A fact that may change says Confirm in place of Approve. |
| Card kinds | Screen 3 | Every kind keeps the card layout, photo on top: fill in the blank, the fact-first question, who-is-this with a fact, and photo only with "Who is this?". Once answered, each shows the filled-in sentence under the photo. |
| Fewer names | Screen 3 | The hint panel as before, "Let’s try with fewer names." in bold; the name just chosen leaves the list, so two remain. |
| Practice more | Screen 2 | A `Sheet`: "A mix of people" as the one filled button at the top, then "Or choose someone:" and the picture cards from the People tab. |

**Checked**, in the web build at 375x647, 390x763 and 430x839 (the heights an iPhone leaves after its insets), at Medium, Large and Extra large, with every card kind forced in turn and its hint states:

- **Fits without scrolling:** every person screen (home, each kind of card, its hints and its success, wrap-up) at Medium on all three sizes, at Large on the 375-wide phone, and at Extra large on the 390-wide phone.
- **Still scrolls, caught by the scroll view:** at Large on the 375-wide phone, the first hint on a card with a long fact (25pt). At Extra large on the 375-wide phone, the hint states as before, and most on a who-is-this card with a long fact (up to 97pt), where the photo gives way to its 80pt floor first. Caregiver forms, story approval, the person's sheet and Practice more scroll when long, as lists do.
- **Contrast, targets, colors:** no tap target under 48pt and only palette colors rendered, at every size. No one-line label would shrink more than 30%.

## Guided profile (2026-11-04)

Built from the same components and tokens; no new colors or screens.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| A step of the form | Screen 5 | The slim progress bar, "Step 2 of 7 · X% complete" with Finish later beside it, and the section title. Questions scroll below; Back and Continue stay pinned below a hairline. |
| Chips | Steps 3, 4 and 6 | Rounded like buttons, 44 tall, white on the group's soft surface, filled blue when chosen. A few short choices only. |
| Picker | Steps 1 and 2 | A form row with a chevron that opens a sheet with the options as a phone's own list: a soft group, thin dividers and a check on the chosen one, with "Something else" for the caregiver's own words. It keeps the step short where a choice has many options. |
| Quiet extras | Steps 3 and 5 | Private questions and "Anything else" wait behind a quiet button; "Other" on the hobby chips opens its field. A memory's year and photo appear once it has words. |
| Review | Step 7 | Plain lines by section, each with a quiet Edit, divided by hairlines, then "Add [name] to practice" pinned below. |
| Profile on the sheet | Person's sheet | "Profile X% complete" as a muted caption beside the avatar, and Finish profile as a soft button. |

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, each step empty and answered, with every existing screen and the practice flow:

- **Fits:** at 390x763 Medium, Basics, Work and school, and Hints. At 430x839 Medium, every step but Interests, which scrolls 85pt.
- **Scrolls:** Interests is the longest step (217pt at 390x763 Medium, 426pt at 375x647 Large), and answered steps grow as their dates, years and photos appear. Next stays pinned, so the way on is always in view.
- **Contrast, targets, colors:** no tap target under 48pt, only palette colors, and no one-line label that would shrink more than 30%.

## Compact caregiver screens (2026-11-04)

The caregiver is not the person with memory loss, so their screens are slimmer than the home screen: same palette, tokens and radius, one compact scale, no new colors.

| Piece | Where | How it looks |
| --- | --- | --- |
| Form row | Every step | A small label that stays put, the answer under it, 56 tall, with the field filling the whole row. The hairline under it and the label turn blue on focus. Placeholders start "e.g." so they can't pass for an answer. |
| Sub-groups | Every step | Related rows on one soft group: surface fill, the one radius, no border, inset hairlines between rows, 24 of whitespace between groups. A small bold heading in the darker blue over some of them (Home, Family, Favorites). |
| Quiet link | In rows | Words in the caption size with a 44pt target: Choose a photo, Remove, Add photo, Edit. |
| Pinned bar | Questionnaire | Back (quiet) and the one filled button, on a hairline. |
| Sheets and approvals | Everywhere else | The same scale and buttons; settings rows, checkboxes, chips, steppers and Picker options are all 44 tall, and story sentences on approval are body text. |

**The keyboard.** `CaregiverScreen` rides the bar above the keyboard with `KeyboardAvoidingView` (padding on both platforms, because Android apps are edge-to-edge and no longer resize), and scrolls the focused field into the space left. Sheets use the scroll view's own keyboard insets on iOS and the same view on Android.

## Percent bar, the gate and test data (2026-11-04)

No new colors or screens.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Percent bar | Every step | The slim 4pt bar shows profile completion, with "X% complete" in the caption size beside it. "3 of 7" stays by the title. |
| Continue strip | Continue, Add to practice | A 4pt strip of the logo sky along the button's bottom edge, the same percent. Decorative, so hidden from screen readers. |
| Not applicable | Required questions that can honestly have no answer | A quiet link at the end of an empty row, beside a chips label, or the last option in a Picker's list. Once marked the row says "Not applicable" with Undo. |
| Still needed | Review, under the button | A caption and one quiet link per missing item. Each jumps to its step, and Continue comes straight back. The button stays disabled at 50% opacity until nothing is missing. |
| Draft label | People tab, person's sheet | "Draft, X% complete" in the muted caption under the name, in place of the relationship. It wraps to a second line on the smallest phones rather than shrink. "Not in practice" takes the same place for someone complete and deselected. |
| Test data tag | Rows, chips, review lines, story approval | "Test data" in the muted caption on a small surface pill. |
| Clear test data | Settings, sign-in off | A settings row, shown while there is test data, behind a confirm. |

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, every existing screen and every step, empty and answered, and every field of every step with the keyboard open (75 fields, the viewport shrunk by a 291pt keyboard, so the focused field and Continue both had to be on screen):

- **Fits:** the first screen, Basics, Work and school, Family and home and Shared memories, empty, at every size. Interests fits at 430x839.
- **Scrolls:** Interests when empty (64pt at 390x763 Medium, 180pt at 375x647 Large), the hints list and the review, as lists do. Continue stays pinned.
- **Contrast, targets, colors:** no target under 48pt on person screens or 44pt on caregiver screens, only palette colors, no one-line label that would shrink more than 30%.
- **Person screens** are unchanged at every size, and the first hint on a long-fact card still scrolls 25pt at Large on the 375-wide phone.
- **Web is not the phone:** the real keyboard, and how the bar rides above it, need a check in Expo Go.

## The study session (2026-11-05)

Built from the same components and tokens. No new colors and no new screens.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Required mark | Every required question | A small bold asterisk after the label. The brief says "accent-colored": it uses `primaryDark`, because `accent` is the logo's yellow, for fills only, and is 1.4:1 on white. Screen readers say "required". |
| Legend | Top of every step of questions | "* Required", one line in the caption size, above "Facts only, please". |
| Inline note | Under a field, once touched | A small info icon and the caption size, in `textMuted`. Never red. Shown after a blur on an empty required field, a year that isn't one, or Continue with no name. |
| Today's line | Person's home, dashboard's Today | "About 8 minutes today", or "About 5 minutes left today", in the caption size. Nothing once the day is done. |
| Session length, Reveal cards | Settings | Rows that open a Picker's list, each option with a caption line under it: "About 8 minutes, about 3 per person". |
| Include in practice, Reveal cards | Person's sheet | Two checkboxes above Hints, once the profile is complete. |
| Next story | Practice card | Full color and ready the moment the right name is chosen. A tap in the first 350 ms is ignored with no change in how it looks. Never disabled, never dimmed, no countdown. It doesn't wait for a flip. |
| Keep going | Person's home | In place of Start once a card is done. |

**The reveal card.** The tile takes the photo's place: `divider` fill (the palette's nearest to gray, so it reads as "not yet"), the one radius, a 96pt "?" in `textMuted`, and "Tap to reveal" in the bold caption. At under 150pt tall, as the photo gives way, the "?" and its label sit side by side at 40pt. It turns about its middle in 450 ms, the photo already behind it, so the sentence and the names never move. `textMuted` on `divider` is checked in `TEXT_PAIRS`.

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, every step of the form, empty and answered, and every existing screen, with reveal cards at Extra large as well:

- **Fits:** at 390x763 Medium, the first screen and Basics, Work and school, Family and home and Shared memories, empty. Every person screen at all three sizes at Medium and Large, though cards are random, so a long fact's hint may still scroll as before. Each reveal card, with its label inside the tile, down to a 139pt tile at Extra large on the 375-wide phone.
- **Scrolls:** Interests (180pt at 390x763), an answered Family and home (217pt, as dates appear), the hints list, Review, Practice more, the People tab and story approval, as lists do. Back and Continue stay pinned.
- **Contrast, targets, colors:** no target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, no label that would shrink more than 30%. The chart's labels are drawn with `fill`, from the palette.
- **The keyboard, simulated:** 75 fields with the viewport shrunk by 291pt. Every focused field stayed clear of the bar, and Continue stayed on screen.
- **Web is not the phone:** the real keyboard, the flip with Reanimated running natively, and the labels sitting on fields at the phone's largest text sizes need a look in Expo Go.

## AI questions (2026-11-05)

Built from the same components and tokens, on the compact caregiver scale. No new colors and no new screens: the consent and the queue replace the person's sheet's contents, in the same `Sheet`, so nothing opens on top of it. With the flag off, none of this shows.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| New questions | Person's sheet, complete profiles only | A small heading, then "Generate new questions" as a quiet `BigButton`, "Writing new questions…" while busy. Where Generate can't be offered, one caption line says why, instead of the button. |
| Failures | Under Generate | The form's `Notice`: an info icon on `surface`, in plain words. Never red. |
| To review | Person's sheet | A `Row` with the count, like Stories. |
| AI questions | Person's sheet, and Settings | The person's opt-out is a `Checkbox` beside Reveal cards. Settings has a `Picker` row, On or Off, like Reveal cards. |
| Consent | Person's sheet, once | Title "Before you generate". The brief's sentence at body size, then two caption paragraphs, then "Agree and generate" and a quiet "Not now". |
| Queue | Person's sheet | One `FormGroup` per sentence: the sentence at body size, the facts it came from as captions ("Hobby: gardening"), then Approve, Edit and Reject on one row. |
| Edit | A sentence in the queue | The form's `Field`, three lines so the whole sentence shows, with Save and Cancel. A refused edit gets a `Notice`. |
| Flagged | A sentence in the queue | One caption line in `primaryDark`: "A fact this used has changed, so it's out of practice until you review it." |
| Reverse card | Practice card | The ordinary card. The instruction reads "Choose one", and the first-letter hint reads "It starts with G." |

**Checked** in the web build with the flag on and a mocked function, at 375x647, 390x763 and 430x839, at Medium and Large: the sheet in every state, the consent, the queue, a sentence being edited and refused, each failure, opted out, offline, and AI cards with their hints and read-backs. No target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, nothing overflowing. The queue scrolls, as lists do. Found and fixed by looking: a fact clipped in the success line, and a one-line edit box that cut the sentence off.

## Archive and restore (2026-11-09)

Built from the same components and tokens, on the compact caregiver scale. No new colors and no new screens: edit mode and the Archived people section are part of the People tab, and the archived person's details are a `Sheet`. None of it appears on a person-facing screen.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Edit mode | People tab, after a 400 ms hold on any card | A light haptic. Done (the tab's one filled button) takes Add a person's place. Each photo gets a 28pt minus badge on its top-left corner: a `primaryDark` disc on a white ring with a white minus, never red, with a 44pt target. It grows in over 150 ms and shrinks away in 120 ms; with Reduce Motion it simply appears. Done, a tap on a card or a tap anywhere else ends it. |
| Undo toast | Bottom of the dashboard | `primaryDark` with white text (7.3:1), the one radius, no shadow: "June archived." and a bold Undo with a 44pt target. Fades up in 250 ms like the success banner, or simply appears with Reduce Motion. Stays 6 seconds, 15 with a screen reader, and is read out as it appears. |
| Archive | Person's sheet | A quiet button at the end, where Remove was: "Archive June". |
| Archived people | Foot of the People tab | A row with a hairline above: "Archived people" in bold, the count muted and a chevron, 44pt tall. Folded by default, gone when nobody is archived. Opened: one caption line, then the same grid with each photo at half opacity (the photo only, so the name and relationship keep their contrast), the name muted, and a quiet Restore link under each card. No long press there. |
| Archived sheet | A tap on an archived card | Read only: the avatar, relationship and "Archived on November 9" in the muted caption, a plain Stories row with no chevron, one caption saying what is kept, then "Restore June" (filled, small) and "Delete permanently" (quiet), which asks first. |
| Today, fewer than two people | Dashboard | The form's `Notice`: "Add or restore people to start practicing." The hero stays when the day had already begun, without its minutes line. |

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion on and off: editing, the badges and how they appear, Done and tapping outside, the toast and Undo, the Archived people section folded and opened, the archived sheet, Delete's confirmation, and Today and the person's home with one person and with nobody. No target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, nothing overflowing, and every existing screen passed the same audit. Found and fixed by looking: Restore links centered under the cards instead of lined up with the names, and the bar dropping to 0% when archiving down to one person after practice had begun. Found by reading the code: a sheet that vanished instead of sliding away once its person was archived, restored or deleted.

**Web is not the phone:** the long press under a real finger, the haptic, the badges growing in with Reanimated running natively, and the toast with VoiceOver need a look in Expo Go.

## The day sheet, day by day (2026-11-10)

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Header | Day sheet | "Nov 7" in the title size between two 44pt chevron buttons in `primaryDark`, at 35% opacity at either end, then Close. `Sheet` gained a `header` slot for it. |
| Page | Day sheet | "Saturday, November 7 · Memory score" in the muted caption, the score at display size in `pinkInk` (or "No practice" in `textMuted`), the band or the calm line, the note, then the rows as before. Pages run edge to edge so a day slides out of view, not into the margin. |
| Motion | Day sheet | Pages follow the finger and settle; arrows slide. With Reduce Motion, a 250 ms crossfade and no sliding at all. |
| Selected day | Calendar | A `surface` tile behind a 2pt ring in `text`, apart from today's `primaryDark` ring; `aria-selected` for screen readers. |

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion on and off: see `HANDOFF.md`.

## Approve all (2026-11-10)

Built from the caregiver's own pieces on the compact scale; no new colors and no new screens.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Waiting for approval | Person's sheet, under Stories and Edit details | A `Row` with the count, like Stories. Gone when nothing waits. |
| Approve all | Under that row once its list has been opened this session, and at the top of the list | A small `BigButton`, "Approve all 8": soft on the sheet, filled in the list, which is its one filled button. |
| The list | The sheet's own place, titled "Waiting for approval" | A caption, then `FormGroup`s headed "5 stories", "3 new questions" and "2 need your confirmation", each item its sentence at body size with a muted caption (its kind, or the facts it came from) and, when held, why in `primaryDark`. Quiet "Open story approval" and "Back". |
| Confirmation | The sheet's own place, titled "Approve all?" | "This approves 8 for June:", the counts by kind in bold, what stays waiting and the draft line in the muted caption, a quiet "Show them", then "Approve 8" (filled) and a quiet Cancel. |
| Toast | Pinned over the sheet | The dashboard's `Toast` ("Approved 8. 2 need your confirmation." and Undo), shown through `Sheet`'s new `overlay`. |

## The Insights redesign (2026-11-10)

Insights became its own tab and was redesigned for calm and clarity. The attached references lent ideas only: a summary hero with a ring gauge, a line with a highlighted point and a value callout, rounded bars, generous card spacing (a data-usage app), and a score with its bands over time (IXL screens). Nothing of their layout, colors, type, words, icons or assets was copied. Everything is in our palette (the Insights pinks with blue as the second color), Atkinson Hyperlegible, and the compact caregiver scale.

| Piece | Where | How it looks |
| --- | --- | --- |
| Sections | Top of Insights, sticky | A segmented control on a `pinkTint` track, the chosen one white with `pinkInk` bold words: **Overview, Answers, People, Days**. It stays at the top as the page scrolls; a new section starts at the top. |
| Hero | Overview | One card on `pinkTint` (the one radius, no border): "Memory score, Today" in the muted caption; the ring; the band in a pill of its own pink; the note; two white tiles ("Cards answered", "Practice time" with "of about 7 min" or "Partial day"); "Last two weeks: Steady"; and "What is this score?" as a full-width white 44pt button with a help icon, in `pinkInk`. Fits above the fold at 375x647 with the compact header. |
| Ring | Hero, a day's sheet, a person's page | 150 to 180pt across in the hero (164 at 375, 180 at 430), 84pt elsewhere. A rounded arc from the top, clockwise, over a `pink1` track; the arc `pink3` for Getting started, `pink4` Building, `pinkDeep` Steady, `pinkInk` Strong. Short `textMuted` ticks outside at each cutoff; a 2.5pt `text` mark at the chance level with "chance" in 11pt beside it (hero only). The number at 30% of the ring in `pinkInk`, tabular, "out of 100" under it. Fills once in 700 ms, at once with Reduce Motion. Fewer than 10 cards: a dashed `pink2` ring, a dash, "Needs 10 cards, 4 to go". |
| Ranges | Under the hero, under the calendar | A slim bar of the four band pinks with the chance mark, beside a "Ranges" button (44pt, `pinkInk`, a chevron) that opens the cutoffs, the chance line and the band rows. |
| Charts | Every section | One frame for all: 140pt plot, a 26pt row above it for the callout, 12pt labels, thin `divider` gridlines, y-axes from zero in seconds or minutes with round ticks, dates under the plot (first, last and as many between as fit, "Today" at the end), reference lines dashed in `text` and named in the right margin, score bands named in the left margin. A tap highlights a day: a `pinkInk` pill with white words and a dotted line down to it; the latest day by default. "Show the numbers" lists the values. No data: a short dashed box, "Not enough cards yet". |
| How answers were found | Answers | A sentence; one 20pt rounded bar of the last 14 days (`pinkInk` right away, `pink2` on a second try, `blueGray` with help, 2pt white gaps); the chance tick and its word under the bar; three rows with a swatch, the words, the percentage in bold and the count; the chance in words; each day as a 100% column; "How to read this". |
| Answer speed | Answers | A `pinkInk` line on a 0-based axis in seconds; each person's middle time in two even columns on hairlines. |
| People | People | One row per person whose cards came up: the name in bold, "24 cards · 3.2 s" muted, a slim 8pt bar of the three ways, a chevron. A tap opens their page: the ring of their cards' score over 14 days, the three rows, their middle time, and "Open June’s profile". |
| Days | Days | The calendar, then practice time: bars in minutes, finished days `pinkInk`, partial days `pink2` with a dashed `pinkInk` edge, the standard a dashed line named at the edge, a one-line legend. |
| Calendar | Days | Each scored day shows its date (10pt) over its score (14pt bold) on its band's pink, in `text`; too few cards a dashed edge; no practice the bare date. Today's `primaryDark` ring and the selected day's `text` ring as before. Completion view unchanged. |
| What stands out, next steps | Overview | Rows on hairlines: a small `pinkInk` dot before each observation; next steps with a chevron. |

**Notes kept:** "Practice activity, not a medical measure." under the ring, under each chart, in every sheet, and once at the foot of each section.

## Insights (2026-11-09)

The caregiver's view of how practice is going, under Trends. The IXL screens it was briefed with lent ideas only (a daily score, a score over time on soft bands, next steps); nothing of their layout, colors, type, words or icons. Built from the dashboard's own pieces and tokens on the compact scale: no new colors, no boxes, hairline lists, bold headings, direct labels. Never on a person-facing screen.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Activity / Insights | Top of Trends | A two-way switch on a `surface` track; the chosen side on white in bold. 44pt each. Activity is Trends as it was, and opens first. |
| The day's score | Top of Insights | Like Today's hero: "Memory score, Today" in the caption, the score at display size in `pinkInk` with tabular numbers, the band name in bold, then the note. A "Top band" pill with a `pinkInk` star, in `pink1` with `text` (11.0:1), on a Strong day (until 2026-11-10 `primaryDark` and `accentSoft`). Then `Stat` rows: cards answered, practice time "9 min of about 8 min", with the standard's neutral words below and "Last two weeks: Steady", tagged "Early read" while small. A quiet "What is this score?". |
| What stands out, next steps | Below the score | Plain sentences, and rows with a chevron that wrap rather than shrink, on hairlines. |
| Charts | Below | `react-native-svg`. The score over 30 days on bands from white to `sky`, each named just inside its top edge in `textMuted` (in `text` on `sky`); the line and points in `primaryDark`, a gap for a day without a score. Stacks of `primary`, `sky` and `skySoft` with a dashed chance line. Answer speed as a `primary` line. Practice time as bars against a dashed standard, partial days in `sky`, the met zone a `surface` band. Direct labels sit on a white backing; each chart has a caption, a summary for screen readers and the note. |
| Calendar | Foot of Insights | Matches Trends' calendar: Monday first, the one radius. Memory score shading from `pink1` through `pink2` and `pink3` to `pink4`, all with `text` (until 2026-11-10 the blues), a dashed `textMuted` edge for too few cards, empty for no practice, a `primaryDark` ring on today. A Memory score / Completion switch; month buttons with 44pt targets; each day with records a 44pt target opening its sheet. |
| Day sheet, "What is this score?" | Sheets | The day's score or how many of the 10 cards a score needs, `Stat` rows for the cards and how they were found, practice time, and who came up. The explanation in five short paragraphs, its numbers from the constants. |
| Empty and early | Insights | "Insights begin with practice" with what will appear; "Not enough cards" with what a score needs; "Nothing stands out yet". With sign-in on, one calm `Notice`. The view fades in, or simply appears with Reduce Motion. |
| Include archived people | Top of Insights, once anyone is archived | The form's `Checkbox`, first because it changes every figure below it. Off by default. |

On screen it was "Practice score", and since 2026-11-10 it is "Memory score": sentence case, like every label.

**Checked** in the web build at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion on and off, with no data, real practice and demo data: the switch, the empty state, the score, the four charts, what stands out and next steps, the calendar's months in both modes, a day's sheet, "What is this score?" and Include archived people. No target under 44pt, no text under 4.5:1, only palette colors, nothing overflowing, and the note on every view. Found and fixed by looking: a band's name floating inside the band, the Chance and Standard labels running into the stacks and bars, the note printed twice at the foot, and the speed chart's last figure clipped at its edge.

**Web is not the phone:** the charts drawn by `react-native-svg` natively, VoiceOver reading each chart's summary, and the fade with Reduce Motion need a look in Expo Go.

## Insights with sign-in on (2026-11-10)

The same Insights, read from the server on the caregiver's phone. No new colors, components or screens, and nothing on the person's screens changes.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Last updated | Top of Insights, sign-in on only | One line in the muted caption: "Last updated today at 3:42 PM", "yesterday at 9:05 AM" or "on November 4 at 8:30 PM". No icon and no button. |
| First load | Insights, the first time on a phone | "Getting the latest practice…" in the muted caption while the first fetch runs; with no connection, the form's `Notice`: "Insights need the internet the first time they open on this phone. Please check the connection." The note stays below either. |
| Pull to refresh | Trends → Insights, sign-in on, on phones | The system's own control, its spinner in `primary`. Opening Insights fetches what is new anyway, so the web, which has no pull, needs no button. |
| Offline | Trends, sign-in on | The dashboard's own notice ("Some of this couldn’t load…") stays at the top; Activity and Insights show this phone's copy, with its Last updated line. |

**Checked** in the web build against a local stand-in for Supabase, on two browser "devices" (the person practicing, the caregiver reading), at 375x647, 390x763 and 430x839, at Medium and Large (192 checks), with every existing screen (278) and Insights view (240) again with sign-in off, and the privacy notice (30). No target under 44pt on caregiver screens or 48pt on person screens, no text under 4.5:1, only palette colors, nothing overflowing. Found by looking: Trends couldn't open offline after a restart, since the dashboard needs the family; the copy now keeps what Trends need.

**Web is not the phone:** pull to refresh, and sending in the background as the app comes back to the front, need a look on two phones.

## Sign-in (2026-11-11)

Screen 1, as steps. No new colors, components beyond the password field, or screens. The welcome and the person's sign-in use the person's large type and 48pt targets; everything past "I am a caregiver" uses the compact caregiver scale and 44pt targets. Nothing is red: every note uses the neutral `FieldNote` and `Notice`.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Welcome | Screen 1, first | Like the person's home: the wordmark (260pt) centered with "Welcome" in the title size and one muted line, then two large buttons at the bottom, **I am practicing** filled and **I am a caregiver** soft. One focal point, two clear paths. |
| Hello | Screen 1, the person | A 48pt Back, "Hello" at display size, one muted line, then User ID and Password in the person's large field style (56pt boxes, bold labels), and one large filled **Continue** pinned at the bottom, riding the keyboard. A gentle `Notice` when it doesn't work. |
| Caregiver forms | Sign in, Create an account, Check your email, Reset password | `CaregiverScreen` with Back and a title, compact fields, notes under a field once it is left or the button tapped, the one filled button pinned at the bottom, quiet links (44pt) for the rest. The consent is the form's `Checkbox`; the privacy line is a muted caption with a quiet **Privacy** link that opens the notice as a sheet. |
| Password field | Every password box | The field's label line carries **Show** / **Hide** at its end: an eye icon and the word in `primaryDark`, a 44pt target (48pt on the person's screen) that overlaps the space around the label rather than making its line taller. Hidden by default. Screen readers hear "Show password". |
| Strength hint | Under a new password | Three slim segments (4pt, `skySoft`, filling `primary` as the password grows) and one muted caption: "At least 8 characters…", "Long enough. Longer is stronger.", "Good…", "Strong.", or "Easy to guess…". Never red, never a refusal of a long password. |
| Send again | Check your email, Reset password | A quiet link that reads "Send again in 42 s" in `textMuted` and does nothing until the minute is up, then "Send the email again". The countdown is caregiver-only. |
| Signed in as | Settings, first account row | Two lines on a row's hairline: "Signed in as" in the muted caption, the email in body text, selectable and wrapping rather than shrinking. |
| Change password | Settings, a sheet | Current password, New password with the strength hint, Confirm new password, all with Show, then **Save new password**; a calm `Notice` when it changes. |

**Checked** in the web build against the Supabase stand-in on localhost, at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion off and on (`HANDOFF.md` has the numbers): every step of every flow with no target under 48pt on the person's steps or 44pt on the caregiver's, no text under 4.5:1, only palette colors, nothing red, no sideways scrolling, no page errors. Found and fixed by looking: the Show toggle's 44pt target made a password's label line taller than other fields', so the gaps between fields were uneven.

**Web is not the phone:** the keyboard riding under Continue, iOS's password autofill and "Save password" prompts, secure storage itself, and coming back from the browser after the confirmation link need a look in Expo Go.

## Pairing the person's phone (2026-11-11, removed 2026-11-16)

**Removed on 2026-11-16** with PIN pairing (`docs/PIN-REMOVAL-PLAN.md`): none of the pieces below is in the app now. "I am practicing" opens Hello, which carries "Your caregiver set this up for you." (bold, the person's body size) above the fields and the **Privacy policy** link (compact reading size, 48pt target) under them. Kept as the record.

A sheet for the caregiver and steps of screen 1 for the person, from the existing pieces and tokens. No new colors or screens. The caregiver's sheet is on the compact scale with 44pt targets; the person's steps use their own large type (the Text size setting), 48pt targets and one action each. Nothing is red: every note is the neutral `FieldNote` or `Notice`.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| Pair the person's phone | Settings, a row | A `Row` with the count as its value ("None yet", "1 phone"), opening a `Sheet`. |
| Create a PIN | The sheet, first | One line on what the person does, then **Create a PIN**, the sheet's one filled button. |
| The PIN | The sheet, once made | A soft `surface` card, the one radius: "Their PIN" in the muted caption, the six digits at the display size in bold, in two halves ("478 005") with tabular figures and 4pt spacing, "Expires in 14:59" in the muted caption, counting each second. Screen readers hear the digits one by one and the minutes left, not every second. Then "What they need" (bold caption), "Your email and this PIN." (body), one muted caption line, and **New PIN** (soft). |
| Linked | The sheet, when a phone pairs | The PIN gives way to a `Notice`: "Phone 1 is linked. You can close this." |
| Send the PIN by email | Below the PIN, between hairlines | Clearly not available: the label in `textMuted`, "Not available yet. It needs Evermore’s email to be set up first." in the muted caption, not pressable, `aria-disabled`. |
| Linked phones | The sheet, last | A bold heading, then one row per phone on hairlines: the name (body), "Paired today" and "Last seen today at 3:42 PM" (muted captions), and a quiet **Remove phone** link (44pt) at the end, which confirms first, naming the phone. "No phones are linked yet." when empty, and a caption that a User ID phone isn't listed. |
| I am practicing | Screen 1, the person | Like "Hello": a 48pt Back, "Hello" at display size, one bold-led sentence for each option, then two large buttons pinned at the bottom: **Create my account** (filled) and **Sign in** (soft). |
| Your caregiver’s email | Screen 1 | Back, the heading at title size (it wraps rather than shrinks), one muted line, a large field (bold label, 56pt box) with the email keyboard and autofill off, one large **Continue** pinned at the bottom. A calm note under the field when it is empty or isn't an email. |
| The PIN from your caregiver | Screen 1 | The same, with "It has 6 numbers.", the number pad, and the digits at the display size in bold, centered and spaced (8pt) in a taller box, easy to check against the caregiver's screen. A failure is a `Notice`: "That did not work. Please check with your caregiver." |
| You are all set | Screen 1, last | Like the welcome: the landscape logo (since the logo pass below) centered, "You are all set" at display size, "Your home is opening." muted, nothing to tap; after a second and a half, their home. If signing in can't happen, a `Notice` and one large **Try again**. |

**Checked** in the web build against the Supabase stand-in on localhost, at 375x647, 390x763 and 430x839, at Medium and Large, with Reduce Motion off and on (`HANDOFF.md` has the numbers): every step of pairing on both devices, and every existing screen, sign-in on and local-only, with no target under 48pt on the person's steps or 44pt on the caregiver's, no text under 4.5:1, only palette colors, nothing red, no sideways scrolling, no page errors. Found and fixed by looking: "Linked phones" sat indented (it had the form groups' heading), the PIN box was an ordinary field, and the disabled email row wasn't announced as unavailable on web.

**Web is not the phone:** the number pad and email keyboard, iOS not offering to save the email, and the device's own name need a look in Expo Go.

## The landscape logo (2026-11-11)

**Superseded 2026-11-16** by `<TandemLogo />` ("The Tandem brand", below). Kept as a record.

One component, `<Logo />` (`src/components/logo.tsx`), is the only way a screen shows the landscape logo (`assets/images/logo-wordmark.png`, 1200x396). It shows the file as it is: `expo-image` with `contentFit="contain"` in a box of the file's own shape (`LOGO_ASPECT`, which `scripts/check-logic.mjs` reads from the file), read as "Evermore", never recolored, cropped or stretched. To use a new logo file, replace that file and update `LOGO_ASPECT` if its shape changed; the check names the numbers.

| Size | Width (under 700pt tall) | Where | Test ID |
| --- | --- | --- | --- |
| hero | 260 (200) | the welcome | `logo-welcome` |
| home | 220 (160) | the person's home, above the greeting and Start | `logo-home` |
| form | 168 (128) | caregiver Sign in and Create an account (`CaregiverScreen`'s `logo` prop, between Back and the title); the person's Hello (after Back) | `logo-sign-in`, `logo-create-account`, `logo-person-sign-in` |

- **Never over a field.** It sits in the layout, never floating, and on a step with a field it folds away while the keyboard is up (`useKeyboardOpen` in `src/components/use-keyboard-open.ts`, which `CaregiverScreen` also uses for its pinned bar), so the fields and the button riding the keyboard keep the room.
- **Small phones.** Under 700pt tall every size takes its smaller width, and it is never wider than the screen less the gutters. The welcome, "You are all set" and the person's home have a middle that scrolls only if very large text needs it, so the primary button is never pushed off the screen.
- **Checked** in the web build against the stand-in at 320x568, 375x647 and 430x839, at Medium and Extra large (456 checks): the logo's shape, inside the screen, nothing overlapping it, above the first field, the primary button wholly on screen and below it, the smaller width under 700pt, the home's Start 64pt tall and its greeting at the person's display size, and the usual audit (48pt targets on the person's steps, 44pt on the caregiver's, contrast, palette, nothing red, no sideways scroll). The keyboard folding needs a look in Expo Go: web has no keyboard events.

## Question refinement (2026-11-11)

What the person sees changes in three places, from existing pieces and tokens. No new colors, components or screens. `docs/QUESTION-AUDIT.md` has the reasons.

| Piece | Where | How it follows the system |
| --- | --- | --- |
| The answer, at the end of the ladder | Practice card, hint panel | The same soft yellow panel and bulb: "It’s June." in bold. That name's button takes the filled blue of a selected choice (`BigButton selected`), the other stays soft. Nothing red, no "wrong", both names stay, and the tap on it ends in the usual success banner. On web the selected state shows only as the fill (React Native Web sets no `aria-selected` on a button); on the phone screen readers hear "selected", and the hint says the name. |
| A "who" card | Practice card, sentence | The fact first, then "Who is this?", so every question card ends with its question, right above the names. The same title size and layout. |
| Today you saw | Wrap-up (screen 7) | Under the heading: "Today you saw" in the muted body size, then up to 6 photos (72pt, the one radius, cover) with each name under it in the body size, centered and wrapping three to a row. Nothing to tap. Without anyone's photo, the old line ("You spent time with June and Leo.") instead. |
| Shorter sentences | Story approval, under the sentence | A muted caption, "Shorter sentences are easier to read.", only past 14 words. A guide, never a block. |
| Hints | Person's sheet | The toggles are listed in the ladder's new order, with "One at a time, in this order, then the answer itself." |

**Checked** in the web build against the stand-in at 375x647 and 430x839, Medium and Extra large (167 checks): a card's ladder reaching "It’s …" with that name's button the only one filled and still two names, no card opening with "Who is this?" before a fact, a whole day's session to the wrap-up with 2 to 6 faces and Home on screen, and the audit at each (48pt targets, contrast, palette, nothing red, no sideways scroll, no page errors).

## Settings and safe deletion (2026-11-12)

From existing pieces, compact scale, 44pt targets, no new colors.

| Piece | Where | How it looks |
| --- | --- | --- |
| Sections | Settings | A bold `primaryDark` caption heading (Account, The person’s phone, Practice, Privacy and data, About) over hairline rows, 4pt between heading and rows, the page's 16pt between sections. |
| Delete account | Settings, last | Apart: 16pt more space and a hairline above, the row, and one muted caption under it ("Deletes your family’s data for good. Archive a person instead to set them aside."). Never red. |
| Typed confirmation | Delete account, Delete permanently | What goes and where in body text; for Delete account a quiet **Export my data first**; then a field labelled `Type “delete” to confirm` and the filled button, disabled at 50% opacity until the word is typed; then a soft **Keep …** button. |
| Export my data | Settings, a sheet | Rebuilt on 2026-11-13: see "Export my data (2026-11-13)" below. |
| Waiting | Settings' Practice section; every dashboard tab | One muted caption ("Getting your practice settings…", "Getting your family’s practice…"), then, if it couldn't load, the dashboard's `Notice` with the reason and **Try again**. |

**Checked** in the web build against the stand-in (62 checks at 375x647 Medium and 430x839 Extra large with Reduce Motion, plus offline from a fresh phone and pairing), and with sign-in off (424 add-person, 28 study-day and 20 regression checks): no target under 44pt (48pt on person screens), no text under 4.5:1, nothing red, only palette colors, every control with an accessible name, no sideways scroll, no page errors.

## After the day's session (2026-11-12)

The person's home once the day's session is finished, from existing pieces: the sage `SuccessBanner` with "Nice work.", one muted line under it, "You can keep practicing, or come back in the morning.", the progress bar, and **Keep practicing** as the one large filled button (it was a soft "Practice more"), which opens the same sheet (a mix, or someone). No time, countdown or "come back at" anywhere. The wrap-up's heading is "Nice work." with the same line when the day is done. A day's Insights sheet adds an "Extra practice" row ("10 cards · 4 min") when there was any. Checked in the web build with a fake clock in New York at 375x647 Medium and 430x839 Extra large: 23:00 done, 02:00 still the same day with practice opening, 05:31 a fresh Start without a reload, and the clock set back staying on the new day (28 checks, the usual audit).

## Add a person, refined (2026-11-12)

Screen 5 and story approval, from existing pieces and tokens: no new colors, no new screens, compact scale, 44pt targets. `docs/ADD-PERSON-AUDIT.md` has why. This replaces, for the questionnaire, the rows above for "A step of the form", "Legend" (top of every step), "Not applicable" (three places), "Quiet extras" (behind a quiet button) and "Percent bar", and the first screen's photo row.

| Piece | Where | How it looks |
| --- | --- | --- |
| Header | Every step, Review too | Fixed: the 4pt bar (the profile's percent, easing as before), then one line, "Step 3 of 8 · 66% complete" in the muted caption with Finish later at its end. The step's title (title size, bold, a header) and its one-line helper (muted caption) slide in with the step, so the fixed part stays two slim lines. |
| Legend and facts-only | Under the helper | "* Required" only on steps with a required question. The facts-only line in full on the first step; on the others a quiet "Facts only" link with the info icon, whose words line up with the helper, opening the line in place. Both on one row when a step has both. |
| Column | Questionnaire and story approval | Header, content and pinned bar centered at 520pt (`CaregiverScreen narrow`, `FORM_WIDTH`); the dashboard keeps 640. |
| Card | Every step | One soft card per step, inset hairlines between questions; a heading (Home, Family, Favorites) starts another. |
| Label line | Every question | The small muted label and its asterisk; "Not applicable" (or Undo once marked) at its end in `primaryDark`, a 44pt target that overlaps the space around the line rather than making it taller (`LabelLine`, `MarkLink`). Marked, the answer reads "Not applicable" in muted text. Offered only while the question is empty. On a picker it sits clear of the chevron. |
| Follow-ups | Under an answer | "This may change", its month, a memory's year and photo: no hairline between them and their answer, one after the last (`joined`). |
| Add row | Inside the card, last | A ⊕ (`add-circle-outline`, 24pt) and the words in `primaryDark`, 48pt tall, the rows' inset (`AddRow`): Add another child, Add another pet, Marital status or situation, Add something else. |
| Photo | Step 1 | An 80pt preview, the one radius, white with a person icon until there is a photo; it is itself a button. Beside it the label line, then "Choose a photo" (or "Change photo") as a white 44pt pill in `primaryDark`, like a chip, and a quiet Remove once there is one. |
| Review | Step 8 | One card of rows, a section per row: its title in bold (the person's name with a 40pt avatar for the first), its answers as captions or "Nothing yet", and Edit. Pinned: "Still needed: a photo, one interest" (muted caption) with **What's left** at its end, then Back and **Continue · 60%**, disabled at 50% opacity with the sky strip, until 100%. |
| Approve all | Story approval, pinned | Approve all (soft) and Done (filled) side by side, each half the width: "Approve all 12", or "Approve all" at 50% opacity when nothing can be. The dashboard's `Toast` sits just above the bar: "Approved 6. 1 needs your confirmation." and Undo. |
| Resume profile | Person's sheet | The soft button, renamed from Finish profile, with one centered muted caption under it: "Picks up at step 5 of 8, Interests." |
| Motion | Each step | Slides in from the side the caregiver is heading (200 ms); with Reduce Motion it simply appears (`useReducedMotion`, checked in the walk: no animation runs). |

**Checked** in the local-only web build in headless Chrome, family photos replaced by gray stand-ins, at 375x647 and 430x839 at Medium and Extra large (the caregiver screens stay compact either way), with Reduce Motion on and off, plus 1024x800 for the column: 424 checks through a whole new person from an empty form to Approve all, and 20 on the screens around it (Settings and its list, People, a sample person's sheet, the person's home, Hints with no facts, leaving a nameless person). Each screen passed the usual audit (no sideways scroll, no target under 44pt, or 48pt on the person's home, no text under 4.5:1, nothing red, only palette colors), and the audit was shown to catch a planted red word, an off-palette color, a small target and a wide element.

- **Fits:** steps 1, 2 and 6 at both sizes; steps 3, 4 and 5 at 430x839.
- **Scrolls:** at 375x647, Work and school 17pt, Family and home 69pt, Interests about 310pt with "Other" open (120pt at 430x839), Review about 120pt; story approval as a list. The way on stays pinned.
- **The keyboard, simulated** (the viewport 291pt shorter): the field typed in and Next stayed in view.
- **Web is not the phone:** the real keyboard's Next and Done keys, the photo library, the slide with Reanimated running natively, and VoiceOver on the label lines need a look in Expo Go.

## Export my data (2026-11-13)

From existing pieces, compact scale, 44pt targets, no new colors in the app.

| Piece | How it looks |
| --- | --- |
| The sheet | One body sentence ("Make a copy of your family’s data to keep, in case anything is ever lost.") and one muted caption on personal information. Then **Data file (everything)** (filled) and **Report (PDF)** (soft), each with a one-line muted caption under it. |
| Photos | An **Include photos** checkbox, off. Ticked, a muted caption (a separate zip, as stored; photos show faces) and a soft **Photos (zip)**. |
| Working | One muted live line ("Reading card records… 2,000 so far", "Gathering photos… 3 of 12", "Preparing the file…") and a quiet **Cancel** while reading. The buttons wait meanwhile. |
| Afterwards | A calm `Notice`: ready, stopped ("Nothing was saved."), or why not with **Try again**. Offline also offers a quiet **Use this phone’s copy**, with a caption saying it may be missing newer data. |
| In Delete account | **Export my data first** swaps the same panel into the sheet, with a quiet **Back**. |
| The report (PDF) | US Letter, 36pt margins, the compact scale (title 21, section heads 16, text 13, notes 11), system sans-serif. The personal-information note first, in a `pinkTint` box with a `pink3` rule. Five figures on `surface` tiles. The Memory score chart: the Insights band fills (`background`, `pinkTint`, `pink1`, `pink2`), a `pink4` line and `pinkInk` points, band names on the left, no zero for a day without a score. How answers were found on `pinkTint`. Hairline tables (`divider`), numbers right-aligned. Section heads underlined in `pink2`. The notes last, kept together. |

**Checked** in the web build against the stand-in at 390x763 and 375x647 (32 checks): both choices, photos only once ticked, each file downloaded and read, offline's words, Try again and this phone's copy, the copy labelled incomplete, the export inside Delete account and Back, nothing wider than the page, targets at least 44, no red, no page errors. The report printed to PDF in Chrome from eight weeks of demo practice: two pages, nothing cut off.

## "I'm not sure" (2026-11-13)

From existing pieces, person scale, no new colors.

| Piece | How it looks |
| --- | --- |
| The control | A quiet `BigButton` under the names: label only, `primaryDark`, body size, 48pt tall, full width. **I’m not sure**, and **Show me** for the tap that will show the answer. Never among the names or styled like one, gone once the answer is shown and on the success banner. |
| The hint it brings | The existing hint box (`accentSoft`, bulb icon), with **That is okay. Here is a little help.** in bold in place of "Take your time." on a first hint it brought. Slides in like any hint; a plain fade with Reduce Motion. |

| A name already chosen (since 2026-11-16) | The same `BigButton`, disabled: half opacity, no color change, no red, no shake, no sound. VoiceOver says "dimmed". Once the hint says the answer, every other name is dimmed and the answer's button is shown selected. |

**Checked** in the local-only web build at 375x647, 390x763 and 430x839, at Medium, Large and Extra large, with Reduce Motion on and off: the control below the names with a 48pt target, the calm first hint, each tap to Show me and the answer, the control gone then, the right name still tapped to finish, no red, no judging words, scores or timers, nothing wider than the page.

## No-login mode

`AUTH_ENABLED` in `src/config/features.ts`, on by default since 2026-11-11; the local-only mode is `EXPO_PUBLIC_LOCAL_ONLY=1` (`npm run start:local`), for development. When it is `false`, the app opens on the person's home with no sign-in, practices the family kept on the phone (copied once from the example deck in `src/data/deck.ts`: the 7 family cards plus the two illustrated sample people), and makes no server calls. Holding **Caregiver** for a second opens the dashboard, where people can be added, edited, approved, archived and deleted on the phone. When it is `true`, the app opens on the sign-in welcome (above) until someone signs in, and works with Supabase.

## The Tandem brand (2026-11-16)

The brand guide (`brand-kit/tandem-brand-guide.png`) is the reference; `docs/BRAND-AUDIT.md` has the mapping and every contrast ratio.

**Colors** (`Brand` in `src/theme/colors.ts`):

| Name | Hex | Used for | Never |
|---|---|---|---|
| Ink | `#1F2B4D` | Headlines, body text, filled buttons (white text, 13.9:1) | |
| Mist | `#EAF3FB` | Surfaces: answer buttons, fields, notices | text |
| Sky | `#8EC5F2` | "Some practice" days, shapes | text |
| Sun | `#F7C948` | Behind the filled-in name | text |
| Rose | `#E8629C` | The score ring's arc (caregiver only) | small text, the person's screens |
| Deep Rose | `#B0467F` | Links and small accents on caregiver screens (5.2:1 on white, 4.6:1 on Mist) | the person's screens |

`primaryDark` (`#2F4A7A`, Ink lifted toward Sky) is the pressed button and the person's link color. **The progress bar** is an outline (2pt, 1.5 on caregiver screens) and a solid fill in one color: Ink on the person's screens (13.9:1 on white), Deep Rose on the caregiver's (5.2:1), from `useProgressColor()`. The success banner is a soft Sky (`#D2E8FA`) with Ink text: the brand has no green.

**The logo.** One component, `<TandemLogo size="…" />` (`src/components/tandem-logo.tsx`), drawn with `react-native-svg` from the kit's shapes. Its box is the drawing plus one lobe radius (34 kit units) on every side, its height follows the kit's proportions, and it is read as the brand name (or hidden where `decorative`).

| Size | Version | Width (small phone) | Where | Test ID |
|---|---|---|---|---|
| hero | stacked | 220 (170) | the welcome | `logo-welcome` |
| home | horizontal | 220 (170) | the person's home | `logo-home` |
| form | horizontal | 168 (152) | sign-in, Create an account, Hello | `logo-sign-in`, `logo-create-account`, `logo-person-sign-in` |
| about | horizontal | 168 | Settings, About | `logo-about` |
| header | mark | 40 | the dashboard's compact header | `logo-header` |
| wrapUp | mark | 120 (96) | the wrap-up, decorative | `logo-wrap-up` |

Every size keeps the guide's minimums (mark 24pt, lockup 140pt, clear space not counted), which `scripts/check-logic.mjs` checks. The reversed colors (`reversed`) are for Ink backgrounds; no screen has one yet. No practice card shows the logo.


## The caregiver's design system (2026-11-17)

A polish pass on the caregiver's screens (`docs/UI-POLISH-PLAN.md`). It supersedes, **for the caregiver's screens only**, "Radius: 16 for everything", "Shadows: none" and the four-size compact scale. **The person's screens keep their rules:** the one 16pt radius, no shadows, the four sizes at each Text size, and no new motion. `scripts/check-logic.mjs` walks every import from the person's screens and fails if any reaches the caregiver's depth, corners, motion or sizes, except through the three shared pieces that ask `useCompact()` first (`BigButton`, `caregiver-ui`, `Sheet`).

**Type** (`COMPACT_SCALE`): six sizes. On the person's screens `headline` falls back to body and `largeTitle` to title, so nothing there changes.

| Size | Compact | Used for |
| --- | --- | --- |
| display | 30 | hero figures |
| largeTitle | 28 | a screen's header: the dashboard's tab name, a form's title |
| title | 21 | step and sheet titles |
| headline | 17 bold | a card's or group's title, an empty state's title |
| body | 16 | rows, fields, buttons |
| caption | 13 | labels, help, row subtitles |

Every number that changes uses tabular figures (`AppText tabular`; Atkinson Hyperlegible has `tnum`, and its default digits are proportional).

**Spacing:** 4, 8, 12, 16, 24, 32 and 48 (the break before something destructive). The caregiver's side margins are 20 (`CAREGIVER_GUTTER`); the person's stay 24.

**Radius** (`Radius` in `src/theme/layout.ts`), with the concentric rule: a corner inside another, inset by some padding, is the outer radius less that padding.

| Token | Value | For |
| --- | --- | --- |
| xs | 4 | slim bars, tags, chart marks, the callout's bar |
| inner | 8 | inside a card at its 16pt padding, near its corner |
| control | 16 | standalone buttons, fields, notices, the toast (the person's one radius) |
| card | 24 | cards and grouped lists (`FormGroup`, `Card`) |
| pill | 999 | chips, the chosen tab's pill, pill buttons |

The segmented control was already concentric (a 16 track, 4 padding, 12 segments).

**Elevation** (`src/theme/elevation.ts`): `boxShadow` (the New Architecture, on iOS, Android and web), tinted with Ink, never black. Most surfaces stay flat: Mist on white needs no edge.

| Level | For |
| --- | --- |
| edge: a 1px Ink ring at 6% and two soft shadows | white on Mist or white: the chosen segment, the chosen tab's pill, chips, pill buttons |
| float: a rising shadow, 6% and 8% | the pinned bar under a form, the tab bar (each in place of its hairline) |
| lifted: a ring and an 8pt shadow at 14% | the toast |

**Motion** (`src/theme/motion.ts`): Reanimated shared values with `withTiming`, which start from where they are, so a press or toggle turns around without jumping.

| Token | For |
| --- | --- |
| press: 120ms ease-out, scale 0.97 and a tone darker | caregiver buttons and rows (`Pressed`, `src/components/pressed.tsx`; full-width rows change tone only) |
| toggle: 180ms | segments and pills |
| enter: 300ms, 8pt up and a fade, 70ms apart, at most 5 groups | a caregiver screen's first appearance (`Enter`) |

With Reduce Motion: no scale and no entrance, only the tone change. A light haptic (`expo-haptics`, already installed) on the caregiver's filled buttons only.

**Pieces** (`src/components/caregiver-ui.tsx` unless named):

- **Screen header:** `CaregiverScreen`'s title, and the dashboard's tab name, at `largeTitle`. The dashboard's header has no hairline under it.
- **Section header:** `GroupHeading`, the bold caption in the accent.
- **Grouped list:** `FormGroup` (the card radius, an optional `footnote` under it) holding `Row`s, each with an optional leading icon (20pt outline, in the accent: one color, never a rainbow), a label and a muted subtitle, then a value (tabular), a control or a chevron. In a card the hairline starts at the words, after the icon, and the press fills the row. The icon side has 2pt less padding, so the glyph, not its box, lines up (optical alignment).
- **Card surface:** `Card`.
- **Buttons:** `BigButton`. On the caregiver's screens a quiet button's words are the accent (Deep Rose; they were the person's ink-blue), and a filled button that isn't ready yet is a soft Mist button with muted words, not a faded dark one, so it reads as "not yet". It says why to screen readers, as before.
- **Text field:** `FormRow` and `Field`, the label above, never a placeholder alone; calm notes under them (`FieldNote`), never red.
- **Chosen tab:** `Tabs`' soft pill, now pill-round with the edge shadow; the bar floats.
- **Callout:** `Callout`: a 3pt accent bar beside the words, no box.
- **Empty state:** `EmptyState`: an icon on a Mist circle, a headline, one muted line, at most one action.
- **Loading:** `Skeleton`: quiet Mist rows where the content will be. Nothing moves; the words beside it are what screen readers hear.
- **Pressed:** `Pressed`, above.

**The person's touch areas:** every control drawn at 48pt (Aa, Caregiver, the practice card's Home, I'm not sure and any quiet button, Hello's Back, the privacy policy link, a sheet's Close) has a 56pt touch area through `hitSlop` (`touchSlop()` in `src/theme/layout.ts`). Nothing is drawn bigger, so no layout moves.

**Not borrowed from the article** (jakub.kr, "Details that make interfaces feel better"): `text-wrap` and font smoothing are CSS only, blur isn't cheap in React Native (and the brief rules it out), and there are no drawers to slide out.

## Add a person, polished (2026-11-17)

Five steps over the same eight sections (`DESIGN.md`, "Add a person in five steps"), on the caregiver's tokens above.

| Piece | How it looks |
| --- | --- |
| Header | As before: the 4pt bar, "Step 2 of 5 · 40% complete" (the percent in tabular figures) and Finish later. The step's title at the 28pt large title, its helper, then "* Required" and the "Facts only" link on one row (the facts-only line in full on step 1). |
| Photo | First on step 1, above the card: a 112pt preview at the card radius (24), Mist with the person's initials (Ink, the large title) once a name is typed, a person icon before; a photo gets a hairline inside its edge. Beside it the label line with Not applicable, then **Choose a photo** as a Mist pill with an images icon (12pt on the icon side, 16 on the other). Initials are for the caregiver only: practice never shows them. |
| Cards | One card per section at the card radius; a merged step titles each card with its section's name ("Work and school", "Family and home"; "Shared memories", "Hints and recognition"). |
| More details | The add row at the end of a card (⊕ and the words in Deep Rose), opening that card's less-asked questions in place. Each card opens on its own; an answered question is always shown. |
| Two to a row | Team and Show, Movie and Music, Food and Place, side by side where each half keeps at least 120pt for the answer and the phone's own text is at most 1.15×; otherwise one per row. |
| Chips | Pills; white with the edge shadow, Ink when chosen. |
| Review | One row per step (four), the first with a 40pt face at the inner radius (the photo, or initials on white). The waiting Continue is a Mist button with muted words and the percent, and the sky strip. |
| Story approval | "6 of 12 approved" in the headline size under the title (tabular). Each story a white card at the card radius with the edge shadow, in place of a hairline above it; its status line has an icon (a clock waiting, a check approved, a minus skipped) so it never rests on color. Approve, Edit, Skip and the pinned Approve all and Done are unchanged. |
| Pinned bar | Floats on a soft shadow in place of its hairline. Back is Deep Rose like every other caregiver link (it was the person's ink-blue). |

## Settings, polished (2026-11-17)

The caregiver's tokens above; nothing a row does, opens or confirms changed.

| Piece | How it looks |
| --- | --- |
| Status card | First, in place of a hero, on a Mist card: a person icon and "Signed in as" with the email, a hairline, then a phone icon (a check once set up) and "The person’s phone" over **Set up**, **Not set up yet**, or "Checking…" while the family loads. Icons and words, never color alone. Sign-in on only. |
| Sections | By how often they're used: **Practice**, **The person’s phone**, **Privacy and data**, **Account**. Each a `GroupHeading` over an inset grouped card (the card radius) of `Row`s, the rows' hairlines starting after the icon. |
| Rows | A 20pt outline icon in Deep Rose (one color), the label, a one-line muted subtitle where it helps ("Cards in a day of practice.", "Some photos start hidden behind a “?”.", "Words on the person’s screens.", "What their phone signs in with.", "A copy of your family’s data to keep."; Research use's "Optional. You can change this at any time." moved under its label), then the value (tabular) and a chevron. Pickers stay pickers: Research use writes a consent record through its list, so it doesn't become a bare switch. |
| Delete account | Alone, 48pt below the last section, in its own card: a trash icon in Ink (not the Deep Rose of the others, and never red) and the label, with its caption under the card. Its sheet, typed confirmation and Export my data first are unchanged. |
| Footer | The `about` lockup (168pt), "Tandem · Version 1.0.0" (the name from `src/config/brand.ts`, the version from the app's config), then "Practice activity, not a medical measure." |
| Entrance | The status card and sections slide up 8pt and fade in, 70ms apart; with Reduce Motion they simply appear. |
| Not here | Reminders: they live on the person's phone only (the hard rule). |
