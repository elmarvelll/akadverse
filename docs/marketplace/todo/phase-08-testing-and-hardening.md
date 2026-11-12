# Phase 8 — Testing & Hardening

## Objective

Close the known security/reliability gaps, and establish test coverage, now that the full order/delivery/escrow/payout pipeline (Phases 3-7) is built.

## Status: ❌ Not started; gaps are documented, not yet fixed

See [`../security/gaps.md`](../security/gaps.md) for the full, current list. Highest-priority items:

- [ ] **Real Paystack refund calls** — the single biggest gap. `refundOrderItem` reaches `REFUNDED` state without an actual money movement back to the buyer.
- [ ] **Paystack transfer-webhook handling** (`transfer.success`/`transfer.failed`) — needed to correctly resolve a payout that doesn't report `success` synchronously.
- [ ] Stock decrement/reservation at checkout (pre-existing gap, still unaddressed — nothing prevents overselling).
- [ ] Delivery-restriction enforcement beyond the dashboard warning banner.
- [ ] Business-configurable delivery windows (currently one fixed constant for everyone).
- [ ] Rate limiting on external-API-calling routes and the OTP-verification routes.
- [ ] No automated test suite exists for any of this — every route/lib function documented in [`../systems/`](../systems/) was verified via `tsc --noEmit` and a full `next build` passing cleanly, not via unit/integration tests. Building real test coverage for the money-handling paths (escrow, payout, refund) should be the first testing priority given they're the highest-consequence code.
- [ ] Audit/event logging — largely satisfied by `OrderEvent` now (see [`../systems/order-history-system.md`](../systems/order-history-system.md)), but nothing analogous exists for deliverer-application or admin actions outside the order pipeline.
- [ ] `Order.status`/`paymentStatus` — `status` is now a real `OrderStatus` enum (done, this phase's earlier recommendation is satisfied); `paymentStatus` remains a free-text string (`"pending"`/`"paid"`) since it predates this pass and represents a narrower, stable concern.

## Dependencies

Ongoing.

## Relevant systems

Cuts across all of them; see [`../security/`](../security/) for the living gap list.
