# Add a person: audit

Written 2026-11-12, before any code changed. It covers screen 5 (the questionnaire: the quick first screen, the six steps of questions and Review), the step after it, screen 6 (story approval), and how a draft is picked up again from the person's sheet. Person-facing screens are out of scope and were not changed.

**How it was checked.** The code was read (`src/app/caregiver/add.tsx`, `src/components/questionnaire.tsx`, `src/components/caregiver-ui.tsx`, `src/components/choices.tsx`, `src/data/questionnaire.ts`, `src/lib/profile.ts`, `src/app/caregiver/review.tsx`, `src/lib/approve-all.ts`), and the flow was walked in the local-only web build in headless Chrome at 390x763 and 1024x800, adding a person called Ann from an empty form to Review. Gray stand-ins replaced the family photos.

**The rules that bound every fix.** `src/data/questionnaire.ts` stays the one source of questions. Required questions keep their asterisk. The review step's way on stays disabled until the profile is 100% complete, and **100% keeps meaning exactly what the 100% gate says**: every required question is answered or marked "Not applicable" (it decides who is in the deck, on the phone and on the server). Sentence case everywhere. Wording only from the caregiver's approved facts. Caregiver screens stay on the compact type scale.

## Findings

### 1. The header changes between the first screen and the rest

- **Seen:** the first screen shows "0% complete" with no step count; the steps after it show "Step 1 of 7 · 20% complete". Review has no Finish later.
- **Cause:** `StepLayout` prints "Step N of 7" only when `step > 0`, because the first screen is "step 0", outside the count. The percent is `0` there whenever the person isn't saved yet (`person ? profileCompletion(...) : 0`). Review was given no `onLater`.
- **Verdict: fix.** The first screen becomes **Step 1 of 8**, Review is Step 8 of 8, and every step has the same slim header: the bar, "Step N of 8 · X% complete", Finish later.

### 2. The percent: why it says 20% on an empty step and then doesn't move

- **Seen:** after typing a name on the first screen, every later step reads 20%, including steps where nothing has been filled in, and it stays at 20% from Basics through Family and home whatever is answered there.
- **Causes (three):**
  1. **Only the five required questions count,** 20% each (`profileCompletion` in `src/lib/profile.ts`). The name is one of them, so after the first screen every step shows at least 20%. The number is the whole profile's, but it sits next to "Step N", so it reads as that step's.
  2. **Four steps have no required question at all:** Basics, Work and school, Family and home, and Hints. Nothing typed on them can move the bar. The required questions are on the first screen (name, photo, relationship), Interests (one interest) and Shared memories (one shared memory).
  3. **It is computed from saved data, not from the form.** It trails typing by the 500 ms autosave, and on the first screen it is 0% until the name has been saved once.
