// src/app/components/dashboard/student/DashboardNavbar.tsx
//
// Minimal top navbar for the student dashboard (src/app/studashboard/page.tsx).
// No design spec was given for this component, so it's kept deliberately
// small: the app name and a sign-out control. Extend this as the student
// portal grows (nav links, notifications, avatar menu, etc.).

"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function DashboardNavbar() {
  // Signs the user out via NextAuth, then sends them to /login. Using
  // `callbackUrl` (rather than a manual router.push after the call) lets
  // NextAuth handle clearing the session cookie and the redirect in one
  // step, avoiding a flash of stale authenticated UI in between.
  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <nav className="fixed top-0 inset-x-0 z-10 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <span className="font-semibold text-gray-900 tracking-tight">Akadverse</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
