// src/app/e-learning/_components/Sidebar.tsx
//
// Renders one of the role-specific nav trees from nav-config.ts, with
// Study-Zone/Course-Control-style sections expandable (AGENTS.md §10/§41).
//
// Client component because of the expand/collapse state, the active-route
// highlight (usePathname), AND because nav-config.ts's trees carry
// lucide-react icon *components* — those can't cross the server->client
// prop boundary (see layout.tsx's header comment), so this component
// builds its own nav tree from the plain `role`/`isLevelAdviser` values
// layout.tsx passes down, rather than receiving a built tree as a prop.
// `role` itself was already resolved server-side from the session
// (services/e-learning/shared/auth.ts) — nothing here re-derives it from
// anything client-controllable.
//
// From `lg` the whole sidebar can collapse to an icon rail (state owned by
// Shell.tsx). In the rail a direct link stays a link; a group's icon re-expands
// the sidebar with that group open. Below `lg` (the mobile drawer) the full
// tree is always shown, whatever the desktop choice is.

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ElearningRole } from "@/services/e-learning/shared/auth";
import type { NavLeaf } from "./nav-config";
import { getStudentNav, getFacultyNav, getHodNav, getDapuNav, getDeanNav, getVcNav } from "./nav-config";

const leafHrefs = (leaf: NavLeaf): string[] => (leaf.href ? [leaf.href] : (leaf.children ?? []).flatMap(leafHrefs));

const toggleClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200 transition focus-visible:outline-2 focus-visible:outline-blue-600";

export default function Sidebar({
  role,
  isLevelAdviser,
  collapsed = false,
  onToggleCollapsed,
}: {
  role: ElearningRole;
  isLevelAdviser: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();

  const sections =
    role === "student"
      ? getStudentNav()
      : role === "faculty"
        ? getFacultyNav(isLevelAdviser)
        : role === "hod"
          ? getHodNav()
          : role === "dapu"
            ? getDapuNav()
            : role === "dean"
              ? getDeanNav()
              : getVcNav();

  // A section starts expanded if the current route is already inside it —
  // otherwise collapsed, so the sidebar doesn't default to showing every
  // group open at once.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const collect = (label: string, leaves: NavLeaf[]) => {
      for (const leaf of leaves) {
        if (leaf.children && leaf.children.flatMap(leafHrefs).some((h) => pathname.startsWith(h))) {
          initial[`${label}/${leaf.label}`] = true;
          initial[label] = true;
          collect(`${label}/${leaf.label}`, leaf.children);
        } else if (leaf.href && pathname.startsWith(leaf.href)) {
          initial[label] = true;
        }
      }
    };
    for (const section of sections) collect(section.label, section.children ?? []);
    return initial;
  });

  const toggleSection = (label: string) => {
    setOpenSections((current) => ({ ...current, [label]: !current[label] }));
  };

  if (sections.length === 0) {
    return null;
  }

  const renderLeaf = (parent: string, leaf: NavLeaf) => {
    const LeafIcon = leaf.icon;
    if (leaf.children) {
      const key = `${parent}/${leaf.label}`;
      const open = !!openSections[key];
      return (
        <div key={key}>
          <button type="button" onClick={() => toggleSection(key)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition">
            <span className="flex items-center gap-2 whitespace-nowrap">{LeafIcon && <LeafIcon size={14} />}{leaf.label}</span>
            <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <div className="mt-1 ml-3 pl-3 border-l border-gray-100 space-y-1">{leaf.children.map((c) => renderLeaf(key, c))}</div>}
        </div>
      );
    }
    const active = pathname === leaf.href || (!!leaf.href && pathname.startsWith(`${leaf.href}/`));
    return (
      <Link key={leaf.href} href={leaf.href!} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
        {LeafIcon && <LeafIcon size={14} />}
        {leaf.label}
      </Link>
    );
  };

  const sectionActive = (section: (typeof sections)[number]) =>
    section.href
      ? pathname === section.href || (!!section.activeOnSubpaths && pathname.startsWith(`${section.href}/`))
      : (section.children ?? []).flatMap(leafHrefs).some((h) => pathname === h || pathname.startsWith(`${h}/`));

  const rail = collapsed && (
    <nav aria-label="E-Learning" className="hidden lg:flex flex-col items-center gap-1 py-3">
      <button type="button" onClick={onToggleCollapsed} aria-label="Expand sidebar" title="Expand sidebar" aria-expanded={false} className={`${toggleClass} mb-2`}>
        <PanelLeftOpen size={18} aria-hidden />
      </button>
      {sections.map((section) => {
        const Icon = section.icon;
        const cls = `flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-blue-600 ${
          sectionActive(section) ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`;
        return section.href ? (
          <Link key={section.label} href={section.href} aria-label={section.label} title={section.label} className={cls}>
            <Icon size={18} aria-hidden />
          </Link>
        ) : (
          <button
            key={section.label}
            type="button"
            aria-label={`${section.label} (expands the sidebar)`}
            title={section.label}
            onClick={() => {
              setOpenSections((current) => ({ ...current, [section.label]: true }));
              onToggleCollapsed?.();
            }}
            className={cls}
          >
            <Icon size={18} aria-hidden />
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {rail}
      <nav aria-label="E-Learning" className={`w-full space-y-1 p-3 lg:p-4 ${collapsed ? "lg:hidden" : ""}`}>
        {onToggleCollapsed && (
          <div className="hidden lg:flex justify-end -mt-1 mb-1">
            <button type="button" onClick={onToggleCollapsed} aria-label="Collapse sidebar" title="Collapse sidebar" aria-expanded className={toggleClass}>
              <PanelLeftClose size={18} aria-hidden />
            </button>
          </div>
        )}
        {sections.map((section) => {
          const Icon = section.icon;

          // Direct link (e.g. "Dashboard") — no expand/collapse.
          if (section.href) {
            const active = sectionActive(section);
            return (
              <Link
                key={section.label}
                href={section.href}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                {section.label}
              </Link>
            );
          }

          // A group with no pages yet is a plain label, not an expander that opens onto nothing.
          if (!section.children || section.children.length === 0) {
            return (
              <div key={section.label} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap text-gray-500">
                <Icon size={16} />
                {section.label}
              </div>
            );
          }

          // Expandable group (e.g. "Academic Essentials").
          const isOpen = !!openSections[section.label];
          const children = section.children ?? [];
          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <Icon size={16} />
                  {section.label}
                </span>
                <ChevronDown size={15} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="mt-1 ml-3.5 pl-3.5 border-l border-gray-100 space-y-1">{children.map((leaf) => renderLeaf(section.label, leaf))}</div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}
