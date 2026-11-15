/** An intentional, safe-to-display message. Never wrap raw database errors in this type. */
export class ProductivityError extends Error {
  constructor(message: string, public readonly code = "INVALID_INPUT", public readonly referenceId?: string) {
    super(message);
    this.name = "ProductivityError";
  }
}

export function productivityErrorMessage(error: unknown, fallback = "An unexpected workspace error occurred. Reload the workspace and try again.") {
  if (!(error instanceof ProductivityError)) return fallback;
  return error.message + (error.referenceId ? ` Reference: ${error.referenceId}.` : "");
}

const actions: Record<string, string> = {
  context: "load your workspace account", "workspace.initial": "prepare your workspace", "workspace.view": "load this section", "official.range": "load your official timetable", "tasks.list": "load your tasks", "tasks.get": "load this task", "tasks.history": "load task history",
  "tasks.create": "create this task", "tasks.update": "save this task", "tasks.delete": "delete this task", "tasks.complete": "complete this task", "tasks.miss": "mark this task missed",
  "habits.list": "load your habits", "habits.save": "save this habit", "habits.archive": "update this habit's archive status",
  "habits.synchronize": "load and generate scheduled habit occurrences", "habits.record": "save this habit outcome", "habits.replan": "replan this habit event",
  "schedule.load": "load your schedule", "schedule.history": "load event history", "schedule.save": "save this event", "schedule.category": "save this schedule category",
  "schedule.archive": "update this event's archive status", "schedule.backup": "save this event's backup time", "schedule.miss": "mark this event missed",
  "official.classes": "load your official timetable", "analytics.tasks": "load task analytics", "analytics.schedule": "load schedule analytics",
  "preferences.save": "save your timezone", import: "import your records",
};
export function productivityAction(operation: string) { return Object.hasOwn(actions, operation) ? actions[operation] : "complete this workspace request"; }
