// src/app/facultydashboard/ai-studio/page.tsx
//
// Landing page for the "AI Studio" workspace card on
// src/app/facultydashboard/page.tsx. Not built out yet. The student
// portal's workspace list links to an equivalent "/studashboard/ai-studio"
// that has no page.tsx at all (a real 404) — this one at least renders the
// same placeholder every other unbuilt workspace uses, rather than leaving
// the faculty version 404 too.

import ComingSoon from "@/app/components/dashboard/shared/ComingSoon";

export default function FacultyAiStudioPage() {
  return <ComingSoon portalName="AI Studio" />;
}
