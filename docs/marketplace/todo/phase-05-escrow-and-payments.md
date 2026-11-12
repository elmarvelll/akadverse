# Phase 5 — Escrow & Seller Payments

## Status: ✅ Done, with two honest gaps

- [x] Payment collection (unchanged, pre-existing).
- [x] Historical price snapshot (unchanged, pre-existing, correctly foundational).
- [x] Item/business-level escrow — `OrderItem.escrowStatus`, fully independent per item. See [`../systems/escrow-system.md`](../systems/escrow-system.md).
- [x] Rejected-item handling: item preserved, reason recorded, `refundOrderItem()` moves it through `REFUND_PENDING` → `REFUNDED`, without touching sibling items.
- [x] Seller payout calculation: `OrderItem.price × quantity − service fee`, from the historical snapshot, never `Product.price`. See [`../systems/seller-payout-system.md`](../systems/seller-payout-system.md).
- [x] Seller payout states (`PAYOUT_PENDING`/`PAYOUT_PROCESSING`/`PAYOUT_SUCCESS`/`PAYOUT_FAILED`).
- [x] Business bank account / Paystack recipient wiring — `Business.paystackRecipientCode`, created lazily on first payout via `createTransferRecipient`. Required reintroducing `Business.bankCode` — see [`../decisions/business-bank-code-reintroduced.md`](../decisions/business-bank-code-reintroduced.md).
- [x] 5-hour seller-payout cron, with bounded retry (5 attempts) for `PAYOUT_FAILED` items.
- [x] Payout idempotency — only ever acts on an item currently `PAYOUT_PENDING`, same pattern proven by `confirmPaymentByReference`.
- [ ] **No real Paystack refund call.** `refundOrderItem` reaches `REFUNDED` without an actual reversal transfer — see [`../security/gaps.md`](../security/gaps.md). This is the single biggest remaining gap in the money-handling code.
- [ ] **No Paystack transfer-webhook handling** for a transfer that reports `pending`/`otp` instead of immediate `success` — such an item is left `PAYOUT_PROCESSING` with no automatic resolution.

## Dependencies

Phase 3, Phase 4 — both satisfied.

## Relevant systems

[`../systems/escrow-system.md`](../systems/escrow-system.md), [`../systems/seller-payout-system.md`](../systems/seller-payout-system.md)

## Financial-logic note

Everything here reuses the "only touch rows still in a not-yet-final state" idempotency pattern from `confirmPaymentByReference` — the one piece of financial logic that predates this phase and remains the model to follow.
