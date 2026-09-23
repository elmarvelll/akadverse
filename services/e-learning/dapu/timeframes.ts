// services/e-learning/dapu/timeframes.ts
//
// DAPU — Academic Time Frames (AGENTS.md §27): the write side of
// services/e-learning/timeframes.ts's read-only checks. Every deadline
// (course registration, result upload, etc.) is a database row DAPU sets
// here — never hard-coded in the frontend, and every action that depends
// on one (student registration, faculty result submission) checks it
// server-side already.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";
import type { TimeFrameType } from "@/generated/prisma-elearning";

export async function listTimeFrames(academicSessionId: string) {
  return elearningDb.academicTimeFrame.findMany({
    where: { academicSessionId },
    include: { semester: true },
    orderBy: { type: "asc" },
  });
}

export async function upsertTimeFrame(
  type: TimeFrameType,
  academicSessionId: string,
  semesterId: string,
  startDate: Date,
  endDate: Date
) {
  if (endDate <= startDate) throw badRequest("The end must be after the start.");
  // One row per period type + session + semester (a unique key), so two periods can never overlap.
  const sem = await elearningDb.semester.findUnique({ where: { id: semesterId }, select: { academicSessionId: true } });
  if (!sem || sem.academicSessionId !== academicSessionId) throw badRequest("That semester doesn't belong to the selected session.");

  return elearningDb.academicTimeFrame.upsert({
    where: { type_academicSessionId_semesterId: { type, academicSessionId, semesterId } },
    update: { startDate, endDate },
    create: { type, academicSessionId, semesterId, startDate, endDate },
  });
}
