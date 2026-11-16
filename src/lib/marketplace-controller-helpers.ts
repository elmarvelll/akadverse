// Scope live Marketplace account checks to Marketplace consumers of the shared HTTP helpers.
export { runController, readJsonBody, serviceErrorResponse } from "./controller-helpers";
import { getActiveSession } from "./marketplace-session";
import { unauthorized } from "./service-error";

export async function requireSession() {
  const session = await getActiveSession();
  if (!session?.user?.id) throw unauthorized();
  return session;
}
export async function requireSessionUserId(): Promise<string> {
  return (await requireSession()).user.id;
}
