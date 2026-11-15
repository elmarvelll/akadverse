import { id, validDate, localNow, type IdentityProvider } from "../schedule/domain.ts";
import { validateTaskInput, taskSnapshot, taskViewStatus, type Task, type TaskInput, type TaskAudit, type TaskRepository } from "./domain.ts";

function normalize(input: TaskInput): TaskInput {
  validateTaskInput(input);
  return { ...taskSnapshot(input), title: input.title.trim(), description: input.description?.trim() || undefined };
}
function audit(task: Task, kind: TaskAudit["kind"], at: string) {
  task.history.push({ id: id(), kind, at, snapshot: taskSnapshot(task) });
  task.updatedAt = at;
}

export class TaskService {
  private mutations: Promise<unknown> = Promise.resolve();
  private outcomes = new Map<string, { kind: "completed" | "missed"; promise: Promise<Task> }>();
  constructor(private repository: TaskRepository, private identity: IdentityProvider, private clock: () => Date = () => new Date()) {}
  getCurrentStudent() { return this.identity.getCurrentStudent(); }
  private serialize<T>(operation: () => Promise<T>) {
    const result = this.mutations.then(operation);
    this.mutations = result.catch(() => undefined);
    return result;
  }
  async listTasks() {
    const student = await this.getCurrentStudent();
    return (await this.repository.load()).tasks.filter(task => task.ownerId === student.id);
  }
  async getTask(taskId: string) {
    const task = (await this.listTasks()).find(task => task.id === taskId);
    if (!task) throw new Error("Task not found for this student.");
    return task;
  }
  async getHistory() { return (await this.listTasks()).filter(task => task.status !== "pending" && !task.deletedAt); }
  private async context(taskId?: string) {
    const student = await this.getCurrentStudent(), data = await this.repository.load();
    const task = taskId !== undefined ? data.tasks.find(task => task.id === taskId && task.ownerId === student.id) : undefined;
    if (taskId !== undefined && !task) throw new Error("Task not found for this student.");
    return { student, data, task };
  }
  createTask(input: TaskInput) {
    return this.serialize(async () => {
      const fields = normalize(input), { student, data } = await this.context(), now = this.clock().toISOString();
      const task: Task = { ...fields, id: id(), ownerId: student.id, source: { kind: "ordinary" }, status: "pending", createdAt: now, updatedAt: now, history: [] };
      audit(task, "created", now);
      data.tasks.push(task);
      await this.repository.save(data);
      return task;
    });
  }
  updateTask(taskId: string, input: TaskInput) {
    return this.serialize(async () => {
      const fields = normalize(input), { data, task } = await this.context(taskId);
      if (task!.source.kind !== "ordinary") throw new Error("Habit task fields are read-only here. Manage the habit in its tracker.");
      if (task!.deletedAt || task!.status !== "pending") throw new Error("Only unfinished ordinary tasks can be edited.");
      // Preserve the pre-edit fields as an audit snapshot.
      audit(task!, "edited", this.clock().toISOString());
      Object.assign(task!, fields);
      await this.repository.save(data);
      return task!;
    });
  }
  deleteTask(taskId: string) {
    return this.serialize(async () => {
      const { data, task } = await this.context(taskId);
      if (task!.source.kind !== "ordinary") throw new Error("Habit occurrences cannot be deleted from the To-do List.");
      if (task!.deletedAt) return task!;
      task!.deletedAt = this.clock().toISOString();
      audit(task!, "deleted", task!.deletedAt);
      await this.repository.save(data);
      return task!;
    });
  }
  completeTask(taskId: string) {
    return this.recordOutcome(taskId, "completed");
  }
  markTaskMissed(taskId: string) {
    return this.recordOutcome(taskId, "missed");
  }
  // Intentional tracker corrections preserve original audits and append a
  // checked before/after chain on the same authoritative task record.
  correctHabitOutcome(taskId: string, status: "pending" | "completed" | "missed") {
    return this.serialize(async () => {
      const { data, task, student } = await this.context(taskId);
      if (task!.source.kind !== "habit" || task!.deletedAt || task!.habitWithdrawn) throw new Error("Only eligible habit occurrences can be corrected here.");
      const now = this.clock(), local = localNow(student.timezone, now), date = task!.source.scheduledDate;
      if (date > local.date || status === "missed" && date === local.date && taskViewStatus({ ...task!, status: "pending" }, student.timezone, now) !== "pending") throw new Error("This outcome is not available at the current scheduled time.");
      if (task!.status === status) return task!;
      const from = { status: task!.status, completedAt: task!.completedAt, missedAt: task!.missedAt };
      const at = now.toISOString(), to = { status, completedAt: status === "completed" ? at : undefined, missedAt: status === "missed" ? at : undefined };
      (task!.outcomeChanges ||= []).push({ id: id(), at, from, to });
      Object.assign(task!, to, { updatedAt: at });
      await this.repository.save(data); return task!;
    });
  }
  private recordOutcome(taskId: string, kind: "completed" | "missed", habitOnly = false): Promise<Task> {
    const inFlight = this.outcomes.get(taskId);
    if (inFlight) return inFlight.kind === kind ? inFlight.promise : Promise.reject(new Error("An outcome update is already saving. Wait before recording another outcome."));
    const promise = this.serialize(async () => {
      const { data, task, student } = await this.context(taskId);
      if (habitOnly && task!.source.kind !== "habit") throw new Error("Only the Habit Tracker can supply missed habit outcomes through this operation.");
      if (task!.deletedAt || task!.habitWithdrawn) throw new Error("Deleted or withdrawn tasks cannot receive outcomes.");
      if (task!.status === kind) return task!;
      // Existing intentional behavior: a missed habit can be completed late.
      // Ordinary task outcomes are final, and completion is never changed to miss.
      if (task!.status !== "pending" && !(kind === "completed" && task!.status === "missed" && task!.source.kind === "habit")) throw new Error("This task already has a recorded outcome and cannot be changed.");
      const instant = this.clock();
      if (task!.source.kind === "habit" && task!.source.scheduledDate > localNow(student.timezone, instant).date) throw new Error("Future habit occurrences cannot receive outcomes.");

      if (kind === "missed" && taskViewStatus(task!, student.timezone, instant) !== "pending") throw new Error("Only tasks whose deadline has arrived can be marked missed. This task is Active.");
      const now = instant.toISOString();
      task!.status = kind;
      if (kind === "completed") task!.completedAt = now;
      else task!.missedAt = now;
      if (task!.outcomeChanges?.length) {
        const from = { status: task!.outcomeChanges.at(-1)!.to.status, completedAt: task!.outcomeChanges.at(-1)!.to.completedAt, missedAt: task!.outcomeChanges.at(-1)!.to.missedAt };
        const to = { status: kind, completedAt: kind === "completed" ? now : undefined, missedAt: kind === "missed" ? now : undefined };
        task!.completedAt = to.completedAt; task!.missedAt = to.missedAt; task!.updatedAt = now;
        task!.outcomeChanges.push({ id: id(), at: now, from, to });
      } else audit(task!, kind, now);
      await this.repository.save(data);
      return task!;
    });
    this.outcomes.set(taskId, { kind, promise });
    const clear = () => { this.outcomes.delete(taskId); };
    void promise.then(clear, clear);
    return promise;
  }
  // Backwards-compatible tracker operation; shares the same authoritative record.
  recordHabitMiss(taskId: string) {
    return this.recordOutcome(taskId, "missed", true);
  }
  // Recurrence edits affect only future, unrecorded generated instances.
  reconcileHabitOccurrence(taskId: string, fields: TaskInput, scheduled: boolean, habitSettings?: import("../habits/domain.ts").HabitRevision) {
    return this.serialize(async () => {
      const { data, task, student } = await this.context(taskId);
      if (task!.source.kind !== "habit") throw new Error("Expected a habit occurrence.");
      if (task!.status !== "pending" || task!.source.scheduledDate < localNow(student.timezone, this.clock()).date) return task!;
      const normalized = normalize(fields);
      if (normalized.dueDate !== task!.source.scheduledDate) throw new Error("Original occurrence dates cannot change.");
      if (JSON.stringify(taskSnapshot(task!)) === JSON.stringify(normalized) && !!task!.habitWithdrawn === !scheduled && (!habitSettings || JSON.stringify(task!.habitSettings) === JSON.stringify(habitSettings))) return task!;
      audit(task!, "edited", this.clock().toISOString()); Object.assign(task!, normalized, { habitWithdrawn: !scheduled });
      task!.source.habitName = normalized.title;
      if (habitSettings) task!.habitSettings = structuredClone(habitSettings);
      await this.repository.save(data); return task!;
    });
  }
  // Integration boundary, not habit creation. The tracker supplies actual dates;
  // it must use this same occurrence record for its cell, totals and completion.
  receiveHabitOccurrence(input: TaskInput & { habitId: string; occurrenceId: string; habitName: string; scheduledDate: string; habitHref?: string; habitSettings?: import("../habits/domain.ts").HabitRevision }, scheduledDates: readonly string[]) {
    return this.serialize(async () => {
      if (!input.habitId?.trim() || !input.occurrenceId?.trim() || !input.habitName?.trim() || !validDate(input.scheduledDate) || !scheduledDates.every(validDate) || !scheduledDates.includes(input.scheduledDate)) throw new Error("Habit occurrences must belong to the habit's actual schedule and have stable source identifiers.");
      if (input.dueDate && input.dueDate !== input.scheduledDate) throw new Error("The habit task date must match its scheduled occurrence.");
      if (input.habitHref && !/^\/habits(?:\/|\?|$)/.test(input.habitHref)) throw new Error("Habit navigation must point to an implemented local habit destination.");
      const fields = normalize({ ...input, dueDate: input.scheduledDate });
      const { student, data } = await this.context();
      const existing = data.tasks.find(task => task.ownerId === student.id && task.source.kind === "habit" && task.source.habitId === input.habitId && task.source.occurrenceId === input.occurrenceId);
      if (existing) {
        if (existing.source.kind === "habit" && existing.source.scheduledDate !== input.scheduledDate) throw new Error("An occurrence identifier cannot be reused for another date.");
        return existing;
      }
      const now = this.clock().toISOString();
      const task: Task = { ...fields, habitSettings: input.habitSettings && structuredClone(input.habitSettings), id: id(), ownerId: student.id, source: { kind: "habit", habitId: input.habitId, occurrenceId: input.occurrenceId, habitName: input.habitName, scheduledDate: input.scheduledDate, habitHref: input.habitHref }, status: "pending", createdAt: now, updatedAt: now, history: [] };
      audit(task, "created", now);
      data.tasks.push(task);
      await this.repository.save(data);
      return task;
    });
  }
}

