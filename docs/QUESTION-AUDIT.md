# Question audit

Written 2026-11-11. It lists every way Evermore asks a question, checks each against a set of design principles, and records what was changed and what wasn't.

**What this is, and isn't.** Only two points below rest on published evidence, and even those are summarized loosely here:

1. Spaced-retrieval training for people with dementia recalls a target at expanding intervals (published examples include 1, 3 and 6 minutes, or 1, 2 and 4 minutes), usually with errorless cueing: the person is prompted so they don't guess wrong. Targets are chosen with the person and their family, are useful in daily life, and are trained one at a time.
2. A study in amnestic mild cognitive impairment found that seeing face-name pairs again incidentally reduced forgetting.

**Everything else here is a design assumption, not a verified finding.** That covers every principle in the next section, every threshold, the hint order, cue fading and where re-exposure goes. None of it is clinically validated. Nothing in Evermore, in the app or its documents, may claim that practice improves memory or helps any condition. A speech-language pathologist must review the numbers and orders marked "Needs clinician review" before real use.

The real family's cards (now the gitignored `src/data/deck.local.ts`) were read for the audit but are not quoted here. Examples use the fictional sample people (June, Leo, Mae, Omar, Ruth).

## Principles audited against (design assumptions)

| # | Principle |
| --- | --- |
| P1 | **One target per card.** The answer is a single caregiver-approved fact: almost always the person's name, or on a reverse card one fact. |
| P2 | **Errorless-leaning.** The first try should be likely to succeed: two or three choices, never names that sound alike, and the hint ladder (more cue, then fewer choices, then the answer shown) before anything that could feel like a miss. Failure is never shown. |
| P3 | **Meaningful cues first, then fading.** Personal, concrete cues (relationship, a shared memory, a role) over trivia. Templates ordered from richest cue to leanest, and cues fade as a person gets a card right repeatedly. |
| P4 | **Re-exposure.** After a face-name pair is answered, the face and name appear again incidentally later in the same session, at no extra pressure. |
| P5 | **Plain, short, calm wording.** Under about 14 words, one idea, active voice, no double negatives, and the same frame for the same kind of question. |
| P6 | **Distractors from the family only.** Other choices come from the same family's approved facts or names: never invented, never another person's sensitive fact, never an obviously silly option. |
| P7 | **Vary the format, keep each layout fixed.** Fill in the blank, question, photo, reveal: different between cards, identical within a kind. |
| P8 | **Intervals are placeholders,** all in `src/config/schedule.ts`, expanding within a session and across days, never hard-coded elsewhere. |

## Audit (before any change)

### The approved sentence (`sentenceFor` in `src/lib/stories.ts`)

| Template | Tests | Cue given | Distractor rule | Meets | Misses |
| --- | --- | --- | --- | --- | --- |
| `My {relationship}, ______, {predicate}.` | The name, from face, relationship and fact | Photo, relationship, one fact | Up to two other names from the deck, rotated (`chooseNames`) | P1, P3 (richest), P6, P7 | P2: other names may sound like the answer or share its first letter. P5: length depends on the caregiver's words. |
| `______ {predicate}.` (no relationship typed) | The name, from face and fact | Photo, one fact | Same | P1, P6, P7 | Same as above |
| Lead `As of {Month Year}, ` (fact that may change) | — | Dates the fact | — | Keeps time-sensitive facts honest | Adds 4 words |
| Lead `In {year}, ` (memory with a year) | — | Dates the memory | — | — | Adds 2 words |

**Predicates** (`PREDICATES`), the fixed words around the caregiver's: memory `{text}`; work `is`; pastwork `worked as`; field `has worked in`; workplace `has worked or studied at`; plans `is`; interest `enjoys`; team `loves`; show `loves watching`; movie `loves the movie`; food, place `loves`; music `loves listening to`; habit `always`; shared `and I`; regular `and I always`; holiday `and I had a holiday we`; met `and I met`; birthday `has a birthday on`; nickname `goes by`; calls (own shapes, below); known `and I have known each other`; home `lives in`; lives_with `lives with`; partner `has a partner named`; child `has a child named`; pet `has`; marital, situation `is`.

