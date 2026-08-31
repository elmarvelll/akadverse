# Decision: Up to 4 delivery days, 1-2 recommended

- **Date**: 2026-08-28.
- **Context**: A business needs to declare which days of the week it accepts deliveries on, feeding the estimated-delivery calculation.
- **Problem**: Too many selectable days gives a business little planning structure; too few (e.g. capping at 1) is overly restrictive for a business that genuinely operates most days.
- **Chosen option**: Allow up to 4 selected days (`MAX_DELIVERY_DAYS`), with UI copy recommending 1-2 (`RECOMMENDED_MAX_DELIVERY_DAYS`) so a business has enough lead time to prepare each order.
- **Reason**: Directly specified by the implementation spec.
- **Consequences**: `src/app/api/marketplace/businesses/route.ts` and `businesses/[id]/route.ts` both reject a request selecting more than 4 days with a 400. The recommendation is advisory only — the API doesn't block 3 or 4 selections, it only enforces the hard cap.
- **Alternatives rejected**: None recorded — this is a direct requirement, not a considered trade-off.
