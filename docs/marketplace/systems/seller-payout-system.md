# System: Seller Payout

## Purpose

Pays a seller for a delivered item's net proceeds, via Paystack Transfers, once escrow has marked the item eligible.

## Calculation

```text
net payout = (historical OrderItem.price × quantity) − (gross × SERVICE_FEE_RATE)
```

`services/marketplace/escrow/escrow.service.ts#calculateItemPayout` — **never** the current `Product.price`. See [`../data/price-snapshots.md`](../data/price-snapshots.md).

## Payout states (`OrderItem.payoutStatus`)

```text
PAYOUT_PENDING -> PAYOUT_PROCESSING -> PAYOUT_SUCCESS
                                    \-> PAYOUT_FAILED (retryable, up to 5 attempts)
```

`PAYOUT_SUCCESS` is set **only** after Paystack's transfer call itself reports `status: "success"` — never optimistically. If Paystack reports a non-terminal status (`pending`/`otp` — transfer still settling), the item is left `PAYOUT_PROCESSING` rather than marked either way; resolving that properly needs a Paystack transfer-webhook handler (`transfer.success`/`transfer.failed`), which doesn't exist yet — see [`../todo/phase-05-escrow-and-payments.md`](../todo/phase-05-escrow-and-payments.md).

## Idempotency (never pay twice)

`services/marketplace/payout/seller-payout.service.ts#processItemPayout` only ever acts on an item currently `payoutStatus = PAYOUT_PENDING` **and** `escrowStatus = PAYOUT_PENDING` — the same "only touch rows still in the pre-success state" pattern proven in `confirmPaymentByReference` (checkout payment confirmation). A retried `PAYOUT_FAILED` item must be explicitly reset back to `PAYOUT_PENDING` by the cron before `processItemPayout` will touch it again — it never silently reprocesses a `FAILED` row. Paystack's own `reference` param (`AKD-PAYOUT-{orderItemId}-{attemptNumber}`) is unique per attempt too, giving idempotency on Paystack's side as a second layer.

## Paystack recipient creation

A business's Paystack transfer recipient (`Business.paystackRecipientCode`) is created once, lazily, the first time a payout is attempted for that business, and cached from then on (`src/lib/external/paystack.ts#createTransferRecipient`). Requires `Business.bankCode`, `accountNumber`, `accountHolderName` all be set — see [`../decisions/business-bank-code-reintroduced.md`](../decisions/business-bank-code-reintroduced.md) for why `bankCode` had to come back onto the schema for this to be possible at all.

## Cron

`seller-payout`, every 5 hours (`vercel.json`) — processes every `PAYOUT_PENDING` item, then resets and retries any `PAYOUT_FAILED` item with fewer than 5 prior attempts. See [`cron-system.md`](cron-system.md).

## Notifications

`sellerPayoutSuccessEmail` / `sellerPayoutFailedEmail`.

## Error handling

Any exception during recipient creation or the transfer call (missing bank details, Paystack API error) is caught, the item is set `PAYOUT_FAILED` with `payoutFailureReason` recorded, and the seller is emailed. The failure doesn't propagate to fail the whole cron run — one bad item never blocks the rest of the batch.

## Database

`OrderItem.{payoutStatus, payoutAttempts, payoutProcessingAt, payoutSucceededAt, payoutFailedAt, payoutFailureReason, payoutReference}`, `Business.paystackRecipientCode`.

## Dependencies

Depends on: [`escrow-system.md`](escrow-system.md) (an item becomes `PAYOUT_PENDING` only once delivered — see `services/marketplace/escrow/escrow.service.ts#markItemEligibleForPayout`, called from the delivery-confirmation route).

## Relevant files

`services/marketplace/payout/seller-payout.service.ts`, `src/app/api/cron/seller-payout/route.ts`, `src/lib/external/paystack.ts` (transfer functions).
