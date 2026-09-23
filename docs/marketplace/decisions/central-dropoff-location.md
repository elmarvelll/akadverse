# Decision: One central drop-off location, not per-business deliverer pickup

- **Date**: 2026-08-28 (documented at implementation time; the underlying business decision predates this and is described as already-operational in the spec — "businesses currently drop their products at one particular central drop-off place").
- **Context**: Getting a ready order from a seller to a deliverer needs a defined hand-off mechanism.
- **Problem**: A deliverer could collect directly from each business's own location, or businesses could all converge on one shared point.
- **Chosen option**: One central drop-off location; sellers bring orders there; a delivery coordinator assigns deliverers who collect from that single point.
- **Reason**: Given as an operational fact in the spec, not a choice made during this implementation pass — modeled as-is (`Order.sellerDroppedOffAt`, the delivery-coordinator assignment flow) rather than building a more complex per-business-pickup routing system.
- **Consequences**: The current implementation has no per-business pickup address/routing logic — a deliverer's `Delivery` run and `Delivery_x_businesses` handoffs assume everything is collected from the same physical point. If the school later operates multiple drop-off points, this would need real routing logic added.
- **Alternatives rejected**: Per-business pickup — not built, since the given operational model is a single central point.
