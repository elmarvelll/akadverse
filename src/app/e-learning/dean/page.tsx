// src/app/e-learning/dean/page.tsx
//
// Placeholder only, deliberately (AGENTS.md §29): Dean functionality is
// not being designed or implemented yet. This route exists so the role
// has somewhere to land and so the architecture accounts for it — nothing
// about what a Dean can do should be inferred from or built into this
// page until that's explicitly specified.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import ComingSoon from "../_components/ComingSoon";

export default async function DeanPage() {
  await requireElearningRole(["dean"]);
  return (
    <ComingSoon
      title="Dean Portal"
      description="Dean functionality hasn't been specified yet — this placeholder exists so the account has somewhere to land."
    />
  );
}
