# Security fixes — summary

## 1. Files changed in this package

- `next.config.js` — security headers (CSP, HSTS, X-Frame-Options, etc.)
- `src/lib/rateLimit.js` — new, in-memory rate limiter
- 7 auth routes — rate limiting added:
  `login`, `verify-login-otp`, `reset-password`, `forgot-password`,
  `verify-email`, `resend-verification`, `register-public`
- `forgot-password` — no longer leaks whether an email is registered
  (always returns the same generic message)
- **18 dynamic API routes** — migrated `params` from sync to async
  (`const { id } = await params;`), required for Next.js 15+:
  `admin/sub-admins/[id]`, `attendance/[id]`, `attendance/session/[sessionId]`,
  `attendance/student/[studentId]`, `attendance/subject/[subjectId]`,
  `departments/[id]`, `holidays/[id]`, `reports/class/[sessionId]`,
  `reports/student/[studentId]`, `reports/subject/[subjectId]`,
  `departmentAdmin/students/[id]`, `departmentAdmin/teachers/[id]`,
  `sessions/[id]/attendance`, `sessions/[id]/end`, `sessions/[id]`,
  `subAdmin/department-admins/[id]`, `subjects/[id]`, `users/[id]`

  All 52 route files in the project were syntax-checked with
  `node --check` after these edits — all pass.

- `package.json.recommended` — updated dependency versions (see below).
  This is **not** applied automatically — copy the values you want into
  your real `package.json` yourself, since your actual file wasn't in
  this export (only `src/` was uploaded).

## 2. Dependency upgrade — verified with `npm audit`

Your original `package.json` had **12 vulnerabilities (8 high, 4 moderate)**.
I tested upgrade paths directly against `npm audit` rather than guessing:

| Package | You had | Verified fix | Why |
|---|---|---|---|
| `next` | 14.2.35 | **16.3.2** | 14.x is EOL for patches. 15.x does **not** clear the CVE either — confirmed by testing; only 16.3.2 does. |
| `react` / `react-dom` | 18.2.0 | **19.2.0** | Required alongside Next 16. |
| `nodemailer` | 8.0.10 | **9.0.5** | Confirmed fix. |
| `exceljs` | latest (4.4.0) | no fix yet | Latest exceljs still pins vulnerable `uuid@^8.3.0` — this is unfixed **upstream**, not something a version bump on your side solves. |
| `@capacitor/cli` | latest (8.5.0) | no fix yet | Same story — pulls `xcode@^3.0.1` → vulnerable `uuid`. Unfixed upstream. |
| `next-pwa` | 5.6.0 | no fix | Abandoned since 2022. The only real fix is replacing it (e.g. `@serwist/next` or Next's built-in manifest support) — not done in this pass, flagged for a separate task. |

After the `next`/`react`/`nodemailer` bumps: **9 vulnerabilities remain
(5 high, 4 moderate)** — all from `next-pwa` and the `exceljs`/`@capacitor/cli`
→ `uuid` chain, none of which have a real upstream fix available today.

## 3. Next.js 16 upgrade — checked against your actual code

Searched your codebase for every documented Next 16 / React 19 breaking
pattern. None were found:

- No `next/image` usage
- No `middleware.js`
- No webpack config in `next.config.js`
- No `revalidateTag`/`unstable_cache`/experimental caching flags
- No AMP usage
- No `propTypes`/`defaultProps`/`findDOMNode`/legacy `ReactDOM.render`
- All 6 `next/link` usages are simple, no nested `<a>` tags
- Node.js v22 already installed (16 requires 20.9+)

**One manual change still needed:** `next lint` was removed in Next 16.
`package.json.recommended` already updates the `lint` script to
`eslint .` — you'll need an ESLint config if you don't already have one
(not included here, since no config file was in this export).

## 4. What's still NOT done

- **2FA** — left as `TWO_FA_ENABLED = false`, per your request to handle separately.
- **`next-pwa` replacement** — needs its own migration, not started.
- **Distributed rate limiting** — current limiter is in-memory/per-instance,
  fine for a single server but not a hard guarantee on multi-instance
  serverless deployments. See comments in `rateLimit.js`.
- **CSP `unsafe-inline`/`unsafe-eval`** — still present; tightening this
  needs nonce-based CSP wiring (a `middleware.js`/now `proxy.js`), not done.
- **`resend-verification`** still reveals account existence via 404 — left
  alone since it's a different, lower-stakes leak than the password-reset one.
