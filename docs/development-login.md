# Development test-student login

The repository uses NextAuth **4.24.15**, its existing JWT session strategy,
SessionProvider/useSession, server session helpers and route proxy. An additional
Credentials provider signs in a dedicated database-backed test student. It does
not use Google credentials, browser storage, a second session system or relaxed
route protection.

## Enable locally

Run from `C:\Productivity Layer`, using the root AkadVerse app, not the standalone
`schedule-manager` app. Stop an existing `npm run dev` with Ctrl+C before installing
dependencies (Windows keeps native modules locked while the server is running).
Start Docker Desktop first. If you do not already have a
root `.env`, create the existing local database configuration without overwriting
an existing file:

```powershell
if (!(Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath for_Developers/.env.example -Destination .env
}
```

That template's four database URLs target the project's local Docker PostgreSQL
server on `127.0.0.1:5433`, with Core database `akadverse` and academic database
`akadverse_elearning`. Do not substitute production/shared database credentials.

Add or update these settings in your existing **`.env.local`**, preserving all
other values:

```dotenv
ENABLE_DEV_LOGIN=true
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-local-secret
```

Generate a real local secret, then paste it into `NEXTAUTH_SECRET` (do not use the
placeholder above):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Next.js gives `.env.local` precedence over `.env`. If `.env.local` already declares
any database URLs, use the matching local URLs from `for_Developers/.env.example`;
blank overrides will also prevent login. `DATABASE_URL` and `DIRECT_URL` must both
be local PostgreSQL URLs. The project's database setup scripts read `.env`, so
keep the database targets consistent between these files.

```powershell
npm.cmd ci
npm.cmd run db:local:up
npm.cmd run db:local:setup
npm.cmd run dev
```

`db:local:setup` deploys the existing Core migrations, including the Productivity
Layer migration, and performs the host's existing separate E-Learning setup. It
refuses non-local databases. No reset, destructive migration or new schema is
required by this login feature. A full seed is optional, not required for the
dedicated test student.

Open **http://localhost:3000/login**, click **Continue as Test Student**, and you
will land on the existing student dashboard. Choose **Productivity Layer** to
open Schedule Manager, To-Do List and Habit Tracker. Create records, reload, and
confirm they remain. Use **Sign out** on the student dashboard to end the normal
NextAuth session, then confirm the protected workspace redirects to `/login`.

The first successful test login creates this clearly labelled Core User:

- Name: **Development Test Student**
- Email: `productivity-test-student@example.local`
- Role: `student`; `isAdmin=false`
- ID: the real database-generated User ID, reused by subsequent test logins
- Password: empty, so this account cannot use the ordinary password login

No request can choose a different user, ID, email or role. Existing matching
accounts with unexpected names/passwords/permissions are refused, not overwritten
or silently demoted. Existing Productivity relations use this actual User ID.
The academic timetable has no invented classes; personal Productivity needs no
additional academic profile, while real registered classes need academic data.

## Gates and disabling

The provider is registered and advertised to the login UI only when **both**
`NODE_ENV === "development"` and `ENABLE_DEV_LOGIN === "true"`. `npm run dev`
sets the development mode; do not set `NODE_ENV` in `.env.local`. The flag is
server-only. There is no `NEXT_PUBLIC` security flag.

The authorize handler repeats the gates and checks the local database target and
secret before creating/reusing the student. JWT callbacks recheck every session
read and refuse an unexpected/promoted account. Dev sessions carry a signed
marker; the proxy also rejects them outside the permitted development setup.
A cached Prisma client whose connection configuration changed requires a server
restart, preventing accidental use of an older connection target after hot reload.

Set `ENABLE_DEV_LOGIN=false` and **restart the server** to disable it. The button
disappears, direct attempts are rejected, and old development sessions lose access.
`npm run build` / `npm start` use production mode and reject development login even
when the flag remains true. Ordinary password/Google sessions remain unaffected.

Google is registered only when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are present. Missing Google configuration hides its button
and shows an unavailable message, while email/password and enabled development
login continue through NextAuth. No dummy Google credentials are supplied.

Restart after changing environment files or database URLs. Do not commit `.env`
or `.env.local`; existing ignore rules cover both. This implementation does not
modify their values.

## Verification and current setup limitation

```powershell
npm.cmd run test:dev-login
npm.cmd run test:productivity
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

`test:dev-login` uses the real installed NextAuth handlers, signed cookies, session
callbacks, CSRF flow, proxy, server-side Productivity authorization and logout,
with an isolated transactional database test double. It verifies fixed identity,
normal student privileges, all three productivity modules using the same ID,
user reuse, disabled/production rejection (including existing sessions), unknown
or remote database rejection, stale-connection rejection and ordinary password
authentication. A fresh production process also verifies provider omission.

Executed validation: all **10 development-login tests** and **14 Productivity
tests** passed. Full typecheck, both Prisma client generations and production
build passed. Lint passed with seven pre-existing warnings outside this change.
An isolated Edge browser also verified the actual login page in three modes:
production with the flag true (button/provider absent, direct login rejected),
development with the flag false (absent/rejected), and enabled development with
no database (button visible, Google absent, clear setup error and retry enabled).
Temporary verification servers were stopped; start your configured server with
`npm.cmd run dev` after completing setup.

At implementation time no database URLs or authentication secret were configured
locally, port 5433 was unreachable, and Docker Desktop reported it could not start.
No real test student was created, no database was migrated, and real database
persistence/login could not be verified. Complete the local setup above, then run
the manual journey; passing test-double checks does not establish real persistence.
