# Sentence audit

Written 2026-11-18 on `sentence-grammar`, before any change (step 1 of the grammar fix). Every sentence, question and hint the app builds from a caregiver's answers was generated against a wide set of **fictional** inputs and checked. Nothing in the app was changed for this audit. AI questions stay off and aren't covered: they are written and checked elsewhere (`src/lib/ai-check.ts`).

## Where sentences are built

All of the words practice shows come from one file, `src/lib/stories.ts`. Each fact's words fill a fixed predicate (`PREDICATES`), placed in a shape (`SHAPES`, `OWN_SHAPES` for "calls"):

| What | Function | Shape | Where it shows |
| --- | --- | --- | --- |
| The approved sentence | `sentenceFor` | `My {relationship}, {name}, {predicate}.` or `{name} {predicate}.` | Story approval, Approve all (`approve-all.tsx`), the read-back after a right answer (`practice-screen.tsx:204`), the data export (`export.ts:130`) |
| Blank cards | `phrasingsFor`, ids `my-rel`, `name`, `favorite` | as above, and `{name}’s {favorite} is {text}.` | Practice |
| Question cards | `ask`, `whose`, `ask-met` | `Who {predicate}?`, `Whose {favorite} is {text}?`, `Who did you meet {text}?` | Practice |
| "Who is this?" cards | `who`, `photo` | `This person {predicate}. Who is this?`, `Who is this?` | Practice |
| The fact hint | `clueFor` | `This person {predicate}.` (or "Think of their voice/laugh.") | Practice, the first hint |
| The other hints | `hintAt` | `This is your {relationship}.`, `The name starts with J.`, `Let’s try with fewer names.`, `It’s June.` | Practice |
| Date leads | `fill` | `As of May 2026, ` (a fact that may change), `In 2002, ` (a memory's year) | Every shape above |

What the caregiver types is tidied, never reworded: extra spaces go, a leading "my" goes from the relationship, and trailing `. , ; : !` go from the fact (`tidyName`, `tidyRelationship`, `tidyMemory`, `tidyDraft` in `src/lib/facts.ts`). Each chip and each list item is its own fact (`src/components/questionnaire.tsx`).

**Approved cards are rebuilt at every render.** Practice calls `phrasingsFor` and `sentenceFor` on the fact each time (`src/lib/session.ts:61`, `:129`). The stored `cards.sentence` is read only for a phone copy saved before facts existed (`session.ts:60`). A caregiver's edit on story approval changes the fact's words, not a sentence (`editCard`, `family-store.ts:500`). **So any change to a template changes how every already approved card reads**, unless each card remembers which wording it was approved with. This decides how step 2 must keep approved sentences unchanged (see "Needs your decision").

## How it was checked

A script (kept outside the repository for this read-only step; step 2 turns it into permanent tests) ran every fact type × each of its shapes × the fact hint against:

- **29 fact types**, with 3 to 7 caregiver answers each (139 in all), from tidy ("a nurse", "got lost in Rome") to what people really type: a capital first letter ("Loves to bake bread"), their own pronoun ("She loves …", "They always say …"), the question's own opening echoed ("A time we …", "We met at church"), a bare noun ("nurse", "Rex"), a verb where the frame expects a noun ("teaches math"), lists of two and three ("Noah and Ava", "Noah, Ava and Liam"), numbers, ages and dates ("turned 80 this year", "3/14", "for 50 years", "since 1962"), places ("Paris, France"), a question mark at the end, and a 21-word memory.
- **9 relationships**: friend, aunt, Grandma (capitalized), older sister, step-dad, "the neighbor", "an aunt", "mom and best friend", and none.
- **Date leads**: a memory's year (2002) and "As of May 2026".
- **6 names** in the possessive and filled shapes: June, Leo, Charles (ends in s), D'Andre (apostrophe), Mary-Kate (hyphen), Grandma Rose (a title).
- **The hint ladder** for four relationships, at every step.

Automatic checks: unresolved placeholders, double spaces, a/an, doubled punctuation, repeated words, missing end punctuation, a capital letter mid-sentence, over 16 words, the blank twice. Fit checks, by fact type: the caregiver's words against the frame (agreement, a doubled subject or preposition, a missing article, an echoed opening, tense). Choppy checks: frames that are grammatical but read like a form.

## Summary

**3,663 sentences generated, 1,614 distinct; 1,056 distinct sentences (65%) have at least one problem.** Counts are distinct sentences; one sentence can have several problems.

| Problem | Distinct sentences | Cause | Example |
| --- | ---: | --- | --- |
| Choppy or robotic frame | 312 | The fixed words | "My friend, ____, and I had a holiday we spent at the lake." |
| Relationship with its own article | 270 | The caregiver's relationship | "My the neighbor, ____, enjoys gardening." |
| Agreement | 145 | The words don't fit the frame | "____ always hum in the kitchen." "____ is teaches math." "____ has a child named Noah and Ava." "____ enjoys to paint." |
| Relationship capitalized mid-sentence | 136 | The caregiver's relationship | "My Grandma, ____, …" |
| Relationship of two roles | 134 | The caregiver's relationship | "My mom and best friend, ____, …" |
| Fragment: the question's opening echoed | 122 | The form's labels ("A time we…", "The place we always…", "A holiday we…", "How we met") | "____ and I A time we had to go into this arena …" |
| Capital mid-sentence | 93 | The words start with a capital | "My friend, ____, Loves to bake bread." |
| Over 16 words | 78 | Long caregiver words, or a long frame | "My friend, ____, tells the same story about the war every single summer …" (22 words) |
| Repeated word | 71 | The words repeat the frame | "____ always always hums." "… and I always always went to the park." |
| Doubled subject (the words bring their own pronoun) | 70 | The words | "My friend, ____, She loves to bake bread." "… always They always say …" |
| Frame doesn't fit | 66 | "had a holiday we {text}" fits only "spent …" | "… and I had a holiday we went to Florida." |
| Missing article | 60 | A bare noun | "____ is nurse." "____ has Rex." |
| Doubled preposition | 35 | The words repeat the frame's preposition | "____ lives in in Ohio." "____ has a birthday on in March." |
| Doubled punctuation | 34 | A question mark the tidy step keeps | "… laughs at bad jokes?." "Who … bad jokes??" |
| Tense | 22 | "always {text}" after a present-tense answer | "____ and I always go to the diner." |
| A typo kept | 12 | The caregiver's words | "… say its not that easy." |
| Missing word | 11 | A number without "for" | "… have known each other 50 years." |
| Repeated title | 1 | A name that is also the relationship | "My grandma, Grandma Rose, enjoys gardening." |
| **Unresolved placeholder** | **0** | | |
| **Double space** | **0** | | |
| **a/an from the fixed words** | **0** | | |
| **Dangling word from an empty field** | **0** | An empty relationship uses the name-first shape; an empty year or date adds nothing; an empty fact is never saved | |
| **Blank missing or twice** | **0** | | |
| **Possessive** | **0** | "Charles’s", "D'Andre’s", "____’s" are all correct | |

**Where the problems come from.** The fixed words are clean (no placeholder, spacing, article or empty-field errors). Almost everything comes from **free text dropped into a frame that expects a particular shape of answer**:
- The form invites the wrong shape: "A time we…" makes people type "A time we …", and "They always say or do" makes people type "They always say …".
- Nothing adapts the words to the frame: no article, verb agreement, preposition or capital fixing.
- A few frames are stiff ("had a holiday we", "has worked or studied at", "has a birthday on", "has a … named").

**Pronouns.** No template guesses gender. The fixed words use only "I" and "you" (the person practicing), "This person", and "their" (singular, in "Think of their voice."). Pronouns appear only when the caregiver types them ("She loves …", "her husband"). No template needs a stored pronoun.

**Your three examples**, reproduced exactly by the current code:
- `shared` "A time we had to go into this arena and fight each other", no relationship → "____ and I A time we had to go into this arena and fight each other."
- the same with year 2002 and "A time our car came to life and we had to save the world" → "In 2002, ____ and I A time our car came to life and we had to save the world."
- `habit` "They always say its not that easy", relationship wife → "My wife, ____, always They always say its not that easy."

## Five current sentences, and the fluent version

| Now | Fluent |
| --- | --- |
| ____ and I A time we had to go into this arena and fight each other. | There was a time when ____ and I had to go into this arena and fight each other. |
| My wife, ____, always They always say its not that easy. | My wife, ____, always says its not that easy. *(it's, if you approve the typo list below)* |
| My friend, ____, and I had a holiday we went to Florida. | My friend, ____, and I went to Florida on a holiday. |
| ____ has a child named Noah and Ava. | ____ has two children, Noah and Ava. |
| My aunt, ____, is nurse. | My aunt, ____, works as a nurse. |

The first is 18 words: "There was a time when" costs five. Where a variant would push a sentence past 16 words, the variant choice should fall back to the shortest one that fits: "____ and I once had to go into this arena and fight each other." (14 words).

In your second example the fluent version keeps your words in your order: "In 2002, there was a time when our car came to life and ____ and I had to save the world." (20 words, so story approval shows its gentle length note). Moving "after our car came to life" to the end, as in your example, would mean reordering the caregiver's clauses, and "this arena" becoming "an arena" would mean changing their words. A deterministic fix can't do either safely. That is the kind of change an optional AI polish step could suggest for the caregiver to approve (step 3).

## Proposed fix (for your approval)

1. **One grammar helper**, `src/lib/grammar.ts`, import-free like `stories.ts`, and the only place these rules live:
   - `article` (a/an by sound, with the usual exceptions: an hour, a university);
   - `possessive` (’s, as now);
   - `joinList` (one; "A and B"; "A, B, and C");
   - `thirdPerson` (say → says, hum → hums, go → goes, have → has, be → is, carry → carries);
   - `capitalizeFirst`, and `lowerFirst` for a sentence-start word from a closed list (pronouns, articles, common verbs), so "Paris" and "The Wizard of Oz" keep their capitals;
   - `cleanSentence` (one space; no space before punctuation; no doubled punctuation; exactly one end mark).
2. **Fit the caregiver's words to the slot before filling it.** This is deterministic and adds no fact; only grammar words and words the caregiver already typed are moved. Per fact type:
   - drop an echoed opening ("A time we", "A time when", "The place we always", "A holiday we", "We met") or the caregiver's own leading pronoun ("She", "They always");
   - turn a base verb into the third person after "always" ("say" → "says");
   - drop a doubled preposition ("in Ohio" → "Ohio" after "lives in"; a birthday that says "in March" keeps its own "in");
   - add the article a bare role or animal needs ("nurse" → "a nurse"; "dog" → "a dog"; a name like "Rex" → "a pet named Rex");
   - use the plural frame for a list ("has children named Noah and Ava");
   - lowercase a sentence-start word ("Loves" → "loves");
   - drop a trailing ? or !;
   - for the relationship, drop a leading article and lowercase a title after "My" ("my grandma"), and use the name-first shape when the name already holds the relationship ("Grandma Rose").
3. **Fluent slot templates (Mad Libs style).**
   - Each fact type gets a frame with named slots (`{who}` is "My aunt, ____," or "____", `{text}`, `{year}`, `{asOf}`) and bridge words. An optional slot adds its clause only when it is filled.
   - **Two or three wording variants per type**, chosen from a stable hash of the card id, so a card reads the same every time. For example, shared: "There was a time when {who} and I {text}." / "I remember when {who} and I {text}." / "{who} and I once {text}."
   - The stiff frames are rewritten:
     - holiday: "{who} and I spent a holiday {at …}" or "… {text} on a holiday";
     - workplace: "{who} has worked at {text}";
     - birthday: "{who}’s birthday is on {text}";
     - partner and child: "{who}’s partner is {text}", "{who} has children named …";
     - known: "{who} and I have known each other {for} {text}".
   - Present tense, at most one connecting clause, 8 to 16 words with typical answers, no idioms or passive voice.
4. **The blank stays clean.** Exactly one blank, never inside a bridge word; the answer never elsewhere in the sentence (the existing `saysName` rule); only one name can fit (the existing same-fact rule in `namesToOffer`).
5. **The hint ladder is unchanged:** the same order, the same rungs, the same facts. The fact hint is built by the same frames, so "This person and I A time we …" becomes "This person and I had to …".
6. **Tests and a permanent check** in `npm test`:
   - every template and variant × the whole fictional input set × every optional field filled and empty;
   - it fails on placeholders, double spaces, a/an, end punctuation, repeated words, doubled punctuation, a dangling bridge word, over the word limit, a blank missing or twice, and the answer outside the blank;
   - each failure is proven on a planted sentence.

## Needs your decision before step 2

1. **How approved sentences stay unchanged.** Practice rebuilds every card from its fact, so new templates would reword approved cards too.
   - **Recommended:** a small wording version on each card. `cards.wording` (an integer, default 1) is added to `supabase/schema.sql` (which you rerun), and the local-only family gets the same field. Version-1 cards keep today's templates exactly; version 2 is the new wording.
   - Without a stored version there is no clean way: approval would switch a card back to the old wording, because practice can't tell an old card from a new one.
2. **Existing unapproved drafts.**
   - **Recommended:** the migration gives pending cards version 2, so the caregiver reviews the new wording before approving. Approved cards stay version 1. Skipped cards stay version 1 and are never shown.
   - Alternative: drafts move to version 2 only when the caregiver edits them.
3. **Typos in the caregiver's words.** The fix never rewrites words. Should a tiny fixed list of unambiguous fixes be allowed ("its not" → "it's not", "dont" → "don't", "im" → "I'm")? Recommended: no, for now. The caregiver sees the sentence on story approval and can fix it there.
4. **The form's labels cause the most common fragments** ("A time we…", "They always say or do"). Changing them to show the sentence being finished (for example "____ and I …" as the label's example) is a change to the Add a person screen, which isn't the review or Approve screen. Do it in step 2?
5. **"I" and "you".** Sentences speak as the person ("My aunt", "I call"), and questions speak to them ("Who did you meet …?", "You call this person …"). Keep as is? Recommended: keep. Each card is consistent within itself.
6. **Long caregiver words** (over 16 words). They are never cut. Story approval already shows a gentle length note (`PLAIN_MOST_WORDS`, 14). The new word-limit check applies to the templates with typical answers, not to what a caregiver types.

## Step 2: what was built (2026-11-18)

Approved on 2026-11-18 with these decisions: a stored wording version; drafts waiting move to the new wording; no typo fixes; relabel the questions that invite the frame's words; keep "I" in sentences and "you" in questions; long answers never cut.

- **`src/lib/grammar.ts`**: article (a/an by sound), possessive, list joining, plural, verb for one person, activity form, capitals (ordinary first words only, so names and titles keep theirs) and the finishing pass (spacing, doubled and end punctuation, a question mark outside a closing quote, an initialism's own period).
- **`src/lib/wording.ts`** (wording 2): `fitWords` fits the caregiver's words to the slot, and each kind of fact has slot frames with bridge words, two or three variants where the meaning allows ("habit", "regular", "marital" and "situation" keep one, so "always" is never softened and a sensitive fact is never restyled). The variant comes from a stable hash of the card's id; one that would run past 16 words falls back to the shortest.
- **Which cards use it**: `cards.wording` (1 or 2, default 1) and the same field on the phone. New and edited drafts are 2. Practice, story approval, Approve all and the export all read each card's own wording.
- **The form**: "NAME always…", "NAME and I once…", "NAME and I always…", "NAME and I spent a holiday…", "NAME and I met…", where NAME is the first name (or "This person" before a name, or for a first name over 12 letters, since the label line is one line). Placeholders are short fictional examples. No field, step, stored value or other screen changed.
- **Checks**: `scripts/check-sentences.mjs` in `npm test` (160,080 wording-2 outputs and the 22,398-output wording-1 fingerprint).

### Before and after (fictional people)

| Person and answer | Wording 1 (kept for approved cards) | Wording 2 (new drafts) |
| --- | --- | --- |
| June, shared: "A time we had to go into this arena and fight each other" | ____ and I A time we had to go into this arena and fight each other. | I remember when ____ and I had to go into this arena and fight each other. |
| Leo, shared, 2002: "A time our car came to life and we had to save the world" | In 2002, ____ and I A time our car came to life and we had to save the world. | In 2002, there was a time when our car came to life and ____ and I had to save the world. |
| Ruth (wife), habit: "They always say its not that easy" | My wife, ____, always They always say its not that easy. | My wife, ____, always says its not that easy. |
| Omar (friend), holiday: "went to Florida" | My friend, ____, and I had a holiday we went to Florida. | My friend, ____, and I went to Florida on a holiday. |
| Mae (granddaughter), work: "nurse" | My granddaughter, ____, is nurse. | My granddaughter, ____, is a nurse. |
| June (aunt), child: "Noah and Ava" | My aunt, ____, has a child named Noah and Ava. | My aunt, ____, is the parent of Noah and Ava. |
| Leo (neighbor), pet: "Rex" | My neighbor, ____, has Rex. | My neighbor, ____, has a pet named Rex. |
| Ruth (the neighbor), memory: "She loves to bake bread" | My the neighbor, ____, She loves to bake bread. | My neighbor, ____, loves to bake bread. |
| Omar (friend), met: "We met at church" | My friend, ____, and I met We met at church. | I met my friend, ____, at church. |
| Mae (Grandma), home: "in Ohio" | My Grandma, ____, lives in in Ohio. | My grandma, ____, lives in Ohio. |
| June (aunt), interest: "to paint" | My aunt, ____, enjoys to paint. | My aunt, ____, likes painting. |
| Leo (cousin), known: "50 years" | My cousin, ____, and I have known each other 50 years. | I have known my cousin, ____, for 50 years. |

### Existing data

- **Approved and skipped cards** keep wording 1, exactly: the server's on the schema rerun, the phone's local family, the sample people and the local deck.
- **Drafts waiting for approval** move to wording 2 once: on the server when the schema rerun first adds the column, on the phone the first time the app opens after the update. Story approval then shows the new sentence, and approving it approves that wording. Nothing about the draft but its sentence changes (its words, id, status, photo, schedule and phrasings off stay).
- **A card the caregiver edits** becomes a wording-2 draft, as any edit already sends a card back for approval. A relationship change keeps each card's wording.
- **On purpose:** a person's sheet shows **Use the new wording** while any of their stories is in wording 1. After a confirmation it moves them all; approved ones go back to story approval (out of practice until approved; Approve all on the sheet does it in one tap); skipped ones stay skipped. A whole deck moves person by person.

## Step 3: should an AI "polish" step be added later?

**Worth considering, not now.** Wording 2 removes every rule-based error the audit found, so what remains is style: reordering a caregiver's clauses ("after our car came to life"), choosing a better word ("an arena" for "this arena"), or splitting a long memory. Only a language model does that well, and only the caregiver should accept it.

What it would take:
- **A new third party for signed-in caregivers**: Anthropic, receiving one fact's words at a time. Today AI runs only with sign-in off (`AI_AVAILABLE`), so this widens its reach.
- **Consent**: a clear opt-in per caregiver (the existing `AiConsent` pattern), off by default, revocable in Settings.
- **The privacy line**: the existing masking (`src/lib/ai-request.ts`) covers names; a polish request would send the caregiver's own sentence, so the same rules (no photos, no test data, no names) and the server-side checks (`src/lib/ai-check.ts`, every content word kept) would need to apply to a rewrite rather than a new sentence.
- **Approval**: a suggestion beside the deterministic sentence on story approval, accepted or ignored, never applied automatically. That changes the review screen, which this change deliberately didn't.
- **A policy update and a new `POLICY_VERSION`**, with `docs/DATA-INVENTORY.md`, the App Privacy answers ("Other User Content" shared with a third party) and the store listing updated.
- **Cost and abuse limits**: the existing per-install and global caps.

Given the review-screen change, the new third party for signed-in users and a policy bump, the deterministic wording should be tried with real caregivers first; add the polish step only if they still edit many sentences by hand.

## The table

Every distinct sentence with a problem for one plain relationship ("friend") and no date lead, plus each odd relationship, the date leads, the names and the hints. "____" is the blank.

| Template | Input | Output | What is wrong |
| --- | --- | --- | --- |
| memory/sentence | memory: "Loves to bake bread", relationship "friend" | My friend, ____, Loves to bake bread. | capital mid-sentence ("Loves") |
| memory/ask | memory: "Loves to bake bread", relationship "friend" | Who Loves to bake bread? | capital mid-sentence ("Loves") |
| memory/who | memory: "Loves to bake bread", relationship "friend" | This person Loves to bake bread. Who is this? | capital mid-sentence ("Loves") |
| memory/fact hint | memory: "Loves to bake bread", relationship "friend" | This person Loves to bake bread. | capital mid-sentence ("Loves") |
| memory/sentence | memory: "She loves to bake bread", relationship "friend" | My friend, ____, She loves to bake bread. | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| memory/ask | memory: "She loves to bake bread", relationship "friend" | Who She loves to bake bread? | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| memory/who | memory: "She loves to bake bread", relationship "friend" | This person She loves to bake bread. Who is this? | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| memory/fact hint | memory: "She loves to bake bread", relationship "friend" | This person She loves to bake bread. | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| memory/sentence | memory: "always laughs at bad jokes?", relationship "friend" | My friend, ____, always laughs at bad jokes?. | doubled punctuation; question mark kept, then a period |
| memory/ask | memory: "always laughs at bad jokes?", relationship "friend" | Who always laughs at bad jokes?? | doubled punctuation; question mark kept, then a period |
| memory/who | memory: "always laughs at bad jokes?", relationship "friend" | This person always laughs at bad jokes?. Who is this? | doubled punctuation; question mark kept, then a period |
| memory/fact hint | memory: "always laughs at bad jokes?", relationship "friend" | This person always laughs at bad jokes?. | doubled punctuation; question mark kept, then a period |
| memory/sentence | memory: "tells the same story about the war every single summer when the whole family gathers at the lake house", relationship "friend" | My friend, ____, tells the same story about the war every single summer when the whole family gathers at the lake house. | too long (22 words) |
| memory/ask | memory: "tells the same story about the war every single summer when the whole family gathers at the lake house", relationship "friend" | Who tells the same story about the war every single summer when the whole family gathers at the lake house? | too long (20 words) |
| memory/who | memory: "tells the same story about the war every single summer when the whole family gathers at the lake house", relationship "friend" | This person tells the same story about the war every single summer when the whole family gathers at the lake house. Who is this? | too long (24 words) |
| memory/fact hint | memory: "tells the same story about the war every single summer when the whole family gathers at the lake house", relationship "friend" | This person tells the same story about the war every single summer when the whole family gathers at the lake house. | too long (21 words) |
| work/sentence | work: "nurse", relationship "friend" | My friend, ____, is nurse. | missing article ("is nurse") |
| work/ask | work: "nurse", relationship "friend" | Who is nurse? | missing article ("is nurse") |
| work/who | work: "nurse", relationship "friend" | This person is nurse. Who is this? | missing article ("is nurse") |
| work/fact hint | work: "nurse", relationship "friend" | This person is nurse. | missing article ("is nurse") |
| work/sentence | work: "nurse", no relationship, as of May 2026 | As of May 2026, ____ is nurse. | missing article ("is nurse") |
| work/sentence | work: "teaches math at the high school", relationship "friend" | My friend, ____, is teaches math at the high school. | agreement (a verb after "is"/"worked as") |
| work/ask | work: "teaches math at the high school", relationship "friend" | Who is teaches math at the high school? | agreement (a verb after "is"/"worked as") |
| work/who | work: "teaches math at the high school", relationship "friend" | This person is teaches math at the high school. Who is this? | agreement (a verb after "is"/"worked as") |
| work/fact hint | work: "teaches math at the high school", relationship "friend" | This person is teaches math at the high school. | agreement (a verb after "is"/"worked as") |
| work/sentence | work: "teaches math at the high school", no relationship, as of May 2026 | As of May 2026, ____ is teaches math at the high school. | agreement (a verb after "is"/"worked as") |
| pastwork/sentence | pastwork: "teacher", relationship "friend" | My friend, ____, worked as teacher. | missing article ("is nurse") |
| pastwork/ask | pastwork: "teacher", relationship "friend" | Who worked as teacher? | missing article ("is nurse") |
| pastwork/who | pastwork: "teacher", relationship "friend" | This person worked as teacher. Who is this? | missing article ("is nurse") |
| pastwork/fact hint | pastwork: "teacher", relationship "friend" | This person worked as teacher. | missing article ("is nurse") |
| workplace/sentence | workplace: "Mercy Hospital", relationship "friend" | My friend, ____, has worked or studied at Mercy Hospital. | choppy: "has worked or studied at" reads like a form |
| workplace/ask | workplace: "Mercy Hospital", relationship "friend" | Who has worked or studied at Mercy Hospital? | choppy: "has worked or studied at" reads like a form |
| workplace/who | workplace: "Mercy Hospital", relationship "friend" | This person has worked or studied at Mercy Hospital. Who is this? | choppy: "has worked or studied at" reads like a form |
| workplace/fact hint | workplace: "Mercy Hospital", relationship "friend" | This person has worked or studied at Mercy Hospital. | choppy: "has worked or studied at" reads like a form |
| workplace/sentence | workplace: "the post office", relationship "friend" | My friend, ____, has worked or studied at the post office. | choppy: "has worked or studied at" reads like a form |
| workplace/ask | workplace: "the post office", relationship "friend" | Who has worked or studied at the post office? | choppy: "has worked or studied at" reads like a form |
| workplace/who | workplace: "the post office", relationship "friend" | This person has worked or studied at the post office. Who is this? | choppy: "has worked or studied at" reads like a form |
| workplace/fact hint | workplace: "the post office", relationship "friend" | This person has worked or studied at the post office. | choppy: "has worked or studied at" reads like a form |
| workplace/sentence | workplace: "Lincoln High School and Ohio State", relationship "friend" | My friend, ____, has worked or studied at Lincoln High School and Ohio State. | choppy: "has worked or studied at" reads like a form |
| workplace/ask | workplace: "Lincoln High School and Ohio State", relationship "friend" | Who has worked or studied at Lincoln High School and Ohio State? | choppy: "has worked or studied at" reads like a form |
| workplace/who | workplace: "Lincoln High School and Ohio State", relationship "friend" | This person has worked or studied at Lincoln High School and Ohio State. Who is this? | choppy: "has worked or studied at" reads like a form |
| workplace/fact hint | workplace: "Lincoln High School and Ohio State", relationship "friend" | This person has worked or studied at Lincoln High School and Ohio State. | choppy: "has worked or studied at" reads like a form |
| plans/sentence | plans: "retire next year", no relationship, as of May 2026 | As of May 2026, ____ is retire next year. | agreement (a verb after "is"/"worked as") |
| interest/sentence | interest: "gardening", relationship "Grandma" | My Grandma, ____, enjoys gardening. | relationship capitalized mid-sentence ("My Grandma") |
| interest/sentence | interest: "gardening", relationship "the neighbor" | My the neighbor, ____, enjoys gardening. | relationship with its own article ("My the neighbor") |
| interest/sentence | interest: "gardening", relationship "an aunt" | My an aunt, ____, enjoys gardening. | relationship with its own article ("My the neighbor") |
| interest/sentence | interest: "gardening", relationship "mom and best friend" | My mom and best friend, ____, enjoys gardening. | relationship of two roles reads oddly |
| interest/sentence | interest: "to paint", relationship "friend" | My friend, ____, enjoys to paint. | agreement ("enjoys to paint", "enjoys knit") |
| interest/ask | interest: "to paint", relationship "friend" | Who enjoys to paint? | agreement ("enjoys to paint", "enjoys knit") |
| interest/who | interest: "to paint", relationship "friend" | This person enjoys to paint. Who is this? | agreement ("enjoys to paint", "enjoys knit") |
| interest/fact hint | interest: "to paint", relationship "friend" | This person enjoys to paint. | agreement ("enjoys to paint", "enjoys knit") |
| interest/sentence | interest: "knit", relationship "friend" | My friend, ____, enjoys knit. | agreement ("enjoys to paint", "enjoys knit") |
| interest/ask | interest: "knit", relationship "friend" | Who enjoys knit? | agreement ("enjoys to paint", "enjoys knit") |
| interest/who | interest: "knit", relationship "friend" | This person enjoys knit. Who is this? | agreement ("enjoys to paint", "enjoys knit") |
| interest/fact hint | interest: "knit", relationship "friend" | This person enjoys knit. | agreement ("enjoys to paint", "enjoys knit") |
| movie/sentence | movie: "The Wizard of Oz", relationship "friend" | My friend, ____, loves the movie The Wizard of Oz. | capital mid-sentence ("The") |
| movie/favorite | movie: "The Wizard of Oz", relationship "friend" | ____’s favorite movie is The Wizard of Oz. | capital mid-sentence ("The") |
| movie/ask | movie: "The Wizard of Oz", relationship "friend" | Who loves the movie The Wizard of Oz? | capital mid-sentence ("The") |
| movie/who | movie: "The Wizard of Oz", relationship "friend" | This person loves the movie The Wizard of Oz. Who is this? | capital mid-sentence ("The") |
| movie/fact hint | movie: "The Wizard of Oz", relationship "friend" | This person loves the movie The Wizard of Oz. | capital mid-sentence ("The") |
| habit/sentence | habit: "hum in the kitchen", relationship "friend" | My friend, ____, always hum in the kitchen. | agreement ("always hum" for one person) |
| habit/ask | habit: "hum in the kitchen", relationship "friend" | Who always hum in the kitchen? | agreement ("always hum" for one person) |
| habit/who | habit: "hum in the kitchen", relationship "friend" | This person always hum in the kitchen. Who is this? | agreement ("always hum" for one person) |
| habit/fact hint | habit: "hum in the kitchen", relationship "friend" | This person always hum in the kitchen. | agreement ("always hum" for one person) |
| habit/sentence | habit: "They always say its not that easy", relationship "friend" | My friend, ____, always They always say its not that easy. | capital mid-sentence ("They"); doubled subject (the words start with their own pronoun); caregiver’s typo kept ("its" for "it’s") |
| habit/ask | habit: "They always say its not that easy", relationship "friend" | Who always They always say its not that easy? | capital mid-sentence ("They"); doubled subject (the words start with their own pronoun); caregiver’s typo kept ("its" for "it’s") |
| habit/who | habit: "They always say its not that easy", relationship "friend" | This person always They always say its not that easy. Who is this? | capital mid-sentence ("They"); doubled subject (the words start with their own pronoun); caregiver’s typo kept ("its" for "it’s") |
| habit/fact hint | habit: "They always say its not that easy", relationship "friend" | This person always They always say its not that easy. | capital mid-sentence ("They"); doubled subject (the words start with their own pronoun); caregiver’s typo kept ("its" for "it’s") |
| habit/sentence | habit: "always hums", relationship "friend" | My friend, ____, always always hums. | repeated word "always"; repeated "always" |
| habit/ask | habit: "always hums", relationship "friend" | Who always always hums? | repeated word "always"; repeated "always" |
| habit/who | habit: "always hums", relationship "friend" | This person always always hums. Who is this? | repeated word "always"; repeated "always" |
| habit/fact hint | habit: "always hums", relationship "friend" | This person always always hums. | repeated word "always"; repeated "always" |
| habit/sentence | habit: "late", relationship "friend" | My friend, ____, always late. | agreement (an adjective after "always" needs "is") |
| habit/ask | habit: "late", relationship "friend" | Who always late? | agreement (an adjective after "always" needs "is") |
| habit/who | habit: "late", relationship "friend" | This person always late. Who is this? | agreement (an adjective after "always" needs "is") |
| habit/fact hint | habit: "late", relationship "friend" | This person always late. | agreement (an adjective after "always" needs "is") |
| habit/sentence | habit: "She says hello to everyone", relationship "friend" | My friend, ____, always She says hello to everyone. | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| habit/ask | habit: "She says hello to everyone", relationship "friend" | Who always She says hello to everyone? | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| habit/who | habit: "She says hello to everyone", relationship "friend" | This person always She says hello to everyone. Who is this? | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| habit/fact hint | habit: "She says hello to everyone", relationship "friend" | This person always She says hello to everyone. | capital mid-sentence ("She"); doubled subject (the words start with their own pronoun) |
| shared/who | shared: "got lost in Rome", relationship "friend" | This person and I got lost in Rome. Who is this? | choppy: "This person and I …" |
| shared/fact hint | shared: "got lost in Rome", relationship "friend" | This person and I got lost in Rome. | choppy: "This person and I …" |
| shared/sentence | shared: "A time we had to go into this arena and fight each other", relationship "friend" | My friend, ____, and I A time we had to go into this arena and fight each other. | too long (18 words); fragment: the words repeat the question’s own opening |
| shared/who | shared: "A time we had to go into this arena and fight each other", relationship "friend" | This person and I A time we had to go into this arena and fight each other. Who is this? | too long (20 words); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/fact hint | shared: "A time we had to go into this arena and fight each other", relationship "friend" | This person and I A time we had to go into this arena and fight each other. | too long (17 words); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/sentence | shared: "A time we had to go into this arena and fight each other", no relationship, year 2002 | In 2002, ____ and I A time we had to go into this arena and fight each other. | too long (18 words); fragment: the words repeat the question’s own opening |
| shared/sentence | shared: "we went to Paris", relationship "friend" | My friend, ____, and I we went to Paris. | doubled subject (the words start with their own pronoun) |
| shared/who | shared: "we went to Paris", relationship "friend" | This person and I we went to Paris. Who is this? | doubled subject (the words start with their own pronoun); choppy: "This person and I …" |
| shared/fact hint | shared: "we went to Paris", relationship "friend" | This person and I we went to Paris. | doubled subject (the words start with their own pronoun); choppy: "This person and I …" |
| shared/sentence | shared: "we went to Paris", no relationship, year 2002 | In 2002, ____ and I we went to Paris. | doubled subject (the words start with their own pronoun) |
| shared/sentence | shared: "went fishing every summer.", relationship "friend" | My friend, ____, and I went fishing every summer.. | doubled punctuation |
| shared/who | shared: "went fishing every summer.", relationship "friend" | This person and I went fishing every summer.. Who is this? | doubled punctuation; choppy: "This person and I …" |
| shared/fact hint | shared: "went fishing every summer.", relationship "friend" | This person and I went fishing every summer.. | doubled punctuation; choppy: "This person and I …" |
| shared/sentence | shared: "went fishing every summer.", no relationship, year 2002 | In 2002, ____ and I went fishing every summer.. | doubled punctuation |
| shared/sentence | shared: "A time our car came to life and we had to save the world", relationship "friend" | My friend, ____, and I A time our car came to life and we had to save the world. | too long (19 words); fragment: the words repeat the question’s own opening |
| shared/who | shared: "A time our car came to life and we had to save the world", relationship "friend" | This person and I A time our car came to life and we had to save the world. Who is this? | too long (21 words); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/fact hint | shared: "A time our car came to life and we had to save the world", relationship "friend" | This person and I A time our car came to life and we had to save the world. | too long (18 words); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/sentence | shared: "A time our car came to life and we had to save the world", no relationship, year 2002 | In 2002, ____ and I A time our car came to life and we had to save the world. | too long (19 words); fragment: the words repeat the question’s own opening |
| shared/sentence | shared: "The time we got lost", relationship "friend" | My friend, ____, and I The time we got lost. | fragment: the words repeat the question’s own opening |
| shared/who | shared: "The time we got lost", relationship "friend" | This person and I The time we got lost. Who is this? | fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/fact hint | shared: "The time we got lost", relationship "friend" | This person and I The time we got lost. | fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| shared/sentence | shared: "The time we got lost", no relationship, year 2002 | In 2002, ____ and I The time we got lost. | fragment: the words repeat the question’s own opening |
| regular/who | regular: "went for ice cream", relationship "friend" | This person and I always went for ice cream. Who is this? | choppy: "This person and I …" |
| regular/fact hint | regular: "went for ice cream", relationship "friend" | This person and I always went for ice cream. | choppy: "This person and I …" |
| regular/sentence | regular: "go to the diner", relationship "friend" | My friend, ____, and I always go to the diner. | tense ("always go" in a past memory) |
| regular/who | regular: "go to the diner", relationship "friend" | This person and I always go to the diner. Who is this? | tense ("always go" in a past memory); choppy: "This person and I …" |
| regular/fact hint | regular: "go to the diner", relationship "friend" | This person and I always go to the diner. | tense ("always go" in a past memory); choppy: "This person and I …" |
| regular/sentence | regular: "go to the diner", no relationship, year 2002 | In 2002, ____ and I always go to the diner. | tense ("always go" in a past memory) |
| regular/sentence | regular: "The place we always went was the diner", relationship "friend" | My friend, ____, and I always The place we always went was the diner. | capital mid-sentence ("The"); fragment: the words repeat the question’s own opening |
| regular/who | regular: "The place we always went was the diner", relationship "friend" | This person and I always The place we always went was the diner. Who is this? | capital mid-sentence ("The"); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| regular/fact hint | regular: "The place we always went was the diner", relationship "friend" | This person and I always The place we always went was the diner. | capital mid-sentence ("The"); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| regular/sentence | regular: "The place we always went was the diner", no relationship, year 2002 | In 2002, ____ and I always The place we always went was the diner. | capital mid-sentence ("The"); fragment: the words repeat the question’s own opening |
| regular/sentence | regular: "always went to the park", relationship "friend" | My friend, ____, and I always always went to the park. | repeated word "always"; repeated "always" |
| regular/who | regular: "always went to the park", relationship "friend" | This person and I always always went to the park. Who is this? | repeated word "always"; repeated "always"; choppy: "This person and I …" |
| regular/fact hint | regular: "always went to the park", relationship "friend" | This person and I always always went to the park. | repeated word "always"; repeated "always"; choppy: "This person and I …" |
| regular/sentence | regular: "always went to the park", no relationship, year 2002 | In 2002, ____ and I always always went to the park. | repeated word "always"; repeated "always" |
| holiday/sentence | holiday: "spent at the lake", relationship "friend" | My friend, ____, and I had a holiday we spent at the lake. | choppy: "had a holiday we …" is stiff |
| holiday/who | holiday: "spent at the lake", relationship "friend" | This person and I had a holiday we spent at the lake. Who is this? | choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/fact hint | holiday: "spent at the lake", relationship "friend" | This person and I had a holiday we spent at the lake. | choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/sentence | holiday: "spent at the lake", no relationship, year 2002 | In 2002, ____ and I had a holiday we spent at the lake. | choppy: "had a holiday we …" is stiff |
| holiday/sentence | holiday: "went to Florida", relationship "friend" | My friend, ____, and I had a holiday we went to Florida. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| holiday/who | holiday: "went to Florida", relationship "friend" | This person and I had a holiday we went to Florida. Who is this? | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/fact hint | holiday: "went to Florida", relationship "friend" | This person and I had a holiday we went to Florida. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/sentence | holiday: "went to Florida", no relationship, year 2002 | In 2002, ____ and I had a holiday we went to Florida. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| holiday/sentence | holiday: "Christmas at Grandma’s", relationship "friend" | My friend, ____, and I had a holiday we Christmas at Grandma’s. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| holiday/who | holiday: "Christmas at Grandma’s", relationship "friend" | This person and I had a holiday we Christmas at Grandma’s. Who is this? | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/fact hint | holiday: "Christmas at Grandma’s", relationship "friend" | This person and I had a holiday we Christmas at Grandma’s. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/sentence | holiday: "Christmas at Grandma’s", no relationship, year 2002 | In 2002, ____ and I had a holiday we Christmas at Grandma’s. | frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| holiday/sentence | holiday: "A holiday we spent in Maine", relationship "friend" | My friend, ____, and I had a holiday we A holiday we spent in Maine. | fragment: the words repeat the question’s own opening; frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| holiday/who | holiday: "A holiday we spent in Maine", relationship "friend" | This person and I had a holiday we A holiday we spent in Maine. Who is this? | too long (17 words); fragment: the words repeat the question’s own opening; frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/fact hint | holiday: "A holiday we spent in Maine", relationship "friend" | This person and I had a holiday we A holiday we spent in Maine. | fragment: the words repeat the question’s own opening; frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff; choppy: "This person and I …" |
| holiday/sentence | holiday: "A holiday we spent in Maine", no relationship, year 2002 | In 2002, ____ and I had a holiday we A holiday we spent in Maine. | fragment: the words repeat the question’s own opening; frame doesn’t fit ("had a holiday we went to …"); choppy: "had a holiday we …" is stiff |
| met/who | met: "at church in 1962", relationship "friend" | This person and I met at church in 1962. Who is this? | choppy: "This person and I …" |
| met/fact hint | met: "at church in 1962", relationship "friend" | This person and I met at church in 1962. | choppy: "This person and I …" |
| met/who | met: "in college", relationship "friend" | This person and I met in college. Who is this? | choppy: "This person and I …" |
| met/fact hint | met: "in college", relationship "friend" | This person and I met in college. | choppy: "This person and I …" |
| met/sentence | met: "We met at church", relationship "friend" | My friend, ____, and I met We met at church. | capital mid-sentence ("We"); doubled subject (the words start with their own pronoun); fragment: the words repeat the question’s own opening |
| met/ask-met | met: "We met at church", relationship "friend" | Who did you meet We met at church? | capital mid-sentence ("We"); doubled subject (the words start with their own pronoun); fragment: the words repeat the question’s own opening |
| met/who | met: "We met at church", relationship "friend" | This person and I met We met at church. Who is this? | capital mid-sentence ("We"); doubled subject (the words start with their own pronoun); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| met/fact hint | met: "We met at church", relationship "friend" | This person and I met We met at church. | capital mid-sentence ("We"); doubled subject (the words start with their own pronoun); fragment: the words repeat the question’s own opening; choppy: "This person and I …" |
| met/who | met: "when we were 5", relationship "friend" | This person and I met when we were 5. Who is this? | choppy: "This person and I …" |
| met/fact hint | met: "when we were 5", relationship "friend" | This person and I met when we were 5. | choppy: "This person and I …" |
| met/who | met: "through friends", relationship "friend" | This person and I met through friends. Who is this? | choppy: "This person and I …" |
| met/fact hint | met: "through friends", relationship "friend" | This person and I met through friends. | choppy: "This person and I …" |
| birthday/sentence | birthday: "March 3", relationship "friend" | My friend, ____, has a birthday on March 3. | choppy: "has a birthday on" reads like a form |
| birthday/who | birthday: "March 3", relationship "friend" | This person has a birthday on March 3. Who is this? | choppy: "has a birthday on" reads like a form |
| birthday/fact hint | birthday: "March 3", relationship "friend" | This person has a birthday on March 3. | choppy: "has a birthday on" reads like a form |
| birthday/sentence | birthday: "3/14", relationship "friend" | My friend, ____, has a birthday on 3/14. | choppy: "has a birthday on" reads like a form |
| birthday/who | birthday: "3/14", relationship "friend" | This person has a birthday on 3/14. Who is this? | choppy: "has a birthday on" reads like a form |
| birthday/fact hint | birthday: "3/14", relationship "friend" | This person has a birthday on 3/14. | choppy: "has a birthday on" reads like a form |
| birthday/sentence | birthday: "in March", relationship "friend" | My friend, ____, has a birthday on in March. | doubled preposition ("on in March"); choppy: "has a birthday on" reads like a form |
| birthday/who | birthday: "in March", relationship "friend" | This person has a birthday on in March. Who is this? | doubled preposition ("on in March"); choppy: "has a birthday on" reads like a form |
| birthday/fact hint | birthday: "in March", relationship "friend" | This person has a birthday on in March. | doubled preposition ("on in March"); choppy: "has a birthday on" reads like a form |
| birthday/sentence | birthday: "the 4th of July", relationship "friend" | My friend, ____, has a birthday on the 4th of July. | choppy: "has a birthday on" reads like a form |
| birthday/who | birthday: "the 4th of July", relationship "friend" | This person has a birthday on the 4th of July. Who is this? | choppy: "has a birthday on" reads like a form |
| birthday/fact hint | birthday: "the 4th of July", relationship "friend" | This person has a birthday on the 4th of July. | choppy: "has a birthday on" reads like a form |
| nickname/sentence | nickname: "J.J.", relationship "friend" | My friend, ____, goes by J.J.. | repeated word "j" |
| nickname/ask | nickname: "J.J.", relationship "friend" | Who goes by J.J.? | repeated word "j" |
| nickname/who | nickname: "J.J.", relationship "friend" | This person goes by J.J.. Who is this? | repeated word "j" |
| nickname/fact hint | nickname: "J.J.", relationship "friend" | This person goes by J.J.. | repeated word "j" |
| known/sentence | known: "all our lives", relationship "friend" | My friend, ____, and I have known each other all our lives. | choppy: "have known each other" is long for its meaning |
| known/who | known: "all our lives", relationship "friend" | This person and I have known each other all our lives. Who is this? | choppy: "have known each other" is long for its meaning; choppy: "This person and I …" |
| known/fact hint | known: "all our lives", relationship "friend" | This person and I have known each other all our lives. | choppy: "have known each other" is long for its meaning; choppy: "This person and I …" |
| known/sentence | known: "since 1962", relationship "friend" | My friend, ____, and I have known each other since 1962. | choppy: "have known each other" is long for its meaning |
| known/who | known: "since 1962", relationship "friend" | This person and I have known each other since 1962. Who is this? | choppy: "have known each other" is long for its meaning; choppy: "This person and I …" |
| known/fact hint | known: "since 1962", relationship "friend" | This person and I have known each other since 1962. | choppy: "have known each other" is long for its meaning; choppy: "This person and I …" |
| home/sentence | home: "in Ohio", relationship "friend" | My friend, ____, lives in in Ohio. | repeated word "in"; doubled preposition ("lives in in") |
| home/ask | home: "in Ohio", relationship "friend" | Who lives in in Ohio? | repeated word "in"; doubled preposition ("lives in in") |
| home/who | home: "in Ohio", relationship "friend" | This person lives in in Ohio. Who is this? | repeated word "in"; doubled preposition ("lives in in") |
| home/fact hint | home: "in Ohio", relationship "friend" | This person lives in in Ohio. | repeated word "in"; doubled preposition ("lives in in") |
| home/sentence | home: "in Ohio", no relationship, as of May 2026 | As of May 2026, ____ lives in in Ohio. | repeated word "in"; doubled preposition ("lives in in") |
| partner/sentence | partner: "Sam", relationship "friend" | My friend, ____, has a partner named Sam. | choppy: "has a … named" reads like a form |
| partner/who | partner: "Sam", relationship "friend" | This person has a partner named Sam. Who is this? | choppy: "has a … named" reads like a form |
| partner/fact hint | partner: "Sam", relationship "friend" | This person has a partner named Sam. | choppy: "has a … named" reads like a form |
| partner/sentence | partner: "Sam and Alex", relationship "friend" | My friend, ____, has a partner named Sam and Alex. | agreement ("a partner named Sam and Alex"); choppy: "has a … named" reads like a form |
| partner/favorite | partner: "Sam and Alex", relationship "friend" | ____’s partner is Sam and Alex. | agreement ("a partner named Sam and Alex") |
| partner/whose | partner: "Sam and Alex", relationship "friend" | Whose partner is Sam and Alex? | agreement ("a partner named Sam and Alex") |
| partner/who | partner: "Sam and Alex", relationship "friend" | This person has a partner named Sam and Alex. Who is this? | agreement ("a partner named Sam and Alex"); choppy: "has a … named" reads like a form |
| partner/fact hint | partner: "Sam and Alex", relationship "friend" | This person has a partner named Sam and Alex. | agreement ("a partner named Sam and Alex"); choppy: "has a … named" reads like a form |
| child/sentence | child: "Noah", relationship "friend" | My friend, ____, has a child named Noah. | choppy: "has a … named" reads like a form |
| child/ask | child: "Noah", relationship "friend" | Who has a child named Noah? | choppy: "has a … named" reads like a form |
| child/who | child: "Noah", relationship "friend" | This person has a child named Noah. Who is this? | choppy: "has a … named" reads like a form |
| child/fact hint | child: "Noah", relationship "friend" | This person has a child named Noah. | choppy: "has a … named" reads like a form |
| child/sentence | child: "Noah and Ava", relationship "friend" | My friend, ____, has a child named Noah and Ava. | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/ask | child: "Noah and Ava", relationship "friend" | Who has a child named Noah and Ava? | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/who | child: "Noah and Ava", relationship "friend" | This person has a child named Noah and Ava. Who is this? | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/fact hint | child: "Noah and Ava", relationship "friend" | This person has a child named Noah and Ava. | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/sentence | child: "Noah, Ava and Liam", relationship "friend" | My friend, ____, has a child named Noah, Ava and Liam. | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/ask | child: "Noah, Ava and Liam", relationship "friend" | Who has a child named Noah, Ava and Liam? | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/who | child: "Noah, Ava and Liam", relationship "friend" | This person has a child named Noah, Ava and Liam. Who is this? | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/fact hint | child: "Noah, Ava and Liam", relationship "friend" | This person has a child named Noah, Ava and Liam. | agreement ("a child named Noah and Ava"); choppy: "has a … named" reads like a form |
| child/sentence | child: "two daughters", relationship "friend" | My friend, ____, has a child named two daughters. | choppy: "has a … named" reads like a form |
| child/ask | child: "two daughters", relationship "friend" | Who has a child named two daughters? | choppy: "has a … named" reads like a form |
| child/who | child: "two daughters", relationship "friend" | This person has a child named two daughters. Who is this? | choppy: "has a … named" reads like a form |
| child/fact hint | child: "two daughters", relationship "friend" | This person has a child named two daughters. | choppy: "has a … named" reads like a form |
| pet/sentence | pet: "Rex", relationship "friend" | My friend, ____, has Rex. | missing article ("has dog", "has Rex") |
| pet/ask | pet: "Rex", relationship "friend" | Who has Rex? | missing article ("has dog", "has Rex") |
| pet/who | pet: "Rex", relationship "friend" | This person has Rex. Who is this? | missing article ("has dog", "has Rex") |
| pet/fact hint | pet: "Rex", relationship "friend" | This person has Rex. | missing article ("has dog", "has Rex") |
| pet/sentence | pet: "dog", relationship "friend" | My friend, ____, has dog. | missing article ("has dog", "has Rex") |
| pet/ask | pet: "dog", relationship "friend" | Who has dog? | missing article ("has dog", "has Rex") |
| pet/who | pet: "dog", relationship "friend" | This person has dog. Who is this? | missing article ("has dog", "has Rex") |
| pet/fact hint | pet: "dog", relationship "friend" | This person has dog. | missing article ("has dog", "has Rex") |
| interest/sentence, filled | name "Grandma Rose", relationship "grandma" | My grandma, Grandma Rose, enjoys gardening. | repeated word "grandma"; repeated title ("my grandma, Grandma Rose") |
| hint | relationship "Grandma", step 1 | Take your time. This person loves lasagna. | relationship capitalized mid-sentence ("your Grandma") |
| hint | relationship "Grandma", step 2 | This is your Grandma. This person loves lasagna. | relationship capitalized mid-sentence ("your Grandma") |
| hint | relationship "the neighbor", step 2 | This is your the neighbor. This person loves lasagna. | relationship with its own article ("your the neighbor") |
