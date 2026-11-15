export const SCHEDULE_HREF = "/studashboard/productivity-layer#schedule";
export const TASKS_HREF = "/studashboard/productivity-layer#tasks";
export const taskHref = (id: string) => `${TASKS_HREF}?task=${encodeURIComponent(id)}`;
export interface WorkspaceSelection { section: "today" | "schedule" | "tasks" | "habits"; taskId?: string; habitId?: string; occurrenceDate?: string; editHabit?: boolean; eventId?: string; scheduleDate?: string }

// Fragments identify an initial section/item inside the host route. Sidebar
// switching continues to use selection state without rewriting the URL.
export function workspaceLocation(hash: string): WorkspaceSelection {
  const [name, query] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  if (name === "tasks") return { section: "tasks", taskId: params.get("task") || undefined };
  if (name === "schedule") return { section: "schedule", eventId: params.get("event") || undefined, scheduleDate: params.get("date") || undefined };
  if (name === "habits") return { section: "habits", habitId: params.get("habit") || undefined, occurrenceDate: params.get("date") || undefined, editHabit: params.get("edit") === "true" || params.get("edit") === "1" };
  return { section: "today" };
}
