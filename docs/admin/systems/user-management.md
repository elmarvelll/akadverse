# System: User Management (Admin)

## Purpose

Lets an admin search users, view non-sensitive detail, and grant or revoke another user's admin access.

## Responsibilities

- Search/paginate users by name or email.
- Show a user's role, admin status, join date, business count, order count, and deliverer application status (if any) — never their password or any auth secret.
- Grant admin access to a user.
- Revoke admin access from a user.

## Actors

Any admin (`User.isAdmin === true` — see [`../security/authorization.md`](../security/authorization.md)). Not tied to `role`: a student, faculty, admin, or super_admin account can independently be an admin — see [`../decisions/admin-flag-replaces-role-check.md`](../decisions/admin-flag-replaces-role-check.md).

## Data

`User` (existing model). `role` is unaffected by anything in this system — only `User.isAdmin` changes.

## Inputs

Search query (`q`), pagination (`page`), a target `userId` (URL param only, never from the request body).

## Outputs

`AdminUserRow[]` (list, includes `role` and `isAdmin`), `AdminUserDetail` (single), a 200/409/404 on grant/revoke.

## Database

`User.role` (read-only here), `User.isAdmin` (read/write), `User.firstName`/`lastName`/`email`/`location`/`createdAt`, `User._count.businesses`/`orders`, `User.deliverer.status`.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/admin/users` | GET | Paginated/searchable list |
| `/api/marketplace/admin/users/[userId]` | GET | One user's detail |
| `/api/marketplace/admin/users/[userId]/promote` | POST | Grant admin access (`isAdmin: true`) |
| `/api/marketplace/admin/users/[userId]/revoke-admin` | POST | Remove admin access (`isAdmin: false`) |

## Services

`services/marketplace/admin/search-users.ts`, `get-user-detail.ts`, `promote-user-to-admin.ts`, `revoke-admin.ts`.

## Components

`src/app/studashboard/admin/marketplace/users/page.tsx` — shows both the `role` badge and, when applicable, a separate "Admin" badge, plus a Grant/Remove admin button depending on current state.

## Authentication / Authorization

Every route requires a session AND `requireAdmin()` (`User.isAdmin === true`). See [`../security/authorization.md`](../security/authorization.md) for exactly how self-promotion/self-revocation are handled.

## State transitions

`User.isAdmin`: `false → true` (grant) and `true → false` (revoke) — both directions are implemented, unlike the earlier role-based design this replaced, which only had a one-way promotion. `User.role` is never touched by either action.

## Error handling

404 if the target user doesn't exist. 409 (via an early return, not a hard error surfaced as a 500 — but returned to the client as a 409 conflict) if granting to an already-admin user, or revoking from a non-admin user.

## Edge cases

- **Granting to an already-admin user**: `promoteUserToAdmin` checks `target.isAdmin` first and throws a 409 conflict rather than silently re-writing the same value — the client-facing message makes this explicit ("This user is already an admin") rather than reporting false success. `revokeAdmin` does the equivalent check in the other direction.
- **Self-promotion**: structurally impossible to abuse — the actor is only ever read from the session by `requireAdmin()`, and only an existing admin can call this route at all.
- **Self-revocation**: possible and deliberately not blocked — an admin can remove their own access, and `requireAdmin()` re-checking the flag on their next request correctly locks them out. See [`../security/authorization.md`](../security/authorization.md) for the known gap this implies (no UI warning if you're the last admin).

## Notifications

None — no email is sent to a user when their admin access changes, in this pass.

## Cron jobs

None.

## Dependencies

None beyond `User` and the shared `requireAdmin()`/`AdminActionLog` primitives.

## Usage

Only reachable from `studashboard/admin/marketplace/users`.

## Relevant files

- `services/marketplace/admin/{search-users,get-user-detail,promote-user-to-admin,revoke-admin}.ts`
- `services/marketplace/admin/shared/{pagination,log-admin-action}.ts`
- `src/app/api/marketplace/admin/users/**`
- `src/app/studashboard/admin/marketplace/users/page.tsx`
