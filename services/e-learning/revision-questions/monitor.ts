export interface RevisionLogMetadata {
  correlationId: string; eventId?: string; teachingEventId?: string; conceptId?: string; studentId?: string; idempotencyKey?: string;
  failureCode?: string; invalidField?: string; durationMs?: number; generatedCount?: number; createdCount?: number; reusedCount?: number; rejectedCount?: number; cardsCreated?: number;
}
export function revisionLog(event: string, m: RevisionLogMetadata) {
  // Explicit allowlist; no questions, answers, raw bodies, signatures, credentials or provider exceptions.
  console.info("[revision-questions]", { event, correlationId: m.correlationId, eventId: m.eventId, teachingEventId: m.teachingEventId, conceptId: m.conceptId, studentId: m.studentId, idempotencyKey: m.idempotencyKey, failureCode: m.failureCode, invalidField: m.invalidField, durationMs: m.durationMs, generatedCount: m.generatedCount, createdCount: m.createdCount, reusedCount: m.reusedCount, rejectedCount: m.rejectedCount, cardsCreated: m.cardsCreated });
}
