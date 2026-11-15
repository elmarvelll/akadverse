import test from "node:test";
import assert from "node:assert/strict";
import {
  ScheduleService,
  emptyDataset,
  findConflicts,
  selectEvents,
  localNow,
  validSlot,
  productivity,
  selectScheduleEvents,
  scheduleConflicts,
  findSmartSlot,
  SlotConflictError,
  type EventInput,
  type Slot,
} from "../src/features/schedule/domain.ts";
import {
  BrowserScheduleRepository,
  parseDataset,
  STORAGE_KEY,
} from "../src/features/schedule/storage.ts";
import {
  developmentIdentity,
  sampleAcademics,
  PortalAcademicProvider,
} from "../src/features/schedule/adapters.ts";
const slot = (start = "16:00", end = "17:00", date = "2030-11-04"): Slot => ({
  date,
  start,
  end,
  timezone: "Africa/Lagos",
});
const input = (overrides: Partial<EventInput> = {}): EventInput => ({
  title: "Leg day",
  description: "Squats and mobility",
  slot: slot(),
  priority: "medium",
  mustComplete: false,
  subScheduleId: "general",
  ...overrides,
});
function fixture() {
  let raw: string | null = JSON.stringify({ ...emptyDataset(), schedules: [{ id: "general", ownerId: "development-student", name: "General", description: "Test category", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }] }),
    failWrite = false,
    failRead = false;
  const storage = {
    getItem() {
      if (failRead) throw new Error("denied");
      return raw;
    },
    setItem(key: string, value: string) {
      assert.equal(key, STORAGE_KEY);
      if (failWrite) throw new Error("quota");
      raw = value;
    },
  };
  const repo = () => new BrowserScheduleRepository(() => storage);
  const service = () =>
    new ScheduleService(repo(), developmentIdentity, sampleAcademics);
  return {
    service,
    repo,
    get raw() {
      return raw;
    },
    setRaw(value: string | null) {
      raw = value;
    },
    failWrite(value: boolean) {
      failWrite = value;
    },
    failRead(value: boolean) {
      failRead = value;
    },
  };
}

test("explicit miss waits for a rescheduling choice even when a backup exists", async () => {
  const s = fixture().service();
  let data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01"), backup: slot("18:00", "19:00"), mustComplete: true }));
  const eid = data.events[0].id;
  assert.equal(data.events[0].history.some(h => h.kind === "missed"), false);
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[0].slot.start, "16:00");
  assert.equal(data.events[0].slot.date, "2020-01-01");
  assert.equal(data.events[0].status, "requires-replanning");
  assert.deepEqual(data.events[0].backup, slot("18:00", "19:00"));
  assert.equal(data.events[0].history.filter(h => h.kind === "missed").length, 1);
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[0].history.filter(h => h.kind === "missed").length, 1);
  await assert.rejects(s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01") }), eid), /future time/);
  data = await s.saveEvent(input({ slot: slot("18:00", "19:00") }), eid);
  assert.equal(data.events[0].history.at(-1)?.kind, "rescheduled");
  assert.equal(data.events[0].mustComplete, false);
  data = await s.completeEvent(eid);
  data = await s.completeEvent(eid);
  assert.equal(data.events[0].history.filter(h => h.kind === "completed").length, 1);
  assert.equal(productivity(data, "development-student", "2020-01-01").score, 100);
});

test("backup conflict preserves miss and allows manual replanning without a second missed attempt", async () => {
  const s = fixture().service();
  let data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01"), backup: slot("09:00", "10:00") }));
  const eid = data.events[0].id;
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[0].status, "requires-replanning");
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[0].history.filter(h => h.kind === "missed").length, 1);
  data = await s.saveEvent(input({ slot: slot("18:00", "19:00") }), eid);
  assert.equal(data.events[0].status, "pending");
  assert.equal(data.events[0].history.filter(h => h.kind === "missed").length, 1);
});

