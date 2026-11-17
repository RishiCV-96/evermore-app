# UI polish plan

Written 2026-11-17, before any code changed. A presentation-only pass: nothing about scheduling, hints, scoring, data, consent, what is stored or what any sentence means changes. The hard rules in `CLAUDE.md` come first; where this plan conflicts with `DESIGN-UI.md`, it says so and needs approval, and `DESIGN-UI.md` is updated when a verdict changes.

**How it was checked.** I read `docs/ADD-PERSON-AUDIT.md`, `docs/SETTINGS-AUDIT.md`, `DESIGN.md`, `DESIGN-UI.md`, `docs/BRAND-AUDIT.md`, the theme files, and the brand walk's screenshots (`docs/brand-screenshots`). Add a person was measured in a local-only web build exported from a `git archive` copy (so no real photo or local deck could be in it). Photo requests were blocked, and the name typed was an invented one. Chrome, 375x647, compact caregiver scale (the caregiver's screens ignore the Text size setting, so "default" is the only caregiver size), empty form. I also read the article (jakub.kr, "Details that make interfaces feel better") and the three reference pairs.

**The brief's open fields** ("What I dislike now", "What I want it to feel like", "Things to keep", "Reference ideas I want most") were left blank. This plan works from the references and the borrow and don't-borrow lists. Filling them in may change priorities.

---

## (a) Problems, screen by screen

### Add a person (screen 5): the eight steps

Add a person is already an eight-step questionnaire (seven steps of questions, then Review), not one long form. `people.profile_step` stores the furthest step reached (0 to 7, checked in `supabase/schema.sql`), and "Resume profile" uses it ("Picks up at step 5 of 8, Interests"). So "shorter" can mean shorter steps, fewer steps, or both, and fewer steps is not presentation-only (see (d)).

**Measured, empty, 375x647** (scrollable content per step; the fixed header and pinned bar take another 141pt on every step, 193pt on Review):

| Step | Title | Fields shown | Content (pt) | Scrolls by (pt) |
|---|---|---|---|---|
| 1 | Who they are | name, photo, relationship, one thing | 420 | 0 |
| 2 | Names and dates | 4 | 350 | 0 |
| 3 | Work and school | 5 | 407 | 0 |
| 4 | Family and home | 5 + "Marital status or situation" row | 520 | 14 |
| 5 | Interests | 9 hobby chips + 7 fields | 765 | 259 |
| 6 | Shared memories | 4 + "Add something else" row | 388 | 0 |
| 7 | Hints and recognition | clue chips, hint list | 336 | 0 |
| 8 | Review | 7 summary rows | 531 | 77 |
| | **Total** | | **3,717** | |

At 430x839 only Interests scrolls (59pt). This baseline is the "before" in the final report.

What looks wrong:

- **About 100pt of preamble before the first field on every step** (title, helper, "* Required", "Facts only"), 121pt on step 1, where the full facts-only line takes its own row.
- **Two link colors on one screen.** "Back" in the pinned bar is `primaryDark` blue (a quiet `BigButton`); every other link on the form is Deep Rose.
- **The photo row is crowded** (step 1): an 80pt preview, the label, "Not applicable" and a "Choose a photo" pill on one row. The preview's 16pt corners sit 16pt inside a card with 16pt corners, which isn't concentric; the 44pt "pill" has 16pt corners, so it isn't a pill either.
- **Interests is the long step.** The six Favorites (team, show, movie, music, food, place) are six full-width 57pt rows for answers of one to three words (341pt).
- **Family and home is split into two cards** (Home, Family) for five fields; the gap and heading cost about 50pt.
- **Review**: seven 61pt rows, each mostly "Nothing yet"; the first row has a letter-in-circle avatar ("I"). The disabled **Continue · 20%** is a grayed Ink at 50% opacity, which reads as broken more than "not yet".
- **Pressed states** are a tone change only on rows; there is no shared pressed wrapper.

### Story approval (screen 6)

Each story is a sentence with Approve, Edit and Skip; Approve all and Done are pinned. Rows are dense at the same weight, with no line saying how far along the caregiver is.

### Settings (dashboard, Settings tab)

