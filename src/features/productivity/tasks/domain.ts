import { ProductivityError } from "../errors";
import { validDate, localNow, type Priority } from "../schedule/domain";

export type TaskSource =
  | { kind: "ordinary" }
  | { kind: "habit"; habitId: string; occurrenceId: string; habitName: string; scheduledDate: string; habitHref?: string };
export type TaskStatus = "pending" | "completed" | "missed";
// Stored pending means unfinished. Active/Pending are clock-derived views, not
// new persisted outcomes, so existing records need no rewrite or migration.
export type TaskViewStatus = "active" | TaskStatus;
export interface TaskInput {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
}
export interface TaskAudit {
  id: string;
  kind: "created" | "edited" | "completed" | "deleted" | "missed";
  at: string;
  snapshot: TaskInput;
}
// A habit task IS its occurrence. There is no second completion flag to sync.
export interface Task extends TaskInput {
  id: string;
  ownerId: string;
  source: TaskSource;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  missedAt?: string;
  deletedAt?: string;
  habitWithdrawn?: boolean;
  outcomeChanges?: import("../habits/outcomes").OutcomeChange[];
  habitSettings?: import("../habits/domain").HabitRevision;
  history: TaskAudit[];
}
export interface TaskDataset { version: 2; tasks: Task[] }
export interface TaskRepository {
  load(): Promise<TaskDataset>;
  save(data: TaskDataset): Promise<void>;
}
export const emptyTasks = (): TaskDataset => ({ version: 2, tasks: [] });
export const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export function validateTaskInput(input: TaskInput) {
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) throw new ProductivityError("Enter a title between 1 and 200 characters.");
  if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 10000)) throw new ProductivityError("Description must be at most 10,000 characters.");
  if (!["low", "medium", "high"].includes(input.priority)) throw new ProductivityError("Task priority must be Low, Medium, or High.");
  if (input.dueDate !== undefined && !validDate(input.dueDate)) throw new ProductivityError("Choose a valid intended completion date.");
  if (input.dueTime !== undefined && !input.dueDate) throw new ProductivityError("Choose an intended completion date before setting a completion time.");
  if (input.dueTime !== undefined && !validTime(input.dueTime)) throw new ProductivityError("The intended completion time must be a valid time between 00:00 and 23:59.");
}
export function taskSnapshot(task: TaskInput): TaskInput {
  return { title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate, dueTime: task.dueTime };
}
export function taskViewStatus(task: Task, timezone: string, instant = new Date()): TaskViewStatus {
  if (task.status !== "pending") return task.status;
  if (!task.dueDate) return "active";
  const now = localNow(timezone, instant);
  const arrived = task.dueTime ? task.dueDate + task.dueTime <= now.date + now.time : task.dueDate < now.date;
  return arrived ? "pending" : "active";
}
// Stored habit projections are plans, not an open workload until their local date.
// Recorded outcomes remain eligible for history regardless of their scheduled date.
export function isTaskListEligible(task: Task, timezone: string, instant = new Date()): boolean {
  return !task.deletedAt && !task.habitWithdrawn && (task.source.kind !== "habit" || task.status !== "pending" || task.source.scheduledDate === localNow(timezone, instant).date);
}
export function millisecondsToNextMinute(instant: Date) {
  return 60000 - instant.getTime() % 60000 + 1;
}
export function isTaskOverdue(task: Task, timezone: string, instant = new Date()) {
  if (task.status !== "pending" || task.deletedAt || !task.dueDate) return false;
  const now = localNow(timezone, instant);
  return task.dueTime ? task.dueDate + task.dueTime < now.date + now.time : task.dueDate < now.date;
}
