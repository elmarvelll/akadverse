// src/app/facultydashboard/page.tsx
//
// Landing page for the "faculty" role — src/proxy.ts sends anyone whose
// session role is "faculty" here. Not built out yet, so it shows a
// lightweight placeholder (see ComingSoon component).

import ComingSoon from "@/app/components/dashboard/shared/ComingSoon";

export default function FacultyDashboardPage() {
  return <ComingSoon portalName="Faculty Portal" />;
}
