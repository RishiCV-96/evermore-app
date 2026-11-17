# Forgot password (caregiver accounts)

Written 2026-11-16. Diagnosed from the code, the in-memory Supabase (`scripts/fakes/supabase-server.mjs`) and Supabase's own documentation. The live project and its dashboard were **not** looked at, so the dashboard settings below are what Supabase does by default, to be confirmed there.

## Every Forgot password control

There is one: **Forgot password?** on the caregiver's Sign in step (`testID="forgot-password"`, `src/components/sign-in/caregiver-sign-in.tsx`). The person's Hello step has none, by design: their login has no email, and the caregiver resets it (below). Nothing in the app says "passcode".

## The path, end to end

1. **Sign in → Forgot password?** opens **Reset password** (`ForgotPassword`): the email, then **Send code** (it was "Send reset email").
2. `sendPasswordReset` (`src/data/account.ts`) calls `supabase.auth.resetPasswordForEmail(email)`, with no `redirectTo`. Supabase emails the address its **Reset password** template.
3. **Check your email** (`NewPassword`): the code from the email, a new password and its confirmation, **Save new password**, **Send again** (after a minute) and **Back to sign in**.
4. `resetPasswordWithCode` calls `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`, which signs the phone in, then `supabase.auth.updateUser({ password })`. The caregiver's home opens.

So a screen to set a new password **does** exist, and the app's side was already the code flow that works in Expo Go. It still fails in practice, for these reasons, in the order a caregiver meets them.

## Why it fails today

1. **The email has no code in it.** Supabase's default **Reset password** template holds only a link (`{{ .ConfirmationURL }}`), not the 6-digit code (`{{ .Token }}`). The app asks for a code the email never gives. This is the main reason.
2. **The link can't open the app.** The app sends no `redirectTo`, so the link goes through Supabase and lands on the project's **Site URL** (by default `http://localhost:3000`) in the phone's browser: a page that doesn't load. Even with a redirect, Expo Go can't be opened by a custom link, and the app has no handler for one (the client keeps no session from a URL). A link-based reset can't work in Expo Go; only the code can.
3. **The template can't be changed yet.** Supabase lets a project edit its email templates only once **custom SMTP** is set up; with the built-in sender, the Templates page asks for SMTP first, and a project without it is kept on the default templates. So reason 1 can't be fixed in the dashboard alone.
4. **The built-in sender reaches almost nobody.** Supabase's default email service delivers **only to members of the project's team** (others are refused), and **about 2 emails an hour for the whole project**. A real caregiver's address isn't on the team, so nothing arrives at all. The app, correctly, shows the same calm message whether or not anything was sent, so it looks as if it worked.
5. **A code bug, fixed here:** if Supabase took the code but refused the new password (its own password rules, or the same password as before), the phone was already signed in by the code. The caregiver landed on their home with the old password still in place, and the refusal was never shown, because the reset step had already closed.
6. **A privacy leak, fixed here:** asking twice within a minute, Supabase answers "wait" (429) only for an address that has an account and was just sent an email. The app passed that on as "We've sent a few emails already", while an unknown address got the normal answer, so a second try revealed whether an account existed.

What was already right: the same calm words for any address, the minute's wait before **Send again**, calm words for a code that didn't match or expired, and the offline words.

## The fix (in the app)

