# System: Business Reports (Admin + Buyer)

## Purpose

Lets a buyer report a business, and lets a `super_admin` review reported businesses.

## Why this needed a new buyer-facing trigger

No reporting system existed anywhere in the codebase before this pass (no model, no route, no UI) — confirmed by inspection during planning. An admin-only "view reports" tab would have had no possible data source. This pass adds both halves: the `BusinessReport` model/service and the minimal buyer-facing trigger.

## Where the "Report business" action lives

There is no dedicated public business-profile page in the Marketplace yet (`business/[id]/page.tsx` is the *owner's* dashboard, not a buyer-facing storefront) — confirmed by inspection. The only place a buyer currently sees a specific business identified while browsing is the product detail modal (seller name, next to the product). The report action was added there rather than inventing a new page for it.

## Responsibilities

- Buyer: report a business with a reason, from the product detail modal.
- Admin: list reports (filterable by status), see which business, why, who reported it, and when.
- Admin: mark a report reviewed.

## Actors

Buyer (any signed-in user — not owner-scoped, since reporting isn't about your own business); `super_admin` (reviews).

## Data

New model `BusinessReport`: `businessId`, `reporterId` (real relation to `User`), `reason`, `status` (`PENDING`/`REVIEWED`), `reviewedAt`, `reviewedBy`, `createdAt`.

## Inputs

Buyer: `businessId` + reason. Admin: `reportId`.

## Outputs

`AdminReportRow[]`, 200/404/400.

## Database

`BusinessReport`, joined to `Business` (name) and `User` (reporter email) via real foreign-key relations — not a manual ID lookup, so a reporter's account being later deleted cascades cleanly (`onDelete: Cascade`) rather than leaving an orphaned report.

## API

| Route | Method | Actor | Purpose |
|---|---|---|---|
| `/api/marketplace/businesses/[id]/report` | POST | Buyer | Submit a report |
| `/api/marketplace/admin/reports` | GET | Admin | List reports |
| `/api/marketplace/admin/reports/[reportId]/review` | POST | Admin | Mark reviewed |

## Services

`services/marketplace/business/report-business.ts` (buyer), `services/marketplace/admin/{list-reports,review-report}.ts` (admin).

## Components

`src/app/studashboard/marketplace/_components/ProductDetailModal.tsx` (the "Report business" text action, next to the seller name), `src/app/studashboard/admin/marketplace/reports/page.tsx`.

## Authentication / Authorization

Buyer route: session required only (not owner-scoped — reporting is inherently about someone else's business). Admin routes: `requireAdmin()`.

## State transitions

`status`: `PENDING → REVIEWED` (one-way; reviewing is idempotent — reviewing an already-reviewed report is a no-op, not an error).

## Error handling

404 if the target business/report doesn't exist. 400 if no reason given.

## Edge cases

- **A business getting reported multiple times**: each submission creates its own `BusinessReport` row (no dedupe) — an admin sees every report individually, which is the correct behavior for judging pattern/severity, not a bug.
- **No block-on-report automation**: reporting a business never automatically restricts it — an admin reviews and, if warranted, separately uses the Businesses tab's Block action ([`business-oversight.md`](business-oversight.md)). Keeping these decoupled was deliberate, not a missing integration.

## Notifications

None — no email is sent to the business owner or the admin when a report is filed, in this pass.

## Cron jobs

None.

## Dependencies

None beyond `Business` and `User`.

## Usage

Buyer: the product detail modal, reachable from anywhere a product is shown. Admin: `studashboard/admin/marketplace/reports`.

## Relevant files

- `services/marketplace/business/report-business.ts`
- `services/marketplace/admin/{list-reports,review-report}.ts`
- `src/app/api/marketplace/businesses/[id]/report/**`, `src/app/api/marketplace/admin/reports/**`
- `src/app/studashboard/marketplace/_components/ProductDetailModal.tsx`, `src/app/studashboard/admin/marketplace/reports/page.tsx`
