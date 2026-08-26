// src/app/superadmindashboard/page.tsx
//
// Landing page for the "super_admin" role — src/proxy.ts sends anyone
// whose session role is "super_admin" here. Not built out yet, so it shows
// a lightweight placeholder (see ComingSoon component).

import ComingSoon from "@/app/components/dashboard/shared/ComingSoon";

export default function SuperAdminDashboardPage() {
  return <ComingSoon portalName="Super Admin Portal" />;
}
