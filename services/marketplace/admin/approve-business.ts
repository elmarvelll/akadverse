// services/marketplace/admin/approve-business.ts
//
// Admin approves a PENDING_APPROVAL business — the business becomes live
// on the marketplace (visible in search/listings, able to accept orders)
// and the owner is emailed + notified. Idempotent-ish: approving an
// already-approved business just updates the timestamp again rather than
// erroring, so a double-click can't corrupt state. Called by
// src/app/api/marketplace/admin/businesses/[businessId]/approve/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/service-error";
import { logAdminAction } from "./shared/log-admin-action";
import { sendEmail, businessApprovedEmail } from "@/services/marketplace/notifications/email.service";
import { createNotification } from "@/services/marketplace/notifications/notification.service";

export async function approveBusiness(businessId: string, adminUserId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, userId: true, user: { select: { email: true } } },
  });
  if (!business) throw notFound("Business not found.");

  await prisma.business.update({
    where: { id: businessId },
    data: { approvalStatus: "APPROVED", approvedAt: new Date(), approvedBy: adminUserId, rejectedAt: null, rejectionReason: null },
  });
  await logAdminAction({ adminId: adminUserId, action: "BUSINESS_APPROVED", targetType: "business", targetId: businessId, message: business.name });

  if (business.user?.email) {
    void sendEmail({ to: business.user.email, ...businessApprovedEmail({ businessName: business.name, businessId }) });
  }
  await createNotification({
    recipientId: business.userId,
    type: "BUSINESS_APPROVED",
    title: "Business approved",
    message: `${business.name} has been approved and is now live on the marketplace.`,
    targetUrl: `/studashboard/marketplace/business/${businessId}`,
    businessId,
  });
}
