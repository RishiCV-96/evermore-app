# The Family board as its own destination

Written 2026-11-18 on `family-board-tab` (from `main` at `b025124`), before any code. The brief came with a concept image of two phones: the person's read-only board and the caregiver's editable one. This plan says how the app gets there, and where the brief meets a rule or the code and which way each call went. The brief asked for an unattended run, so every call is the one that seemed most sensible and is noted for the owner.

## 1. Navigation

**Caregiver: a sixth tab.** The dashboard already has a bottom tab bar (`src/components/tabs.tsx`, five tabs in `src/lib/caregiver-tabs.ts`). The board joins it between People and Settings: Today, Trends, Insights, People, **Board**, Settings.

- The tab's label is **Board**. "Family board" can't sit in a sixth of a 375pt screen: the fit rule (`tabShrink`, checked in `scripts/check-logic.mjs`) would shrink it to about 60%, under the app's 70% floor. The page itself is titled "Family board".
- **Fitting six tabs.** Labels go from 12 to 11pt, the size of iOS's own tab labels, and the bar's side padding goes. "Settings" then fits at full size on every iPhone from 375pt, and stays above 70% at the largest caregiver text scale even on the 320pt iPhone SE (1st generation), which React Native 0.88 still supports (iOS 15.1).
- **The bar's look:**
  - a hairline top border in place of the floating shadow;
  - the chosen tab marked by a short Rose bar at its top edge, with its icon and label in Deep Rose;
  - every unchosen tab in muted Ink, the Insights brain included (it was always pink);
  - a light haptic on each press, and the caregiver's interruptible Reanimated press (`Pressed`).
- **Rose is never text or an icon.** It is 3.2:1 on white, and `check-logic` refuses Rose text or icons. So "Rose for the active tab" is the Rose bar, and the icon and label are Deep Rose (5.2:1).
- **The board tab's header.** The tab has its own header: the flower mark, "Family board" (display), "Notes from the people who love you." and a **Caregiver** chip (Deep Rose on the palest rose, 4.7:1). It replaces the compact header the other tabs share, so the title isn't shown twice. There is no back link.
- **Settings.** The Family board sheet goes from Settings → The person's phone. One quiet row stays there ("Family board", "Now its own tab") and jumps to the Board tab.

**Person: a read-only board screen.** A new route, `src/app/board.tsx`, in the person's group. It fades in like the home and practice, so there is no new motion.

- **View dashboard opens it,** on every phone: sign-in off and the person's own signed-in phone alike. It replaces the 2026-11-18 rule that hid View dashboard on the person's own phone: the button no longer leads to the caregiver's dashboard, so there is nothing to hide.
- **The way back** is a **Back to home** button, 64pt and labeled, pinned at the bottom of the screen where it is always in reach.

**Screen budget.** The budget was 8 screens, all used, and the board was a sheet. A tab counts as a screen, as Insights did on 2026-11-10, so this is a deliberate change made at the owner's request: **9. Family board** (the caregiver's tab and the person's read-only screen, one screen shown two ways). CLAUDE.md and DESIGN.md record it.

## 2. Data

**The author columns already exist, so nothing is added.** `public.family_notes` has had nullable `from_name` and `from_relationship` since it was made, each 1 to 40 letters (a check). The app keeps them as `fromName` and `fromRelationship`, the export as `from` and `relationship`, and the cards already show them. Adding `author_name` and `author_relation` beside them would make two columns for one fact, which could disagree. So:

- **No schema change on this branch.** `docs/SQL-TO-RUN.md` gives the SQL that is still pending from `main`: the whole `supabase/schema.sql`, which creates `family_notes` with these columns. It also gives a query to confirm the columns are there.
- **No cache bump (`tandem.board.v1`) and no export version bump (`EXPORT_FORMAT` 2).** What they hold doesn't change. A new cache key would also leave the person's phone with an empty board offline after the update, until it next reached the server. `shownFirst` stays.
- **New: the last author is remembered.** The Add note sheet fills in From and Relationship with what the caregiver last saved. Both stay editable, optional and 40 letters each. They are kept in AsyncStorage on the caregiver's phone, `tandem.boardAuthor.v1.<caregiver id>` (`.local` with sign-in off). It is forgotten at sign-out and never sent. It is named in `docs/DATA-INVENTORY.md`. The privacy policy's words don't change: the board's From name is already described, and this is a copy on the phone of something the caregiver typed.

## 3. Where the brief conflicts with the code or the rules, and the call made