- **Code only, in Expo Go.** The flow stays `verifyOtp` with `type: 'recovery'`, then `updateUser`. No link, no redirect, no deep link.
- **One calm answer.** After **Send code**, whatever happened (an account or not, sent or held back by Supabase's minute): "**If that email has an account, we have sent a code.** It can take a few minutes. If it isn't there, look in the spam folder." (`RESET_SENT`, `RESET_SENT_MORE` in `src/lib/auth-form.ts`). Supabase's 429 on a reset request is no longer passed on. Only **no connection** reads differently ("We couldn't reach Evermore…"), since that says nothing about any account.
- **The app keeps its own minute.** **Send again** stays disabled for 60 seconds, counting down. Going **Back** and tapping **Send code** again for the same address within that minute sends nothing and goes straight back to the code.
- **The code.** "6-digit code from the email", the number pad, one-time-code autofill. Spaces and dashes are dropped as typed, and fewer than 6 digits gets "Please type the 6-digit code from the email." (Supabase allows up to 10 if its setting is changed, and the field accepts that.)
- **Wrong, expired, reused or superseded codes** all read "That code didn't match, or it has expired. Please check the newest email and try again." Nobody is signed in and nothing is kept. Too many tries (Supabase: 30 code checks in five minutes per IP address) reads "There have been a lot of tries. Please wait a few minutes, then try again."
- **Signed in only once the password is saved.** While the code is being checked and the password saved, `src/data/account.ts` holds the sign-in (`resetHold`), so the caregiver stays on the step. If Supabase refuses the password, the step says "Your code worked." followed by Supabase's reason in calm words (such as "Please choose a longer password that's harder to guess."), hides the code (it is used up) and **Send again**, and **Save new password** tries only the password (`finishPasswordReset`). Leaving the step any way before then (Back, Back to sign in, Android's back) signs the code's session out (`cancelPasswordReset`), so a half-finished reset never leaves anyone signed in.
- **Passwords** follow the existing rules: at least 8 characters, the strength hint, confirmation, Show. Supabase's own rules, if stricter, are said calmly.
- **Never logged:** no email, code or password goes to the console or `warnKind`.

## The person's login ("Their login")

It has no email (its address is on the reserved `person.evermore.invalid` domain, which can't receive mail), so it has no Forgot password. **This already existed and works**: Settings → **The person's phone** → **Their login** → a new password (and optionally a new User ID) → **Save**, through `manage-family` (`reset-person`). The function looks the login up only among the caller's own family (`caregiver_id` = the caller), so it can't reset another family's login, and renaming onto a User ID another family uses is refused. **Added:** a confirmation before anything is sent: "Give their login a new password? Their phone will be signed out and will ask for the new password the next time it connects, within the hour. Only your family's login changes. Their practice and your people are kept." The note after saving says the phone will ask them to sign in again.

## What you must do in the Supabase dashboard

These are needed before Forgot password can work for anyone. Until they're done, it can only work for addresses on the project's team, and even then the email has no code.

1. **Set up custom SMTP.** Authentication → Emails → **SMTP Settings** → enable custom SMTP, and enter a provider's host, port, user, password, sender email and sender name (Resend, Postmark, Amazon SES, Brevo and others have free tiers; the sender address must be on a domain you've verified with them). Without this, Supabase emails only your team, about 2 an hour, and won't let you edit templates. Adding a provider is a **new third party** that receives caregivers' email addresses: add it to `docs/DATA-INVENTORY.md` and the privacy policy (`src/lib/privacy-policy.ts`, then `node scripts/build-policy.mjs` and a new `POLICY_VERSION`).
2. **Raise the email limit.** Authentication → **Rate Limits** → "Rate limit for sending emails": with custom SMTP it starts around 30 an hour. Set what you expect to need.
3. **Put the code in the Reset password template.** Authentication → Emails → **Templates** → **Reset Password**. Replace the body with something like:

   ```html
   <h2>Reset your Evermore password</h2>
   <p>Your code is:</p>
   <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>
   <p>Type it in the Evermore app with your new password. It works once, for one hour.</p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```

   Leave `{{ .ConfirmationURL }}` out, so nobody taps a link that can't open the app. Do the same in **Confirm signup** (the app also asks for a code there): `{{ .Token }}` in place of the link.
4. **Keep the code at 6 digits and an hour.** Authentication → Providers → **Email**: "Email OTP Length" 6 (the app accepts 6 to 10) and "Email OTP Expiration" 3600 seconds (the template's words say an hour; change both together).
5. **Redirect URLs: nothing needed.** The code flow uses no link. You can set **Site URL** (Authentication → URL Configuration) to a page you host, such as the privacy policy page, so an old email's link lands somewhere sensible rather than on `localhost`.
6. **Then try it on a phone** with an address that is **not** on your Supabase team: Forgot password, the code arrives, a new password, signed in; sign out; the old password is refused and the new one works.

## What can't be tested until then

Everything here was checked against the in-memory Supabase (`scripts/check-auth.mjs`) and in the web build against it, never against the live project. Until the steps above are done, it is **not verified** that:
- the real email arrives, or that it shows the code (the template),
- Supabase's real answers for a wrong, expired or reused code and for too many tries match the stand-in's (`otp_expired`, 429), though they follow Supabase's documented behavior,
- Supabase's real password rules, and the one-time-code autofill on iOS and Android.

## Checked by

`scripts/check-auth.mjs`: the same answer for known and unknown addresses (asked twice within the minute too), offline; wrong, expired, reused and superseded codes; too many tries; a refused password keeping the caregiver signed out with a second password then saved, and leaving the step signing out; the new password working and the old not; no code or email in any log; the screens' minute between sends; Their login reset only in the caller's family, after the confirmation. A browser walk at 375x647 and 430x839 against the stand-in.
