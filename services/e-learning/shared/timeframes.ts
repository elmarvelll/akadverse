// services/e-learning/shared/timeframes.ts
//
// AGENTS.md §27: academic deadlines (course registration, result upload, etc.) are
// DAPU-controlled database rows, never hard-coded dates in frontend code. Every action that
// depends on one checks it HERE, on the server, against the SERVER clock — a time or state
// sent by the browser is never consulted.
//
// The two timestamps are the only source of truth (there is deliberately no isActive flag
// that could go stale):
//   now <  startAt            -> UPCOMING
//   startAt <= now < endAt    -> ACTIVE
//   now >= endAt              -> ENDED
//   no row for the period     -> NOT_CONFIGURED (treated as closed — never "no deadline")

import { elearningDb } from "@/lib/db/elearning";
import type { TimeFrameType } from "@/generated/prisma-elearning";

export type TimeFramePhase = "NOT_CONFIGURED" | "UPCOMING" | "ACTIVE" | "ENDED";

export function phaseAt(now: Date, startAt: Date, endAt: Date): TimeFramePhase {
  if (now < startAt) return "UPCOMING";
  if (now < endAt) return "ACTIVE";
  return "ENDED";
}

export async function getTimeFrame(type: TimeFrameType, academicSessionId: string, semesterId: string, now: Date = new Date()) {
  const row = await elearningDb.academicTimeFrame.findUnique({
    where: { type_academicSessionId_semesterId: { type, academicSessionId, semesterId } },
  });
  if (!row) return { phase: "NOT_CONFIGURED" as const, startAt: null, endAt: null, now };
  return { phase: phaseAt(now, row.startDate, row.endDate), startAt: row.startDate, endAt: row.endDate, now };
}

export async function getActiveTimeFrame(type: TimeFrameType, academicSessionId: string, semesterId: string) {
  const t = await getTimeFrame(type, academicSessionId, semesterId);
  return t.phase === "ACTIVE" ? t : null;
}

export async function isTimeFrameOpen(type: TimeFrameType, academicSessionId: string, semesterId: string): Promise<boolean> {
  return (await getTimeFrame(type, academicSessionId, semesterId)).phase === "ACTIVE";
}
