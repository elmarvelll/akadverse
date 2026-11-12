# System: Delivery Coordinator

## Purpose

Assigns dropped-off order items to a specific approved deliverer, and issues the seller<->deliverer pickup OTP per business represented in that assignment.

## Actors

Delivery coordinator — implemented as an **admin-only** function (`role: admin`/`super_admin`), not a distinct account type. See [`../decisions/delivery-coordinator-is-admin.md`](../decisions/delivery-coordinator-is-admin.md) for why: the product spec describes a coordinator role/function, but defines no separate account model for it, and the platform's only elevated role is `admin`.

## Flow

```text
GET /api/marketplace/admin/deliveries/ready-items
  -> every OrderItem with deliveryStatus=null, not rejected/cancelled,
     whose Order has sellerDroppedOffAt set (regardless of whether this is
     a first assignment or a post-retry reassignment — see the route's own
     comment on why fulfillmentStatus isn't part of this filter)

POST /api/marketplace/admin/deliveries { delivererId, orderItemIds }
  -> creates one Delivery (the deliverer's run)
  -> upserts one DeliveryItem per selected OrderItem (upsert, not create —
     a retried item already has a DeliveryItem row from its earlier failed
     run; this reassigns it rather than trying to duplicate it, since
     DeliveryItem.orderItemId is @unique)
  -> creates one Delivery_x_businesses row per distinct business
     represented, each with its own freshly generated pickupOtp
  -> OrderItem.deliveryStatus -> ASSIGNED
```

## Database

`Delivery`, `DeliveryItem`, `Delivery_x_businesses`, `OrderItem.deliveryStatus`.

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/marketplace/admin/deliveries/ready-items` | GET | The assignment pool |
| `/api/marketplace/admin/deliveries` | POST | Perform an assignment |

## Authentication / Authorization

`src/lib/admin.ts#requireAdmin` — session role must be `admin`/`super_admin`.

## Components

`studashboard/admin/marketplace/deliveries/page.tsx` — checkbox list of ready items + a deliverer picker.

## Edge cases

- A `Delivery` can span multiple businesses' items in one assignment — one `Delivery_x_businesses` (and OTP) is still issued per business, since the physical handoff happens business-by-business even if the coordinator batches the assignment.
- Only `APPROVED` deliverers are assignable (`Deliverer.status`).

## Dependencies

Depends on: [`central-dropoff-system.md`](central-dropoff-system.md), [`deliverer-system.md`](deliverer-system.md) (approval gate).
Depended on by: [`deliverer-system.md`](deliverer-system.md) (the pickup OTP handoff this creates).

## Relevant files

`src/app/api/marketplace/admin/deliveries/route.ts`, `.../ready-items/route.ts`, `src/lib/admin.ts`.
