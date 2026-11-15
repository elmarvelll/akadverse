import { Prisma } from "@prisma/client";
import { ServiceError } from "@/lib/service-error";
import { ProductivityError } from "@/features/productivity/errors";
import { SlotConflictError } from "@/features/productivity/schedule/domain";

export class OfficialTimetableError extends Error {
  constructor(public readonly cause: unknown) { super("Official timetable dependency failed"); }
}

/** Only these bounded messages leave the server; never return error.message from Prisma. */
export function publicProductivityError(error: unknown): { status: number; code: string; error: string; conflicts?: SlotConflictError["conflicts"]; dependency?: "official-timetable" } {
  if (error instanceof OfficialTimetableError) {
    const failure = publicProductivityError(error.cause);
    return { ...failure, dependency: "official-timetable", error: `The official timetable service failed. ${failure.error}` };
  }
  if (error instanceof SlotConflictError) return { status: 409, code: "SLOT_CONFLICT", error: error.message, conflicts: error.conflicts };
  if (error instanceof ServiceError) return { status: error.status, code: ({ 400: "INVALID_INPUT", 401: "SIGN_IN_REQUIRED", 403: "ACCESS_DENIED", 404: "RECORD_NOT_FOUND", 409: "RECORD_CONFLICT" } as Record<number, string>)[error.status] || "REQUEST_FAILED", error: error.message };
  if (error instanceof ProductivityError) return { status: 400, code: error.code, error: error.message };

  // The host's E-Learning client has its own generated Prisma runtime, so its
  // error classes can have a different identity from the core client's classes.
  const initialization = error instanceof Prisma.PrismaClientInitializationError || error instanceof Error && error.name === "PrismaClientInitializationError";
  const known = error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Error && error.name === "PrismaClientKnownRequestError";
  const databaseError = initialization || known;
  const code = error instanceof Error ? known && "code" in error ? error.code : initialization && "errorCode" in error ? error.errorCode : undefined : undefined;
  if (databaseError) {
    if (code === "P2021" || code === "P2022") return { status: 503, code: "DATABASE_SCHEMA_MISSING", error: "The database is missing tables or columns required by this application. Ask the developer to apply the database migrations, then reload the workspace." };
    if (code === "P1000" || code === "P1010") return { status: 503, code: "DATABASE_ACCESS_DENIED", error: "The application cannot authenticate to the database or lacks permission to use it. Ask the developer to check the server's database credentials and permissions." };
    if (code === "P1001" || code === "P1002" || code === "P1017") return { status: 503, code: "DATABASE_UNAVAILABLE", error: "The application cannot reach the database. It may be stopped or unavailable. Try again shortly; in local development, check that PostgreSQL is running." };
    if (code === "P1003") return { status: 503, code: "DATABASE_NOT_FOUND", error: "The configured database does not exist. Ask the developer to create the development database or correct the server's database configuration." };
    if (code === "P1008" || code === "P2024" || code === "P2028") return { status: 503, code: "DATABASE_TIMEOUT", error: "The database did not finish this request in time. Retry the same action; do not create a second copy of the item." };
    if (code === "P2002") return { status: 409, code: "DUPLICATE_RECORD", error: "A record with this unique value already exists. Reload your records and use a different category name if needed." };
    if (code === "P2003" || code === "P2025") return { status: 409, code: "RELATED_RECORD_MISSING", error: "A related task, habit, event, or category is no longer available. Reload the workspace and select an existing record." };
    if (code === "P2034") return { status: 409, code: "CONCURRENT_UPDATE", error: "Another request changed these records at the same time. Reload the workspace and retry your change." };
    if (initialization) return { status: 503, code: "DATABASE_CONFIGURATION", error: "The database connection could not be initialized. Ask the developer to check the server's database environment settings and restart the application." };
  }
  return { status: 500, code: "UNEXPECTED_ERROR", error: "An unexpected server error prevented this request from completing. Retry the same action. If it continues, give the error reference to the developer." };
}
