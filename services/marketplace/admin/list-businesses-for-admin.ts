// services/marketplace/admin/list-businesses-for-admin.ts
//
// Paginated, searchable, filterable business list — serves the
// Businesses tab (no filter / pending_approval), and the Verifications tab
// (filter=pending_verification — businesses with a currently PENDING
// BusinessVerificationRequest, not just "verified: false" — see
// docs/marketplace/systems/admin-system.md for the distinction). Called by
// src/app/api/marketplace/admin/businesses/route.controller.ts.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePageParams, toPageResult, type PageResult } from "./shared/pagination";

export interface AdminBusinessRow {
  id: string;
  name: string;
  industry: string;
  ownerEmail: string;
  approvalStatus: string;
  rejectionReason: string | null;
  verified: boolean;
  blocked: boolean;
  deliveryRestricted: boolean;
  createdAt: string;
}

export type BusinessAdminFilter = "all" | "pending_approval" | "pending_verification" | "verified" | "blocked";

export async function listBusinessesForAdmin(searchParams: URLSearchParams): Promise<PageResult<AdminBusinessRow>> {
  const pageParams = parsePageParams(searchParams);
  const q = searchParams.get("q")?.trim();
  const filter = (searchParams.get("filter") as BusinessAdminFilter | null) ?? "all";

  const where: Prisma.BusinessWhereInput = {
    ...(q ? { OR: [{ name: { contains: q } }, { industry: { contains: q } }] } : {}),
    ...(filter === "pending_approval" ? { approvalStatus: "PENDING_APPROVAL" } : {}),
    ...(filter === "pending_verification" ? { verificationRequests: { some: { status: "PENDING" } } } : {}),
    ...(filter === "verified" ? { verified: true } : {}),
    ...(filter === "blocked" ? { blocked: true } : {}),
  };

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where,
      select: {
        id: true,
        name: true,
        industry: true,
        approvalStatus: true,
        rejectionReason: true,
        verified: true,
        blocked: true,
        deliveryRestricted: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (pageParams.page - 1) * pageParams.pageSize,
      take: pageParams.pageSize,
    }),
    prisma.business.count({ where }),
  ]);

  return toPageResult(
    businesses.map(({ user, createdAt, ...rest }) => ({ ...rest, ownerEmail: user.email, createdAt: createdAt.toISOString() })),
    total,
    pageParams
  );
}
