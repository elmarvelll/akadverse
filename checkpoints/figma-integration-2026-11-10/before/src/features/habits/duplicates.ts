import type { Task } from "../tasks/domain.ts";
import type { PersonalEvent } from "../schedule/domain.ts";

// Diagnose aliases of the same original occurrence without deleting or merging
// their records. Different recorded outcomes require explicit recovery.
export function habitDuplicateConflicts(tasks: readonly Task[], events: readonly PersonalEvent[] = []) {
  const groups = new Map<string, Set<string>>();
  function add(key: string, signature: string) {
    const values = groups.get(key) || new Set<string>(); values.add(signature); groups.set(key, values);
  }
  for (const task of tasks) if (task.source.kind === "habit" && !task.habitWithdrawn && !task.deletedAt) add(JSON.stringify([task.ownerId, task.source.habitId, task.source.scheduledDate]), JSON.stringify([task.status, task.completedAt, task.missedAt]));
  for (const event of events) if (event.source.kind === "habit" && !event.archivedAt) add(JSON.stringify([event.ownerId, event.source.habitId, event.originalSlot.date]), JSON.stringify([event.status, event.completedAt, event.history.filter(entry => entry.kind === "missed").map(entry => entry.at)]));
  return [...groups].filter(([, signatures]) => signatures.size > 1).map(([key]) => key);
}
