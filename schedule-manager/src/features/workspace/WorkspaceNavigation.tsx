"use client";
import { createContext, useContext, type ComponentPropsWithoutRef } from "react";
import type { WorkspaceSelection } from "./navigation";

export const WorkspaceNavigation = createContext<((selection: WorkspaceSelection) => void) | null>(null);
export function useWorkspaceNavigation() {
  const selectSection = useContext(WorkspaceNavigation);
  if (!selectSection) throw new Error("Workspace selection requires the workspace provider.");
  return selectSection;
}

export function WorkspaceButton({ section, taskId, habitId, occurrenceDate, editHabit, selected, onClick, ...props }: Omit<ComponentPropsWithoutRef<"button">, "type"> & WorkspaceSelection & { selected?: boolean }) {
  const selectSection = useWorkspaceNavigation();
  return <button {...props} type="button" aria-pressed={selected} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented) selectSection({ section, taskId, ...(habitId ? { habitId } : {}), ...(occurrenceDate ? { occurrenceDate } : {}), ...(editHabit ? { editHabit } : {}) });
  }} />;
}
