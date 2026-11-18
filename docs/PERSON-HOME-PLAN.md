# The person's home: Family board and two clear buttons

Written 2026-11-18 on `person-home-board` (from `main` at `f9e8789`). Step 1 of the brief: the plan. It was written and built in one unattended run, so every choice the brief left open is recorded under **Assumed while unattended**, and anything that needs the owner is under **Needs my decision**.

**Branch state.** `sentence-grammar` is not merged into `main` and there is no `photo-privacy` branch. This branch starts from `main` regardless: its schema change is one labeled block at the end of `supabase/schema.sql`, and nothing here touches the sentence code. `main` doesn't yet have the support email or policy version 2026-11-18 (those are on `sentence-grammar`).

## 1. The person's home, in order

Practice stays first: it is the first thing after the greeting and always visible without scrolling at 375x647, Extra large text.

1. The top row, unchanged: **Aa** (text size) and the held **Caregiver** control. Both already exist (see section 10).
2. The logo, then "Hello, June." (the person's name), then one calm status line ("Your stories are ready." / "About 6 minutes today"), unchanged.
3. The progress bar and "0 of 25 cards today", unchanged.
4. **Start practice**: the primary button, Ink with white text, the largest (72pt tall), with a play icon. After the first card it reads **Keep going**; once the day's session is done, it is **Keep practicing** (Practice more), as today. It is never disabled and nothing on the board can push it off the screen.
5. **View dashboard**: the secondary button, Sky with Ink text and a 2pt Ink outline, 64pt tall, with a grid icon. See section 3 for what it opens.
6. **Family board**, below the buttons: the title "Family board" with "Notes from the people who love you." under it, then the notes (pinned first, then newest first), then a quiet "View only" line with an eye icon ("New notes from your family appear here."). With no notes the board is not shown at all.

The whole screen scrolls as one column when Extra large text needs it. The buttons come before the board, so the board never pushes them off.

## 2. Final colors and contrast

Existing tokens only. Ratios are WCAG contrast ratios, computed from the palette (`src/theme/colors.ts`) and checked by `scripts/check-board.mjs`, in normal vision and under the Machado (2009, severity 1) simulations and grayscale.

| Pair | Normal | Protanopia | Deuteranopia | Tritanopia | Grayscale | Target |
| --- | --- | --- | --- | --- | --- | --- |
| White on Ink (Start practice) | 13.90 | 13.44 | 14.18 | 13.74 | 13.90 | 7:1 |
| Ink on Sky (View dashboard) | 7.56 | 7.80 | 7.39 | 7.55 | 7.56 | 7:1 |
| Ink background vs Sky background | 7.56 | 7.80 | 7.39 | 7.55 | 7.56 | 3:1 |
| Ink outline on the white page (View dashboard's edge) | 13.90 | 13.44 | 14.18 | 13.74 | 13.90 | 3:1 |
| Ink on Mist (a note) | 12.38 | 12.09 | 12.56 | 12.26 | 12.38 | 7:1 |
| Ink on Sky tint `#D2E8FA` (the pinned note) | 11.03 | 10.93 | 11.08 | 10.94 | 11.03 | 7:1 |
| Muted `#4D5D76` on Mist (the relationship) | 5.95 | 5.80 | 6.05 | 5.91 | 5.95 | 4.5:1 |
| Muted on Sky tint | 5.30 | 5.24 | 5.34 | 5.28 | 5.30 | 4.5:1 |
| Ink on white (Read aloud) | 13.90 | | | | | 7:1 |
| Ink on Sky (initials avatar) | 7.56 | 7.80 | 7.39 | 7.55 | 7.56 | 7:1 |

Lightness (relative luminance): Ink 0.026, Sky 0.521. The two buttons differ by lightness (7.56:1), by icon (play and grid) and by label, never by color alone. Sky on the white page is only 1.84:1, so View dashboard carries the Ink outline.

Note cards: Mist for every note, and the soft Sky tint (`softSuccess`, the success banner's color) for the pinned one, which also says "Pinned" with a pin icon. Authors are told apart by initials and names, never by color. Every card has a hairline `divider` border so it holds its shape against white, and no shadow.

DESIGN-UI.md and the palette check gain one allowance: on the person's home, Sky is a button background and Mist and the Sky tint are note backgrounds. Pink, red and yellow stay banned on every person screen.

## 3. View dashboard

The person has no dashboard of their own, and the caregiver's dashboard (with Insights) must stay behind the caregiver lock. **Assumed:** View dashboard is the visible way to the caregiver's side, with a deliberate second step, never one tap:

- **Sign-in off** (one phone shared): a confirmation, "Open the caregiver dashboard? It's for your caregiver.", with **Open dashboard** and **Not now**. Open does what holding Caregiver does (`openCaregiver`).
- **Sign-in on** (the person's own phone): a sheet that says "Your caregiver's dashboard is on their phone." with **Done**. It never signs the phone out. The held Caregiver control stays the only way to switch this phone to the caregiver.

## 4. The caregiver's editor

**One place: Settings → The person's phone → Family board** (in local-only mode the section shows Family board alone). Reasons: the board is what the person's phone shows, next to Their login; Today must stay completion only (a hard rule); People is per person, and notes are for the family.

The row ("Family board", "2 of 3 notes") opens a sheet that mirrors the person's board in the caregiver's style:
- The same cards (white with a hairline border and the caregiver's hairline shadow; the pinned one in the Sky tint), each with a "…" menu: **Edit**, **Pin to top** or **Unpin**, **Delete** (with a calm confirmation).
- A gentle empty state: "No notes yet. A short note from family appears on their home screen."
- A sticky **Add note** button at the bottom, disabled with "3 of 3 notes. Delete one to add another." when full.
- The note form (swapped into the same sheet, so no sheet opens on a sheet): **Note** (a multi-line field with a live "12 of 200" counter), **From** (optional, a name, 40 letters) and **Relationship** (optional, 40 letters), labels above fields, sentence case. Guidance: "Keep it short and warm. It shows on their home screen as you write it." Validation is calm ("Write a few words first.", "A little shorter, please: 200 letters at most."). **Save** shows the note on the person's phone at its next refresh.

## 5. Card title

Two options were considered: "Family board" and "Notes from family". **Chosen: "Family board"**, with the subtitle "Notes from the people who love you." It is short at Extra large text and names a place, and the subtitle says what is in it.

## 6. Data: the table, limits and row-level security

`public.family_notes`: `id` (uuid), `caregiver_id` (the family, `default auth.uid()`, cascade from `profiles`), `body` (1 to 200 characters, trimmed), `from_name` and `from_relationship` (optional, 1 to 40), `pinned` (boolean), `created_at`, `updated_at`.

- **At most 3 notes per family**: a `before insert` trigger counts the family's notes under a per-family advisory lock and refuses a fourth (`check_violation`). The app refuses it first.
- **One pinned note**: a partial unique index on `(caregiver_id) where pinned`. Pinning another unpins the first in the app before pinning.
- **RLS**: the caregiver reads and writes only their family's notes (`caregiver_id = auth.uid()` and `is_caregiver()`); the person's login reads only its family's (`caregiver_id = my_caregiver()`) and has no write policy; `anon` has no grant; anyone else matches no policy.
- No expiry, no read receipts, no counters.

## 7. Sync, offline and local-only

- **Sign-in on**: `src/data/board-store.ts`, one small store for both roles. It keeps a copy on the phone (`tandem.board.v1.<user id>` in AsyncStorage) and opens from it at once, then fetches the family's notes. It refreshes when the person's home comes into view and when the app returns to the front, and after every caregiver change. A failed fetch (offline, or a server not yet upgraded) keeps the last notes and never touches practice.
- **Sign-in off**: the notes live in the family kept on the phone (`evermore.family.v1`, a `notes` list), written by the same pure rules (`src/lib/family-notes.ts`).

## 8. Cleanup paths

- **Delete account**: `manage-family` deletes the logins; the notes go with the caregiver's `profiles` row (cascade). Checked in PGlite.
- **Deleting a person**: notes belong to the family, not to a person, so nothing changes.
- **Sign-out**: `forget.ts` deletes the board copy for every login that signs out on the phone.
- **Export my data**: format stays 2, with a new `familyBoard` section (each note's words, From, Relationship, whether pinned, and dates), present in every export and empty when there are no notes. The report (PDF) doesn't show notes: it describes practice only.
- **Local-only**: the notes go with the family on the phone; deleting the app removes them.

## 9. Docs, privacy answers and draft policy wording

- `docs/DATA-INVENTORY.md`: the `family_notes` table and the `tandem.board.v1.<user id>` key.
- `docs/app-store-privacy-answers.md`: notes are **Other User Content** (already Yes), linked, App Functionality, not tracking.
- `scripts/check-privacy.mjs` finds storage keys starting with `tandem.` as well as the older prefix.
- The privacy policy is **not** edited. Proposed wording is under Needs my decision.

## 10. The mock's other pieces: Today, Hold to open, Aa

- **"Today" with times** (Walk with Lucy, 4:00 PM): not built. Timed items imply reminders at those times (a second notification channel beside the daily reminder, with its once-a-day rule), time zones, and something to happen when a time passes: "missed" must never be said. Cost: a new table, scheduling and its tests. Risk: urgency and pressure on the person's screen, which the rules forbid.
- **"Hold to open"**: already built. It is the existing Caregiver control at the top right (hold for a second; a tap shows "Hold to open"). Nothing new was added. A second hold gesture would be a new thing for the person to learn, so View dashboard uses a confirmation instead.
- **"Aa"**: already built. It is the existing Text size control at the top left (four sizes and Reminders). Unchanged. A larger accessibility pass (for example following the phone's own text size) would be its own feature.

## 11. Exact SQL, and when to run it

One block at the end of `supabase/schema.sql`, labeled "Family board". Safe to rerun. In each project (development, then production): **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, **Run**. Run it **before** using a build with the board in that project. A build without it keeps working (notes simply don't load and can't be saved), so the order matters only for the feature.

## 12. Tests

`scripts/check-board.mjs` (in `npm test`):
- the pure rules (limit, length, From, ordering, pinning, initials, spoken words);
- the caregiver's store adding, editing, deleting and pinning against the stand-in, and the person's store seeing each change after a refresh, keeping the last notes offline, and forgetting them at sign-out;
- a fourth note refused by the app and the stand-in;
- the person's screen free of pink, yellow, red, shadows, rotation, gradients and motion;
- the colors' contrast, in normal vision, grayscale and the three simulations, and the 56pt targets;
- Read aloud calling the app's speech with the note's words;
- export and Delete account covering notes.

Each check is shown to fail on a planted fault: a pink card, a yellow card, a rotated card, a shadow, a gradient, a fourth note, a low-contrast button and a small target.

`supabase/tests/rls.test.mjs` runs the real schema in PGlite: the caregiver reads and writes their own, another family reads and writes nothing, the person's login reads its family's and writes nothing, a signed-out user gets nothing, a fourth note and a second pin are refused, Delete account removes notes, and a rerun keeps them.

A web walk at 375x647 and 430x839, Large and Extra large text, with no notes, one note, three notes, a pinned note and a 200-character note: no clipping, targets of at least 56pt on the person's home, contrast, no sideways scroll. Screenshots before and after, and color-blind simulations.

## 13. Risks

- **Note tone (clinician review).** A note can upset as easily as comfort: a note about someone who has died, a test ("Do you remember…?"), urgency ("Call me now"), or guilt ("You forgot again"). The editor's guidance asks for short, warm words. A speech-language pathologist or dementia-care clinician should review the guidance and decide whether notes should avoid questions altogether.
- **View dashboard on the person's phone** may lead the person to a confirmation they don't understand. Sign-in off it opens the caregiver's dashboard after "Open dashboard"; sign-in on it only explains.
- **Stale notes on a phone offline for a long time**: the board shows the last notes it saw, with no "updated" time (by the rules: no counters).
- **The server not yet upgraded**: notes don't load or save until the schema runs, and the caregiver sees a calm message.

## Verification (2026-11-18)

Typecheck, lint, all 16 `npm test` suites (with the new `scripts/check-board.mjs`, 14 checks) and the production iOS export with its release and real-data checks pass. The web walk passed all 16 combinations (375x647 and 430x839, Large and Extra large, no notes, one, three with one pinned, and a 200-character note): no clipping, both main buttons at least 56pt and every other control at least 48pt drawn, contrast, Start practice on screen without scrolling, no sideways scroll, and no shadow, rotation or gradient on the person's screen. Its own audit was shown to fail on a planted clipped label, low contrast, a small target, a shadow, rotation and a gradient. The editor showed the full board with Add note waiting. Screenshots, before and after, with grayscale, protanopia, deuteranopia and tritanopia: `docs/person-home-screenshots/`.

## Assumed while unattended

1. **View dashboard** opens the caregiver's dashboard after a confirmation with sign-in off, and explains that the dashboard is on the caregiver's phone with sign-in on (section 3).
2. **The editor** lives in Settings → The person's phone (section 4).
3. **The title** is "Family board" (section 5).
4. **With no notes** the board is hidden on the person's home.
5. **Layout**: the buttons sit before the board, in one scrolling column (section 1). The Start button keeps its existing words "Keep going" and "Keep practicing" after the first card.
6. **The pinned note** uses the soft Sky tint; others use Mist.
7. **View dashboard** gets a 2pt Ink outline, because Sky alone is 1.84:1 on white.
8. **From** is two optional fields: a name and a relationship, 40 letters each. With no name, the avatar shows a heart icon and there is no From line.
9. **Read aloud** says the note, then "From Mikayla, daughter." when there is a From line.
10. **Export format stays 2**, with a `familyBoard` section always present.
11. **The storage key** is `tandem.board.v1.<user id>`: a new key takes the new name. `check-privacy` was widened to find it.
12. **Notes keep their creation order** after an edit (newest first by when they were written).
13. **The export's key for a pinned note is `shownFirst`**, not `pinned`: the export's secret-field guard refuses any key containing "pin" (from the removed PIN pairing), and weakening that guard would be worse.
14. **A phone-copy export made before the board has loaded** lists the Family board among what it may lack, like sessions.
15. **Read aloud sits on its own line under the From line** on every card, so a long name or relationship never moves it (seen in the walk).
16. **"View only" is a bold label with an eye icon** above the quiet line, as in the mock, in muted Ink (no color of its own).
17. **The caregiver's note menu opens inline** under the "…" button (it lengthens the card while open) rather than as a floating popover.
18. **Screenshots** (fictional data only) are in `docs/person-home-screenshots/`, kept out of the EAS upload by `.easignore` and checked by `scripts/check-store.mjs`.

## Needs my decision

1. **Mock versus rules on the person's screen.** The mock's pink and yellow cards, tilt, shadows and gradient title are banned there. Built instead: Mist and Sky-tint cards, straight, hairline borders, a solid Ink title. If you want more warmth, the only allowed option is the logo itself beside the title, as the home already has.
2. **View dashboard with sign-in on.** It only explains, because the person's phone can't open the caregiver's dashboard. Options: keep it; hide it with sign-in on; or make it the same switch as the held Caregiver control (which signs this phone out: risky for the person).
3. **Two ways to the caregiver** with sign-in off (View dashboard and the held Caregiver control). Proposed: keep both for now; drop one after an older person tries the home.
4. **Other look-alike buttons on person screens** (not changed):
   - Reminders, **Earlier** and **Later**: the same soft button side by side, told apart only by the word. Proposed: an arrow icon on each.
   - Welcome, **I am practicing** (filled) and **I am a caregiver** (soft): they differ in fill, but have no icons.
   - Practice more, **A mix of people** and the person tiles: different shapes, fine.
   - A card's name choices look alike on purpose (the answer can't be told from its look).
5. **Privacy policy (draft wording, not applied).** Proposed addition to "What we store": "Family board notes: up to three short notes the caregiver writes for the person's home screen, with an optional name and relationship for who it is from. Only the caregiver can write or delete them; the person's phone can only show them. They are deleted with the account." This needs a new `POLICY_VERSION`, best done in the one policy update already planned.
6. **Clinician review of note guidance** (section 13).
7. **Export format**: kept at 2 with an added section. Bump to 3 if you prefer every change of shape to have its own number.