- **Order follows the record, not use:** Account and The person's phone come first; Practice (the settings changed most) is third.
- **No status at a glance:** whether the person's phone has a login is two taps away.
- **Rows are text only;** no leading icons, so the groups don't scan.
- **About puts a 168pt logo mid-list**, then a Version row; the page then ends with the medical note after Delete account.
- **Delete account** is a plain row like the others, set apart by spacing and a caption only. It's calm, which is right, but it reads as one more row.

### Dashboard: Today, Trends, Insights, People

- **Today with no practice stacks two notices** ("No practice yet…" and "Add or restore people…") above three stat rows and an empty chart. There's no single focal point.
- **The stats are three full-width rows** (sessions, average session, average day); the references' condensed stat row would take one line.
- **Numbers aren't all tabular:** some changing figures (counts, minutes, percents) shift width as they change.
- **The tab bar** already has a soft pill on the chosen tab (`tabs.tsx`, radius 14, which is off the scale).
- **Header:** the tab's name at the 21pt title size next to the mark. It isn't a confident headline.

### Sheets, toast, pinned bars

- Separated from the page by a 1px hairline only; the sheet's grabber (radius 8) and the toast are flat.

### The person's screens (home, practice card, wrap-up, welcome, Hello, Practice more, Aa sheet)

These are already calm. Only spacing, alignment and case are in scope, and a few small things:

- **Several targets are 48pt, under the brief's 56:** Aa, Caregiver (home), the Home icon (practice card), I'm not sure, Back and the Privacy policy link (Hello), and `BigButton`'s minimum (most person buttons are 64 already).
- **The practice card at 375x647 Large** leaves about 50pt empty under I'm not sure while the photo has shrunk to about 96pt. Worth checking whether the photo could take that room (the photo is "the part that gives way"; this changes its size only, no logic).

---

## (b) Tokens

New tokens go in `src/theme/` beside the existing ones; nothing on the person's screens changes value.

### Type: the caregiver's compact scale, six steps

`check-logic` pins caption 13, body 15 to 17 and title 20 to 22; these stay.

