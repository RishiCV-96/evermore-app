# Brand walk, 2026-11-16

Screens after the Tandem rebrand (`docs/BRAND-AUDIT.md`), taken in the web build with Chrome. Fictional sample data only: the builds were exported from a `git archive` copy of the branch, so no real photo or the local deck could be in them. The person's screens use the five fictional sample people and their illustrations.

**Files** are named `<width>x<height>-<text size>-<light|dark>-<screen>.png`: 375x647 and 430x839 (the heights an iPhone leaves), Large and Extra large, light and dark. The app sets `userInterfaceStyle: "light"`, so its screens look the same in dark mode; the dark set shows that nothing changes.

| # | Screen | Build |
|---|---|---|
| 01 | The person's home (logo above Start) | local-only, sample deck |
| 02 | A practice card (no logo) | local-only, sample deck |
| 03 | The welcome (stacked logo, tagline) | sign-in on, local Supabase stand-in |
| 04 | Hello, the person's sign-in | sign-in on |
| 05 | The caregiver's welcome | sign-in on |
| 06 | Caregiver sign-in | sign-in on |
| 07 | Create an account | sign-in on |
| 08 | The agreements, ticked | sign-in on |
| 09 | The dashboard's header mark (Today) | sign-in on, a new test caregiver |
| 10 | Settings, About | sign-in on |
| 11 | The privacy policy | sign-in on |
| 12 | Export my data | sign-in on |

**The logo, checked on every screenshot** by the walk: its drawn proportions equal the kit's (within 1%), it sits wholly on screen, nothing covers it (except the Settings logos under the policy and export sheets, which are meant to be covered), and its wordmark is at least 4.5:1 on what it sits on. The audit was first shown to catch a planted stretched logo, one pushed off screen and one covered. No problem was found.

| Logo | 375x647 | 430x839 | Wordmark contrast |
|---|---|---|---|
| Welcome (stacked) | 170x94 | 220x122 | 13.9:1 |
| Home | 170x39 | 220x50 | 13.9:1 |
| Sign-in, Create an account, Hello | 152x35 | 168x38 | 13.9:1 |
| Settings, About | 168x38 | 168x38 | 13.9:1 |
| Dashboard header (mark) | 40x31 | 40x31 | (no wordmark) |

Sizes include the clear space of one lobe radius. The smallest lockup (152 points) draws its mark and wordmark 142 points wide, above the 140-point minimum; the header mark draws 31 points, above 24.
