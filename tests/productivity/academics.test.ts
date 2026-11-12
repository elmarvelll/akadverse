import { it, mock } from "node:test";
import assert from "node:assert/strict";
const context = { session: { id: "current-session" }, semester: { id: "current-semester", name: "Semester", startDate: new Date("2030-01-01"), endDate: new Date("2030-06-30") } };
const calls: unknown[] = [];
mock.module("@/lib/db/elearning", { namedExports: { elearningDb: { timetableEntry: { async findMany(input: unknown) {
  calls.push(input); return [{ id: "published-entry", courseId: "registered-course", dayOfWeek: "TUESDAY", startTime: "00:30", endTime: "01:30", venue: "Lecture hall" }];
} } } } });
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => context } });
mock.module("@/services/e-learning/student/registered-courses", { namedExports: { getRegisteredCourses: async (ownerId: string) => {
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
