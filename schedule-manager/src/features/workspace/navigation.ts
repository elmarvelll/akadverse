export const SCHEDULE_HREF = "/#schedule";
export const TASKS_HREF = "/#tasks";
export const taskHref = (id: string) => `${TASKS_HREF}?task=${encodeURIComponent(id)}`;
export interface WorkspaceSelection { section: "today" | "schedule" | "tasks" | "habits"; taskId?: string; habitId?: string; occurrenceDate?: string; editHabit?: boolean; eventId?: string; scheduleDate?: string }

// Fragments identify an in-page section/item; the pathname always stays '/'.
export function workspaceLocation(hash: string): WorkspaceSelection {
  if (hash === "#today") return { section: "today" };
  if (hash === "#tasks") return { section: "tasks" };
  if (hash.startsWith("#tasks?")) {
    return { section: "tasks", taskId: new URLSearchParams(hash.slice(7)).get("task") || undefined };
  }
  return { section: "schedule" };
}
