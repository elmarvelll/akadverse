// src/app/e-learning/_components/Header.tsx
//
// The header bar of the common E-Learning layout (AGENTS.md §10). Kept in
// the same minimal style as src/app/components/dashboard/student/DashboardNavbar.tsx
// (the Marketplace-side student navbar) for visual consistency, plus a
// role label so it's always visible which portal you're in.

"use client";

import { signOut } from "next-auth/react";
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
}: {
  role: string;
  name: string;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
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
          <span className="font-semibold text-gray-900 tracking-tight">Akadverse</span>
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
