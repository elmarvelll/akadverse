// src/app/e-learning/_components/Shell.tsx
//
// Responsive frame: below `lg` the sidebar is an off-canvas drawer opened from
// a header menu button (phones + tablets); from `lg` up it is a fixed column.
// Client component only because it owns the drawer's open state; role/name are
// still resolved server-side in layout.tsx.

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import type { ElearningRole } from "@/services/e-learning/shared/auth";

export default function Shell({
  role,
  name,
  isLevelAdviser,
  children,
}: {
  role: ElearningRole;
  name: string;
  isLevelAdviser: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
      <Header role={role} name={name} menuOpen={open} onMenuToggle={() => setOpen((v) => !v)} />

      {open && <div className="fixed inset-0 top-16 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="pt-16 max-w-[1600px] mx-auto lg:flex">
        <aside
          id="elearning-nav"
          className={`fixed top-16 bottom-0 left-0 z-30 w-72 max-w-[85vw] overflow-y-auto bg-white border-r border-gray-100 transition-transform duration-200
            lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:border-0 lg:bg-transparent lg:overflow-visible
            ${open ? "translate-x-0" : "-translate-x-full max-lg:invisible"}`}
        >
          <Sidebar role={role} isLevelAdviser={isLevelAdviser} />
        </aside>
        <main className="flex-1 min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
