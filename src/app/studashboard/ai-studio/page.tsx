// src/app/studashboard/ai-studio/page.tsx
//
// Landing page for the "AI Studio" workspace card on
// src/app/studashboard/page.tsx. Not built out yet — same placeholder as
// the faculty portal's equivalent (src/app/facultydashboard/ai-studio/page.tsx).
// The card used to link here with no page.tsx at all, so it was a 404.

import ComingSoon from "@/app/components/dashboard/shared/ComingSoon";

export default function AiStudioPage() {
  return <ComingSoon portalName="AI Studio" backHref="/studashboard" />;
}
