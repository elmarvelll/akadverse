# System: Business Oversight — Verification & Blocking (Admin)

## Purpose

Lets a `super_admin` mark a business as verified (a trust signal, admin-reviewed) and block a business (an admin-imposed restriction), independent of the pre-existing, unrelated `deliveryRestricted` flag.

## Responsibilities

- List/search/filter businesses (all, pending verification, verified, blocked).
- Show one business's full detail, including owner, verification/block state, and counts (products, orders, reports).
- Verify a business.
- Block a business, with a required reason.
- Unblock a business.

## Actors

`super_admin` only.

## Data

`Business.verified`/`verifiedAt`/`verifiedBy`, `Business.blocked`/`blockedAt`/`blockedReason`/`blockedBy` — new fields, added this pass (see [`../data/schema.md`](../data/schema.md)).

## Why verification and blocking are separate from `deliveryRestricted`

`Business.deliveryRestricted` already existed and means something specific and automatic: the business missed the 15-hour seller drop-off deadline and hasn't yet paid the resulting fine (see [`docs/marketplace/systems/late-delivery-fine-system.md`](../../marketplace/systems/late-delivery-fine-system.md)). It is set/cleared entirely by that system, never by an admin directly. `verified`/`blocked` are admin-only judgment calls about trust/legitimacy, unrelated to fine payment. The Businesses tab shows all three flags side by side (see the UI) precisely so this distinction stays visible rather than getting conflated.

## Inputs

Search query, filter (`all`/`pending_verification`/`verified`/`blocked`), pagination, a target `businessId`, a block reason.

## Outputs

`AdminBusinessRow[]`, `AdminBusinessDetail`, 200/404/400 on the mutating actions.

## Database

`Business` (new fields above), joined to `Business.user` for owner email, `Business._count` for products/orders/reports.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/admin/businesses` | GET | List (also serves Verifications via `?filter=pending_verification`) |
| `/api/marketplace/admin/businesses/[businessId]` | GET | Detail |
| `/api/marketplace/admin/businesses/[businessId]/verify` | POST | Verify |
| `/api/marketplace/admin/businesses/[businessId]/block` | POST | Block (`{reason}`) |
| `/api/marketplace/admin/businesses/[businessId]/unblock` | POST | Unblock |

## Services

`services/marketplace/admin/list-businesses-for-admin.ts`, `get-business-detail-for-admin.ts`, `verify-business.ts`, `block-business.ts`, `unblock-business.ts`.

## Components

`src/app/studashboard/admin/marketplace/businesses/page.tsx`, `verifications/page.tsx` (the same service, filtered).

## Authentication / Authorization

`requireAdmin()` on every route.

## State transitions

`verified`: `false → true` (one-way; no "unverify" action exists — a known gap, see TODO).
`blocked`: `false → true → false` (block/unblock are both implemented and idempotent).

## Error handling

404 if the business doesn't exist. Blocking without a reason is rejected with 400 before anything is written.

## Edge cases

- **Double-verify / double-block**: both `verify-business.ts` and `block-business.ts` check current state first and return early (no-op, no duplicate `AdminActionLog` entry) rather than erroring or re-writing timestamps — a double-click can't corrupt state.
- **Blocking is never deletion**: blocking only sets flags on the `Business` row. Its products, orders, `OrderEvent` history, and fines are untouched and remain fully queryable — required explicitly by the spec and verified by inspection (no code path here calls `delete` on anything).
- **What "blocked" actually prevents today**: only what's visible in the admin UI (the flag itself, shown in the Businesses tab). No buyer-facing or seller-facing route currently checks `Business.blocked` to refuse an action (e.g. a blocked business can still technically receive a new order) — this is a real, documented gap, not something this pass silently claims to enforce. See [`../todo/phase-01-admin-dashboard.md`](../todo/phase-01-admin-dashboard.md).

## Notifications

None — no email is sent to a business owner on verification or blocking in this pass.

## Cron jobs

None.

## Dependencies

None beyond `Business` and the shared admin primitives. Deliberately does not touch `deliveryRestricted` logic.

## Usage

`studashboard/admin/marketplace/businesses`, `studashboard/admin/marketplace/verifications`.

## Relevant files

- `services/marketplace/admin/{list-businesses-for-admin,get-business-detail-for-admin,verify-business,block-business,unblock-business}.ts`
- `src/app/api/marketplace/admin/businesses/**`
- `src/app/studashboard/admin/marketplace/{businesses,verifications}/page.tsx`
