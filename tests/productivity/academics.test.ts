import { it, mock } from "node:test";
import assert from "node:assert/strict";
const context = { session: { id: "current-session" }, semester: { id: "current-semester", name: "Semester", startDate: new Date("2030-01-01"), endDate: new Date("2030-06-30") } };
const calls: unknown[] = [];
const nameOptions: boolean[] = [];
mock.module("@/lib/db/elearning", { namedExports: { elearningDb: { timetableEntry: { async findMany(input: unknown) {
  calls.push(input); return [{ id: "published-entry", courseId: "registered-course", dayOfWeek: "TUESDAY", startTime: "00:30", endTime: "01:30", venue: "Lecture hall" }];
} } } } });
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => context } });
mock.module("@/services/e-learning/student/registered-courses", { namedExports: { getRegisteredCourses: async (ownerId: string, _context: unknown, options: { includeLecturerNames: boolean }) => {
  nameOptions.push(options.includeLecturerNames);
  assert.equal(ownerId, "authenticated-user"); return [{ id: "registered-course", code: "CSC", title: "Computing", lecturerName: "Assigned lecturer" }];
} } });
it("uses approved registered-course scope, converts campus dates and reuses one request-local timetable read", async () => {
  const { officialClasses } = await import("@/services/productivity-layer/academics"); const cache = {};
  const mondayInNewYork = await officialClasses("authenticated-user", "2030-01-14", "America/New_York", cache);
  assert.equal(mondayInNewYork.length, 1); assert.equal(mondayInNewYork[0].slot.start, "18:30");
  assert.equal(mondayInNewYork[0].slot.date, "2030-01-14"); assert.equal(mondayInNewYork[0].sourceId, "published-entry:2030-01-15");
  await officialClasses("authenticated-user", "2030-01-15", "America/New_York", cache); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { where: { courseId: { in: ["registered-course"] }, academicSessionId: "current-session", semesterId: "current-semester", isApproved: true } });
});


it("separates conflict-only timetable reads from display reads without dropping class conflicts", async () => {
  const { officialClasses } = await import("@/services/productivity-layer/academics");
  const cache = {};
  const conflictRows = await officialClasses("authenticated-user", "2030-01-15", "Africa/Lagos", cache, { includeLecturerNames: false });
  assert.equal(nameOptions.at(-1), false);
  assert.equal(conflictRows.length, 1);
  assert.equal(conflictRows[0].slot.start, "00:30");
  const count = nameOptions.length;
  await officialClasses("authenticated-user", "2030-01-15", "Africa/Lagos", cache, { includeLecturerNames: false });
  assert.equal(nameOptions.length, count);
  await officialClasses("authenticated-user", "2030-01-15", "Africa/Lagos", cache);
  assert.equal(nameOptions.at(-1), true);
  assert.equal(nameOptions.length, count + 1);
});
