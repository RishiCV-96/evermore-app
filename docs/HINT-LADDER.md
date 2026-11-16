# The hint ladder on the person's card

Written 2026-11-16, from the code (`src/lib/card-steps.ts`, `hintAt` and `hintLadder` in `src/lib/stories.ts`, `PracticeCard` in `src/components/practice-screen.tsx`), before and after the fix that makes every wrong tap advance the ladder.

## The ladder (unchanged)

The rungs, in order (`HINT_LADDER`): **another fact** the caregiver gave, **the relationship** ("This is your mom."), **the first letter** ("The name starts with S."), **fewer names** ("Let’s try with fewer names.", one other name set aside), then **the answer** itself ("It’s June.", that name's button shown selected). A rung the caregiver turned off for that person, or one with nothing true and new to say, is skipped (`hintLadder`); with every rung off there is one "Take your time." and then the answer. The newest rung leads and the first stays beside it. No hint content was added or changed.

Every card kind that asks for a name or a fact has the ladder: blank, ask, who, photo-only ("Who is this?"), reverse (AI, sign-in off only) and reveal cards. There is no pick-the-photo card in the app.

## How it behaved before (2026-11-13 build)

`chooseName` and `askForHelp` in `src/lib/card-steps.ts` are pure and each moves one step (`misses + 1`) per call. On paper every wrong tap advanced the ladder, including the same wrong name tapped again. On the card it didn't always, for three reasons:

1. **Taps read a stale state.** `PracticeCard` kept the steps in React state, and both press handlers (`choose`, `notSureTapped`) computed the next step from `steps` as it was when the card last drew. Two taps landing before React drew again (a quick double tap, a tremor, the same name pressed twice, or a name and **I’m not sure** together) both started from the same step and set the same next step: **two taps, one step**. The card record still kept both selections, so it showed two names chosen against one hint. A name and **I’m not sure** in the same frame could also overwrite each other's step, so the record's rungs and help steps could disagree.
2. **A wrong name stayed live.** After a wrong tap the same button looked and worked exactly as before, so the same mistake could loop. Each loop did move a step (if it wasn't lost to reason 1), but nothing told the person that name had been tried.
3. **Steps past the answer.** Once the hint said the answer, the other names stayed live. Tapping one counted another step (`misses` 6, 7, …) with nothing new shown, and recorded the last rung again in the card's `hints`.

## How it behaves now

- **One step per tap, from the newest state.** The card keeps the newest steps in a ref (`latest`) beside its state. Each handler starts from it and writes the next step back at once, so a second tap before the card draws again steps on from the first. One tap is one call, so one step: never two for a tap, never skipped, never back.
- **A name once chosen is dimmed and disabled** (`nameLive`, `tried`). It's the `BigButton`'s existing disabled look (half opacity, no colour, no red, no shake, no sound), and VoiceOver hears "dimmed". If a second tap lands before it dims, it still counts as a name chosen and still moves one step, to a new hint.
- **The answer is the last step.** At the answer nothing moves further (`stepOn` stays put). Every other name dims, so the answer's button (shown selected) is the only one live, and the person taps it to finish. Every card ends on a success. A stray tap that lands before the others dim is still counted as a name chosen, but shows nothing new.
- **"I'm not sure" and wrong taps share one ladder state.** Both go through the same `stepOn` from the same `latest` steps, so alternating them moves one step each, and the control goes once the answer shows.
- **Fewer names** is unchanged: it sets aside the last other name chosen, or the first other name offered when none was chosen yet, and never the answer. With a dimmed name it removes that dimmed button, so at least two live names remain as before.
- **Screen readers.** After any new step (a wrong tap or **I’m not sure**), focus moves to the new hint (`sendAccessibilityEvent(..., 'focus')` once it is laid out), so VoiceOver reads the hint and focus doesn't stay on a button that just dimmed. This replaces the separate announcement a wrong tap made before, which would now read the hint twice.
- **Reduce Motion, type and targets** are as before: the hint fades in instead of sliding, the scroll doesn't animate, names keep their 64pt buttons at the person's text size.

## What did not change

- **Recording.** Each tap is pushed to `selections` as before, so "How answers were found" (right away, second try, with help) reads exactly as it did (`resolvedOn`). The rungs recorded in `hints` are the same as before for every tap up to the answer. Only a tap that lands after the answer showed (now possible only in the moment before the others dim) records no extra rung.
- **Scheduling.** `cardResult` is still tries = names chosen + 1 and hints used = steps taken, so a hinted card moves back a step and comes back in the session as before.
- **Reveal cards.** Eligibility and the unlock rules (`src/lib/reveal.ts`) are untouched: any wrong tap or hint means no first-try answer, so no reveal unlock.
- **The Memory score** and every Insights figure: unchanged.

## A consequence worth knowing

With three names and the ladder's four rungs, wrong taps alone can now dim both other names after two steps, leaving only the right name live before the hint has said it. The hint still shows only the step it reached (nothing is skipped), and the person still taps the right name. **I’m not sure** stays available to walk the rest of the ladder. With two names, one wrong tap leaves only the right one. This is the intended effect of dimming (the same mistake can't loop), and is listed for the clinician in `docs/QUESTION-AUDIT.md`.

## Checked by

`scripts/check-logic.mjs`: repeated wrong taps, the same name twice, two different names, the end of the ladder, dimming, all 16 hint settings on every card kind with wrong taps alone and mixed with **I’m not sure**, recording and scheduling against the earlier rules, and the card's source (handlers start from `latest`, names disabled through `nameLive`, focus to the hint, no red, sound or haptics). The web build was walked at small and large iPhone sizes and at Large and Extra large text.