| The brief | The rule or the code | The call |
| --- | --- | --- |
| TODAY rows from "the existing reminders for today", on both sides | There is one reminder: the person's daily practice reminder ("Your practice is ready whenever you are."), set and kept on the person's phone only. "No caregiver screen mentions them." There are no titled events like the concept image's | **Person:** one TODAY row, "Practice reminder" with its time, while the reminder is on, allowed and today's practice isn't done. A tap opens the Reminders view in the Aa sheet. **Caregiver:** no TODAY section, ever. The brief already allows hiding it when there is nothing to show |
| `author_name`, `author_relation` columns, a v2 cache, export v3 | They exist as `from_name`, `from_relationship` | See section 2 |
| A sun tint for the pinned note on the caregiver's board | "Sun only behind the filled-in name" (the brand rule) | Done as asked, on the caregiver's side only. The brand rule now lists this one exception. The person's side stays free of yellow (checked) |
| A tilt of about 1° on caregiver cards | The no-rotation rule is for the person's screens | Done on the caregiver's side only, ±0.4° to ±1° from the note's id. Never on the person's (checked) |
| Rose for the active tab | Rose is never text or an icon (3.2:1) | A Rose bar marks the chosen tab; its icon and label are Deep Rose |
| A "Family board" tab label | Six tabs at 375pt | The label "Board"; the page says "Family board" |
| A text-size "Aa" control with three steps | The person already has Aa with four sizes (and their Reminders) | Reused as it is |
| "Hold to open" goes to the caregiver side | Reuse the existing hold | `CaregiverButton`, labelled "Hold to open". With sign-in off it opens the dashboard; on the person's own phone it signs that phone out (after a confirmation) so the caregiver can sign in. That phone has no caregiver side of its own. The home keeps its own Caregiver hold too: taking it away would hide a way in the caregiver already knows |
| The "View dashboard" label on a button that opens the board | The words don't say where it goes | Kept as asked, in one constant (`HOME_BOARD_BUTTON` in `src/config/brand.ts`), so it is one edit to change. Flagged for the owner |
| Two equal buttons, both 72pt | Start practice was 72pt, View dashboard 64pt | Both 72pt, the same radius and type size. They still differ by lightness (7.56:1), icon and words |
| Read aloud 56pt "using hitSlop" | | On the person's screen it is drawn 56pt tall, so it needs no hitSlop. The caregiver's pill is 36pt drawn with hitSlop to 44pt, their minimum |
| A fourth note refused with a friendly message | Add note was disabled when full | Add note stays tappable. When the board is full it says, just above the button, "3 of 3 notes. Delete one to add another." The database still refuses a fourth |
| The concept image's people | No real names | The image's names appear nowhere. The form's placeholders and the tests' sample notes, which used names like the image's, now use the fictional sample people (Mae, Ruth, Leo) |

## 4. The caregiver's board (right-hand phone)

`src/components/family-board-tab.tsx`, the caregiver's alone. The pinks are allowed there and nothing on the person's side imports it.

- **The header:** the mark, "Family board", the subtitle, and the Caregiver chip.
- **NOTES:** a small label, letter-spaced, in muted Ink. It is uppercased on screen only (`textTransform`), so screen readers and the capitalization check read "Notes".
- **Cards:**
  - Radius 20, padding 16, and inner radii worked out from the card's (concentric).
  - Fills: the sun tint (`accentSoft`) for the pinned note; the others alternate the rose tint (`pink1`) and the Sky tint (`softSuccess`).
  - "Pinned" with a pin.
  - The note in a large semibold size.
  - Then an initials circle in the card's own deeper tone, the name and relationship on two lines, and a white **Read aloud** pill.
  - A "···" menu (Edit, Pin to top or Unpin, Delete), with Delete confirmed.
  - The tilt comes from the note's id.
  - A tap on a card opens Edit, with the caregiver's press.
- **Add note:** a floating Ink pill, "+ Add note", above the tab bar. It opens a sheet with Note (the 200 counter), then From and Relationship, filled in with the last author.
- **Limits unchanged:** 3 notes, 200 letters, one pin.

## 5. The person's board (left-hand phone)

`src/app/board.tsx` with `src/components/family-board.tsx`: no pink, red or yellow, no tilt, shadow, gradient or new motion.

- **The top row:** Aa (left) and the hold-to-open lock (right).
- **The header:** the mark, "Family board" and the subtitle.
- **TODAY:** the reminder row (section 3).
- **NOTES:**
  - Mist and Sky-tint cards with a hairline Ink outline; the pinned one also has a 2pt Ink outline and "Pinned".
  - Initials and names.
  - A Read aloud button 56pt tall that uses the app's voice.
- **The end of the page:** "View only. New notes from family appear here."
- **With no notes:** only "No notes yet. Your family can leave notes here."
- **Back to home**, at the bottom.
- **Fresh notes:** the notes come from the phone's copy, then the server, and refresh on opening and on coming back to the app.

## 6. Checks

- **`scripts/check-board.mjs`:**
  - the person's files (home, buttons, board screen, cards) have none of the banned looks;
  - the caregiver's board has its tilt, pastels and chip, and the person's side never imports it;
  - both home buttons are 72pt;
  - View dashboard shows on every phone and goes to `/board`;
  - the board is gone from the home and from Settings (a row jumps to the tab);
  - TODAY comes only from the person's own reminder;
  - the empty state;
  - the last author is remembered and forgotten at sign-out.

  Each new look check is shown to fail on a planted fault.
- **`scripts/check-logic.mjs`:**
  - six tabs and their fit;
  - the person's import walk starts at `src/app/board.tsx` too;
  - the caregiver's board file is allowed the pinks;
  - the logo's new board place;
  - the home's order.
- **`scripts/check-brand.mjs`:** the button label comes from `brand.ts`.
- **`scripts/check-privacy.mjs`:** follows `docs/DATA-INVENTORY.md`.
- **`.easignore`** gains the new screenshots folder (check-store refuses screenshots in an upload).
