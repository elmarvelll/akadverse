# Data: Delivery Days

## What "delivery days" means

**Days of the week** a business accepts deliveries on — `MONDAY`..`SUNDAY` — not "N days from today." A business selects up to 4; 1-2 is recommended so there's enough lead time to prepare orders (see [`../decisions/delivery-days-max-and-recommendation.md`](../decisions/delivery-days-max-and-recommendation.md)).

## Storage

`BusinessDeliveryDay` — a join table (`businessId`, `day: DayOfWeek`, `@@unique([businessId, day])`), not a `String[]` or comma-separated string column. This is both a design preference (a real one-to-many relationship deserves a relational table) and a hard requirement: MySQL/Prisma doesn't support scalar list columns the way Postgres does.

## Selection

A dropdown on the business onboarding form (`business/create/page.tsx`) and the dashboard's edit form (`business/[id]/page.tsx`), both via `src/app/studashboard/marketplace/business/_components/DeliveryDaysField.tsx`. Selecting a day removes it from the dropdown's remaining options and adds a removable chip; the dropdown disables itself once 4 are selected.

## Display

Shown on the Business Profile tab (view mode) and the Analytics/Stats tab — both read `Business.deliveryDays` (a `DayOfWeek[]` derived from the join table) via `GET /api/marketplace/businesses/[id]`.

## How the estimated delivery date is calculated from them

See [`estimated-delivery-and-windows.md`](estimated-delivery-and-windows.md).

## Relevant files

`prisma/schema.prisma` (`BusinessDeliveryDay`, `DayOfWeek`), `src/types/business.ts` (`DeliveryDay`, `MAX_DELIVERY_DAYS`, `RECOMMENDED_MAX_DELIVERY_DAYS`), `src/app/studashboard/marketplace/business/_components/DeliveryDaysField.tsx`, `src/app/api/marketplace/businesses/route.ts` + `businesses/[id]/route.ts`.
