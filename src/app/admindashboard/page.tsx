// src/app/admindashboard/page.tsx
//
// Landing page for the "admin" role — src/proxy.ts sends anyone whose
// session role is "admin" here. Not built out yet, so it shows a
// lightweight placeholder (see ComingSoon component).

import ComingSoon from "@/app/components/dashboard/shared/ComingSoon";

export default function AdminDashboardPage() {
  return <ComingSoon portalName="Admin Portal" />;
}
