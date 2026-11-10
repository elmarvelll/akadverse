"use client";
import { WorkspaceButton } from "./WorkspaceNavigation";
import type { WorkspaceSelection } from "./navigation";

export function WorkspaceSections({ active }: { active: WorkspaceSelection["section"] }) {
  return <nav aria-label="Workspace navigation">
    <WorkspaceButton className={"nav-item " + (active === "schedule" ? "selected" : "")} selected={active === "schedule"} section="schedule">▦ Schedule Manager</WorkspaceButton>
    <WorkspaceButton className={"nav-item " + (active === "tasks" ? "selected" : "")} selected={active === "tasks"} section="tasks">☑ To-do List</WorkspaceButton>
    <WorkspaceButton className={"nav-item " + (active === "habits" ? "selected" : "")} selected={active === "habits"} section="habits">Habit Tracker</WorkspaceButton>
  </nav>;
}
