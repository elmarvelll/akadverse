import type { Student, Dataset } from "../schedule/domain";
import type { Task, TaskViewStatus } from "../tasks/domain";
import type { TaskSort } from "../tasks/queries";
import type { Habit, Occurrence } from "../habits/domain";
import type { WorkspaceSelection } from "./navigation";

export interface ViewOptions {
  section: WorkspaceSelection["section"];
  start?: string; end?: string; status?: TaskViewStatus; sort?: TaskSort;
  period?: "all" | "today" | "week" | "month";
  page?: number; history?: boolean; categoryId?: string; taskId?: string; eventId?: string;
}
export interface WorkspaceSnapshot {
  student: Student; email: string; serverTime: string;
  data: { tasks: { version: 2; tasks: Task[] }; habits: { version: 1; habits: Habit[] }; schedule: Dataset };
  occurrences: Occurrence[];
  counts?: Record<TaskViewStatus, number>;
  hasMore: boolean;
  todayCounts?: { completedTasks: number; openTasks: number };
}
export type TaskPages = Record<TaskViewStatus, { ids: string[]; hasMore: boolean }>;
export interface WorkspaceInitial {
  snapshot: WorkspaceSnapshot;
  taskPages?: TaskPages;
  taskError?: string;
  range: { start: string; end: string };
}
