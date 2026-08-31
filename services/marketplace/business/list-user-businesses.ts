// services/marketplace/business/list-user-businesses.ts
//
// The current user's own businesses, for the navbar's "My Businesses"
// dropdown. Called by
// src/app/api/marketplace/businesses/route.controller.ts.

import { prisma } from "@/lib/prisma";

export async function listUserBusinesses(userId: string) {
  const businesses = await prisma.business.findMany({
    where: { userId },
    select: { id: true, name: true, industry: true, secure_url: true, approvalStatus: true },
    orderBy: { createdAt: "desc" },
  });
  return businesses.map(({ secure_url, ...rest }) => ({ ...rest, secureUrl: secure_url }));
}
