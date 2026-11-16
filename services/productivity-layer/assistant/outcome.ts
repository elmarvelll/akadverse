type ExecutionOutcome = { toolName: string; status: string; result: unknown };
const actions: Record<string, string> = {
  create_task: "Created task", update_task: "Updated task", complete_task: "Completed task",
  miss_task: "Marked task missed", delete_task: "Deleted task", save_habit: "Saved habit",
  record_habit: "Recorded habit outcome", archive_habit: "Updated habit archive status",
  replan_habit: "Rescheduled habit", save_event: "Saved event", save_category: "Saved category",
  archive_event: "Updated event archive status", set_backup: "Saved backup slot",
  miss_event: "Recorded missed event", set_timezone: "Updated timezone",
};

/** Summarize durable backend facts only; never infer success from model text or arguments. */
export function interruptedOutcome(executions: ExecutionOutcome[]): string | undefined {
  const confirmed = executions.filter(row => row.status === "completed" && Object.hasOwn(actions, row.toolName));
  if (!confirmed.length) return;
  const lines = confirmed.map(row => {
    const result = row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : {};
    const item = result.task || result.event || result.category;
    const title = item && typeof item === "object" && "title" in item ? item.title
      : item && typeof item === "object" && "name" in item ? item.name : undefined;
    const label = typeof title === "string" ? `: ${JSON.stringify(title.replace(/[\r\n\t]/g, " ").slice(0, 160))}` : "";
    return `- ${actions[row.toolName]}${label}.`;
  });
  let message = `Confirmed changes:\n${lines.join("\n")}\n\nThe assistant could not finish its reply. These changes are saved; other requested steps may be incomplete.`;
  if (executions.some(row => row.status === "pending" || row.status === "unknown")) message += " An operation is unconfirmed. Use Recheck outcome before repeating it.";
  if (executions.some(row => row.status === "awaiting_confirmation")) message += " A proposed action still needs confirmation; it has not been saved.";
  return message;
}
