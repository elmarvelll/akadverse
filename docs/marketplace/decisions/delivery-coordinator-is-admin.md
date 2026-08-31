# Decision: "Delivery coordinator" is implemented as an admin-only function, not a separate role

- **Date**: 2026-08-28.
- **Context**: The spec describes a "delivery coordinator" who assigns deliveries to deliverers after businesses drop items off, and separately describes an admin who approves deliverer applications.
- **Problem**: The spec never defines a distinct account type, permission set, or model for "delivery coordinator" — it reads as a function/responsibility, not a role definition, unlike "deliverer" (which does get its own model).
- **Chosen option**: Delivery-coordinator actions (viewing the ready-items pool, assigning deliveries) are gated by the same `requireAdmin` check used for deliverer-application approval.
- **Reason**: The platform's only elevated role available is `admin`/`super_admin` (`Role` enum). Inventing a new role/model for "delivery coordinator" without any spec'd data shape for it would be adding scope not actually requested, and would need its own approval/assignment flow mirroring the deliverer one for no clear reason given in the spec.
- **Consequences**: Any user with `role: admin` or `super_admin` can act as both an application-approver and a delivery coordinator — there's no way to grant just one of those two functions today. If they need to be split later (e.g. a coordinator who isn't also an application-approver), that's a real, currently-unbuilt permission distinction.
- **Alternatives rejected**: A new `DeliveryCoordinator` model/role, mirroring `Deliverer` — not built, since nothing in the spec calls for a distinct application/approval flow for coordinators the way it explicitly does for deliverers.
