// services/marketplace/business/business-ownership.service.ts
//
// Shared "does this business belong to this signed-in user" check, used by
// every owner-scoped controller (business profile, products, orders,
// fines) so a business's dashboard data is only ever readable/writable by
// its owner. Throws ServiceError (401/404) rather than returning a
// NextResponse — see src/lib/service-error.ts and
// src/lib/controller-helpers.ts for how controllers turn that into the
// right HTTP response.

import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized, notFound } from "@/lib/service-error";

export interface OwnedBusiness {
  session: Session;
  businessId: string;
}

export async function requireOwnedBusiness(businessId: string): Promise<OwnedBusiness> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw unauthorized();
  }

  const business = await prisma.business.findFirst({
    where: { id: businessId, userId: session.user.id },
    select: { id: true },
  });
  if (!business) {
    throw notFound("Business not found.");
  }

  return { session, businessId: business.id };
}
