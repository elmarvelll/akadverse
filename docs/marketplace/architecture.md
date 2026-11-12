# Marketplace — Architecture

Last verified against the codebase: 2026-08-28.

## 1. The end-to-end flow, as implemented

```text
Buyer → Marketplace → Business/Seller → Central Drop-off → Delivery Coordinator
  → Deliverer → Buyer → Escrow → Seller Payout
```

Every hop above is now real:

```text
Buyer browses/carts → checkout/Paystack → Order (PENDING_SELLER)
  → Seller accepts/rejects (24h deadline, cron-enforced) → ACCEPTED
  → Seller processes → marks READY_FOR_PICKUP (buyer emailed estimate+window)
  → Seller drops off at central drop-off (15h deadline; late fine + delivery
     restriction if missed)
  → Delivery coordinator (admin) assigns dropped-off items to a deliverer
  → Deliverer <-> Seller OTP handoff -> PICKED_UP / HANDED_TO_DELIVERER
  → Deliverer starts delivery -> buyer OTP issued -> OUT_FOR_DELIVERY
  → Deliverer <-> Buyer OTP confirmation -> DELIVERED
      (failure -> 24h retry -> second failure -> item cancelled + refunded)
  → Escrow: HELD -> PAYOUT_PENDING
  → Seller-payout cron -> Paystack Transfer -> PAYOUT_SUCCESS
```

See [`systems/order-system.md`](systems/order-system.md) for the full pipeline with links to each system's own doc.

## 2. Component diagram

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Browser (Next.js client components)                                       │
│  studashboard/marketplace/                                                │
│   ├─ business/[id]/orders (seller: 5 sections, accept/reject/ready/       │
│   │                        drop-off, fine payment)                        │
│   ├─ orders (buyer: item-level order tracking + delivery OTP display)     │
│   ├─ deliverer (pickup OTP, out-for-delivery, delivery OTP, fail-attempt) │
│   ├─ deliverer/apply (application form)                                   │
│   ├─ admin/deliverers, admin/deliveries (approval queue, coordinator      │
│   │                                       assignment)                      │
│   └─ checkout, business/create, business/[id] (delivery-days field)       │
└───────────────┬─────────────────────────────────────────────────────────┬─┘
                │ axios                                                    │ Paystack Inline JS
                ▼                                                          ▼
┌───────────────────────────────────────────────┐        ┌──────────────────────────┐
│ src/proxy.ts (session gate; /api/cron & /api/  │        │ Paystack (external)      │
│ webhooks are the two unauthenticated prefixes) │◄───────┤ - checkout + fine payment │
└───────────────┬─────────────────────────────────┘  HMAC  │ - transfer recipients/   │
                ▼                                    signature│   transfers (payouts)  │