- All are active voice with no negatives (P5).
- **Misses P5:** workplace (`has worked or studied at`) holds two ideas joined by "or", and holiday (`had a holiday we …`) reads awkwardly.
- **Misses P5:** a free "something about them" fact can hold two ideas, and some real deck facts do. Those are the caregiver's words, and the deck is never changed.

### Ways to ask (`SHAPES`, `PHRASINGS`)

| Shape id | Kind | Template (before) | Tests | Cue given | Distractor rule | Meets | Misses |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `my-rel` | blank | `My {relationship}, ______, {predicate}.` | Name | Photo, relationship, fact | Names from deck, rotated | P1, P3, P7 | P2 (sound-alike names) |
| `name` | blank | `______ {predicate}.` | Name | Photo, fact | Same | P1, P7 | P2 |
| `favorite` | blank | `______’s {favorite} is {text}.` (team, show, movie, food, music, place, birthday, partner) | Name | Photo, fact | Same | P1, P7 | P2 |
| `ask` | ask | `Who {predicate}?` | Name | Photo, fact | Same, minus anyone with the same fact | P1, P5, P7 | P2 |
| `whose` | ask | `Whose {favorite} is {text}?` (birthday, partner) | Name | Photo, fact | Same | P1, P5 | P2 |
| `ask-met` | ask | `Who did you meet {text}?` | Name | Photo, how you met | Same | P1, P3 (personal), P5 | P2 |
| `who` | who | `Who is this? This person {predicate}.` | Name | Photo, fact | Same | P1, P7 | **P5:** the question comes first and the cue after it, unlike every other question card, where the question is last, just above the names. |
| `photo` | photo | `Who is this?` | Name from the face alone | Photo only (leanest) | Names from deck | P1, P5, P7 | — |
| calls `my-rel` | blank | `I call my {relationship}, ______, {text}.` | Name | Photo, relationship, what you call them | Same | P1, P3 | P2 |
| calls `name` | blank | `I call ______ {text}.` | Name | Photo, what you call them | Same | P1 | P2 |
| calls `ask` | ask | `Who do you call {text}?` | Name | Photo, what you call them | Same | P1, P5 | P2 |
| calls `who` | who | `Who is this? You call this person {text}.` | Name | Photo, what you call them | Same | P1 | P5, as `who` |

**Every shape.** Every shape shows the photo (reveal cards aside) and holds the caregiver's words once (P6). Shapes needing a relationship or photo are dropped without one. "Who and I …?" is never asked. Private kinds (marital, situation) are stated, never asked.

**Which shape is used (P3).** Before this change, the shape was picked at random among the ones not used today, a new way and a new kind for the person first, with an approved AI sentence ahead of a fixed one. **Misses P3:** nothing ordered the shapes from rich to lean, and nothing faded the cue as a card climbed the schedule. A brand-new card was as likely to be asked photo-only as with its relationship.

**Answer in the stem (P2, P1).** No fixed shape writes the name into a question. But a caregiver can type the person's name into a fact ("calls June's garden her pride"), and that fact's question shapes would then show the answer. **Misses:** nothing caught it.

### AI shapes (`src/lib/ai-check.ts`, `generate-questions`)

| Shape | Template, as the prompt describes it | Tests | Cue given | Distractor rule | Meets | Misses |
| --- | --- | --- | --- | --- | --- | --- |
| `one_fact` | One fact, `____` for the name | Name | Photo, fact | Names from deck | P1, P6 | P5: up to 18 words asked, 22 accepted |
| `two_facts` | Two facts, `____` for the name | Name | Photo, two facts (richest after relationship) | Same | P1, P3 | P5: two facts in one sentence, 22 words allowed |
| `fact_to_name` | `Who …?` or `Whose …?`, no blank | Name | Photo, fact | Same | P1, P5 | — |
| `context` | A shared memory told as a moment | Name | Photo, memory | Same | P1, P3 (personal) | P5 (length) |
| `reverse` | `[NAME] enjoys ____.` | One fact, the name given | Photo, name | Other people's facts of the same kind, short, never time-sensitive, never also true of this person | P1, P6 | **P6:** `lives_with` can be a reverse kind, which offers other family members' household arrangements as choices. That can be sensitive. |

