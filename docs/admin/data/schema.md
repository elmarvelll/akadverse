# Data: Admin Schema Changes

Source of truth: `prisma/schema.prisma`. Everything below was added or newly wired up in this pass — check that file for anything this drifts from.

## `User.isAdmin` — new field (later addition)

| Field | Type | Purpose |
|---|---|---|
| `isAdmin` | `Boolean @default(false)` | Marketplace admin access, independent of `role` |

Added after the rest of this schema section, replacing `role === "super_admin"` as the admin-access check — see [`../decisions/admin-flag-replaces-role-check.md`](../decisions/admin-flag-replaces-role-check.md). Migration `20260828180000_user_is_admin_flag` includes a data backfill (`UPDATE User SET isAdmin = true WHERE role = 'super_admin'`) so the one pre-existing `super_admin`-role account in the dev database kept working access rather than being silently locked out. `role` itself is untouched by this change and keeps its existing four values (`student`/`faculty`/`admin`/`super_admin`) — `isAdmin` is a second, independent dimension, not a replacement for the role system.

## `Business` — new fields

| Field | Type | Purpose |
|---|---|---|
| `verified` | `Boolean @default(false)` | Admin-reviewed trust flag |
| `verifiedAt` | `DateTime?` | Set once, by `verify-business.ts` |
| `verifiedBy` | `String?` | The admin's `User.id` |
| `blocked` | `Boolean @default(false)` | Admin-imposed restriction |
| `blockedAt` | `DateTime?` | |
| `blockedReason` | `String? @db.Text` | Required at block time, cleared on unblock |
| `blockedBy` | `String?` | The admin's `User.id`, cleared on unblock |

Deliberately separate from the pre-existing `deliveryRestricted`/`deliveryRestrictedAt`/`lateDeliveryCount` fields — see [`../systems/business-oversight.md`](../systems/business-oversight.md) for why these must never be conflated.

## `BusinessReport` — new model

```text
BusinessReport
├── id
├── businessId    → Business (onDelete: Cascade)
├── reporterId     → User (onDelete: Cascade)
├── reason         (Text, required)
├── status         ReportStatus @default(PENDING)
├── reviewedAt
├── reviewedBy      (User.id, not a relation — see below)
└── createdAt
```

`reviewedBy` is a plain string (the reviewing admin's id), not a relation — consistent with `Business.verifiedBy`/`blockedBy` and `LateDeliveryFine`'s existing convention of storing an actor id without a formal FK, since these are audit fields, not data the schema needs to join through routinely. `reporterId`, by contrast, **is** a real relation to `User` (added deliberately — see the note in [`data/schema.md`](#reporterid-is-a-real-relation)) because report listings routinely need the reporter's identity, not just an audit trail of it.

New enum: `ReportStatus { PENDING REVIEWED }`.

### `reporterId` is a real relation

The first draft of `list-reports.ts` treated `reporterId` as a bare string and manually joined to `User` with a second query. That was corrected before shipping: `reporterId` is a proper `@relation` to `User`, with `User.businessReports BusinessReport[]` as the back-relation, and `list-reports.ts` uses a normal Prisma `include`. This required a second migration (`20260828171500_business_report_reporter_fk`) since the FK was added after the table already existed from the first migration — see the log entry for what that looked like in practice.

## `AdminActionLog` — new model

```text
AdminActionLog
├── id
├── adminId     (User.id — the actor, from requireAdmin(), never client-supplied)
├── action       String, e.g. "USER_PROMOTED_TO_ADMIN", "BUSINESS_VERIFIED",
│                "BUSINESS_BLOCKED", "BUSINESS_UNBLOCKED", "REPORT_REVIEWED"
├── targetType   String, e.g. "user" | "business" | "report"
├── targetId
├── message      (Text?, human-readable context)
└── createdAt
```

`action` is a free-text string, not an enum — unlike `OrderEventType`, this log exists purely for human review, not for driving any business-logic branching, so a growing/changing vocabulary of action labels doesn't need a schema migration each time. Written by `services/marketplace/admin/shared/log-admin-action.ts`, called from every mutating admin action (promote, verify, block, unblock, review-report) — **not** from dispute resolution, which writes to `OrderEvent` instead (see below).

## `OrderEventType` — two new values

`DISPUTE_OPENED`, `DISPUTE_RESOLVED` — added to the existing enum rather than creating a parallel dispute-log, because a dispute is inherently scoped to one `Order`, exactly what `OrderEvent` already models. See [`../architecture.md`](../architecture.md#two-audit-trails-deliberately-not-merged) for why this and `AdminActionLog` stay separate.

## `Order` — no schema change, previously-dormant fields now used

`isDisputed`, `disputeReason`, `disputeCreatedAt`, `disputeResolvedAt`, `disputeResolvedBy`, `disputeResolution` all already existed (added in an earlier pass, never wired up — flagged as dormant in `docs/marketplace/data/schema.md` before this pass). This pass writes and reads them for the first time; no migration was needed for `Order` itself.

## Migrations added this pass

- `20260828170000_admin_dashboard` — `Business` fields, `BusinessReport` (without the `reporterId` FK yet), `AdminActionLog`, `OrderEventType` additions.
- `20260828171500_business_report_reporter_fk` — adds the `BusinessReport.reporterId → User` foreign key and index, added moments after the first migration once the relation was corrected (see above).