test("a missed event stays in place until the student replans it", async () => {
  const s = fixture().service();
  const tomorrow = localNow("Africa/Lagos").date;
  // Every candidate is blocked by a personal commitment; no academic dependency.
  const { addDays } = await import("../src/features/schedule/domain.ts");
  await s.saveEvent(input({ slot: slot("00:30", "01:30", addDays(tomorrow, 1)) }));
  let data = await s.saveEvent(input({ slot: slot("00:00", "01:00", "2020-01-01") }));
  const eid = data.events[1].id;
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[1].status, "requires-replanning");
  assert.equal(data.events[1].slot.date, "2020-01-01");
  assert.equal(data.events[1].history.some(h => h.kind === "rescheduled"), false);
});

test("habit occurrences share schedule records and completion is scoped to one occurrence", async () => {
  const s = fixture().service();
  const source = { kind: "habit" as const, habitId: "exercise", occurrenceId: "monday" };
  let data = await s.saveEvent(input(), undefined, source);
  const eid = data.events[0].id;
  data = await s.saveEvent(input(), undefined, source);
  assert.equal(data.events.length, 1);
  data = await s.saveEvent(input({ slot: slot("18:00", "19:00") }), undefined, { ...source, occurrenceId: "tuesday" });
  data = await s.completeEvent(eid);
  assert.equal(data.events[0].status, "completed");
  assert.equal(data.events[1].status, "pending");
});

test("backup validation rejects shorter or earlier alternatives", async () => {
  const s = fixture().service();
  await assert.rejects(() => s.saveEvent(input({ backup: slot("18:00", "18:30") })), /duration/);
  await assert.rejects(() => s.saveEvent(input({ backup: slot("14:00", "15:00") })), /later/);
});

test("event creation requires an existing category owned by the student", async () => {
  const f = fixture(), s = f.service();
  await assert.rejects(s.saveEvent(input({ subScheduleId: undefined })), /sub-category first/);
  await assert.rejects(s.saveEvent(input({ subScheduleId: "someone-elses-category" })), /sub-category first/);
  f.setRaw(null);
  await assert.rejects(s.saveEvent(input()), /sub-category first/);
  const categories = await s.saveSubSchedule("Exercise", "Training");
  const data = await s.saveEvent(input({ subScheduleId: categories.schedules[0].id }));
  assert.equal(data.events.length, 1);
});

test("visual schedule keeps completed tasks, events and habit practices; filters share records", async () => {
  const s = fixture().service();
  await s.saveEvent(input());
  let data = await s.saveEvent(input({ slot: slot("18:00", "19:00") }), undefined, { kind: "task", taskId: "assignment" });
  const taskId = data.events[1].id;
  data = await s.saveEvent(input({ slot: slot("20:00", "21:00") }), undefined, { kind: "habit", habitId: "reading", occurrenceId: "one" });
  data = await s.completeEvent(taskId); // The owning tracker uses the shared service.
  const all = selectScheduleEvents(data, "development-student", { date: slot().date });
  const category = selectScheduleEvents(data, "development-student", { date: slot().date, scheduleId: "general" });
  assert.deepEqual(all.map(e => e.source.kind), ["personal", "task", "habit"]);
  assert.equal(category[1], all[1]);
  assert.equal(category[1].status, "completed");
  assert.equal(selectScheduleEvents(data, "someone-else", { date: slot().date }).length, 0);
  assert.equal(selectScheduleEvents(data, "development-student", { date: slot().date, scheduleId: "another" }).length, 0);
  assert.equal(parseDataset(JSON.stringify(data)).events[1].source.kind, "task");
});

test("manual time clashes require an explicit override and flag both affected cards", async () => {
  const s = fixture().service();
  let data = await s.saveEvent(input({ slot: slot("08:30", "09:30") }), undefined, undefined, { mode: "manual", allowConflicts: true });
  const classes = await s.getOfficialClasses(slot().date);
  const flags = scheduleConflicts(data.events, classes, "development-student");
  assert.equal(flags.get(data.events[0].id)![0].id, classes[0].id);
  assert.equal(flags.get(classes[0].id)![0].id, data.events[0].id);
  await assert.rejects(s.saveEvent(input({ slot: slot("09:30", "10:00") })), SlotConflictError);
  assert.equal((await s.load()).events.length, 1);
  data = await s.saveEvent(input({ slot: slot("10:30", "11:30") }));
  assert.equal(scheduleConflicts(data.events, classes, "development-student").get(data.events[1].id)!.length, 0);
});