┌───────────────────────────────────────────────────────────┴──────────────┐
│ Route handlers — src/app/api/marketplace/**, /api/cron/**,               │
│  /api/webhooks/paystack                                                  │
│  businesses/[id]/orders/[orderId]/{accept,reject,ready,drop-off}         │
│  businesses/[id]/orders/[orderId]/items/[itemId]/reject                  │
│  businesses/[id]/fines/**  ·  deliverer/apply, status, handoffs,          │
│  deliveries/**  ·  admin/deliverers/**, admin/deliveries/**  ·  orders   │
│  cron/{seller-response,seller-payout,deliverer-inventory,                │
│        delivery-schedule,delivery-retry}                                  │
└───────┬───────────────────┬───────────────────┬───────────────────┬──────┘
        ▼                   ▼                   ▼                   ▼
┌────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐
│ src/lib/        │ │ services/external_│ │ next-auth          │ │ src/lib/      │
│  order-fulfillment│ │ utils/paystack.ts │ │ (getServerSession)│ │ admin.ts,     │
│  estimated-delivery│ │  - checkout verify│ └──────────────────┘ │ deliverer.ts, │
│  dropoff-deadline │ │  - bank/resolve    │                       │ cron-auth.ts  │
│  otp.ts            │ │  - transfer        │                       └──────────────┘
│  order-events.ts   │ │    recipients/     │
│  escrow.ts          │ │    transfers       │
│  seller-payout.ts   │ └──────────────────┘
│  late-delivery-fine │ ┌──────────────────┐
│  seller-order-      │ │ services/marketplace/notifications/email.service.ts  │
│    sections.ts       │ │  (Resend)         │
└─────────────────────┘ └──────────────────┘
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Prisma → MySQL                                                │
│  User, Business (+ BusinessDeliveryDay, LateDeliveryFine),    │
│  Product, CartItem, Order, OrderItem, OrderEvent, Deliverer,   │
│  Delivery, DeliveryItem, Delivery_x_businesses                 │
└─────────────────────────────────────────────────────────────┘
```

## 3. Components and how they communicate

- **Frontend**: unchanged pattern — client components under `studashboard/marketplace/`, all backend calls through `src/lib/axios.ts`.
- **Backend/API**: every new route still re-checks `getServerSession` (or, for admin/deliverer routes, the additional `requireAdmin`/`requireApprovedDeliverer` guard) and reuses `requireOwnedBusiness` wherever business ownership is the relevant scope.
- **Database**: MySQL via Prisma — the schema grew substantially (see [`data/schema.md`](data/schema.md)) but the connection/client pattern (`src/lib/prisma.ts`) is unchanged.
- **Authentication**: unchanged (NextAuth, JWT sessions). **Authorization** now includes two new gates: `src/lib/admin.ts#requireAdmin` (role-based) and `services/marketplace/deliverer/deliverer.service.ts#requireApprovedDeliverer` (Deliverer-row-based).
- **Order system**: now the full lifecycle — see [`systems/order-system.md`](systems/order-system.md).
- **Delivery system**: real — `Delivery`/`DeliveryItem`/`Delivery_x_businesses`, driven by the delivery coordinator's assignment and the deliverer's own pickup/delivery actions. See [`systems/delivery-system.md`](systems/delivery-system.md), [`systems/deliverer-system.md`](systems/deliverer-system.md).
- **Notification/email system**: real, via Resend — see [`systems/email-system.md`](systems/email-system.md). The in-app `NotificationDropdown` bell is still not wired to any of this (still renders empty).
- **Cron jobs**: real — five routes under `/api/cron/*`, scheduled by Vercel Cron (`vercel.json`), authenticated by a shared secret (`src/lib/cron-auth.ts`). See [`systems/cron-system.md`](systems/cron-system.md).
- **Paystack**: now also handles transfer-recipient creation and transfers (seller payouts), and a second payment flow (late-delivery fines), distinguished from checkout payments by reference prefix (`AKD-FINE-` vs. the default `AKD-`) in the shared webhook route.
- **Escrow**: real, item-level — see [`systems/escrow-system.md`](systems/escrow-system.md). Honest caveat: refunds reach `REFUNDED` state without an actual Paystack refund call yet (see [`security/gaps.md`](security/gaps.md)).
- **Seller payouts**: real, via Paystack Transfers, idempotent, cron-driven — see [`systems/seller-payout-system.md`](systems/seller-payout-system.md).
- **Admin system**: real for two functions (deliverer approval, delivery-coordinator assignment) — see [`systems/admin-system.md`](systems/admin-system.md). No broader Marketplace admin tooling (disputes, moderation) exists.
- **Deliverer approval system**: real — see [`systems/deliverer-system.md`](systems/deliverer-system.md).

## 4. Data flows and state transitions

The single most important reference for this is [`data/order-states.md`](data/order-states.md) — four separate state machines (order status, fulfillment status, delivery status, escrow/payout status), deliberately not collapsed into one field. See [`decisions/separate-status-fields.md`](decisions/separate-status-fields.md) for why.

## 5. Keeping this document updated

Update this diagram and the flow list above whenever a new Marketplace system is added or an existing one's shape changes — not when it's merely planned. Cross-reference the relevant [`todo/`](todo/) phase and add a [`log/`](log/) entry for the change.
