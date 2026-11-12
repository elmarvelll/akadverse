// src/app/components/dashboard/shared/ComingSoon.tsx
//
// Shared placeholder shown as the dashboard home page for roles whose
// portals haven't been built yet (faculty, admin — see
// src/app/facultydashboard, src/app/admindashboard). Kept as one shared
// component instead of copy-pasting the same markup, so the "coming soon"
// look only needs updating in one place later.
//
// super_admin no longer has its own portal (src/app/superadmindashboard
// was removed) — Marketplace admin access is now the independent
// `User.isAdmin` flag, not tied to `role`, so a super_admin account just
// lands on the normal student home route like everyone else. See
// docs/admin/decisions/admin-flag-replaces-role-check.md.
//
// Also reused for unbuilt workspaces inside a hub (Main Menu, AI Studio).
// Those pass `backHref` pointing at their hub, which swaps the Sign out
// button for a "Back to dashboard" link — signing out from a sub-page was
// the only way off it before.

"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Loader2, LogOut } from "lucide-react";

export default function ComingSoon({ portalName, backHref }: { portalName: string; backHref?: string }) {
  const { user, isLoading } = useAuth();

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center px-6 text-center">
      {isLoading ? (
        // Loading state for the session lookup, same pattern used on
        // src/app/studashboard/page.tsx — avoids flashing a greeting with
        // no name before the session resolves.
        <Loader2 className="animate-spin text-gray-400" size={28} />
      ) : (
        <>
          <p className="text-xs tracking-[0.3em] uppercase text-gray-400 mb-3">{portalName}</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Coming soon</h1>
          <p className="text-gray-500 max-w-sm">
            {user?.firstName ? `Hang tight, ${user.firstName} — ` : ""}
            we&apos;re still building the {portalName.toLowerCase()}. Check back soon.
          </p>
          {backHref ? (
            <Link
              href={backHref}
              className="mt-8 flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition"
            >
              <ArrowLeft size={16} />
              Back to dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-8 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
            >
              <LogOut size={16} />
              Sign out
            </button>
          )}
        </>
      )}
    </div>
  );
}
