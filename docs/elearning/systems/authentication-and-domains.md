# System: Authentication & Account-Type Domains

## Purpose

One AkadVerse-wide login (NextAuth — `src/lib/auth.ts`) serves both Marketplace and E-Learning. This doc covers **sign-up**: the Role field that fixes the email domain, the student sign-up with an emailed OTP, and how a new student is created across the two databases. **Login is a normal email + password form that accepts any email** — it has no role or domain selector.

## Actors

Everyone signs in through `/login`. Sign-up is at `/signup`.

## Role → email domain (sign-up only)

`src/app/signup/page.tsx` has a **Role** dropdown (its own field) offering Student, Faculty, HOD and DAPU (VC and Dean are not selectable — no functionality yet). The role fixes the domain shown right beside the email input (plain non-editable text), and the complete address is displayed under the field. `src/lib/account-domains.ts` — `ACCOUNT_TYPES`:

| Role | Domain |
|---|---|
| Student | `stu.cu.edu.ng` |
| Faculty | `faculty.cu.edu.ng` |
| HOD | `HODEIE.cu.stu.ng` |
| DAPU | `DAPU.cu.edu.ng` |

The HOD domain is intentionally inconsistent with the others (`.cu.stu.ng` vs `.cu.edu.ng`) — exactly what §8 specifies; do not "fix" it. Domains are stored/compared lower-case. The **server never trusts the browser's display**: `buildEmail` rebuilds the address from the local part + role and `isEmailForRole` re-checks the domain (and that the local part contains no `@`/spaces, so a domain can't be smuggled in).

## Student sign-up (Main DB `User` + E-Learning `StudentProfile`)

Services: `services/auth/student-signup/`. API: `/api/signup/student/{options,start,verify,resend,google-context}` (public in `src/proxy.ts`).

```text
Sign up → Role: Student (Faculty/HOD instead pick only College + Department) → email local part (+ fixed @stu.cu.edu.ng) → College / Department / Programme / Level (dropdowns from the
E-Learning DB) → first/last name, matric number, password → "Send verification code"
   start:   validate everything server-side → store a PendingSignup (hashed OTP, bcrypt password hash) → email the 6-digit code
   verify:  check the code → create the Main User → create the E-Learning StudentProfile (StudentProfile.userId === User.id)
            → the browser signs in normally (credentials) → student home
```

- **Dropdown data** comes from `services/e-learning/student/signup-academics.ts`. During the testing phase it is restricted to one dataset by **codes** (never IDs): College `CoE`, Department `EIENG` (Electrical and Information Engineering), Programme `EEE` (Electrical and Electronics Engineering), Level 300. Widen `SIGNUP_SCOPE` there to open more. Every id from the browser is re-validated against the database, including College → Department → Programme.
- **StudentProfile fields**: `userId`, `departmentId`, `programmeId`, `level`, `matricNumber`, `admissionSessionId`. College isn't stored (it follows from the department). `admissionSessionId` is required by the schema; the only session that exists is the current one (the manually-created student uses it too), so that is recorded.
- **Matric number**: optional in the schema and no format is defined, so no format is invented — it is required at sign-up, upper-cased, must be non-empty, ≤ 30 characters of `A-Z 0-9 / . _ -`, and unique.
- **OTP**: 6 digits, `crypto.randomInt`; only an HMAC-SHA256 hash (bound to the email, keyed with `NEXTAUTH_SECRET`) is stored; 5-minute expiry; 5 wrong attempts per code; 60-second resend cooldown; a new code invalidates the old one; one-time use (claimed atomically); the code is emailed in the **body only** (never the subject — `sendEmail()` logs subjects) and never returned by an API. Email goes through the existing Resend wrapper.
- **`PendingSignup`** (Main DB) is the one table added for this: the flow is "verify OTP, then create the User", so before verification there is no `User` row for the OTP to live on, and a stateless token can't enforce attempts/cooldown/single use. Rows are deleted on success and after 24 h.
- **Two-database safety**: everything is validated before the first write; the User is created first with a pre-generated id, then the StudentProfile; if the profile write fails, the User created in that call is deleted and the OTP is released so the student can retry; an existing account with no profile ("link" mode) only gets a profile attached (no second User, password untouched); an existing account with a non-student role, or a student who is already registered, is refused.
- **Faculty and HOD sign-up** also asks for a **College** and a **Department** (dropdowns from the E-Learning DB, same testing-phase scope); DAPU is university-wide and asks for neither. They are required and re-validated on the server (`resolveDepartmentSelection`: the department must belong to the college and be in scope). **Choosing them grants nothing**: the role is never set by the form (still the database / the dev-only exception), and a profile is created (`services/auth/staff-signup/create-staff-profile.ts`) only for an account whose role really is faculty/hod, in the chosen department. A HOD profile is unique per department and approvals are routed to "the HOD of a department", so it is never created when the department already has one — the sign-up is refused up front instead. Consequence to be aware of: for an ordinary sign-up the chosen department is validated but not stored, because there is no approval step or table for a pending staff affiliation yet.
- **`/api/register`** is now only for Faculty/HOD/DAPU domains. It refuses student-domain emails (they must use the verified flow) and any non-institutional domain.

