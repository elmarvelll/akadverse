import { localNow } from "../schedule/domain";
import { taskViewStatus, type Task, type TaskViewStatus } from "./domain";
import { taskHref } from "../workspace/navigation";
export { taskHref } from "../workspace/navigation";
export interface TaskFilters { createdDate?: string; dueDate?: string; priority?: string }
export type TaskSort = "newest" | "oldest" | "due-earliest" | "due-latest" | "priority-high" | "priority-low";
const rank = { low: 0, medium: 1, high: 2 };
export function queryTasks(tasks: readonly Task[], options: { status?: TaskViewStatus; filters?: TaskFilters; sort?: TaskSort; timezone: string; instant?: Date }) {
  const { filters = {}, sort = "newest", timezone, instant = new Date() } = options;
  const selected = tasks.filter(task => !task.deletedAt && !task.habitWithdrawn && taskViewStatus(task, timezone, instant) === (options.status || "active") && (!filters.createdDate || localNow(timezone, new Date(task.createdAt)).date === filters.createdDate) && (!filters.dueDate || task.dueDate === filters.dueDate) && (!filters.priority || task.priority === filters.priority));
  const tie = (a: Task, b: Task) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  return selected.sort((a, b) => {
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    if (sort === "oldest") return tie(a, b);
    if (sort === "priority-high") return rank[b.priority] - rank[a.priority] || tie(a, b);
    if (sort === "priority-low") return rank[a.priority] - rank[b.priority] || tie(a, b);
    if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : tie(a, b);
    const byDate = a.dueDate.localeCompare(b.dueDate);
    // A date-only deadline is never assigned a fabricated time; it sorts after
    // timed deadlines on the same day for ascending order.
    const byTime = a.dueTime && b.dueTime ? a.dueTime.localeCompare(b.dueTime) : a.dueTime ? -1 : b.dueTime ? 1 : 0;
    return (sort === "due-latest" ? -1 : 1) * (byDate || byTime) || tie(a, b);
  });
}
export function taskDaySummary(tasks: readonly Task[], date: string, timezone = "Africa/Lagos", instant = new Date()) {
  const due = tasks.filter(task => !task.deletedAt && !task.habitWithdrawn && task.dueDate === date);
  return { scheduled: due.length, ...taskStatusCounts(due, timezone, instant), unfinished: due.filter(task => task.status === "pending").length, items: due.map(task => ({ id: task.id, title: task.title, status: taskViewStatus(task, timezone, instant), href: taskHref(task.id) })) };
}
export function taskStatusCounts(tasks: readonly Task[], timezone: string, instant = new Date()): Record<TaskViewStatus, number> {
  const counts = { active: 0, pending: 0, completed: 0, missed: 0 };
  for (const task of tasks) if (!task.deletedAt && !task.habitWithdrawn) counts[taskViewStatus(task, timezone, instant)]++;
  return counts;
}