test("smart scheduling preserves duration, avoids all categories and lectures, and never moves official classes", async () => {
  const s = fixture().service();
  const classes = await s.getOfficialClasses(slot().date);
  const categories = await s.saveSubSchedule("Exercise", "Training");
  await s.saveEvent(input({ subScheduleId: categories.schedules.find(c => c.name === "Exercise")!.id, slot: slot("10:30", "11:00") }));
  const options = { mode: "smart" as const, durationMinutes: 60, earliest: "08:30", latest: "13:00" };
  let data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01") }));
  const eid = data.events[1].id;
  await s.recordMissedAttempt(eid);
  data = await s.saveEvent(input(), eid, undefined, options);
  assert.equal(data.events[1].slot.start, "11:00");
  assert.equal(data.events[1].slot.end, "12:00");
  await assert.rejects(s.saveEvent(input(), classes[0].id, undefined, options), /read-only/);
  await assert.rejects(s.setBackup(classes[0].id, slot()), /read-only/);
  await assert.rejects(s.recordMissedAttempt(classes[0].id), /read-only/);
  assert.deepEqual(await s.getOfficialClasses(slot().date), classes);
});

test("smart scheduling fails without saving when no full-duration slot is available", async () => {
  const s = fixture().service();
  const data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01") }));
  const eid = data.events[0].id;
  await s.recordMissedAttempt(eid);
  await assert.rejects(s.saveEvent(input(), eid, undefined, { mode: "smart", durationMinutes: 60, earliest: "09:00", latest: "10:30" }), /No free slot/);
  assert.equal((await s.load()).events[0].status, "requires-replanning");
  assert.equal((await s.load()).events[0].slot.date, "2020-01-01");
  const options = { mode: "smart" as const, durationMinutes: 60, earliest: "08:00", latest: "11:00" };
  assert.equal(findSmartSlot("2030-11-04", "Africa/Lagos", options, [], [], { date: "2030-11-04", time: "09:15" })!.start, "09:16");
  assert.throws(() => findSmartSlot("2020-01-01", "Africa/Lagos", options, [], [], { date: "2030-11-04", time: "09:15" }), /future date/);
  assert.throws(() => findSmartSlot("2030-11-04", "Africa/Lagos", { ...options, durationMinutes: 0 }, [], [], { date: "2030-11-04", time: "09:15" }), /duration/);
});

test("smart scheduling is unavailable for new events and pending events, including elapsed ones", async () => {
  const s = fixture().service();
  const options = { mode: "smart" as const, durationMinutes: 60, earliest: "08:00", latest: "22:00" };
  await assert.rejects(s.saveEvent(input(), undefined, undefined, options), /explicitly marked missed/);
  let data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01") }));
  const eid = data.events[0].id;
  await assert.rejects(s.saveEvent(input(), eid, undefined, options), /explicitly marked missed/);
  data = await s.recordMissedAttempt(eid);
  assert.equal(data.events[0].status, "requires-replanning");
  data = await s.saveEvent(input(), eid, undefined, options);
  assert.equal(data.events[0].status, "pending");
  assert.equal(data.events[0].history.at(-1)?.kind, "rescheduled");
  await assert.rejects(s.saveEvent(input(), eid, undefined, options), /explicitly marked missed/);
});

test("simultaneous completion clicks append only one outcome and preserve other mutations", async () => {
  const s = fixture().service();
  const data = await s.saveEvent(input());
  await Promise.all([s.completeEvent(data.events[0].id), s.completeEvent(data.events[0].id)]);
  const saved = await s.load();
  assert.equal(saved.events[0].history.filter(h => h.kind === "completed").length, 1);
});