## Google

"Continue with Google" is on both pages. Google **alone grants nothing** (`src/lib/auth.ts` `signIn` callback):

- An **existing** account signs in normally — no OTP again.
- A **new** Google user must have a verified `@stu.cu.edu.ng` address (otherwise refused: Gmail and other domains can't become students). They are **not auto-created**: they are sent to `/signup?google=<token>` — a short-lived token signed by the server with the identity Google verified — where the email is locked, they give their academic details, receive the OTP, and only then is the account created. Afterwards they continue through Google to get a session.

## Login

`src/app/login/page.tsx`: a normal `type="email"` field + password (+ Google). Any email address works; it is trimmed and lower-cased (login and `authorize`) so letter case doesn't matter. Role/authorization always come from the account in the database, never from anything typed on this page.

## Verified

`scripts/verify-student-signup.ts` (service level, both real databases: domain rules, academic validation, OTP send/wrong/attempts/expiry/cooldown/resend/reuse, User + StudentProfile linking, duplicates, link mode, two-database rollback, Google callback, `/api/register` bypass) and `scripts/verify-signup-browser.ts` (real Chrome at phone/tablet/desktop in dark and light: Role field and fixed domain, dropdowns, readable contrast, no overflow, full sign-up flow through the UI, plain login). Not verified: real email delivery (tests replace the sender / disable Resend) and the live Google OAuth round-trip (no browser Google account) — the callback logic is unit-tested, the redirect itself is not.

## The dev-test exception (§7)

`src/app/api/register/route.ts`'s `DEV_TEST_LOCAL_PART = "marvelousifezue31"`. If, and only if, **both**:

1. `process.env.NODE_ENV !== "production"`, **and**
2. the new account's email local part is exactly `marvelousifezue31`,

...then the role assigned at creation is taken from the domain actually used (via `accountTypeForEmail`) instead of defaulting to `student`. This lets that one account sign up under each domain — `marvelousifezue31@stu.cu.edu.ng`, `@faculty.cu.edu.ng`, `@HODEIE.cu.stu.ng`, `@DAPU.cu.edu.ng` — and get **real, separately-stored** accounts with real roles, rather than one account pretending to be six roles via a runtime switch. In production this whole branch is dead code — `NODE_ENV=production` alone makes it unreachable regardless of local part.

## Follow-up needed for each new dev-test role account

Creating the Core `User` row (via signup) is not enough — the corresponding E-Learning profile (`StudentProfile`/`FacultyProfile`/`HodProfile`/`DapuProfile`) still has to exist before that account's pages work (`requireStudentProfile` etc. in `services/e-learning/shared/auth.ts` throw `403` otherwise — this is the authorization system working correctly, not a bug). `npm run db:elearning:seed` (`scripts/elearning-seed.ts`) links these automatically for the four `marvelousifezue31@*` accounts if they already exist by email; re-run it after creating a new one.