The checks (`checkSentence`) already enforce P6's "nothing invented": every word must come from the cited facts, their kind's fixed words, the relationship or a short list of small words, and no content word may be dropped.

### Hints (`hintAt`)

| Rung (before, in order) | Says | Cue type | Meets | Misses |
| --- | --- | --- | --- | --- |
| 1. letter | `The name starts with S.` (reverse: `It starts with G.`) | Spelling | P2 | **P3:** a spelling cue before any meaningful one. **P2:** useless when another name offered starts with the same letter. |
| 2. fact | `This person enjoys gardening.`, another approved fact, never the card's own; the best clue steers it (`Think of their laugh.`) | Personal fact | P3, P6 | — |
| 3. relationship | `This is your mom.` | Relationship | P3 | **P2:** repeats the question on a card that already says "My mom, ______, …" |
| 4. fewer | `Let’s try with fewer names.` One name set aside, never leaving fewer than two. | Fewer choices | P2 | — |
| (after the ladder) | The last rung again, forever | — | — | **P2:** the ladder never ends in the answer. With two names left, a person can keep choosing the other one. |
| (every rung off) | `Take your time.` | — | P5 | Same as above |

The newest rung leads and the first stays beside it. Hints use no judging words (checked).

### Feedback, wrap-up, re-exposure

| Piece | Says | Meets | Misses |
| --- | --- | --- | --- |
| Instruction | `Choose a name` / `Choose one` | P5 | — |
| Read-back | `Yes, that’s June.` and the whole sentence, read aloud | P2 (ends on success), P4 (face and name together, once) | — |
| Reveal card | Photo behind a "?" until tapped or answered | P7 | — |
| Wrap-up | `Nice work.` / `All done today.` and `You spent time with June and Leo.` (a count past 5) | P5 | **P4:** names only, no faces. A pair is never seen again later in the session, apart from a re-ask after a hint. |

### Distractors (`chooseNames`, `namesToOffer`, `withOthers`)

- Names come only from the approved deck: no drafts, no deselected or archived people (P6). People with the same fact are left out of "Who …?" cards. The other names and the right name's place rotate.
- **Misses P2:** no notion of names that sound alike. In a family where several names share a first letter (as happens in many families), the first-letter hint often can't tell the choices apart, and names like Ann and Anne, or Jon and John, can be offered together.
- No name is ever silly in itself, since every one is a real family member's.

### Intervals (`src/config/schedule.ts`)

- Across days: steps of 10 minutes, then 1, 3, 7 and 14 days, expanding (P8).
- Within a session: a card that needed a hint is asked again **once**, 3 or 4 cards later (`REASK_AFTER_CARDS`), plus a short review pass at the end. **Misses P8:** there is no expanding series within the session, which is the core of the published spaced-retrieval method.
- All numbers are already in the one config file and marked as placeholders.

## Proposed (and implemented)

Each change keeps every hard rule in `CLAUDE.md`: no invented facts, wording only from caregiver-approved facts, no red and no "wrong", no scores or timers on the person's screens, the photo rules, reveal-card eligibility, rotation and the copy check. Nothing needed a change to data, photos or the schema.

### 1. Names that sound alike are not offered together (P2)

`soundsAlike` in `src/lib/stories.ts`: the same first letter, or a spelling one or two letters apart (one for names of three letters or fewer), after folding common sound-alike spellings (ph and f, c and k, y and i, a silent h, double letters).

