# Security: Admin Authorization

## The gate: `requireAdmin()`

`src/lib/admin.ts` — every single admin route controller under `src/app/api/marketplace/admin/**` calls this as its first line, before touching any input:

```ts
export async function requireAdmin(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  if (!session.user.isAdmin) throw forbidden("Admin access required.");
  return session;
}
```

No session → `ServiceError(401)`. Session exists but `isAdmin` is `false` → `ServiceError(403)`. Both are turned into the right HTTP response by `runController`/`serviceErrorResponse` (`src/lib/controller-helpers.ts`) — the same mechanism every other Marketplace controller uses, not a special case.

**This is a server-side check on every request, not a client-side one.** The admin UI (`AdminMainMenu`, the tab pages) renders regardless of the viewer's admin status — reaching `/studashboard/admin/marketplace` without `isAdmin` shows working navigation and then every single page's data call gets a 403 and renders "Admin access required." The security boundary is `requireAdmin()`, verified again on literally every request; the UI is not trusted to enforce anything, and calling any admin endpoint directly (`curl`, Postman, a browser devtools fetch) with a non-admin or no session gets rejected identically to going through the UI. See [`../../marketplace/security/authentication-and-authorization.md`](../../marketplace/security/authentication-and-authorization.md) for how this fits the rest of the app's auth model (`src/proxy.ts` at the edge, `getServerSession()` again in every route handler).

## Admin access is a flag, independent of `role`

`User.isAdmin` — a plain boolean, orthogonal to the platform's `role` enum (`student`/`faculty`/`admin`/`super_admin`). A student account, a faculty account, or any other role can independently also be an admin. See [`../decisions/admin-flag-replaces-role-check.md`](../decisions/admin-flag-replaces-role-check.md) for why this replaced an earlier `role === "super_admin"`-only gate, and [`../decisions/admin-access-level.md`](../decisions/admin-access-level.md) for the (now-superseded, but still-relevant reasoning) original decision.

The session carries `isAdmin` the same way it carries `role` — populated from the database in `src/lib/auth.ts`'s `jwt` callback on sign-in, copied to `session.user.isAdmin` in the `session` callback, typed via `src/types/next-auth.d.ts`'s declaration merging. It is never something the client can set — the only two places that ever write `User.isAdmin` are `promote-user-to-admin.ts` and `revoke-admin.ts`, both themselves gated by `requireAdmin()`.

## Grant/revoke security specifically

Granting or removing a user's admin access is the most sensitive action in this surface. The concrete guarantees:

- The **actor** (who is granting/revoking) is resolved exclusively from `requireAdmin()`'s server-side session lookup — never from any request field.
- The **target** (whose access is changing) is resolved exclusively from the URL path segment (`[userId]`) — never from the request body.
- **No `isAdmin`/`role` value is ever accepted from the client at all.** `promote-user-to-admin.ts` hardcodes `isAdmin: true`; `revoke-admin.ts` hardcodes `isAdmin: false` — there is no generic "set this user's admin flag to X" endpoint anywhere in the admin surface.
- Self-revocation is possible and deliberately not specially blocked: if an admin revokes their own access, `requireAdmin()` re-checking the flag on their very next request correctly locks them out, the same as it would for anyone else — see the comment in `revoke-admin.ts`.
- Self-promotion is structurally impossible to abuse: only an existing admin can reach the promote endpoint at all (via `requireAdmin()`), so a non-admin submitting their own id gets 403 before the target lookup even runs.
- Both actions are recorded in `AdminActionLog` (actor, action, target, message) — see [`../data/schema.md`](../data/schema.md).

## What's verified vs. what's a known gap

**Verified**: every admin route rejects an unauthenticated request (checked live — `curl` with no session cookie against `/api/marketplace/admin/overview` and the revoke-admin endpoint both returned `401 {"error":"Not authenticated."}`). Every admin controller was checked by grep to confirm it calls `requireAdmin()` — no admin route was found missing it. The one pre-existing `super_admin`-role account in the dev database was confirmed, by direct query, to have kept working admin access after the migration (`isAdmin: true`, backfilled from `role: 'super_admin'`).

**Not verified (would need a running admin and non-admin test session)**: the specific 403-for-no-flag path, end-to-end through a real browser session. The code path is identical in shape to the 401 path already verified (same `requireAdmin()` function, same `runController` wrapper) — but this document says so honestly rather than claiming a test that wasn't actually run.

## Known gaps

- **`Business.blocked` isn't enforced anywhere outside the admin UI itself** — no buyer-facing or seller-facing route currently checks it. See [`../systems/business-oversight.md`](../systems/business-oversight.md).
- **No rate limiting** on any admin route — consistent with the rest of the Marketplace (see [`../../marketplace/security/gaps.md`](../../marketplace/security/gaps.md)), not a regression introduced here.
- **`AdminActionLog`/`OrderEvent` (dispute events) are audit records, not alerts** — nothing currently notifies anyone when an admin action happens; they're only visible by looking.
- **No UI safeguard against an admin revoking their own last-remaining access** — technically possible to lock yourself out if you're the only admin; would need direct database access to recover. Not currently warned against in the UI.
