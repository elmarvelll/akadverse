import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, forbidden } from "@/lib/service-error";
import { timed } from "./diagnostics";

export async function requireProductivityUser(expectedUserId?: string | null) {
  const session = await timed("auth.session", () => getServerSession(authOptions));
  if (!session?.user?.id) throw unauthorized("Your session is missing or expired. Sign in again to open your workspace.");
  if (expectedUserId && expectedUserId !== session.user.id) throw unauthorized("Your account changed. Reload your workspace.");
  const user = await timed("auth.user", () => prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, firstName: true, lastName: true, email: true, role: true } }));
  if (!user) throw unauthorized("The account linked to this session no longer exists. Sign in again with an existing student account.");
  // This feature is mounted in the existing student workspace. It has no
  // institution-wide/admin sharing scope, nor access to other students' data.
  if (user.role !== "student") throw forbidden("Productivity Layer is available in the student workspace.");
  return user;
}