| Token | Size / weight | Used for |
|---|---|---|
| caption | 13 regular | labels above fields, helper text, row subtitles, tab labels (12 today, raised to 13 if it fits the fifth-width rule) |
| body | 16 regular | rows, fields, buttons |
| headline | 17 bold | **new**: card and group titles ("Favorites", Review's section titles, story approval's sentence count) |
| title | 21 bold | step and sheet titles |
| largeTitle | 28 bold | **new**: the screen header (the tab's name, "Add a person"): the "confident headline" |
| display | 30 bold, tabular | hero figures |

Charts keep their own 11 and 12pt labels, as now. **The person's scale (4 sizes × 4 Text size levels) is unchanged.** Every number that changes gets `fontVariant: ['tabular-nums']` (an `AppText` prop, `tabular`).

### Spacing (4/8 base)

4, 8, 12, 16, 24, 32, plus **48** for the break before Delete account. Side gutter stays 24 on the person's screens; **20 on caregiver screens**, so two short fields sit side by side comfortably at 375pt.

### Radius: a scale with the concentric rule

Today there is one radius (16) and a few strays (14, 8, 7, 4, 3). Proposed:

| Token | Value | For |
|---|---|---|
| `R.xs` | 4 | slim bars, tags, chart marks |
| `R.inner` | 8 | anything nested inside a card at the card's 16pt padding (the photo inside a row, small tiles) |
| `R.control` | 16 | standalone buttons, fields, answer buttons, photos on the page. **Every person-screen radius stays 16.** |
| `R.card` | 24 | cards and grouped lists that hold inset content (= `R.inner` 8 + 16 padding) and sheet tops |
| `R.pill` | 999 | chips, the selected tab, the "Choose a photo" pill, toggles |

**The rule:** an element whose corner sits inside a parent's corner uses parent radius minus the inset. `R.card` and `R.inner` are the pair at 16pt padding. A lint-style check in `check-logic` keeps radii to these tokens.

### Elevation: hairline shadows in place of hard edges

React Native 0.88 on the New Architecture (the only one in SDK 58) supports the `boxShadow` style on iOS, Android and web, so the article's layered shadows map directly. Tinted with Ink, not black, so they belong to the palette.

| Level | Value | For |
|---|---|---|
| 0 flat | none | the default: Mist surfaces on white (cards, fields, grouped lists) |
| 1 edge | `0 0 0 1px rgba(31,43,77,0.06), 0 1px 2px -1px rgba(31,43,77,0.06), 0 2px 4px rgba(31,43,77,0.04)` | white things on Mist: chips, the photo pill, the selected segment, the Settings status card |
| 2 float | `0 -1px 0 rgba(31,43,77,0.06), 0 -8px 24px rgba(31,43,77,0.08)` | pinned bottom bars, the tab bar, sheets and the toast, replacing their 1px top hairline |
| image outline | inset 1px `rgba(31,43,77,0.10)` (an absolutely placed bordered view) | caregiver photos only (People grid, Review, a person's sheet), so a pale photo keeps its edge |

Nothing else gets a shadow. **This supersedes `DESIGN-UI.md`'s "Shadows: none" and "Radius: 16 for everything"** for caregiver screens, so it needs your approval.

### Motion: Reanimated, interruptible, Reduce Motion first

| Token | Duration / easing | For |
|---|---|---|
| press | 120ms, ease-out; scale 0.97 + surface tone (Mist→skySoft, Ink→primaryDark) | **caregiver** buttons, rows, chips, tabs (the person's existing 0.98 press is unchanged) |
| toggle | 180ms, ease-out | checkbox, segment and pill moves |
| enter | 300ms, `bezier(0.25,0.46,0.45,0.94)` (the article's), 8pt slide up + fade, 70ms stagger, at most 5 groups | a caregiver screen's first appearance only |
| existing | 200ms step slide, 250ms banners, 450ms flip | unchanged |

Every animated value is a Reanimated shared value driven by `withTiming`, which retargets from wherever it is, so a quick press-and-release or a toggle tapped twice never jumps. With Reduce Motion (`useReducedMotion`) press keeps its tone change only, enter is instant, and toggles snap. **No motion is added to the person's screens.**

**Haptics:** `expo-haptics` is already installed (used for the People long press). A light impact on caregiver primary actions only: Next/Continue, Approve all, Save, Done. No new package.

### Icons

Ionicons outline, 24pt (20pt as row leaders), one set and one stroke. The Insights brain stays the drawn exception the rules already allow. **Optical alignment:** buttons and rows with a leading icon get 4pt less padding on the icon side; chevrons sit 2pt in from the edge.

### Article items skipped, and why

- `text-wrap: balance` and `pretty`: CSS only. Titles here are one line by rule anyway.
- Font smoothing: CSS and macOS only.
- Blur in enter and exit animations: React Native has no cheap blur on views, and the brief bans blur.
- The "full-slide exit" drawer: we have no drawers. Sheets keep their slide.

---

## (c) What changes on each screen, and the idea behind it

| Screen | Change | From |
|---|---|---|
| **Caregiver header** (every tab, Add a person, story approval) | The title at `largeTitle` 28 bold, left-aligned beside the 32pt mark; the hairline under it goes, and level 0 page. | "larger, confident headline type" (task home after) |
| **Tab bar** | Keep the soft pill on the chosen tab, now `R.pill` (it is 14), level 2 float in place of the hairline, press token. Label 13pt if it still fits a fifth at 320pt; else 12. | "pill-style selected state" (task home, golf after) |
| **Today** | One dominant element: the day's completion at display size, tabular. The three stat rows become **one quiet row of three** with hairline vertical dividers (each figure bold over a caption label), wrapping to rows at the largest accessibility text. With no practice, **one** notice, the more useful one (fewer than two people wins), not both. | "one dominant element", "stats condensed into one quiet row" (story details after) |
| **Trends** | Tabular figures; the times-practiced table on the same hairline rhythm; radii to tokens. | consistency |
| **Insights** | Tabular figures everywhere (some are already); the hero's two white tiles become one quiet stat row like Today's; "How to read this" and the note under charts become **accent-bar callouts** (3pt `pinkInk` bar, no box); concentric radii in the hero (card 24, tiles 8). | "tips as an accent-bar callout" (golf after), stat row |
| **People** | Photos with the image outline; the grid's card radius by the concentric rule; press token. | "real photos in context", article image outline |
| **A person's sheet** | Rows grouped on one inset card per purpose (Stories and Waiting, Practice settings, Hints, Archive apart), leading icons in Deep Rose, Archive separated like Delete. | inset grouped list |
| **Add a person** | See (d). | |
| **Story approval** | Each story a calm card: the sentence at body, its kind as a caption, **Approve** as a small soft pill and Edit and Skip as quiet links on one line; an approved story collapses to its sentence with a check and "Approved" (state never by color alone). A **compact progress line** under the title, "6 of 12 approved", tabular. Approve all and Done stay pinned, unchanged in what they do. | "one primary action anchored at the bottom" |
| **Settings** | See below. | |
| **Sign-in (caregiver forms)** | The same field (label above, 56pt, calm inline note), largeTitle header, pinned primary on level 2. | consistency |
| **Welcome, Hello** (person-facing) | Spacing and alignment only; 56pt targets. | non-negotiables |
| **Sheets** | `R.card` tops, level 2, grabber `R.pill`; content padding 16 so inner controls use `R.inner` where they hug a corner. System alerts (`Alert`, `window.confirm` on web) can't be styled and stay as they are. | concentric radii, hairline shadows |
| **Toast** | Ink pill-ish card at `R.card`, level 2; same timing and Undo. | |
| **Wrap-up, home, practice card, Practice more, Aa sheet** (person-facing) | Spacing, alignment and case only. Targets raised to 56pt with `hitSlop` (the touch area grows, the drawing doesn't, so no layout moves). Check whether the card's photo can take the empty 50pt it leaves at 375x647 Large. | non-negotiables |
| **Report (PDF)** | `font-variant-numeric: tabular-nums` on its tables; nothing else. | article |

### Settings in detail

- **Status card at the top**, in place of a hero, on Mist at `R.card`: "Signed in as" with the email (as today), and "The person's phone" with **Set up** or **Not set up yet** (whether Their login exists, which the family store already loads), each with an icon and its words, so state is never color alone. With sign-in off: "On this phone only".
- **Sections by how often they're used:** **Practice** (session length, reveal cards, AI questions where available, practice text size), **The person's phone** (their login, reset), **Privacy and data** (privacy policy, what the app stores, research use, AI questions agreement where available, export my data), **Account** (change password, sign out), **About** (version only). Then, 48pt apart, **Delete account** alone in its own group with its caption: a `trash-outline` icon and the label in Ink, never red, its confirmation unchanged.
- **Rows:** a 20pt leading icon in Deep Rose (one colour), the label, an optional one-line muted subtitle, and a trailing value, chevron or switch. Rows that are switches today keep a one-line description; **rows that open a picker or a consent sheet stay rows** (Research use writes a consent record through its sheet, so it doesn't become a bare switch).
- **Footer:** the logo (the `about` lockup, 168pt), "Tandem" and the version, centered small, then "Practice activity, not a medical measure.". The name comes from `src/config/brand.ts`; the version is read where it is today (`Constants.expoConfig.version`), because `brand.ts` doesn't hold it and `app.json` is out of bounds.
- **Reminders are not added to Settings.** The hard rule keeps them on the person's phone only, with no caregiver control or mention.

---

## (d) Add a person: grouping, what folds away, and the saving

### Option A, recommended: keep the eight steps, make each step shorter

Nothing stored changes, `profile_step` keeps its meaning, and every question stays where it is. The existing `behind` mechanism in `src/data/questionnaire.ts` (today used for "Marital status or situation" and "Add something else") becomes **More details**. It's a row at the end of a card, shown open once anything behind it is answered, so no answer is ever hidden.

| Step | Shown | Under "More details" | Other changes | Saving (pt) |
|---|---|---|---|---|
| All | | | Title and helper tighter; "* Required" and "Facts only" share one line on every step | ~12 each |
| 1 Who they are | Photo first (a large rounded area, initials on Mist until there is one, Choose a photo as a real pill), Name, Relationship, One thing | | The full facts-only line becomes the same "Facts only" link as later steps (**your call**: the audit put it in full here) | about +12 net (the photo grows) |
| 2 Names and dates | Goes by, Birthday | What the person calls them, Known each other | | 66 |
| 3 Work and school | Job now, Past job | Field, Employer or school, Future plans | | 123 |
| 4 Family and home | Lives in, Partner, Children, Pets | Lives with, Marital status, Family situation (one row, replacing today's) | Home and Family become one card with two small subheads | 107 |
| 5 Interests | Hobbies, They always say or do, Favorites **two to a row** (Team and Show, Movie and Music, Food and Place) | | Two-up only while each half is at least 140pt; one per row at the largest accessibility text | 180 |
| 6 Shared memories | A time we…, How we met | The place we always…, A holiday we…, Anything else (one row, replacing "Add something else") | | 114 |
| 7 Hints | unchanged | | | 0 |
| 8 Review | Rows at 52pt; the first row shows the photo (or initials on Mist), "Nothing yet" rows muted | | The disabled Continue shown as a Mist button with Ink text and the percent, not grayed Ink | 63 |

**Expected:** about **3,717 → about 2,900pt as first shown (about 22% shorter)**. Fully expanded (a caregiver who opens every More details) it saves about 10%, from the tighter preamble, the merged card, the two-up favorites and Review. **Option A alone doesn't reach 30%.** Reaching it this way would mean hiding nearly every optional question, which would make the form feel empty rather than short.

### Option B: fewer steps (needs your approval)

Merge to five: **Who they are** (with Goes by and Birthday under More details), **Their life** (Work and school + Family and home, as two subheads), **Interests**, **Memories and hints**, **Review**. Combined with A it saves three preambles, three headers and three Next taps: about **2,350pt (about 37% shorter)**.

The cost, and why it isn't presentation-only: `profile_step` would mean a different step. Drafts saved mid-form need a mapping when read (0,1→0; 2,3→1; 4→2; 5,6→3; 7→4), "Picks up at step 5 of 8" becomes "of 5", and the step tests in `check-logic` change. The schema's 0-to-7 check still accepts it, so no Supabase change. You asked me to wait before changing the form's structure, so B waits.

### Also in Add a person

- **Fields:** 56pt, label above (never placeholder-only, as today), calm inline notes as today.
- **The keyboard:** `CaregiverScreen`'s existing reveal and keyboard avoidance stay, and the pinned bar gets level 2. Checked with the simulated keyboard in the walk, and on a phone.
- **"Take a photo" is left out:** the camera needs a camera-permission string in `app.json`, which this pass may not touch. "Choose a photo" stays.
- **Live card preview (your call):** possible without new logic. Once Name, Relationship and One thing are filled, step 1 could show a small card made by the same `sentenceFor` that story approval uses, with the photo. I'd add it only if you want it, since story approval already shows every card exactly.
- **Success** after Done on story approval: the existing quiet return and toast, no celebration.

---

## The draft mapping for five steps (approved 2026-11-17, written before any code)

**The problem.** `people.profile_step` is a number from 0 to 7. If the five new steps were stored as 0 to 4, a stored 3 couldn't be told apart: an old draft that reached Family and home, or a new one that reached Memories and hints. The value carries no version.

**The answer: the stored unit doesn't change.** `profile_step` keeps meaning what it means today, **the furthest section of the form reached**, numbered by the seven sections of questions and Review (0 to 7, `SECTIONS[].step`, unchanged). The five steps are a way of showing those sections, two at a time where they merge. So:

- **Reading** (opening the form, Resume profile, its line on the person's sheet): the stored section is shown on the step that holds it, `pageOf(section)`.
- **Writing** (Next, Back, Finish later): reaching a step stores the **first section of that step**, `firstSectionOf(page)`, so a new draft's value is always one an old version also understood.
- Nothing about what is saved changes: the column, its check (`between 0 and 7`), the export (which writes the stored value plus 1, as before) and `docs/DATA-INVENTORY.md` all stay as they are. No Supabase change.

| Stored `profile_step` (section) | Section | Old step shown | New step shown |
|---|---|---|---|
| 0 | Who they are | 1 of 8 | **1 of 5**, Who they are |
| 1 | Names and dates | 2 of 8 | **1 of 5** (under More details) |
| 2 | Work and school | 3 of 8 | **2 of 5**, Work and home |
| 3 | Family and home | 4 of 8 | **2 of 5** |
| 4 | Interests | 5 of 8 | **3 of 5**, Interests |
| 5 | Shared memories | 6 of 8 | **4 of 5**, Memories and hints |
| 6 | Hints and recognition | 7 of 8 | **4 of 5** |
| 7 | Review | 8 of 8 | **5 of 5**, Review |

Writing back: step 1 → 0, step 2 → 2, step 3 → 4, step 4 → 5, step 5 → 7.

**The guarantees, each with a test in `scripts/check-logic.mjs`:**

1. **Every old value lands on the nearest step:** the step that now holds the same section, never a later one, so nothing between is skipped. Values outside 0 to 7 or not a number are clamped into it.
2. **No answer is lost:** answers are facts saved by question, never by step, and every question of every section is on exactly one of the five steps. The test checks that each question appears once, so a merged step shows all of its sections' answers, including those behind More details (shown open whenever they have an answer).
3. **A new draft opens where it was left:** for every step, `pageOf(firstSectionOf(step)) === step`.
4. **Progress only moves forward:** what is stored is still only raised (`reached > profileStep`), and `firstSectionOf` grows with the step, so an old draft further along (a stored 3, say) isn't pulled back to 2 by passing through step 2.
5. **Resume profile** keeps its rule in sections (`resumeStep`: the furthest reached, at least past the first screen; once through, the first thing missing), and its line names the new step: "Picks up at step 2 of 5, Work and home."
6. **What's left** jumps to the step holding the missing question's section.

**The five steps:**

| Step | Title | Sections | On screen |
|---|---|---|---|
| 1 | Who they are | 0, 1 | The photo first, then Name, Relationship, One thing; Names and dates under More details in the same card |
| 2 | Work and home | 2, 3 | Two cards headed "Work and school" and "Family and home", each with More details |
| 3 | Interests | 4 | Hobbies and They always say or do; Favorites two to a row |
| 4 | Memories and hints | 5, 6 | Two cards headed "Shared memories" and "Hints and recognition" |
| 5 | Review | 7 | One row per step, with Edit |

## Decisions (2026-11-17)

1. **Branch:** `brand-tandem` was merged into `main`; `ui-polish` is from `main`.
2. **Add a person:** Option A and Option B, with the mapping above.
3. **Design rules:** the radius scale, hairline shadows and six-size scale apply to **caregiver screens only**; the person's screens keep 16pt corners, no shadows and their four sizes. `DESIGN-UI.md` is updated, and checks are adjusted only as far as this needs.
4. **Sun:** only behind the filled-in name.
5. **The person's screens:** 56pt touch areas through `hitSlop`, drawn the same.
6. **Settings:** sections by use, Practice first.
7. **Live card preview:** skipped for now.
8. **Tab bar:** the soft pill with pill corners and a soft shadow.
- Reminders stay out of the caregiver's Settings. No "Take a photo"; `app.json` untouched. No change to the privacy policy or consent words, even for case.

## Decisions this plan asked for (answered above)

1. **Branch base.** `main` doesn't have the Tandem brand (`brand-tandem` is 14 commits ahead and unmerged), so `ui-polish` from `main` would lose `brand.ts`, the logo, Deep Rose and `check-brand`. I recommend branching from `brand-tandem`. There is no `testflight-prep` branch.
2. **Option A or A + B** for Add a person (above).
3. **The design contract:** the radius scale, hairline shadows and the six-step compact type scale supersede "one radius", "no shadows" and the four-size caregiver scale in `DESIGN-UI.md`.
4. **Sun:** the brand rule keeps Sun only behind the filled-in name; the brief says "sparing highlights". I'd keep the rule.
5. **The person's 56pt targets** through `hitSlop` (no visual change), rather than drawing bigger controls.
6. **The Settings order** by use (Practice first), which changes the order recorded in `CLAUDE.md` and `docs/SETTINGS-AUDIT.md`.
7. **The privacy policy's case.** Any change to its words, case included, changes its fingerprint, so it needs a new `POLICY_VERSION`, and every caregiver is asked to agree again. I'll list policy case issues under "Needs my decision" in the capitalization audit rather than change them.
8. **The live card preview** on step 1, and **the tab bar** (keep the soft pill, or an Ink pill with white icon and label).