- **Constraint:** the user asked that answered optional fields count too, but the gate needs 100% to mean "every required question done". If optional answers were part of 100%, either the short required list would quietly grow, or 100% would stop meaning complete.
- **Verdict: fix, with one defined rule.**
  - Each required question done (answered or "Not applicable") is worth **20 points**.
  - Each optional question answered adds **3 points**, up to **15**, counted only while something required is still missing.
  - So the most an incomplete profile can show is 95%, and **100% means complete, and nothing else**.
  - A question counts once however many answers it has (two children are one question), a best clue counts, and the list of hint facts doesn't (it only chooses among facts). The weights live beside the required list in `src/data/questionnaire.ts`.
  - The figure is worked out **live from the form** (the step's unsaved answers over the saved ones), so it moves as the caregiver types, on the first screen too.
  - Tests: every number above by hand, and a random check that 100% appears exactly when nothing is missing and that answering something never lowers it.

### 3. Notes that repeat on every step

- **Seen:** "* Required" and "Facts only, please: nothing medical, financial or private." are at the top of all six steps of questions, including Basics, Work and school, Family and home and Hints, which have nothing required.
- **Verdict: fix.** "* Required" only on steps with a required question (the first, Interests, Shared memories). The facts-only line in full on the first step; on later steps a small "Facts only" info link that opens the same line in place.

### 4. Controls that don't follow one pattern

| Seen | Where | Cause |
| --- | --- | --- |
| Some steps put every field in one card with dividers; others split them into separate cards | First screen ("One thing about them" alone), Work and school ("Future plans" alone), Interests ("They always say or do" alone), Shared memories (each memory its own card), Hints | `startsGroup` on those questions, each added for a local reason |
| Centered links floating below the cards | "Marital status or situation", "Add something else" | `behind` questions render as a quiet `BigButton` after all the groups |
| "Add another child" is a link in a cell; the hobbies' "Other" is a chip; the extras above are centered buttons | Family and home, Interests | Three ways to add one more |
| The photo row holds a 40pt avatar, the label, "Not applicable" and "Choose a photo" on one line; marked, it says "Not applicable" twice (as text and beside Undo) | First screen | `photoRow` packs everything into one `FormCell` |
| "Not applicable" sits in three different places | At the end of a text row (`FormRow`), on a chips question's label line (`Group`), and as the last option inside the relationship list (`Picker`) | Each control grew its own way out |

- **Verdict: fix.** One pattern for each:
  - **Field:** the label in the caption size, muted, with its asterisk, on a 56pt row; the answer under it; inset hairlines between questions on the step's one soft card. A heading (Home, Family, Favorites) is the only thing that starts another card.
  - **Follow-ups:** a fact's follow-ups ("This may change", the month, a memory's year and photo) sit directly under it with no hairline between, so they read as part of it.
  - **Add more:** a full-width row inside the card with a ⊕ icon and the words in the darker blue, the same for "Add another child", "Add another pet", "Marital status or situation" and "Add something else".
  - **Not applicable:** always at the end of the question's label line, offered only while the question is empty; once marked, the answer reads "Not applicable" and the link reads "Undo". Removed from inside the relationship list, so there is one place for it.
  - **Photo:** its own row in the card, with an 80pt preview that is itself a button, "Choose a photo" (or "Change photo") as a soft button beside it, Remove once there is one, and "Not applicable" on the label line like every other question.

### 5. Width

- **Seen:** at 1024 wide the form is centered at 640pt, but the rows run nearly 600pt for answers of a few words on the left, so the page reads as hugging the left edge of a wide card. The review's "Nothing yet" rows were padded in from the column's edge.
- **Verdict: fix.** The questionnaire and story approval center in a narrower column (520pt), header, content and the pinned bar alike. The dashboard keeps its 640.

### 6. Keyboard