test("missed history survives a timetable lookup failure", async () => {
  const f = fixture();
  let fail = false;
  const s = new ScheduleService(f.repo(), developmentIdentity, {
    async getClassSessions() { if (fail) throw new Error("Portal unavailable"); return []; },
  });
  const data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01") }));
  fail = true;
  await s.recordMissedAttempt(data.events[0].id);
  const saved = await f.service().load();
  assert.equal(saved.events[0].status, "requires-replanning");
  assert.equal(saved.events[0].history.filter(h => h.kind === "missed").length, 1);
});

test("score counts unrecorded outcomes, ignores priority and does not double count missed attempts", async () => {
  const s = fixture().service();
  let data = await s.saveSubSchedule("Exercise", "Training");
  const subScheduleId = data.schedules.find(s => s.name === "Exercise")!.id;
  data = await s.saveEvent(input({ slot: slot("16:00", "17:00", "2020-01-01"), subScheduleId, priority: "high" }));
  const eid = data.events[0].id;
  data = await s.saveEvent(input({ slot: slot("18:00", "19:00", "2020-01-01"), subScheduleId }));
  assert.deepEqual(productivity(data, "development-student", "2020-01-01", subScheduleId), { completed: 0, due: 2, score: 0 });
  data = await s.recordMissedAttempt(eid);
  data = await s.completeEvent(eid);
  assert.deepEqual(productivity(data, "development-student", "2020-01-01", subScheduleId), { completed: 1, due: 2, score: 50 });
  assert.equal(productivity(data, "someone-else", "2020-01-01").score, null);
});

