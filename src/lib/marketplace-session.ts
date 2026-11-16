// Marketplace-only access checks. Keep AkadVerse's session/cookies and academic access unchanged.
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/service-error";

export async function getActiveSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, marketplaceAccount: { select: { blocked: true } } },
  });
  if (!user) return null;
  if (user.role !== "student") throw forbidden("Marketplace is only available to students.");
  if (user.marketplaceAccount?.blocked) throw forbidden("Your Marketplace account has been blocked. Contact support if you believe this is a mistake.");
  return session;
}
