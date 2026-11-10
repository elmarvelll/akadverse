import { habitDuplicateConflicts } from "./duplicates.ts";
import { addDays, id, localNow, type IdentityProvider, type ScheduleRepository, type PersonalEvent, type SchedulingOptions, type Slot, ScheduleService, type AcademicProvider } from "../schedule/domain.ts";
import { TaskService } from "../tasks/service.ts";
import { rangeDays, type DateRange } from "../analytics/periods.ts";
import { occurrenceId, scheduledFor, settingsFor, type HabitInput, type HabitRepository, type Occurrence, validateHabit } from "./domain.ts";

export class HabitService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private repository: HabitRepository, readonly tasks: TaskService, private schedules: ScheduleRepository, private identity: IdentityProvider, private academic: AcademicProvider, private clock: () => Date = () => new Date()) {}
  private serialize<T>(fn: () => Promise<T>) { const result = this.queue.then(fn); this.queue = result.catch(() => undefined); return result; }
  async list() { const student = await this.identity.getCurrentStudent(); return (await this.repository.load()).habits.filter(habit => habit.ownerId === student.id); }
  save(input: HabitInput, habitId?: string) {
    return this.serialize(async () => {
      const student = await this.identity.getCurrentStudent(); validateHabit(input, student.timezone);
      const data = await this.repository.load(), now = this.clock(), today = localNow(student.timezone, now).date;
      let habit = data.habits.find(item => item.id === habitId && item.ownerId === student.id);
      if (habitId && !habit) throw new Error("Habit not found for this student.");
      const revision = { ...input, name: input.name.trim(), description: input.description.trim(), weekdays: [...input.weekdays], effectiveDate: habit ? addDays(today, 1) : today, at: now.toISOString(), archived: false };
      if (habit) habit.revisions.push(revision);
      else { habit = { id: id(), ownerId: student.id, timezone: student.timezone, createdDate: today, createdAt: now.toISOString(), revisions: [revision] }; data.habits.push(habit); }
      await this.repository.save(data); return habit;
    });
  }
  archive(habitId: string, archived: boolean) {
    return this.serialize(async () => {
      const student = await this.identity.getCurrentStudent(), data = await this.repository.load();
      const habit = data.habits.find(item => item.id === habitId && item.ownerId === student.id);
      if (!habit) throw new Error("Habit not found for this student.");
      const latest = habit.revisions.at(-1)!;
      if (latest.archived === archived) return;
      habit.revisions.push({ ...latest, archived, effectiveDate: addDays(localNow(habit.timezone, this.clock()).date, 1), at: this.clock().toISOString() });
      await this.repository.save(data);
    });
  }
  synchronize(range: DateRange, options: { tasks?: "all" | "today" } = {}) { return this.serialize(() => this.generate(range, options.tasks || "all")); }
  private async generate(range: DateRange, taskScope: "all" | "today" = "all"): Promise<Occurrence[]> {
    const dates = rangeDays(range), habits = await this.list(), student = await this.identity.getCurrentStudent();
    let tasks = await this.tasks.listTasks();
    const data = await this.schedules.load(), now = this.clock().toISOString(); let changed = false;
    const conflicts = habitDuplicateConflicts(tasks, data.events.filter(event => event.ownerId === student.id));
    if (conflicts.length) throw new Error("Conflicting duplicate habit outcomes require review: " + conflicts.join(", ") + ". Saved records are untouched; no automatic merge was performed.");
    const today = localNow(student.timezone, this.clock()).date;
    // Include already-generated future dates so edits/archiving withdraw those
    // instances even when a different month is currently displayed.
    const needed = new Set(dates);
    for (const task of tasks) if (task.source.kind === "habit" && habits.some(habit => habit.id === (task.source.kind === "habit" && task.source.habitId))) needed.add(task.source.scheduledDate);
    for (const event of data.events) if (event.ownerId === student.id && event.source.kind === "habit" && habits.some(habit => habit.id === (event.source.kind === "habit" && event.source.habitId))) needed.add(event.originalSlot.date);
    for (const habit of habits) for (const date of needed) {
      const settings = scheduledFor(habit, date), key = occurrenceId(habit.id, date);
      const existingTask = tasks.find(task => task.source.kind === "habit" && task.source.habitId === habit.id && task.source.scheduledDate === date);
      const existingEvent = data.events.find(event => event.ownerId === student.id && event.source.kind === "habit" && event.source.habitId === habit.id && event.originalSlot.date === date);
      const fields = settings && { title: settings.name, description: settings.description, priority: settings.priority, dueDate: date, dueTime: settings.time };
      if (existingTask && date > today) await this.tasks.reconcileHabitOccurrence(existingTask.id, fields || existingTask, !!settings && settings.type === "task" && !(existingEvent && hasOutcome(existingEvent)));
      if ((taskScope === "all" || date === today) && settings?.type === "task" && !existingTask && !(existingEvent && hasOutcome(existingEvent))) {
        const task = await this.tasks.receiveHabitOccurrence({ ...fields!, habitId: habit.id, occurrenceId: key, habitName: settings.name, scheduledDate: date }, [date]); tasks.push(task);
      }
      if (existingEvent && date > today && !hasOutcome(existingEvent)) {
        const enabled = settings?.type === "event" && !(existingTask && existingTask.status !== "pending");
        const slot = enabled ? { date, start: settings.time, end: settings.end!, timezone: habit.timezone } : existingEvent.slot;
        if (!!existingEvent.archivedAt === enabled || (enabled && (existingEvent.title !== settings.name || existingEvent.description !== (settings.description || settings.name) || existingEvent.priority !== settings.priority || JSON.stringify(existingEvent.slot) !== JSON.stringify(slot)))) {
          existingEvent.history.push({ id: id(), kind: enabled ? "edited" : "archived", at: now, planned: { ...existingEvent.slot }, next: enabled ? slot : undefined, mustComplete: false });
          Object.assign(existingEvent, enabled ? { slot, originalSlot: { ...slot }, title: settings.name, description: settings.description || settings.name, priority: settings.priority, archivedAt: undefined, updatedAt: now } : { archivedAt: now, updatedAt: now }); changed = true;
        }
      }
      if (settings?.type === "event" && !existingEvent && !(existingTask && existingTask.status !== "pending")) {
        const slot = { date, start: settings.time, end: settings.end!, timezone: habit.timezone };
        data.events.push({ id: `habit-event:${key}`, ownerId: student.id, title: settings.name, description: settings.description || settings.name, slot, originalSlot: { ...slot }, priority: settings.priority, mustComplete: false, status: "pending", source: { kind: "habit", habitId: habit.id, occurrenceId: key }, createdAt: now, updatedAt: now, history: [{ id: id(), kind: "created", at: now, planned: { ...slot }, mustComplete: false }] }); changed = true;
      }
    }
    if (changed) await this.schedules.save(data);
    tasks = await this.tasks.listTasks();
    const occurrences: Occurrence[] = [];
    for (const habit of habits) for (const date of dates) {
      const key = occurrenceId(habit.id, date), settings = scheduledFor(habit, date);
      const task = tasks.find(task => !task.habitWithdrawn && task.source.kind === "habit" && task.source.habitId === habit.id && task.source.scheduledDate === date);
      const event = data.events.find(event => !event.archivedAt && event.ownerId === student.id && event.source.kind === "habit" && event.source.habitId === habit.id && event.originalSlot.date === date);
      if (settings || task || event) occurrences.push({ habitId: habit.id, id: key, date, settings: settings || settingsFor(habit, date)!, task, event });
    }
    return occurrences;
  }
  record(habitId: string, date: string, kind: "completed" | "missed") {
    return this.serialize(async () => {
      const [item] = (await this.generate({ start: date, end: date })).filter(item => item.habitId === habitId);
      if (!item) throw new Error("This date is not scheduled.");
      if (item.task) return kind === "completed" ? this.tasks.completeTask(item.task.id) : this.tasks.recordHabitMiss(item.task.id);
      if (!item.event) throw new Error("Occurrence could not be loaded. Retry.");
      const service = new ScheduleService(this.schedules, this.identity, this.academic);
      if (kind === "completed") await service.completeEvent(item.event.id);
      else await service.recordMissedAttempt(item.event.id);
    });
  }
  replan(event: PersonalEvent, slot: Slot, options: SchedulingOptions) {
    return this.serialize(async () => {
      const habits = await this.list();
      if (event.source.kind !== "habit" || !habits.some(habit => event.source.kind === "habit" && habit.id === event.source.habitId)) throw new Error("Habit event not found.");
      const current = (await this.schedules.load()).events.find(item => item.id === event.id);
      if (!current || current.status !== "requires-replanning") throw new Error("Record a missed attempt before replanning.");
      const service = new ScheduleService(this.schedules, this.identity, this.academic);
      // Imported habit events have no user-selected category. Other slot,
      // ownership, history and conflict checks use the existing schedule service.
      await service.saveEvent({ title: current.title, description: current.description, priority: current.priority, mustComplete: current.mustComplete, subScheduleId: current.subScheduleId, backup: current.backup, slot }, current.id, current.source, options);
    });
  }
}
function hasOutcome(event: PersonalEvent) { return !!event.completedAt || event.history.some(entry => entry.kind === "missed" || entry.kind === "rescheduled"); }
