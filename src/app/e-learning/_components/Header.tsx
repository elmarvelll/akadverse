// src/app/e-learning/_components/Header.tsx
//
// The header bar of the common E-Learning layout (AGENTS.md §10). Kept in
// the same minimal style as src/app/components/dashboard/student/DashboardNavbar.tsx
// (the Marketplace-side student navbar) for visual consistency, plus a
// role label so it's always visible which portal you're in.

"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import type { ElearningRole } from "@/services/e-learning/shared/auth";
import { getDashboardHref } from "./nav-config";
import { LogOut, Menu, X } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  hod: "HOD",
  dapu: "DAPU",
  dean: "Dean",
  vc: "VC",
};

export default function Header({
  role,
  name,
  menuOpen = false,
  onMenuToggle,
  onBrandClick,
}: {
  role: ElearningRole;
  name: string;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  // Called when the AkadVerse logo is clicked (the shell uses it to close the mobile drawer, e.g. when you are already on the dashboard).
  onBrandClick?: () => void;
}) {
  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="fixed top-0 inset-x-0 z-10 h-16 bg-white border-b border-gray-100">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onMenuToggle && (
            <button
              type="button"
              onClick={onMenuToggle}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="elearning-nav"
              className="lg:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {/* Always the CURRENT role's dashboard (role comes from the server-side session via the layout, never from the URL or the client).
              A real link — a new history entry, deliberately NOT router.back(): the logo means "home", not "previous page". */}
          <Link
            href={getDashboardHref(role)}
            onClick={onBrandClick}
            aria-label="AkadVerse — go to your dashboard"
            className="font-semibold text-gray-900 tracking-tight rounded-md px-1 -mx-1 py-1 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Akadverse
          </Link>
          <span className="hidden sm:inline text-xs font-medium text-gray-400 border-l border-gray-200 pl-3">E-Learning</span>
          <span className="hidden md:inline text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded-full px-2.5 py-1">
            {ROLE_LABELS[role] ?? role}
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <span className="hidden md:inline text-sm text-gray-500">{name}</span>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