- `chooseNames` takes other names unlike the answer and unlike each other first, then the existing rotation (names this person wasn't just shown first, the right name's place moving).
- Only a deck with nothing else falls back to alike names, so every card still offers two or three choices.

| | Choices on a June card |
| --- | --- |
| Before | June, Jane, Leo (possible) |
| After | June, Leo, Omar (Jane only if no one else is left) |

### 2. The hint ladder: meaningful cues first, then fewer names, then the answer (P2, P3)

`HINT_LADDER` in `src/lib/stories.ts`. `HINT_RUNGS`, the stored set the caregiver turns on and off, is unchanged, so the schema is too.

| | Order |
| --- | --- |
| Before | letter, fact, relationship, fewer names, then the last rung again |
| After | fact, relationship, letter, fewer names, then **the answer shown** |

| Misses | Before | After |
| --- | --- | --- |
| 1 | Take your time. The name starts with J. | Take your time. This person enjoys gardening. |
| 2 | This person enjoys gardening. The name starts with J. | This is your aunt. This person enjoys gardening. |
| 3 | This is your aunt. The name starts with J. | The name starts with J. This person enjoys gardening. |
| 4 | Let’s try with fewer names. The name starts with J. | Let’s try with fewer names. This person enjoys gardening. |
| 5 | (the same again) | **It’s June.** June’s button is shown filled, as a selected choice. |

- **No repeated relationship.** The relationship rung is skipped when the card's own question already says the relationship ("My aunt, ______, …").
- **The answer is always reached.** It comes after the last rung the caregiver allows, or after one "Take your time." when every rung is off. Every card still ends with the person tapping the right name.
- **Both names stay.** The fewer-names rule (never fewer than two names) still holds.
- **Nothing new is recorded.** Insights record the same rungs as before.

### 3. Cue fading (P3)

Each way to ask has a cue level (`cueLevel` in `src/lib/stories.ts`): 0 is the richest, 3 the leanest.

| Level | Ways |
| --- | --- |
| 0 | `my-rel` (relationship and fact), calls `my-rel`; AI `two_facts` |
| 1 | `name`, `favorite`, `ask`, `whose`, `ask-met`, `who`; AI `one_fact`, `context`, `fact_to_name` |
| 2 | `photo` (the face alone) |
| 3 | AI `reverse` (the name given, the fact recalled) |

`CUE_FADING` in `src/config/schedule.ts` gives the levels preferred at each schedule step:

| Step | Levels preferred |
| --- | --- |
| 0 (new, or after a hint) | 0 |
| 1 | 0 to 1 |
| 2 | 1 to 2 |
| 3 and up | 1 to 3 |

- **A preference, never a lock.** Within the choice the rules already make (no sentence twice a day, a new way and a new kind for the person, an AI sentence first), the ways closest to the band win. If none fits, practice uses what there is.
- **Re-asks.** A card asked again after a hint is back on step 0, so it leads with the richest cue it has left.

### 4. "Who is this?" cards put the question last (P5)

Every question card now ends with its question, just above the names, and gives its cue first.

| Kind | Before | After |
| --- | --- | --- |
| `who` | Who is this? This person loves the Riverton Otters. | This person loves the Riverton Otters. Who is this? |
| calls `who` | Who is this? You call this person Nana. | You call this person Nana. Who is this? |
| fact that may change | Who is this? As of May 2026, this person is a nurse. | As of May 2026, this person is a nurse. Who is this? |

The fact hint (`clueFor`) still reads "This person loves the Riverton Otters."

### 5. The answer never shows in the question (P1, P2)

`phrasingsFor` takes the person's name. A question shape whose words contain it (whole word, any case, first name or full name) is left out, and a blank card's words outside the blank count too. A card with no way left to ask isn't practiced. Story approval lists the same ways, made by the same function.

| | `nickname` fact "June Bug" for June |
| --- | --- |
| Before | Who goes by June Bug? (gives the answer away) |
| After | That shape is left out. The photo-only card still asks. |

