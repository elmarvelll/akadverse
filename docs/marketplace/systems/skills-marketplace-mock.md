# System: Skills Marketplace (UI mock)

## Purpose

Renders a "services students offer" section (tutoring, design help, etc.) alongside the real product marketplace on the homepage and Explore page.

## Reality check

This is **not backed by the database**. `getPopularSkills`, `getBestServices`, `getSkillsByCategory`, and `searchSkills` all come from `services/marketplace/skills-market/data.ts`, which is static, hard-coded mock data — not a Prisma query. Despite the schema defining a full set of skills-related models (`Skill`, `SkillOffer`, `SkillCounterOffer`, `SkillReview`, `SkillNotification`, `SkillType`), **no API route exists for any of them** (no `src/app/api/marketplace/skills*` directory was found). The `explore/page.tsx` file's own header comment confirms this directly: *"still backed by the mock product-market/skills-market data."*

`services/marketplace/product-market/data.ts` is the equivalent legacy mock for products; it is still imported by `explore/page.tsx` but the real, DB-backed product search (`/api/marketplace/search/products`) is what the page actually renders for products. Treat `product-market/data.ts` as effectively superseded/unused code to verify before deleting — do not assume it's dead without checking every import site (**Undocumented / requires clarification** on whether removal is intended or it's a deliberate fallback).

## Actors

Buyer (view only — there is no way to create/offer a skill anywhere in the UI or API).

## Data

None persisted. `services/marketplace/shared/types.ts` defines the mock shape consumed by `SkillCard.tsx`/`SpotlightCard.tsx`.

## Components

- `_components/SkillCard.tsx`, `SpotlightCard.tsx` — render mock skill data on the homepage.
- `explore/page.tsx` — renders mock skill search results alongside real product search results.

## Why this matters for anyone continuing the work

Building a real Skills marketplace (offer creation, buyer requests, counter-offers, OTP-based fulfillment confirmation, reviews) would need: API routes under `/api/marketplace/skills*`, wiring the existing `Skill`/`SkillOffer`/`SkillCounterOffer`/`SkillReview`/`SkillNotification`/`SkillType` models (which already model a fairly complete offer/counter-offer/dispute lifecycle in their field lists) into real routes, and replacing every import of `services/marketplace/skills-market/data.ts` with real queries. This is out of scope for the Product Marketplace TODO phases in [`../todo/`](../todo/), which cover the product side only — call this out explicitly if skills-marketplace work is prioritized, since it would need its own phase plan.

## Relevant files

- `services/marketplace/skills-market/data.ts`, `services/marketplace/shared/types.ts`
- `prisma/schema.prisma` — `Skill`, `SkillOffer`, `SkillCounterOffer`, `SkillReview`, `SkillNotification`, `SkillType` (all unused by any route)
- `src/app/studashboard/marketplace/page.tsx`, `explore/page.tsx`