test("portal provider refreshes registrations, timetable edits, cancellations and drops", async () => {
  let registered = true, cancelled = false, venue = "A";
  const template = (await sampleAcademics.getClassSessions("development-student", "2030-11-04"))[0];
  const provider = new PortalAcademicProvider({
    async getRegisteredCourses() { return [{ registrationId: template.registrationId, courseId: "csc201", state: registered ? "registered" : "dropped" }]; },
    async getTimetableSessions() { return [{ ...template, courseId: "csc201", venue, state: cancelled ? "cancelled" : "scheduled" }]; },
  });
  assert.equal((await provider.getClassSessions("student", "2030-11-04"))[0].venue, "A");
  venue = "B";
  assert.equal((await provider.getClassSessions("student", "2030-11-04"))[0].venue, "B");
  cancelled = true;
  assert.deepEqual(await provider.getClassSessions("student", "2030-11-04"), []);
  cancelled = false; registered = false;
  assert.deepEqual(await provider.getClassSessions("student", "2030-11-04"), []);
});
test("requested journey shares one record, edits, reloads, focuses, completes and reloads history", async () => {
  const f = fixture(),
    s = f.service();
  let data = await s.saveSubSchedule("Exercise", "Training");
  const sid = data.schedules.find(s => s.name === "Exercise")!.id;
  data = await s.saveEvent(input({ subScheduleId: sid, mustComplete: true }));
  const eid = data.events[0].id;
  const main = selectEvents(data, "development-student", { date: slot().date });
  const sub = selectEvents(data, "development-student", {
    date: slot().date,
    scheduleId: sid,
  });
  assert.equal(main[0], sub[0]);
  data = await s.saveEvent(
    input({
      subScheduleId: sid,
      mustComplete: true,
      slot: slot("17:00", "18:00"),
    }),
    eid,
  );
  assert.equal(data.events.length, 1);
  assert.equal(
    selectEvents(data, "development-student", { scheduleId: sid })[0].slot
      .start,
    "17:00",
  );
  const reloaded = f.service();
  data = await reloaded.load();
  assert.equal(
    selectEvents(data, "development-student", {
      date: slot().date,
      focus: true,
    })[0].id,
    eid,
  );
  data = await reloaded.completeEvent(eid);
  assert.equal(selectEvents(data, "development-student").length, 0);
  assert.equal(
    selectEvents(data, "development-student", { history: true })[0].id,
    eid,
  );
  data = await f.service().load();
  assert.equal(data.events[0].originalSlot.start, "16:00");
  assert.ok(data.events[0].completedAt);
  assert.deepEqual(
    data.events[0].history.map((h) => h.kind),
    ["created", "edited", "completed"],
  );
});
test("partial, enclosing, contained and adjacent intervals; edit excludes itself", async () => {
  const s = fixture().service(),
    data = await s.saveEvent(input()),
    events = data.events;
  for (const candidate of [
    slot("15:30", "16:30"),
    slot("16:30", "17:30"),
    slot("15:00", "18:00"),
    slot("16:10", "16:20"),
  ])
    assert.equal(findConflicts(candidate, events, []).length, 1);
  for (const candidate of [slot("15:00", "16:00"), slot("17:00", "18:00")])
    assert.equal(findConflicts(candidate, events, []).length, 0);
  assert.equal(findConflicts(slot(), events, [], events[0].id).length, 0);
  assert.equal(
    (await s.saveEvent(input({ title: "Updated" }), events[0].id)).events[0]
      .title,
    "Updated",
  );
});
test("official sessions block conflicting intervals and cannot be altered by personal operations", async () => {
  const f = fixture(),
    s = f.service(),
    classes = await s.getOfficialClasses(slot().date);
  assert.equal(classes.length, 1);
  await assert.rejects(
    s.saveEvent(input({ slot: slot("08:00", "11:00") })),
    /Time conflict/,
  );
  await assert.rejects(s.saveEvent(input(), classes[0].id), /read-only/);
  await assert.rejects(s.completeEvent(classes[0].id), /read-only/);
  await assert.rejects(s.archiveEvent(classes[0].id), /read-only/);
  assert.deepEqual(await s.getOfficialClasses(slot().date), classes);
  assert.equal((await s.load()).events.length, 0);
});
test("completion is idempotent and preserves original plan and focus commitment", async () => {
  const s = fixture().service();
  let d = await s.saveEvent(input({ mustComplete: true }));
  const e = d.events[0];
  d = await s.completeEvent(e.id);
  const done = d.events[0].completedAt;
  d = await s.completeEvent(e.id);
  assert.equal(d.events[0].completedAt, done);
  assert.equal(
    d.events[0].history.filter((h) => h.kind === "completed").length,
    1,
  );
  assert.deepEqual(d.events[0].originalSlot, slot());
  assert.equal(d.events[0].history.at(-1)?.mustComplete, true);
});
test("Focus Mode depends on commitment, independently of priority", async () => {
  const s = fixture().service();
  await s.saveEvent(input({ priority: "high" }));
  const d = await s.saveEvent(
    input({
      priority: "low",
      mustComplete: true,
      slot: slot("18:00", "19:00"),
    }),
  );
  assert.equal(
    selectEvents(d, "development-student", { date: slot().date, focus: true })
      .length,
    1,
  );
  assert.equal(
    selectEvents(d, "development-student", {
      date: slot().date,
      focus: true,
    })[0].priority,
    "low",
  );
  assert.equal(
    selectEvents(d, "development-student", { date: slot().date }).length,
    2,
  );
});
test("moving date records original commitment and requires the new explicit focus choice", async () => {
  const s = fixture().service();
  let d = await s.saveEvent(input({ mustComplete: true }));
  const eid = d.events[0].id;
  d = await s.saveEvent(
    input({ slot: slot("16:00", "17:00", "2030-11-05"), mustComplete: false }),
    eid,
  );
  assert.equal(d.events[0].focusDate, undefined);
  assert.equal(d.events[0].history.at(-1)?.mustComplete, true);
  assert.equal(d.events[0].history.at(-1)?.planned.date, "2030-11-04");
  assert.equal(
    selectEvents(d, "development-student", { date: "2030-11-05", focus: true })
      .length,
    0,
  );
});
test("archive and restore preserve completed outcomes", async () => {
  const s = fixture().service();
  let d = await s.saveEvent(input());
  const eid = d.events[0].id;
  d = await s.completeEvent(eid);
  d = await s.archiveEvent(eid);
  assert.ok(d.events[0].archivedAt);
  d = await s.archiveEvent(eid, true);
  assert.equal(d.events[0].archivedAt, undefined);
  assert.equal(d.events[0].status, "completed");
  assert.equal(
    d.events[0].history.filter((h) => h.kind === "completed").length,
    1,
  );
});
test("time passing does not change status; moving into the past is rejected", async () => {
  const s = fixture().service();
  let d = await s.saveEvent(
    input({ slot: slot("16:00", "17:00", "2020-11-04") }),
  );
  assert.equal((await s.load()).events[0].status, "pending");
  await assert.rejects(
    s.saveEvent(
      input({ slot: slot("17:00", "18:00", "2020-11-04") }),
      d.events[0].id,
    ),
    /future time/,
  );
  d = await s.load();
  assert.equal(d.events[0].history.length, 1);
});
test("required fields, invalid dates, nonpositive duration and overnight times rejected", async () => {
  const s = fixture().service();
  for (const value of [
    input({ title: " " }),
    input({ description: "" }),
    input({ slot: slot("17:00", "16:00") }),
    input({ slot: slot("16:00", "16:00") }),
    input({ slot: slot("23:00", "01:00") }),
    input({ slot: slot("16:00", "17:00", "2030-02-30") }),
    input({ subScheduleId: "missing" }),
  ])
    await assert.rejects(s.saveEvent(value));
  assert.equal(validSlot(slot("24:00", "25:00")), false);
});
test("local date remains explicit across UTC boundary", () => {
  assert.deepEqual(localNow("Africa/Lagos", new Date("2030-11-04T23:30:00Z")), {
    date: "2030-11-05",
    time: "00:30",
  });
});
test("empty storage loads safely; invalid JSON and malformed records are never replaced", async () => {
  const f = fixture();
  f.setRaw(null);
  assert.deepEqual(await f.repo().load(), emptyDataset());
  for (const raw of [
    "{",
    JSON.stringify({ version: 2, events: [], schedules: [] }),
    JSON.stringify({ version: 1, events: [{ id: "bad" }], schedules: [] }),
  ]) {
    f.setRaw(raw);
    const repo = f.repo();
    await assert.rejects(repo.load());
    await assert.rejects(repo.save(emptyDataset()), /Load saved data/);
    assert.equal(f.raw, raw);
  }
});
test("malformed nested records, source and dangling schedules fail validation", async () => {
  const s = fixture().service(),
    d = await s.saveEvent(input());
  for (const mutate of [
    (x: typeof d) => {
      x.events[0].slot.end = "15:00";
    },
    (x: typeof d) => {
      x.events[0].history[0].at = "bad";
    },
    (x: typeof d) => {
      x.events[0].subScheduleId = "missing";
    },
    (x: typeof d) => {
      x.events[0].source = { kind: "habit", habitId: "", occurrenceId: "x" };
    },
    (x: typeof d) => {
      x.events[0].source = { kind: "task", taskId: "" };
    },
    (x: typeof d) => {
      x.events[0].focusDate = "2030-11-04";
    },
  ]) {
    const copy = structuredClone(d);
    mutate(copy);
    assert.throws(() => parseDataset(JSON.stringify(copy)));
  }
});
test("storage unavailable and failed writes surface errors and preserve saved data for retry", async () => {
  const f = fixture(),
    s = f.service();
  await s.saveEvent(input());
  const before = f.raw;
  f.failWrite(true);
  await assert.rejects(
    s.saveEvent(input({ slot: slot("18:00", "19:00") })),
    /Saving failed/,
  );
  assert.equal(f.raw, before);
  f.failWrite(false);
  assert.equal(
    (await s.saveEvent(input({ slot: slot("18:00", "19:00") }))).events.length,
    2,
  );
  f.failRead(true);
  await assert.rejects(s.load(), /unavailable/);
});
test("stale repository cannot silently overwrite another tab", async () => {
  const f = fixture(),
    a = f.repo(),
    b = f.repo();
  await a.load();
  await b.load();
  await a.save(emptyDataset());
  await assert.rejects(b.save(emptyDataset()), /another tab/);
});
