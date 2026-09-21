// src/app/e-learning/vc/page.tsx
//
// Placeholder only, deliberately (AGENTS.md §29) — see src/app/e-learning/dean/page.tsx's
// header comment; the same reasoning applies here for VC.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import ComingSoon from "../_components/ComingSoon";

export default async function VcPage() {
  await requireElearningRole(["vc"]);
  return (
    <ComingSoon
      title="VC Portal"
      description="VC functionality hasn't been specified yet — this placeholder exists so the account has somewhere to land."
    />
  );
}
