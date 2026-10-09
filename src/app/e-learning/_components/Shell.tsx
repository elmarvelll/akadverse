// src/app/e-learning/_components/Shell.tsx
//
// Responsive frame: below `lg` the sidebar is an off-canvas drawer opened from
// a header menu button (phones + tablets); from `lg` up it is a sticky column
// that can be collapsed to an icon rail (the choice is kept in a cookie, which
// layout.tsx reads so the first paint already matches). Collapsing really
// narrows the column, so <main> (flex-1) takes the space back.
// Client component only because it owns the drawer / collapsed state; role/name
// are still resolved server-side in layout.tsx.
//
// Stacking order (the only z-indexes in the shell): header z-10 (fixed, top),
// mobile backdrop z-20, mobile drawer z-30; from `lg` the sidebar is z-20 so
// page content (e.g. Study Zone's document viewer) can never paint over it.

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { ElearningRole } from "@/services/e-learning/shared/auth";
import { SIDEBAR_COOKIE } from "./nav-config";

export default function Shell({
  role,
  name,
  isLevelAdviser,
  initialCollapsed = false,
  children,
}: {
  role: ElearningRole;
  name: string;
  isLevelAdviser: boolean;
  initialCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };
  // The drawer is remembered together with the path it was opened on, so
  // navigating anywhere closes it without an effect-driven state reset.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    setOpenedOn(value ? pathname : null);
  };

  // Escape closes it; lock page scroll while it is open on small screens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedOn(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="elearning-shell min-h-screen bg-gray-50">
      <Header role={role} name={name} menuOpen={open} onMenuToggle={() => setOpen((v) => !v)} onBrandClick={() => setOpen(false)} />

      {open && <div className="fixed inset-0 top-16 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="pt-16 max-w-[1600px] mx-auto lg:flex">
        <aside
          id="elearning-nav"
          className={`fixed top-16 bottom-0 left-0 z-30 w-64 max-w-[85vw] overflow-y-auto bg-white border-r border-gray-100 transition-transform duration-200
            lg:sticky lg:z-20 lg:h-[calc(100dvh-4rem)] lg:self-start lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:overflow-x-hidden lg:bg-transparent lg:transition-[width]
            ${collapsed ? "lg:w-16 lg:border-r" : "lg:w-64 lg:border-0"}
            ${open ? "translate-x-0" : "-translate-x-full max-lg:invisible"}`}
        >
          <Sidebar role={role} isLevelAdviser={isLevelAdviser} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>
        <main className="flex-1 min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
