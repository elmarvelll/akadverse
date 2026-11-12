# Decision: Order status uses `PENDING_SELLER`, superseding the earlier `PENDING`-only guidance

- **Date**: 2026-08-28.
- **Context**: The original Marketplace documentation pass (README, architecture, TODO) explicitly recorded: *"Use PENDING, ACCEPTED, REJECTED, CANCELLED. Do NOT use PENDING_SELLER. The correct initial state is PENDING."* The subsequent implementation specification for the order/delivery/escrow system explicitly and repeatedly (in its state-machine section and its full-lifecycle diagram) specified `PENDING_SELLER` as the literal initial order status.
- **Problem**: Two direct, conflicting instructions about the same enum's initial value, given at different times.
- **Options considered**: 1) Keep `PENDING` per the earlier guidance and treat the later spec's `PENDING_SELLER` as a typo/inconsistency to ignore. 2) Follow the later, more detailed, repeatedly-stated spec and use `PENDING_SELLER`.
- **Chosen option**: 2 — `OrderStatus.PENDING_SELLER` is the actual initial value implemented in `prisma/schema.prisma`.
- **Reason**: The later specification is more recent, far more detailed (a full state-machine diagram, repeated across three separate sections), and is what was actually being implemented at the time this decision was made. Per this documentation set's own maintenance rule ("if a decision is later changed, do not erase the original, document the new one and why"), this file records the change rather than silently overwriting the earlier stated preference.
- **Consequences**: Every place in the earlier documentation pass that said "the correct initial state is PENDING, not PENDING_SELLER" is now stale and superseded by this decision. `docs/marketplace/data/order-states.md` reflects the actual implemented value.
- **Alternatives rejected**: Keeping `PENDING` — rejected because it would have directly contradicted the explicit, repeated instruction in the implementation spec that was actively being built against.
