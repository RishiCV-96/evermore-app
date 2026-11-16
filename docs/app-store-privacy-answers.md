# App Store privacy answers (draft)

**Draft for review by a lawyer or privacy professional.** Draft answers for App Store Connect → App Privacy, derived from `docs/DATA-INVENTORY.md` on 2026-11-13. Every answer marked **[REVIEW]** needs a decision before submission. Apple's definitions are at <https://developer.apple.com/app-store/app-privacy-details/>; re-read them before answering, as they change.

These answers describe the **shipped app**: sign-in on, AI questions off. If AI questions are ever turned on for signed-in users, revisit them: Anthropic would become a third party receiving "Other User Content".

## The first question

**Do you or your third-party partners collect data from this app?** Yes. Apple's "collect" means sending data off the device in a way that you or a partner can access it for longer than a real-time request needs. Everything the caregiver enters, and the person's practice, is stored on Supabase.

## Tracking

**Is any data used for tracking?** No, for every data type. Nothing is linked with third-party data for advertising or advertising measurement, and nothing is shared with a data broker. There are no ad, analytics or attribution SDKs, and the app never asks for the advertising identifier, so **no App Tracking Transparency prompt** is needed.

## Data types

For every type below: **Linked to the user: Yes** (it is stored in the caregiver's account). **Used for tracking: No.** **Purpose: App Functionality** only, unless stated otherwise.

| Apple data type | Collected? | What it is in Evermore | Notes |
| --- | --- | --- | --- |
| Contact Info → **Email Address** | Yes | The caregiver's sign-in email | Also used to send the confirmation and reset emails (App Functionality) |
| Contact Info → **Name** | Yes | Names of the people the caregiver adds, and the person's first name | **[REVIEW]** These are names of people other than the user. Apple says to disclose a data type when the app asks the user to enter it, so the conservative answer is Yes |
| Contact Info → Phone Number | No | | |
| Contact Info → Physical Address | No | | **[REVIEW]** The "Lives in" answer asks for a place (for example "Ohio"), not an address. A caregiver could type a street address in a free-text field; Apple treats free-form text as Other User Content |
| Contact Info → Other User Contact Info | No | | |
| Health & Fitness → **Health** | **[REVIEW]**, recommended Yes | Card records and the Memory score describe a person's memory practice, in an app for early memory loss | Apple's definition covers "any other user provided health or medical data". The conservative answer is Yes. Declaring it brings guideline 5.1.3 into play: no use for advertising or marketing. |
| Health & Fitness → Fitness | No | | |
| Financial Info, Location (precise or coarse), Sensitive Info, Contacts, Browsing History, Search History, Purchases | No | | **[REVIEW]** Sensitive Info: optional answers such as marital status and family situation aren't in Apple's sensitive list, but confirm |
| User Content → **Photos or Videos** | Yes | Photos of people and shared memories that the caregiver picks | Stored privately. Never analyzed by AI or face recognition |
| User Content → Audio Data | No | | Read-aloud is done by the phone and produces no audio file |
| User Content → Gameplay Content, Customer Support | No | | Customer Support becomes Yes if a support channel collects data in the app |
| User Content → **Other User Content** | Yes | The caregiver's profile answers and stories (relationship, nickname, birthday, work, home, interests, shared memories) | |
| Identifiers → **User ID** | Yes | The account's user ID; the person's User ID (a username the caregiver chooses) | |
| Identifiers → Device ID | No | | **[REVIEW]** The app no longer stores any phone's name (PIN pairing was removed on 2026-11-16); names an earlier build stored for paired phones stay on the server until the account is deleted or the tables are dropped. No device-level identifier. The AI install token can't be reached in the shipped app |
| Usage Data → **Product Interaction** | Yes | Sessions; for each card, the answers chosen, when, hints shown and time on screen (shown to the caregiver as Insights, and used to schedule cards) | **[REVIEW]** Purpose: App Functionality (it is a feature the caregiver sees), not Analytics. Nothing is used to study how people use the app |
| Usage Data → Advertising Data, Other Usage Data | No | | |
| Diagnostics → Crash Data, Performance Data, Other Diagnostic Data | No | | No crash or diagnostics SDK. Crash reports Apple collects from users who opt in are Apple's, not the app's. **[REVIEW]** Confirm Apple's current guidance on that point |
| Other Data | No | | Agreement records (which policy version, when) are stored. **[REVIEW]** Whether they need a type of their own; the conservative choice is to treat them as part of the account |

## Things to check before you answer

1. **The research choice is a stored preference, not research.** Nothing is used for research, so no research purpose applies today. If research starts, the answers change. Apple's guideline 5.1.3(iii) and (iv) require participant consent with specific contents, and approval from an independent ethics review board, for health-related human subject research. **[REVIEW]**
2. **Supabase is your service provider**, not a third party you "share" data with for its own purposes. The answers above still count the data as collected. **[REVIEW]**
3. **Email delivery** goes through Supabase's built-in email. If you switch to a custom SMTP provider, nothing changes in these answers (it is still App Functionality), but the privacy policy must name it.
4. **Optional disclosure doesn't apply.** Apple's exemption requires collection that is infrequent, optional and not part of the app's main purpose. Evermore's data is its main purpose.
