import { elearningDb } from "@/lib/db/elearning";
import type { Prisma } from "@/generated/prisma-elearning";
import type { CallRecord, CallStore } from "./client";

/** Traceability only: no learning credit tariff/ledger exists, so no guessed financial postings. */
export const learningCallStore: CallStore = {
  async claim(record) {
    try {
      await elearningDb.aiCallLog.create({ data: { requestId: record.requestId, operation: record.operation, requestHash: record.requestHash, studentId: record.studentId, courseId: record.courseId, status: "PENDING" } });
      return { claimed: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
      const existing = await elearningDb.aiCallLog.findUniqueOrThrow({ where: { requestId: record.requestId } });
      return { claimed: false, record: existing as CallRecord };
    }
  },
  async complete(requestId, data) {
    // Only the internal client constructs these fields; JSON values are private backend cache entries.
    await elearningDb.aiCallLog.update({ where: { requestId }, data: data as Prisma.AiCallLogUpdateInput });
  },
};
