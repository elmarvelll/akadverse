# System: Central Drop-off

## Purpose

The physical hand-off point between "seller has it" and "the delivery network has it." Businesses currently drop prepared orders at one particular central location rather than the deliverer collecting from each business individually. See [`../decisions/central-dropoff-location.md`](../decisions/central-dropoff-location.md).

## Flow

```text
Seller (READY_FOR_PICKUP, prepared)
  -> Seller confirms drop-off (POST .../orders/[orderId]/drop-off)
  -> Order.sellerDroppedOffAt recorded
  -> Delivery coordinator sees the item in the ready-items pool
     (GET /api/marketplace/admin/deliveries/ready-items)
  -> Coordinator assigns it to a deliverer (see delivery-coordinator-system.md)
```

## The 15-hour deadline

The seller must drop off **15 hours before the start of the new day of the estimated delivery date** — i.e. 15 hours before 12:00 AM on the estimated delivery date, not "15 hours before the delivery window." See [`../decisions/seller-dropoff-deadline.md`](../decisions/seller-dropoff-deadline.md) and `services/marketplace/delivery/dropoff-deadline.service.ts`.

```text
Estimated delivery: Wednesday
Start of that new day: Wednesday 12:00 AM
Deadline: Tuesday 9:00 PM  (12:00 AM - 15 hours)
```

## Missed deadline

Drop-off after the deadline (checked in the drop-off route itself, comparing the drop-off timestamp against the deadline) triggers [`late-delivery-fine-system.md`](late-delivery-fine-system.md): a fine is issued and the business is restricted from delivery until it's paid.

## API

`POST /api/marketplace/businesses/[id]/orders/[orderId]/drop-off` — the only route in this system. 409 if the order isn't `READY_FOR_PICKUP` or has already been dropped off.

## Database

`Order.sellerDroppedOffAt`, `Order.estimatedDeliveryAt` (read to compute the deadline).

## Dependencies

Depends on: [`seller-processing-system.md`](seller-processing-system.md).
Depended on by: [`delivery-coordinator-system.md`](delivery-coordinator-system.md), [`late-delivery-fine-system.md`](late-delivery-fine-system.md).

## Relevant files

`services/marketplace/delivery/dropoff-deadline.service.ts`, `src/app/api/marketplace/businesses/[id]/orders/[orderId]/drop-off/route.ts`.
