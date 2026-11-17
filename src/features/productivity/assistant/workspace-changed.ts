type Execution = { id: string; status: string; result: Record<string, unknown> | null };
/** Read-only conversations and unchanged polls must not reload the whole workspace. */
export function workspaceChanged(previous: Execution[], next: Execution[]) {
  const saved = new Set(previous.filter(row => row.status === "completed" && row.result?.saved === true).map(row => row.id));
  return next.some(row => row.status === "completed" && row.result?.saved === true && !saved.has(row.id));
}
