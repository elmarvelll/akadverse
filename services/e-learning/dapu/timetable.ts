// services/e-learning/dapu/timetable.ts
//
// DAPU — Timetable Review / Approve / Send to HODs (AGENTS.md §28).
// "Send to HODs" isn't a separate stored state: once `isApproved` is true,
// a HOD's faculty immediately see the entry on their own dashboard (see
// services/e-learning/faculty/timetable.ts, which only reads approved
// entries) — there's no separate distribution/notification artifact
// described in the spec to model, so Approve and "Send to HODs" are the
// same action here rather than an invented extra step.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";
import type { DayOfWeek } from "@/generated/prisma-elearning";

export async function listPendingTimetableEntries(academicSessionId: string, semesterId: string) {
  return elearningDb.timetableEntry.findMany({
    where: { academicSessionId, semesterId, isApproved: false },
    include: { course: { include: { department: true } } },
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function listApprovedTimetableEntries(academicSessionId: string, semesterId: string) {
  return elearningDb.timetableEntry.findMany({
    where: { academicSessionId, semesterId, isApproved: true },
    include: { course: { include: { department: true } } },
    orderBy: { dayOfWeek: "asc" },
  });
}

export async function createTimetableEntry(params: {
  courseId: string;
  academicSessionId: string;
  semesterId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  venue: string;
}) {
  if (!params.venue.trim()) throw badRequest("Venue is required.");
  return elearningDb.timetableEntry.create({ data: params });
}

export async function approveTimetableEntry(entryId: string) {
  return elearningDb.timetableEntry.update({ where: { id: entryId }, data: { isApproved: true } });
}