### 6. Expanding re-asks within a session (P8)

| | Within a session |
| --- | --- |
| Before | A card that needed a hint comes back once, 3 or 4 cards later, then maybe in the review pass. |
| After | It comes back at expanding gaps of about **1, 2, 4 and 8 minutes** (`SAME_SESSION_MINUTES`), turned into cards at `SECONDS_PER_CARD` (about 4, 9, 17 and 34 cards). |

- **How the series moves.** A first-try answer moves it to the next gap. Another hint starts the series again from 1 minute. A gap past the end of the session ends it.
- **A ceiling.** At most `SAME_SESSION_MOST` (8) cards come back in a session, so a hard day can't grow long.
- **They don't count.** Cards that come back still move only the schedule, not "X of N cards today", and are never reveal cards.
- **Across days, unchanged:** 10 minutes, 1, 3, 7 and 14 days. The steps keep their numbers because the server stores them.

### 7. "Today you saw" on the wrap-up (P4)

The wrap-up shows the faces and names of up to 6 people from the session, in the order they first came up, so the earliest pairs come back after the longest gap. It replaces the line of names.

- **Everyone, regardless of answers.** Every person whose card came up is included, so the strip reveals nothing about how answers went. People without a photo are left out of the strip.
- **No pressure.** No count or score, and nothing to tap but Home.

| | Wrap-up |
| --- | --- |
| Before | Nice work. You spent time with June and Leo. |
| After | Nice work. Today you saw: [June's photo] June, [Leo's photo] Leo. |

### 8. AI: shorter, calmer and safer distractors (P5, P6)

| Rule | Before | After |
| --- | --- | --- |
| Words per sentence, asked of the model | at most 18 | at most 14 |
| Words per sentence, enforced by `checkSentence` | 22 | 16 (a little room over the ask; longer is dropped) |
| Wording rules in the prompt | warm, plain, no negatives | adds: one idea, active voice, no double negatives, a question always ends the sentence |
| Reverse kinds | include `lives_with` | `lives_with` removed, so no one's household is offered as a choice on someone else's card |
| Cue level in practice | none | from the shape, as in change 3 |

The validation block is still copied by `scripts/sync-ai-check.mjs`. The function must be redeployed (AI is off by default).

### 9. A gentle length note for the caregiver (P5)

Story approval shows "Shorter sentences are easier to read." under a sentence longer than 14 words. It is the caregiver's choice whether to edit. Nothing is rewritten, and nothing is blocked.

## Not changed, and why

- **The fixed predicates** (workplace `has worked or studied at`, holiday `had a holiday we`). Changing them changes sentences caregivers already approved, word for word, which would need a re-approval flow.
- **Re-exposure inside another person's sentence.** Writing one person's name into another person's sentence would add words the caregiver never approved. Change 7 does it with the faces and names alone.
- **Nicknames that echo the name** ("Nori" for Nora). They can't be detected reliably. Change 5 catches only the name itself.
- **The across-day steps.** They are already expanding and placeholders. Renumbering them would change what the server's stored steps mean.
- **Two facts in one AI sentence.** They stay as the richest AI cue. The new word limit keeps them short.

## Needs clinician review

- **Interval schedule:** the same-session gaps (1, 2, 4, 8 minutes, as cards), the ceiling of 8, and the across-day steps (10 minutes, 1, 3, 7, 14 days).
- **Hint ladder order:** fact, relationship, letter, fewer names, then the answer. Also whether the answer should come sooner (more errorless) or later.
- **Cue fading thresholds:** the four bands in `CUE_FADING`, and the cue levels given to each way to ask.
- **Re-exposure placement:** the wrap-up strip, its 6 people, the first-seen order, and whether a mid-session re-exposure would help.
- **Sound-alike rule:** whether the same first letter and a spelling one or two letters apart is the right test.
- **The 14-word guide** for the caregiver's note and the AI's sentences.
