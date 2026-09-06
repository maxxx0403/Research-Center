# Security Measures — CvSU Research Center Reservation System

This documents every security control implemented in this system, split into
**(A) code changes already applied in this repo** and **(B) settings you
must still turn on manually in the Supabase Dashboard** (these can't be
expressed as application code).

## A. Implemented in code

| # | Control | Where |
|---|---|---|
| 1 | **Authentication** via Supabase Auth (JWT, hashed passwords, managed sessions) | `src/integrations/supabase/client.ts` |
| 2 | **PKCE auth flow** instead of implicit flow — tokens are never exposed in a redirect URL | `src/integrations/supabase/client.ts` |
| 3 | **Role-Based Access Control** (`admin` / `staff` / `user`, plus `assigned_floor` for staff) | `src/contexts/AuthContext.jsx`, `user_roles` table |
| 4 | **Row Level Security (RLS)** on every table — users can only read/write their own rows; admin/staff get elevated read/write; ownership enforced at the database, not just the UI | `supabase/migrations/20260724093336_security_rls_hardening.sql` |
| 5 | **Server-side privilege checks** for admin actions (creating/removing staff) via `has_role()` inside an Edge Function using the `service_role` key, never exposed to the browser | `supabase/create-staff/index.ts` |
| 6 | **Input validation & sanitization** on all forms (login, register, reset password, reservations, feedback, uploads) — required fields, length limits, PH phone format, email format, HTML-tag stripping | `src/lib/validation.js` (new), wired into `Login.jsx`, `ResetPassword.jsx`, `UserReserve.jsx`, `UserReserveEquipment.jsx`, `UserForms.jsx` |
| 7 | **Password policy** — minimum 8 characters, must include a letter and a number | `src/lib/validation.js` → `validatePassword` |
| 8 | **Client-side login throttling** (defense-in-depth on top of Supabase's own server-side rate limit) — locks out further attempts for 60s after 5 failed tries in a browser session | `src/lib/validation.js` → `checkLoginThrottle` / `recordLoginAttempt`, used in `Login.jsx` |
| 9 | **File upload validation** — only PDF/DOCX accepted, 10 MB max size, blocks disguised executable extensions | `src/lib/validation.js` → `validateUploadFile`, used in `UserForms.jsx` |
| 10 | **Storage access scoped per user** — Supabase Storage policy restricts the `submissions` bucket so a user can only touch files under their own `user_id` folder; admins get read/write to all | `supabase/migrations/20260724093336_security_rls_hardening.sql` (storage.objects policy) |
| 11 | **Security response headers** (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, HSTS, `Permissions-Policy`) | `index.html` (meta-tag baseline, works everywhere) + `public/_headers` (real HTTP headers on hosts that support it, e.g. Netlify/Cloudflare Pages) |
| 12 | **Secrets not committed to git** — `.env.local` matches the existing `*.local` rule in `.gitignore`; the `service_role` key is never used client-side, only inside the Edge Function | `.gitignore`, `supabase/create-staff/index.ts` |
| 13 | **Audit trail** — admin/staff activity logs pages already exist | `src/pages/admin/ActivityLogs.jsx`, `src/pages/staff/StaffActivityLogs.jsx` |

### How to apply the RLS migration

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/20260724093336_security_rls_hardening.sql`.
3. Run it. It's idempotent (safe to re-run) — every policy is dropped and
   recreated, so re-running it after future edits won't error out.
4. Test as a regular `user` account that you can no longer see other users'
   reservations, and that a `staff`/`admin` account still can.

> ⚠️ Before running this for the first time, **back up your database** (Supabase
> Dashboard → Database → Backups) — enabling RLS on a table with no existing
> policies immediately blocks all access until the policies in this file are
> applied, so run the whole file in one go, not line-by-line.

### Note on `getPublicUrl()` for submitted files

`UserForms.jsx` currently calls `supabase.storage.from('submissions').getPublicUrl(...)`.
If the `submissions` bucket is **public**, anyone with a file's URL can view
it (URLs aren't guessable in practice since they include a timestamp, but
they aren't access-controlled either). For real per-user access control,
either:
- Keep the bucket **private** and switch to `createSignedUrl()` (short-lived,
  authenticated links) — this pairs correctly with the storage RLS policy
  added in the migration, or
- Keep it public and treat file URLs as "unlisted" rather than "private."

## B. Manual steps — Supabase Dashboard settings

These are account/project-level toggles, not application code, so they need
to be set once in the Dashboard:

1. **Authentication → Rate Limits**: confirm/tune the built-in sign-in and
   OTP rate limits (Supabase already rate-limits by IP; the app also adds a
   client-side throttle as a second layer).
2. **Authentication → Providers → Email → "Leaked password protection"**:
   turn this on so Supabase rejects passwords found in known breach lists.
3. **Authentication → Multi-Factor Authentication**: enable TOTP MFA and
   (optionally) require it for `admin` accounts specifically — this is the
   biggest single upgrade for admin-account security and isn't something
   that can be forced purely from the client.
4. **Authentication → URL Configuration**: make sure only your real
   production domain(s) are listed as allowed redirect URLs (prevents
   password-reset / magic-link redirect abuse).
5. **Database → Backups**: enable daily backups (or point-in-time recovery
   if available on your plan).
6. **Storage → Buckets → `submissions`**: decide public vs. private per the
   note above, and set a bucket-level file size limit as a second layer on
   top of the 10 MB client-side check.

## Threat model notes

- The Supabase **anon key** in `client.ts` is meant to be public — Supabase's
  security model relies on RLS, not on hiding this key. The actual gate is
  the RLS policies in the migration above; without them, an anon-key holder
  could read/write any row in any table.
- Client-side validation (in `src/lib/validation.js`) improves UX and blocks
  obviously bad input early, but it is **not** the security boundary — RLS
  and the `has_role()` checks in the Edge Function are. Never rely on a form
  field's `required`/`pattern` attribute alone.
