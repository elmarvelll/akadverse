# Phase 1 — Foundation

## Objective

Authentication, database schema, and the base routing/ownership primitives everything else builds on.

## Status: ✅ Done (for what this phase needs)

- [x] NextAuth (Credentials + Google), JWT sessions — `src/lib/auth.ts`
- [x] Edge-runtime route protection — `src/proxy.ts`
- [x] Prisma schema + MySQL — `prisma/schema.prisma`
- [x] Shared ownership guard — `services/marketplace/business/business-ownership.service.ts#requireOwnedBusiness`
- [x] Cloudinary image upload — `src/lib/external/cloudinary.ts`, `/api/marketplace/uploads`
- [x] Paystack integration primitives (bank list, account resolution, transaction verify) — `src/lib/external/paystack.ts`

## Dependencies

None — this is the base layer.

## Relevant systems

All of them depend on this phase.

## Notes for whoever picks this up next

Nothing outstanding here structurally. If a Marketplace-specific role/permission model is ever needed (beyond ownership-based checks), it would extend this phase — see [`../security/authentication-and-authorization.md`](../security/authentication-and-authorization.md) for why there currently isn't one.
