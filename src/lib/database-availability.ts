// Recognize connectivity/connection-pool failures from either generated Prisma client.
// Keep authorization, missing tables and other query errors out of this classification.
export function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; errorCode?: unknown };
  const code = value.code ?? value.errorCode;
  return typeof code === "string" && ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code);
}
