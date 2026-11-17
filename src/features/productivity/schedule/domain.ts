import { ProductivityError } from "../errors";
import { slotInterval } from "./time";
export type LocalDate = string;
export type Time = string;
export type Priority = "low" | "medium" | "high";
export interface Slot {
  date: LocalDate;
  start: Time;
  end: Time;
  timezone: string;
}
export type EventSource =
  | { kind: "personal" }
  | { kind: "task"; taskId: string }
  | { kind: "habit"; habitId: string; occurrenceId: string };
export interface HistoryEntry {
  id: string;
  kind:
    | "created"
    | "edited"
    | "completed"
    | "archived"
    | "restored"
    | "missed"
    | "rescheduled";
  at: string;
  planned: Slot;
  mustComplete: boolean;
  next?: Slot;
}
export interface PersonalEvent {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  subScheduleId?: string;
  slot: Slot;
  originalSlot: Slot;
  priority: Priority;
  mustComplete: boolean;
  focusDate?: LocalDate;
  backup?: Slot;
  status: "pending" | "completed" | "requires-replanning";
  source: EventSource;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
  history: HistoryEntry[];
  outcomeChanges?: import("../habits/outcomes").OutcomeChange[];
  habitSettings?: import("../habits/domain").HabitRevision;
}
export interface SubSchedule {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  academic?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Dataset {
  version: 1;
  events: PersonalEvent[];
  schedules: SubSchedule[];
}
export interface Student {
  id: string;
  name: string;
  timezone: string;
  development: boolean;
}
export interface OfficialClass {
  id: string;
  sourceId: string;
  registrationId: string;
  courseCode: string;
  courseName: string;
  lecturer: string;
  venue: string;
  semester: string;
  classGroup: string;
  slot: Slot;
  state: "scheduled" | "cancelled";
  registrationState: "registered" | "dropped";
}
export interface IdentityProvider {
  getCurrentStudent(): Promise<Student>;
}
export interface ScheduleRepository {
  load(): Promise<Dataset>;
  save(data: Dataset): Promise<void>;
}
export interface AcademicProvider {
  /** Owner-scoped task intervals already loaded by the transaction; no extra I/O. */
  getExtraCommitments?(): Conflict[];
  getClassSessions(
    studentId: string,
    date: LocalDate,
  ): Promise<OfficialClass[]>;
}
export type EventInput = Pick<
  PersonalEvent,
  | "title"
  | "description"
  | "subScheduleId"
  | "slot"
  | "priority"
  | "mustComplete"
> & { backup?: Slot };
export type SchedulingOptions =
  | { mode: "manual"; allowConflicts?: boolean }
  | { mode: "smart"; durationMinutes: number; earliest: Time; latest: Time };
export type Conflict = { id: string; title: string; slot: Slot };
export class SlotConflictError extends ProductivityError {
  constructor(public conflicts: Conflict[], referenceId?: string) {
    super("Time conflict with " + conflicts.map(c => `${c.title} (${c.slot.start}–${c.slot.end})`).join(", ") + ". Choose another time or explicitly keep this time.", "SLOT_CONFLICT", referenceId);
    this.name = "SlotConflictError";
  }
}

// A schedule is a record of time: completion in another module does not erase it.
export function selectScheduleEvents(data: Dataset, ownerId: string, options: { date: string; scheduleId?: string; focus?: boolean }) {
  return data.events.filter(e => e.ownerId === ownerId && !e.archivedAt && e.slot.date === options.date && (!options.scheduleId || e.subScheduleId === options.scheduleId) && (!options.focus || (e.mustComplete && e.focusDate === options.date)));
}

export function scheduleConflicts(events: PersonalEvent[], classes: OfficialClass[], ownerId: string) {
  const commitments = [
    ...events.filter(e => e.ownerId === ownerId && !e.archivedAt).map(e => ({ id: e.id, title: e.title, slot: e.slot })),
    ...classes.filter(c => c.state === "scheduled" && c.registrationState === "registered").map(c => ({ id: c.id, title: c.courseCode + " · " + c.courseName, slot: c.slot })),
  ];
  const result = new Map<string, Conflict[]>();
  for (const commitment of commitments) result.set(commitment.id, commitments.filter(other => other.id !== commitment.id && overlaps(commitment.slot, other.slot)));
  return result;
}

export function findSmartSlot(date: string, timezone: string, options: Extract<SchedulingOptions, { mode: "smart" }>, events: PersonalEvent[], classes: OfficialClass[], now: { date: string; time: string }, excludeId?: string, extra: Conflict[] = []): Slot | null {
  const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!validDate(date) || !validTime(options.earliest) || !validTime(options.latest) || options.earliest >= options.latest || !Number.isInteger(options.durationMinutes) || options.durationMinutes < 1 || options.durationMinutes > 1439)
    throw new ProductivityError("Choose a valid scheduling window and duration between 1 and 1439 minutes.");
  if (date < now.date) throw new ProductivityError("Smart scheduling needs today or a future date.");
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const time = (value: number) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  const start = Math.max(minutes(options.earliest), date === now.date ? minutes(now.time) + 1 : 0);
  for (let minute = start; minute + options.durationMinutes <= minutes(options.latest); minute++) {
    const candidate = { date, timezone, start: time(minute), end: time(minute + options.durationMinutes) };
    if (!findConflicts(candidate, events, classes, excludeId, extra).length) return candidate;
  }
  return null;
}
export const emptyDataset = (): Dataset => ({
  version: 1,
  events: [],
  schedules: [],
});
export const id = () => crypto.randomUUID();
export const timestamp = () => new Date().toISOString();
export function localNow(
  timezone: string,
  instant = new Date(),
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return {
    date: get("year") + "-" + get("month") + "-" + get("day"),
    time: get("hour") + ":" + get("minute"),
  };
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}
export function validSlot(s: Slot): boolean {
  if (
    !s ||
    !validDate(s.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end) ||
    s.end === s.start
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format();
    return true;
  } catch {
    return false;
  }
}
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function overlaps(a: Slot, b: Slot): boolean {
  const left = slotInterval(a), right = slotInterval(b);
  return left.start < right.end && left.end > right.start;
}
export const slotEndDate = (slot: Slot) => slot.end < slot.start ? addDays(slot.date, 1) : slot.date;
export function findConflicts(
  slot: Slot,
  events: PersonalEvent[],
  classes: OfficialClass[],
  excludeId?: string,
  extra: Conflict[] = [],
) {
  return [
    ...extra.filter(commitment => commitment.id !== excludeId && overlaps(slot, commitment.slot)),
    ...events
      .filter(
        (e) =>
          e.id !== excludeId &&
          !e.archivedAt &&
          overlaps(slot, e.slot),
      )
      .map((e) => ({ id: e.id, title: e.title, slot: e.slot })),
    ...classes
      .filter(
        (c) =>
          c.state === "scheduled" &&
          c.registrationState === "registered" &&
          overlaps(slot, c.slot),
      )
      .map((c) => ({
        id: c.id,
        title: c.courseCode + " · " + c.courseName,
        slot: c.slot,
      })),
  ];
}
export function selectEvents(
  data: Dataset,
  ownerId: string,
  options: {
    date?: string;
    scheduleId?: string;
    focus?: boolean;
    history?: boolean;
  } = {},
) {
  return data.events.filter(
    (e) =>
      e.ownerId === ownerId &&
      (options.history
        ? !!e.archivedAt || e.status === "completed"
        : !e.archivedAt && e.status !== "completed") &&
      (!options.date || e.slot.date === options.date) &&
      (!options.scheduleId || e.subScheduleId === options.scheduleId) &&
      (!options.focus || (e.mustComplete && e.focusDate === options.date)),
  );
}
export function validateInput(
  input: EventInput,
  student: Student,
  data: Dataset,
  importedHabit = false,
) {
  if (!input.title.trim() || input.title.trim().length > 100)
    throw new ProductivityError("Enter a title between 1 and 100 characters.");
  if (!input.description.trim())
    throw new ProductivityError("Enter detailed event instructions or a description.");
  if (!validSlot(input.slot))
    throw new ProductivityError(
      "Choose a valid date and different start/end times. An earlier end time means the following day.",
    );
  if (input.slot.timezone !== student.timezone)
    throw new ProductivityError("Use the student's timezone.");
  if (input.backup && (!validSlot(input.backup) || input.backup.timezone !== student.timezone || input.backup.date + input.backup.start <= input.slot.date + input.slot.start || duration(input.backup) !== duration(input.slot)))
    throw new ProductivityError("Backup must be later than the event, use the same timezone, and preserve its duration.");
  if (
    !["low", "medium", "high"].includes(input.priority) ||
    typeof input.mustComplete !== "boolean"
  )
    throw new ProductivityError("Choose a valid priority and focus commitment.");
  if (
    !importedHabit && (!input.subScheduleId || !data.schedules.some(
      (s) => s.id === input.subScheduleId && s.ownerId === student.id,
    ))
  )
    throw new ProductivityError("Create a sub-category first, then select one of your existing sub-categories.");
}
function owned(data: Dataset, student: Student, eventId: string) {
  const e = data.events.find(
    (e) => e.id === eventId && e.ownerId === student.id,
  );
  if (!e)
    throw new ProductivityError(
      "Personal event not found. Official classes are read-only.",
    );
  return e;
}
export class ScheduleService {
  private mutations: Promise<unknown> = Promise.resolve();
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutations.then(operation);
    this.mutations = result.catch(() => undefined);
    return result;
  }
  saveEvent(input: EventInput, eventId?: string, source: EventSource = { kind: "personal" }, scheduling: SchedulingOptions = { mode: "manual" }) {
    return this.serialize(() => this.saveEventInternal(input, eventId, source, scheduling));
  }
  completeEvent(eventId: string) {
    return this.serialize(() => this.completeEventInternal(eventId));
  }
  recordMissedAttempt(eventId: string) {
    return this.serialize(() => this.recordMissedAttemptInternal(eventId));
  }
  saveSubSchedule(name: string, description: string, scheduleId?: string, academic = false) {
    return this.serialize(() => this.saveSubScheduleInternal(name, description, scheduleId, academic));
  }
  archiveEvent(eventId: string, restore = false) {
    return this.serialize(() => this.archiveEventInternal(eventId, restore));
  }
  setBackup(eventId: string, backup?: Slot) {
    return this.serialize(() => this.setBackupInternal(eventId, backup));
  }
  constructor(
    private repository: ScheduleRepository,
    private identity: IdentityProvider,
    private academic: AcademicProvider,
    private clock: () => Date = () => new Date(),
  ) {}
  getCurrentStudent() {
    return this.identity.getCurrentStudent();
  }
  async load() {
    return this.repository.load();
  }
  async listSubSchedules() {
    const s = await this.getCurrentStudent();
    return (await this.load()).schedules.filter((x) => x.ownerId === s.id);
  }
  async listPersonalEvents() {
    const s = await this.getCurrentStudent();
    return (await this.load()).events.filter((x) => x.ownerId === s.id);
  }
  async getOfficialClasses(date: string) {
    const s = await this.getCurrentStudent();
    return this.academic.getClassSessions(s.id, date);
  }
  private async saveSubScheduleInternal(
    name: string,
    description: string,
    scheduleId?: string,
    academic = false,
  ) {
    const student = await this.getCurrentStudent(),
      data = await this.load();
    name = name.trim();
    if (!name || name.length > 60)
      throw new ProductivityError("Enter a sub-schedule name between 1 and 60 characters.");
    if (
      data.schedules.some(
        (s) =>
          s.ownerId === student.id &&
          s.id !== scheduleId &&
          s.name.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new ProductivityError("A sub-schedule with this name already exists.");
    const now = this.clock().toISOString();
    if (scheduleId) {
      const s = data.schedules.find(
        (s) => s.id === scheduleId && s.ownerId === student.id,
      );
      if (!s) throw new ProductivityError("Sub-schedule not found.");
      Object.assign(s, { name, description, academic, updatedAt: now });
    } else
      data.schedules.push({
        id: id(),
        ownerId: student.id,
        name,
        description,
        academic,
        createdAt: now,
        updatedAt: now,
      });
    await this.repository.save(data);
    return data;
  }
  private async saveEventInternal(input: EventInput, eventId: string | undefined, source: EventSource, scheduling: SchedulingOptions) {
    const student = await this.getCurrentStudent(),
      data = await this.load();
    const existing = eventId ? owned(data, student, eventId) : undefined;
    if (scheduling.mode !== "manual" && scheduling.mode !== "smart") throw new ProductivityError("Choose manual or smart scheduling.");
    if (scheduling.mode === "smart" && (!existing || existing.status !== "requires-replanning" || existing.archivedAt))
      throw new ProductivityError("Smart rescheduling is available only after an event is explicitly marked missed.");
    if (source.kind === "habit") {
      if (!source.habitId.trim() || !source.occurrenceId.trim()) throw new ProductivityError("Habit and occurrence identifiers are required.");
      const occurrence = data.events.find(e => e.ownerId === student.id && e.source.kind === "habit" && e.source.habitId === source.habitId && e.source.occurrenceId === source.occurrenceId);
      if (occurrence && !eventId) return data;
    }
    if (source.kind === "task") {
      if (!source.taskId.trim()) throw new ProductivityError("A task identifier is required.");
      if (!eventId && data.events.some(e => e.ownerId === student.id && e.source.kind === "task" && e.source.taskId === source.taskId)) return data;
    }
    if (scheduling.mode === "smart") {
      if (!validDate(input.slot.date)) throw new ProductivityError("Choose a valid date.");
      const classes = await this.academic.getClassSessions(student.id, input.slot.date);
      const suggested = findSmartSlot(input.slot.date, student.timezone, scheduling, data.events.filter(e => e.ownerId === student.id), classes, localNow(student.timezone, this.clock()), eventId, this.academic.getExtraCommitments?.() || []);
      if (!suggested) throw new ProductivityError("No free slot fits this duration and window on the selected day. Choose another date, widen the window, or use manual scheduling.");
      input = { ...input, slot: suggested };
    }
    validateInput(input, student, data, source.kind === "habit" || existing?.source.kind === "habit");
    slotInterval(input.slot);
    if (input.backup) slotInterval(input.backup);
    if (existing && (existing.status === "completed" || existing.archivedAt))
      throw new ProductivityError("Only active pending events can be edited.");
    const moved =
      existing && JSON.stringify(existing.slot) !== JSON.stringify(input.slot);
    if (moved || existing?.status === "requires-replanning") {
      const now = localNow(student.timezone, this.clock());
      if (input.slot.date + input.slot.start <= now.date + now.time)
        throw new ProductivityError("Choose a future time when moving an event.");
    }
    const classDates = [...new Set([input.slot.date, slotEndDate(input.slot)])];
    const classes = (await Promise.all(classDates.map(date => this.academic.getClassSessions(student.id, date)))).flat();
    const conflicts = findConflicts(
      input.slot,
      data.events.filter((e) => e.ownerId === student.id),
      classes,
      eventId,
      this.academic.getExtraCommitments?.() || [],
    );
    if (conflicts.length && !(scheduling.mode === "manual" && scheduling.allowConflicts))
      throw new SlotConflictError(conflicts);
    const now = this.clock().toISOString();
    if (existing) {
      existing.history.push({
        id: id(),
        kind: existing.status === "requires-replanning" ? "rescheduled" : "edited",
        at: now,
        planned: { ...existing.slot },
        mustComplete: existing.mustComplete,
        next: { ...input.slot },
      });
      Object.assign(existing, input, {
        backup: input.backup,
        status: "pending",
        title: input.title.trim(),
        updatedAt: now,
        focusDate: input.mustComplete ? input.slot.date : undefined,
      });
    } else {
      data.events.push({
        ...input,
        id: id(),
        ownerId: student.id,
        title: input.title.trim(),
        originalSlot: { ...input.slot },
        source,
        status: "pending",
        focusDate: input.mustComplete ? input.slot.date : undefined,
        createdAt: now,
        updatedAt: now,
        history: [
          {
            id: id(),
            kind: "created",
            at: now,
            planned: { ...input.slot },
            mustComplete: input.mustComplete,
          },
        ],
      });
    }
    await this.repository.save(data);
    return data;
  }
  private async completeEventInternal(eventId: string) {
    const student = await this.getCurrentStudent(),
      data = await this.load(),
      e = owned(data, student, eventId);
    if (e.status === "completed") return data;
    if (e.archivedAt)
      throw new ProductivityError("Restore this event before completing it.");
    const now = this.clock().toISOString();
    e.status = "completed";
    e.completedAt = now;
    e.updatedAt = now;
    e.history.push({
      id: id(),
      kind: "completed",
      at: now,
      planned: { ...e.slot },
      mustComplete: e.mustComplete,
    });
    await this.repository.save(data);
    return data;
  }
  private async archiveEventInternal(eventId: string, restore = false) {
    const student = await this.getCurrentStudent(),
      data = await this.load(),
      e = owned(data, student, eventId);
    if ((restore && !e.archivedAt) || (!restore && e.archivedAt)) return data;
    const now = this.clock().toISOString();
    e.archivedAt = restore ? undefined : now;
    e.updatedAt = now;
    e.history.push({
      id: id(),
      kind: restore ? "restored" : "archived",
      at: now,
      planned: { ...e.slot },
      mustComplete: e.mustComplete,
    });
    await this.repository.save(data);
    return data;
  }
  async getHistory(eventId: string) {
    const s = await this.getCurrentStudent();
    return owned(await this.load(), s, eventId).history;
  }

  private async setBackupInternal(eventId: string, backup?: Slot) {
    const student = await this.getCurrentStudent(), data = await this.load();
    const e = owned(data, student, eventId);
    if (e.status === "completed" || e.archivedAt) throw new ProductivityError("Only active events can have a backup.");
    validateInput({ ...e, backup }, student, data);
    e.backup = backup;
    e.updatedAt = this.clock().toISOString();
    e.history.push({ id: id(), kind: "edited", at: e.updatedAt, planned: { ...e.slot }, mustComplete: e.mustComplete });
    await this.repository.save(data);
    return data;
  }

  private async recordMissedAttemptInternal(eventId: string) {
    const student = await this.getCurrentStudent(), data = await this.load();
    const e = owned(data, student, eventId);
    if (e.status === "completed" || e.archivedAt) throw new ProductivityError("Only active events can be marked missed.");
    if (e.status === "requires-replanning") return data;
    const now = localNow(e.slot.timezone, this.clock());
    if (slotEndDate(e.slot) + e.slot.end > now.date + now.time)
      throw new ProductivityError("Wait until the planned event ends before marking it missed.");
    e.history.push({ id: id(), kind: "missed", at: this.clock().toISOString(), planned: { ...e.slot }, mustComplete: e.mustComplete });
    e.status = "requires-replanning";
    e.updatedAt = this.clock().toISOString();
    // Recording a miss never moves the event. Replanning is a separate choice.
    await this.repository.save(data);
    return data;
  }
}
export function duration(slot: Slot) {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const difference = minutes(slot.end) - minutes(slot.start);
  return difference < 0 ? difference + 1440 : difference;
}

// Provisional: one eligible activity per event's original date, including missed
// and unrecorded outcomes. Late completion counts on that original date.
export function productivity(data: Dataset, ownerId: string, date: string, scheduleId?: string) {
  const eligible = data.events.filter(e => e.ownerId === ownerId && !e.archivedAt && e.originalSlot.date === date && (!scheduleId || e.subScheduleId === scheduleId));
  const completed = eligible.filter(e => e.status === "completed").length;
  return { completed, due: eligible.length, score: eligible.length ? Math.round(completed / eligible.length * 100) : null };
}
