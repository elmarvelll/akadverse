import { ProductivityError } from "../errors";
import { habitDuplicateConflicts } from "./duplicates";
import { id, localNow, type IdentityProvider, type ScheduleRepository, type PersonalEvent, type SchedulingOptions, type Slot, ScheduleService, type AcademicProvider } from "../schedule/domain";
import { TaskService } from "../tasks/service";
import { rangeDays, type DateRange } from "../analytics/periods";
import { occurrenceId, scheduledFor, settingsFor, occurrenceActions, type HabitInput, type HabitRepository, type Occurrence, validateHabit } from "./domain";

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
      if (habitId && !habit) throw new ProductivityError("Habit not found for this student.");
      const revision = { ...input, name: input.name.trim(), description: input.description.trim(), weekdays: [...input.weekdays], effectiveDate: habit ? today : input.startDate && input.startDate < today ? input.startDate : today, at: now.toISOString(), archived: habit?.revisions.at(-1)?.archived || false };
      if (habit) habit.revisions.push(revision);
      else { habit = { id: id(), ownerId: student.id, timezone: student.timezone, createdDate: today, createdAt: now.toISOString(), revisions: [revision] }; data.habits.push(habit); }
      await this.repository.save(data); return habit;
    });
  }
  archive(habitId: string, archived: boolean) {
    return this.serialize(async () => {
      const student = await this.identity.getCurrentStudent(), data = await this.repository.load();
      const habit = data.habits.find(item => item.id === habitId && item.ownerId === student.id);
      if (!habit) throw new ProductivityError("Habit not found for this student.");
      const latest = habit.revisions.at(-1)!;
      if (latest.archived === archived) return;
      habit.revisions.push({ ...latest, archived, effectiveDate: localNow(student.timezone, this.clock()).date, at: this.clock().toISOString() });
      await this.repository.save(data);
    });
  }
  synchronize(range: DateRange, options: { tasks?: "all" | "today" } = {}) { return this.serialize(() => this.generate(range, options.tasks || "all")); }
  private async generate(range: DateRange, taskScope: "all" | "today" = "all"): Promise<Occurrence[]> {
    const dates = rangeDays(range), habits = await this.list(), student = await this.identity.getCurrentStudent();
    let tasks = await this.tasks.listTasks();
    const data = await this.schedules.load(), now = this.clock().toISOString(); let changed = false;
    const conflicts = habitDuplicateConflicts(tasks, data.events.filter(event => event.ownerId === student.id));
    if (conflicts.length) throw new ProductivityError("Conflicting duplicate habit outcomes require review: " + conflicts.join(", ") + ". Saved records are untouched; no automatic merge was performed.");
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
      const fields = settings && { title: settings.name, description: settings.description, priority: settings.priority, dueDate: date, dueTime: settings.time || undefined };
      if (existingTask && date >= today) await this.tasks.reconcileHabitOccurrence(existingTask.id, fields || existingTask, !!settings && settings.type === "task" && !(existingEvent && hasOutcome(existingEvent)), settings?.type === "task" ? settings : undefined);
      if ((taskScope === "all" || date === today) && settings?.type === "task" && !existingTask && !(existingEvent && hasOutcome(existingEvent))) {
        const task = await this.tasks.receiveHabitOccurrence({ ...fields!, habitId: habit.id, occurrenceId: key, habitName: settings.name, scheduledDate: date, habitSettings: structuredClone(settings) }, [date]); tasks.push(task);
      }
      if (existingEvent && date >= today && !hasOutcome(existingEvent)) {
        const enabled = settings?.type === "event" && !(existingTask && existingTask.status !== "pending");
        const slot = enabled ? { date, start: settings.time, end: settings.end!, timezone: date < today ? habit.timezone : student.timezone } : existingEvent.slot;
        if (!!existingEvent.archivedAt === enabled || (enabled && (existingEvent.title !== settings.name || existingEvent.description !== (settings.description || settings.name) || existingEvent.priority !== settings.priority || JSON.stringify(existingEvent.slot) !== JSON.stringify(slot) || JSON.stringify(existingEvent.habitSettings) !== JSON.stringify(settings)))) {
          existingEvent.history.push({ id: id(), kind: enabled ? "edited" : "archived", at: now, planned: { ...existingEvent.slot }, next: enabled ? slot : undefined, mustComplete: false });
          Object.assign(existingEvent, enabled ? { slot, originalSlot: { ...slot }, habitSettings: structuredClone(settings), title: settings.name, description: settings.description || settings.name, priority: settings.priority, archivedAt: undefined, updatedAt: now } : { archivedAt: now, updatedAt: now }); changed = true;
        }
      }
      if (settings?.type === "event" && !existingEvent && !(existingTask && existingTask.status !== "pending")) {
        const slot = { date, start: settings.time, end: settings.end!, timezone: date < today ? habit.timezone : student.timezone };
        data.events.push({ id: `habit-event:${key}`, ownerId: student.id, title: settings.name, description: settings.description || settings.name, habitSettings: structuredClone(settings), slot, originalSlot: { ...slot }, priority: settings.priority, mustComplete: false, status: "pending", source: { kind: "habit", habitId: habit.id, occurrenceId: key }, createdAt: now, updatedAt: now, history: [{ id: id(), kind: "created", at: now, planned: { ...slot }, mustComplete: false }] }); changed = true;
      }
    }
    if (changed) await this.schedules.save(data);
    tasks = await this.tasks.listTasks();
    const occurrences: Occurrence[] = [];
    for (const habit of habits) for (const date of dates) {
      const key = occurrenceId(habit.id, date), settings = scheduledFor(habit, date);
      const task = tasks.find(task => !task.habitWithdrawn && task.source.kind === "habit" && task.source.habitId === habit.id && task.source.scheduledDate === date);
      const event = data.events.find(event => !event.archivedAt && event.ownerId === student.id && event.source.kind === "habit" && event.source.habitId === habit.id && event.originalSlot.date === date);
      const recordedAt = task?.history.find(entry => entry.kind === "completed" || entry.kind === "missed")?.at || event?.history.find(entry => entry.kind === "completed" || entry.kind === "missed")?.at;
      if (settings || task || event) occurrences.push({ habitId: habit.id, id: key, date, settings: task?.habitSettings || event?.habitSettings || (recordedAt && settingsFor(habit, date, recordedAt)) || settings || settingsFor(habit, date)!, task, event });
    }
    return occurrences;
  }
  record(habitId: string, date: string, kind: "completed" | "missed" | "pending") {
    return this.serialize(async () => {
      const [item] = (await this.generate({ start: date, end: date })).filter(item => item.habitId === habitId);
      if (!item) throw new ProductivityError("This date is not scheduled.");
      const student = await this.identity.getCurrentStudent(), instant = this.clock(), actions = occurrenceActions(item, localNow(student.timezone, instant), student.timezone);
      const current = item.task?.status || item.event?.outcomeChanges?.at(-1)?.to.status || (item.event?.status === "completed" ? "completed" : item.event?.status === "requires-replanning" || item.event?.history.some(entry => entry.kind === "missed") && !item.event.outcomeChanges?.length ? "missed" : "pending");
      if (current === kind) return;
      if (!(kind === "completed" ? actions.complete : kind === "missed" ? actions.missed : actions.clear)) throw new ProductivityError("This outcome is not available at the current scheduled time.");
      if (item.task) {
        if (current === "pending" && kind !== "pending" && !item.task.outcomeChanges?.length) return kind === "completed" ? this.tasks.completeTask(item.task.id) : this.tasks.recordHabitMiss(item.task.id);
        return this.tasks.correctHabitOutcome(item.task.id, kind);
      }
      if (!item.event) throw new ProductivityError("Occurrence could not be loaded. Retry.");
      const data = await this.schedules.load(), event = data.events.find(event => event.id === item.event!.id && event.ownerId === student.id)!;
      const at = instant.toISOString();
      if (current === "pending" && kind !== "pending" && !event.outcomeChanges?.length) {
        event.history.push({ id: id(), kind, at, planned: { ...event.slot }, mustComplete: event.mustComplete });
      } else {
        const from = { status: current, completedAt: event.completedAt, missedAt: event.outcomeChanges?.at(-1)?.to.missedAt || (!event.outcomeChanges?.length ? event.history.filter(entry => entry.kind === "missed").at(-1)?.at : undefined) };
        const to = { status: kind, completedAt: kind === "completed" ? at : undefined, missedAt: kind === "missed" ? at : undefined };
        (event.outcomeChanges ||= []).push({ id: id(), at, from, to });
      }
      event.status = kind === "missed" ? "requires-replanning" : kind;
      event.completedAt = kind === "completed" ? at : undefined; event.updatedAt = at;
      await this.schedules.save(data);
    });
  }
  replan(event: PersonalEvent, slot: Slot, options: SchedulingOptions) {
    return this.serialize(async () => {
      const habits = await this.list();
      if (event.source.kind !== "habit" || !habits.some(habit => event.source.kind === "habit" && habit.id === event.source.habitId)) throw new ProductivityError("Habit event not found.");
      const current = (await this.schedules.load()).events.find(item => item.id === event.id);
      if (!current || current.status !== "requires-replanning") throw new ProductivityError("Record a missed attempt before replanning.");
      const service = new ScheduleService(this.schedules, this.identity, this.academic, this.clock);
      // Imported habit events have no user-selected category. Other slot,
      // ownership, history and conflict checks use the existing schedule service.
      await service.saveEvent({ title: current.title, description: current.description, priority: current.priority, mustComplete: current.mustComplete, subScheduleId: current.subScheduleId, backup: current.backup, slot }, current.id, current.source, options);
    });
  }
}
function hasOutcome(event: PersonalEvent) { return !!event.completedAt || event.outcomeChanges?.at(-1)?.to.status === "missed" || event.status === "requires-replanning" || !event.outcomeChanges?.length && event.history.some(entry => entry.kind === "missed" || entry.kind === "rescheduled"); }
