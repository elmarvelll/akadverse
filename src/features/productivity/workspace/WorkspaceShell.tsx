"use client";
import { useEffect, useState, type ReactNode } from "react";
import { peekStudent } from "../client";
import { type Student } from "../schedule/domain";
import { WorkspaceSections } from "./WorkspaceSections";
import { Icon } from "./Design";
import type { WorkspaceSelection } from "./navigation";
import Link from "next/link";
import { AccountTools } from "../AccountTools";
import { SaveNotificationRegion } from "../SaveNotifications";


// Shell proportions and selected treatment adapted from ProductivityPortal.
export function WorkspaceShell({ active, children }: { active: WorkspaceSelection["section"]; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false), [open, setOpen] = useState(false);
  const [student, setStudent] = useState<Student | undefined>(() => peekStudent());
  useEffect(() => {
    let active = true;
    const refresh = () => { const current = peekStudent(); if (active && current) { setStudent(current); } };
    refresh();
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const resized = () => { if (window.innerWidth > 760) setOpen(false); };
    window.addEventListener("productivity:context-ready", refresh); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible); window.addEventListener("keydown", escape); window.addEventListener("resize", resized);
    return () => { active = false; window.removeEventListener("productivity:context-ready", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); window.removeEventListener("keydown", escape); window.removeEventListener("resize", resized); };
  }, []);
  const initials = student?.name.split(" ").slice(0, 2).map(word => word[0]).join("") || "P";
  return <div className={`productivity-workspace ${collapsed ? "sidebar-collapsed" : ""} ${open ? "navigation-open" : ""}`}>
    <button type="button" className="skip-navigation" onClick={() => document.getElementById("workspace-content")?.focus()}>Skip to content</button>
    <header className="prod-topbar"><div className="portal-identity"><button type="button" className="mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="workspace-sidebar" onClick={() => setOpen(value => !value)}><Icon name="menu"/></button><span className="portal-avatar">{initials}</span><div><strong>{student?.name || "Your workspace"}</strong><span className="portal-tag">Productivity Layer</span><small>Your time. Your priorities.</small></div></div><div className="portal-top-right"><AccountTools /></div></header>
    {open && <button className="navigation-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside className="prod-sidebar" id="workspace-sidebar"><div><div className="sidebar-caption"><span>WORKSPACE</span><button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}><Icon name="arrow"/></button></div><WorkspaceSections active={active} onSelect={() => setOpen(false)} /></div><div className="prod-sidebar-bottom"><div className="prod-sidebar-footer"><span className="sidebar-wordmark"><Icon name="habit"/> Productivity</span><p>Make room for what matters.</p><small>Saved to your AkadVerse account</small></div><Link href="/studashboard" className="back-to-akadverse" aria-label="Back to Akadverse dashboard" title="Back to Akadverse"><span className="back-to-akadverse-icon" aria-hidden="true">←</span><span className="back-to-akadverse-label">Back to Akadverse</span></Link></div></aside>
    <div className="prod-main" id="workspace-content" tabIndex={-1} inert={open}><SaveNotificationRegion />{children}</div>
  </div>;
}
