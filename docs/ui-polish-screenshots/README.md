# UI polish walk, 2026-11-17

Before and after screenshots of Add a person and Settings for the UI polish pass (`docs/UI-POLISH-PLAN.md`). Taken in the web build with Chrome at 2x. **Fictional data only:**
- Every build was exported from a copy holding only files git doesn't ignore: a `git archive` of the code before the pass, and the working tree without ignored files. So no real photo, local deck, denylist or `.env` could be in them, and `scripts/check-no-real-data.mjs --bundle` passed on each.
- Photo requests were blocked.
- The people are the fictional sample deck and two invented names typed in the walk.
- Test accounts use the reserved `caregiver.evermore.invalid` domain, against the repo's local Supabase stand-in (`scripts/fakes/supabase-server.mjs`).

**Files** are named `<width>x<height>-<before|after>-<screen>.png`. 375x647 and 430x839 are the heights an iPhone leaves. The 375 walks ran with Reduce Motion off and the 430 walks with it on.

| Screen | Before | After |
|---|---|---|
| Add a person, empty | `add-step1` to `add-step8` (eight steps) | `add-step1` to `add-step5` (five steps); `add-step*-more-details` with every More details opened (375) |
| Add a person, filled | | `add-filled-step1` (initials on the placeholder, Not applicable marked), `add-filled-review` (Continue ready at 100%) |
| Story approval | | `story-approval` ("0 of 4 approved", the story cards), `story-approval-approved` (after Approve all) |
| Settings (sign-in on) | `settings-1-top`, `settings-2-set-up` (after making Their login), `settings-3-middle`, `settings-4-bottom` | the same four, plus `settings-5-delete` (Delete account's sheet, waiting for the typed word) |

**Measured** (the scrolling content of each step, empty, as first shown): 3,717pt before and 2,592pt after at 375x647 (30.3% shorter), 2,540pt at 430x839 (31.7%). The plan has the full table.

**Checked** by the walks: 60 checks on Add a person and story approval, 28 on Settings (10 before, 18 after). Each screen got the audit: no sideways scroll, no target under 44pt, no text under 4.5:1 (3:1 at 24pt and up), nothing red. The audit was first shown to catch a planted red word, a 30pt target, faint text and a wide element.
- **Settings** also checked the order on screen, Delete account at least 44pt below Account's card, its typed confirmation still waiting, and the status card saying Set up once Their login exists.
- **Add a person** also checked the keyboard, simulated with a 291pt shorter viewport, and old drafts opening on the right step.

**Large and Extra large text:** the caregiver's screens use the compact scale and ignore the app's Text size setting. They follow the phone's own text size up to 1.3x, which the web build can't simulate, so that needs a look on a phone.

## Sign-in, and the rest of the app (Steps 6 and 7)

**Sign-in** (sign-in on, the same stand-in): `<size>-<before|after>-signin-1-welcome`, `-signin-2-caregiver` and `-signin-3-create-account`, at 375x647 (Reduce Motion off) and 430x839 (on).

**The rest of the app** (local-only build, the sample deck): `<size>-<text size>-<motion|reduced>-<before|after>-<screen>.png`, in four configurations:
- 375x647 at Large, Reduce Motion off
- 375x647 at Extra large, Reduce Motion on
- 430x839 at Extra large, Reduce Motion off
- 430x839 at Large, Reduce Motion on

The walk practiced six real cards first, so Today, Trends and Insights have something to show.

| # | Screen | Shots |
|---|---|---|
| 01 | The person's home | after |
| 02 | A practice card | after |
| 03 | A hint | after |
| 04 | The success banner | after |
| 05 | Home after practicing | after |
| 06 | Today | before and after |
| 07 | Trends | before and after |
| 08 | Insights | before and after |
| 09 | People | before and after |
| 10 | A person's sheet | before and after |
| 11 | Settings (local-only) | before and after |

The person's screens weren't redrawn, so only "after" is kept for them; the brand walk (`docs/brand-screenshots`) has them from before. Their home is pixel-identical before and after in all four configurations. Practice cards are chosen at random, so those weren't compared pixel by pixel.

**Checked:** 66 checks after, 46 before. The usual audit ran on every screen, at 48pt on the person's screens and 44pt on the caregiver's. On every person screen after, no element has a box shadow. Sign-in and Settings: 24 checks after, 16 before. Add a person: 60 again on the final code.
