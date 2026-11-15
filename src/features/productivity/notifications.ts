import { productivityErrorMessage } from "./errors";

export type SaveNotification = { id: number; state: "pending" | "success" | "error"; message: string };
type Clock = { now: () => number; set: (callback: () => void, delay: number) => unknown; clear: (timer: unknown) => void };
const clock: Clock = { now: () => Date.now(), set: (callback, delay) => setTimeout(callback, delay), clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) };

// One lifecycle per confirmed RPC save, shared by every Productivity section.
// Timers live outside React so rerenders, portals and section changes cannot restart them.
export class SaveNotifications {
  private rows: SaveNotification[] = [];
  private listeners = new Set<() => void>();
  private sequence = 0;
  private timers = new Map<number, { remaining: number; started: number; timer?: unknown; pauses: Set<string> }>();
  private pending = new Map<string, Promise<unknown>>();
  private failed = new Map<string, number>();
  constructor(private time: Clock = clock) {}
  snapshot = () => this.rows;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  private replace(id: number, state: SaveNotification["state"], message: string) {
    if (!this.rows.some(row => row.id === id)) return;
    this.rows = this.rows.map(row => row.id === id ? { id, state, message } : row);
    if (state === "success") {
      const timer = this.timers.get(id)!;
      timer.remaining = 5000;
      this.resume(id);
    }
    this.emit();
  }
  dismiss = (id: number) => {
    const timer = this.timers.get(id);
    if (timer?.timer !== undefined) this.time.clear(timer.timer);
    this.timers.delete(id);
    for (const [key, value] of this.failed) if (value === id) this.failed.delete(key);
    this.rows = this.rows.filter(row => row.id !== id);
    this.emit();
  };
  clear() {
    for (const id of this.timers.keys()) { const timer = this.timers.get(id)!; if (timer.timer !== undefined) this.time.clear(timer.timer); }
    this.timers.clear(); this.pending.clear(); this.failed.clear(); this.rows = []; this.emit();
  }
  pause(id: number, reason: string) {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.pauses.add(reason);
    if (timer.timer !== undefined) {
      this.time.clear(timer.timer); timer.timer = undefined;
      timer.remaining = Math.max(0, timer.remaining - (this.time.now() - timer.started));
    }
  }
  resume(id: number, reason?: string) {
    const timer = this.timers.get(id);
    if (!timer) return;
    if (reason) timer.pauses.delete(reason);
    if (timer.pauses.size || timer.timer !== undefined || !this.rows.some(row => row.id === id && row.state === "success")) return;
    timer.started = this.time.now();
    timer.timer = this.time.set(() => this.dismiss(id), timer.remaining);
  }
  run<T>(key: string, operation: () => Promise<T>, success: string): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const id = this.failed.get(key) ?? ++this.sequence;
    this.failed.delete(key);
    const row: SaveNotification = { id, state: "pending", message: "Saving…" };
    this.rows = this.rows.some(item => item.id === id) ? this.rows.map(item => item.id === id ? row : item) : [...this.rows, row];
    if (!this.timers.has(id)) this.timers.set(id, { remaining: 5000, started: 0, pauses: new Set() });
    this.emit();
    const promise = (async () => {
      try { const result = await operation(); this.replace(id, "success", success); return result; }
      catch (error) {
        if (this.rows.some(row => row.id === id)) this.failed.set(key, id);
        this.replace(id, "error", productivityErrorMessage(error, "The save could not be confirmed. Retry the same action using its original controls; do not create a second copy."));
        throw error;
      }
    })().finally(() => { if (this.pending.get(key) === promise) this.pending.delete(key); });
    this.pending.set(key, promise);
    return promise;
  }
}
export const saveNotifications = new SaveNotifications();
export function saveSuccessMessage(operation: string) {
  const messages: Record<string, string> = {
    "schedule.category": "Sub-schedule saved.", "schedule.save": "Event saved.", "schedule.archive": "Event archive status saved.", "schedule.backup": "Backup time saved.", "schedule.miss": "Missed event outcome saved.",
    "tasks.create": "Task created.", "tasks.update": "Task saved.", "tasks.complete": "Task completed.", "tasks.miss": "Missed task outcome saved.", "tasks.delete": "Task deleted.",
    "habits.save": "Habit settings saved.", "habits.record": "Habit outcome saved.", "habits.archive": "Habit archive status saved.", "habits.replan": "Habit event replanned.",
    "preferences.save": "Settings saved.", import: "Records imported. Previously imported records were skipped; your local originals remain intact.",
  };
  return messages[operation] || "Changes saved.";
}
