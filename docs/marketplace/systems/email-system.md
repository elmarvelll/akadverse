# System: Email

## Purpose

Every transactional email the Marketplace sends — new order, acceptance, ready-for-pickup, delivery OTP, failure/retry, refund, late-fine restriction, payout outcome, deliverer daily digest, deliverer approval.

## Provider

Resend, via `services/marketplace/notifications/email.service.ts#sendEmail`. Chosen over SMTP/nodemailer for a simpler API-based integration — see [`../decisions/email-provider.md`](../decisions/email-provider.md).

## Failure handling

`sendEmail` **never throws** — a Resend API error or a missing `RESEND_API_KEY` is logged (`console.warn`/`console.error`) and swallowed. This is deliberate: an email failure must never fail the order/delivery/payout state change that triggered it. Every call site in the codebase is a fire-and-forget `void sendEmail(...)`.

## Templates

One function per notification in `services/marketplace/notifications/email.service.ts`, each returning `{ subject, html }` built through a shared `layout()` wrapper so every email looks consistent:

| Function | Sent to | Triggered by |
|---|---|---|
| `newOrderEmail` | Seller | Payment confirmed |
| `sellerOrderProcessingEmail` | Buyer | Seller accepts |
| `sellerRejectedEmail` | Buyer | Seller rejects / auto-reject |
| `buyerOrderReadyEmail` | Buyer | Seller marks ready |
| `buyerOutForDeliveryEmail` | Buyer | Deliverer starts delivery |
| `buyerDeliveryOtpEmail` | Buyer | Deliverer starts delivery |
| `sellerDeliveryFailedEmail` | Seller | First failed delivery attempt |
| `buyerDeliveryFailedEmail` | Buyer | First failed delivery attempt |
| `buyerRefundEmail` | Buyer | Item refunded |
| `sellerLateDeliveryRestrictionEmail` | Seller | Missed drop-off deadline |
| `sellerPayoutSuccessEmail` | Seller | Payout succeeds |
| `sellerPayoutFailedEmail` | Seller | Payout fails |
| `delivererDailyScheduleEmail` | Deliverer | Midnight delivery-schedule cron |
| `delivererApplicationApprovedEmail` | Deliverer applicant | Admin approves |

## Not implemented

An in-app notification bell exists in the UI (`NotificationDropdown.tsx`) but is **not wired to any of this** — it renders a permanent empty state, since the `Notification` Prisma model has no writer anywhere in the Marketplace. See [`../data/schema.md`](../data/schema.md). If in-app notifications are built later, the natural integration point is having each of the `sendEmail` call sites above also create a `Notification` row.

## Configuration

`RESEND_API_KEY`, `MARKETPLACE_EMAIL_FROM` (optional, falls back to a default sender) — see `.env.example`.

## Relevant files

`services/marketplace/notifications/email.service.ts`.
