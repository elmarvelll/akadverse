// Retain AkadVerse's configured admin identity while rechecking database-backed admin grants per request.
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { isAdminEmail } from "./admin-identity";
import { prisma } from "./prisma";
import { forbidden, unauthorized } from "./service-error";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw unauthorized();
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true, email: true } });
  if (!user || (!user.isAdmin && !isAdminEmail(user.email))) throw forbidden("Admin access required.");
  return session;
}
