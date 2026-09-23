// services/marketplace/admin/get-user-detail.ts
//
// One user's detail for the admin Users tab and the new admin User
// Profile page (src/app/studashboard/admin/marketplace/users/[userId]/page.tsx)
// — never selects `password` or any auth secret. Includes the user's own
// businesses (not just a count) so the profile page can link straight
// through to each one — see
// services/marketplace/admin/get-business-detail-for-admin.ts. Called by
// src/app/api/marketplace/admin/users/[userId]/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/service-error";

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isAdmin: true,
      location: true,
      createdAt: true,
      businesses: { select: { id: true, name: true, approvalStatus: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { orders: true } },
      deliverer: { select: { status: true } },
    },
  });
  if (!user) throw notFound("User not found.");

  const { _count, deliverer, ...rest } = user;
  return {
    ...rest,
    createdAt: rest.createdAt.toISOString(),
    businessCount: rest.businesses.length,
    orderCount: _count.orders,
    delivererStatus: deliverer?.status ?? null,
  };
}
