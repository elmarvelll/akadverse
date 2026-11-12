# Decision: A rejected deliverer applicant can reapply

- **Date**: 2026-08-28.
- **Context**: `Deliverer.userId` is `@unique` — one row per user, ever. A user whose application is rejected needs some path forward if they want to try again, and the footer's state machine (not_applied/pending/approved/suspended) implies rejection isn't meant to be a permanent dead end.
- **Problem**: With `userId` unique, a naive "create a new `Deliverer` row" reapply would violate the constraint.
- **Chosen option**: `POST /api/marketplace/deliverer/apply` checks the existing row's status: if `REJECTED`, it **updates** that same row back to `PENDING` (clearing `rejectedAt`/`rejectionReason`, refreshing the submitted details) instead of creating a new one. `PENDING`/`APPROVED`/`SUSPENDED` still block a resubmission with a 409.
- **Reason**: Keeps one `Deliverer` row per user (simpler relation, no need to pick "the latest" among several historical rows) while still letting rejection be recoverable, which the footer's own UX implies is the intended behavior.
- **Consequences**: A `Deliverer` row's `appliedAt`/`firstName`/etc. reflect the *most recent* application, not the original one — there's no history of a prior rejected attempt preserved once reapplied (the `OrderEvent` history system doesn't cover deliverer applications, only orders). If that history matters later, a proper `DelivererApplication` history table would be a real addition, not just this fix.
- **Alternatives rejected**: A separate `DelivererApplication` history table with `Deliverer` only representing the current/approved state — not built, given the spec's `Deliverer` model definition (id/firstName/lastName/email) doesn't call for it and this is a smaller, sufficient fix.