- **Seen:** no field sets its return key, so on a phone "return" just closes the keyboard and the caregiver taps the next field by hand. Fields scroll themselves clear of the keyboard and the pinned bar (`CaregiverScreen`'s reveal), which works.
- **Verdict: fix.** Text fields on a step form a chain: "Next" moves to the next text field, the last one says "Done" and closes the keyboard. Pickers, chips and the number pad (year) are skipped.

### 7. Scroll length per step

Measured empty, at 390x763: only **Interests** scrolls (180pt; 91pt at 1024x800). Every other step fits. Answered steps grow as dates, years and photos appear.

- **Verdict: tighten, keep eight steps.** Interests stays one step: splitting it in two would make nine, and `people.profile_step` is checked `between 0 and 7` in `supabase/schema.sql`, so a ninth step would need a schema change and a rerun on Supabase before the app could save it. "They always say or do" joins the hobbies' card, the title moves into the scrolling part so the fixed header is two slim lines, and the notes no longer repeat, which gives each step back about 60pt.

### 8. Back and forward

- Back and Next both save first (`go` flushes the autosave), so a step's answers survive going back. Kept.
- **Lost answers found:**
  1. Words typed in the hobbies' "Other" field but not added with Add are dropped on leaving the step.
  2. Words typed in a list's "Something else" (relationship, field, known) are dropped if the list is closed without "Use this".
  3. On a new person with no name yet, a photo, relationship or first fact is dropped on Back or Finish later without a word, because nothing can be saved without a name.
- After a jump from Review to a missing item, the step's button goes straight back to Review but still says "Continue".
- **Verdict: fix all four.** The "Other" words become a chip when the field is left; closing the list keeps typed words as the answer; leaving a nameless new person with other answers asks first ("A name is needed to save this person."); and the button says "Back to review".

### 9. Empty and error states

- **Hints with no facts yet** shows the explanation and nothing under it. **Fix:** "Facts you add on earlier steps appear here."
- **Review's empty sections** float as "Nothing yet" beside each title. **Fix:** one card of rows, a section per row with Edit, "Nothing yet" muted under its title.
- **A failed save** shows its notice after the last field, below the fold on a long step. **Fix:** in the pinned bar, above the buttons.
- **Inline notes** (a required question left empty after it was touched, a name missing on Next, a year that isn't one) are already calm: an info icon and muted caption, never red. Kept.

### 10. Review's way on

- **Seen:** "Add Ann to practice", disabled below 100%, with "Still needed:" and up to four links wrapping under the button. Since 2026-11-05 a complete profile joins the deck by itself, so "Add … to practice" only means something for someone the caregiver took out of practice; for everyone else the button leads to story approval.
- **Verdict: fix.**
  - The button is **Continue**: below 100% it is disabled and shows the percent ("Continue · 60%"), at 100% it is enabled and opens story approval. Someone deselected still sees "Add Ann to practice", because that also puts them back in.
  - Above it, one line says what is still needed, with **What's left**, which opens the step of the first missing item, scrolls to that question, focuses it if it is typed, and shows its note.

### 11. Story approval (screen 6)

- **Seen:** every story needs its own Approve tap; with a full profile that is a dozen or more. Approve all exists only on the person's sheet, behind opening its list and a confirmation.
- **Verdict: add Approve all here,** matching the sheet's rule (`approvalPlan` in `src/lib/approve-all.ts`):
  - It approves the stories still waiting, in one tap, and shows the count ("Approve all 12"); disabled when there are none.
  - Skipped stories stay skipped, a story's words stay exactly as they are (edited or not), and a story open for editing is left alone.
  - **A fact that may change is never approved by it**, as on the sheet (hard rule): it keeps its Confirm, and the toast says how many still need confirming.
  - A toast with Undo for a few seconds; Undo puts back only what is still as Approve all left it.
  - No confirmation dialog: every story is on this screen, which is what the sheet's confirmation is for, and Undo covers a slip. The sheet's own Approve all is unchanged.
  - AI sentences waiting in the person's queue aren't on this screen, so this button never approves them.
  - Long sentences stay included and keep "Shorter sentences are easier to read."
  - Per-story **Approve, Edit and Skip** stay. The brief says "Reject"; the app's word is Skip (CLAUDE.md: "skipped ones never appear"), and it is gentler, so it stays.
  - Approve all and Done are pinned at the bottom, so the count stays in view while scrolling, at the same narrower width.

### 12. Picking a draft up again

- **Seen:** the person's sheet says "Draft, 20% complete" and offers "Finish profile", which opens the furthest step reached, without saying which.
- **Verdict: fix.** "Resume profile", with one line under it: "Picks up at step 5 of 8, Interests." Answers save as they are typed (autosave), so there is nothing else to restore.

### 13. Motion and accessibility

- Steps slide in from the side the caregiver is heading (200 ms). Reanimated skips layout animations under Reduce Motion by default, but nothing in the code says so, unlike every other animated component here. **Fix:** check `useReducedMotion()` explicitly, as they do.
- The bar's fill eases (400 ms) and jumps under Reduce Motion (Reanimated's default). `ProgressBar` is shared with the practice card, a person-facing screen, so it isn't changed.
- Targets are at least 44pt; labels say "required" to screen readers. **Add:** the disabled Continue says why ("Available once the profile is complete"), the photo preview is labelled as a button, and the step's title is a header inside the part that slides in.
- Extra large: the Text size setting doesn't reach caregiver screens (compact scale), and the phone's own text size is capped at 1.3×. The walk checks both settings.

## Not changed, and why

- **Eight steps, not nine** (finding 7): a ninth needs a schema change and a rerun on Supabase. **Superseded 2026-11-17:** five steps over the same eight sections, with `profile_step` still storing the section (`docs/UI-POLISH-PLAN.md`).
- **Skip stays Skip** on story approval (finding 11).
- **Approve all never approves a fact that may change, or an AI sentence,** on either screen (finding 11): the hard rule, and what's on screen.
- **The percent's 100% stays the gate's 100%** (finding 2): optional answers count, but only toward the way there.
- **`ProgressBar` and every person-facing screen** are untouched (finding 13).
- **The per-step button doesn't wait for 100%.** The required questions sit on three different steps, so a step-level gate would make the form impossible to get through. Only Review's Continue waits, as before; every other step's button is **Next**.
