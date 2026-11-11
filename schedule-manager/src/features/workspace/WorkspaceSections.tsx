"use client";
import { Icon, type IconName } from "./Design";
import { WorkspaceButton } from "./WorkspaceNavigation";
import type { WorkspaceSelection } from "./navigation";

export function WorkspaceSections({ active, onSelect }: { active: WorkspaceSelection["section"]; onSelect?: () => void }) {
  const items: { section: WorkspaceSelection["section"]; label: string; icon: IconName }[] = [{ section: "today", label: "Today", icon: "today" }, { section: "schedule", label: "Schedule Manager", icon: "calendar" }, { section: "tasks", label: "To-do List", icon: "task" }, { section: "habits", label: "Habit Tracker", icon: "habit" }];
  return <nav aria-label="Workspace navigation">{items.map(item => <WorkspaceButton key={item.section} className={"nav-item " + (active === item.section ? "selected" : "")} title={item.label} aria-label={item.label} selected={active === item.section} section={item.section} onClick={onSelect}><Icon name={item.icon}/><span>{item.label}</span></WorkspaceButton>)}</nav>;
}
