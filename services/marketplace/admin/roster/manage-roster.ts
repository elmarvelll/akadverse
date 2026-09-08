// services/marketplace/admin/roster/manage-roster.ts
//
// Admin's deliverer roster (spec §15-19) — who is on duty for which
// VendorDeliverySlot on which date, independent of any specific order.
// Completely separate from VendorTimeframeCapacity (a vendor's own
// order-fulfillment ceiling) — see
// docs/marketplace/decisions/vendor-independent-architecture.md.
// VendorDeliverySlot.delivererCapacity is the "positions available"
// number this reads against; "filled" is a live count of this table.
// Called by
// src/app/api/marketplace/admin/vendor-delivery/roster/route.controller.ts.

import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/service-error";
import { logAdminAction } from "@/services/marketplace/admin/shared/log-admin-action";
import { createNotification } from "@/services/marketplace/notifications/notification.service";
import { DELIVERER_ARRIVAL_LEAD_MINS, formatArrivalTime } from "@/services/marketplace/vendor-delivery/deliverer-arrival";

export interface RosterSlotRow {
  slotId: string;
  slotLabel: string;
  windowStart: string;
  windowEnd: string;
  capacity: number;
  assignments: {
    id: string;
    delivererId: string;
    delivererName: string;
    status: string;
    arrivedAt: string | null;
  }[];
}

function parseDate(dateStr: string | undefined): Date {
  const trimmed = dateStr?.trim();
  if (!trimmed) throw badRequest("date is required.");
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw badRequest('date must be "YYYY-MM-DD".');
  return parsed;
}

export async function listRosterForDate(dateStr: string): Promise<RosterSlotRow[]> {
  const date = parseDate(dateStr);

  const [slots, assignments] = await Promise.all([
    prisma.vendorDeliverySlot.findMany({ where: { active: true }, orderBy: { windowStart: "asc" } }),
    prisma.delivererRosterAssignment.findMany({
      where: { date, status: { not: "CANCELLED" } },
      select: {
        id: true,
        slotId: true,
        delivererId: true,
        status: true,
        arrivedAt: true,
        deliverer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return slots.map((slot) => ({
    slotId: slot.id,
    slotLabel: slot.label,
    windowStart: slot.windowStart,
    windowEnd: slot.windowEnd,
    capacity: slot.delivererCapacity,
    assignments: assignments
      .filter((a) => a.slotId === slot.id)
      .map((a) => ({
        id: a.id,
        delivererId: a.delivererId,
        delivererName: `${a.deliverer.firstName} ${a.deliverer.lastName}`,
        status: a.status,
        arrivedAt: a.arrivedAt?.toISOString() ?? null,
      })),
  }));
}

export async function assignDelivererToRoster(dateStr: string, slotId: string, delivererId: string, adminUserId: string) {
  const date = parseDate(dateStr);

  const [slot, deliverer] = await Promise.all([
    prisma.vendorDeliverySlot.findUnique({ where: { id: slotId } }),
    prisma.deliverer.findUnique({ where: { id: delivererId }, select: { id: true, status: true, userId: true, firstName: true } }),
  ]);
  if (!slot || !slot.active) throw notFound("Delivery slot not found.");
  if (!deliverer || deliverer.status !== "APPROVED") throw badRequest("Deliverer not found or not approved.");

  const existingForDeliverer = await prisma.delivererRosterAssignment.findFirst({
    where: { delivererId, slotId, date, status: { not: "CANCELLED" } },
  });
  if (existingForDeliverer) throw conflict("This deliverer is already rostered for this slot/date.");

  const filled = await prisma.delivererRosterAssignment.count({ where: { slotId, date, status: { not: "CANCELLED" } } });
  if (filled >= slot.delivererCapacity) throw conflict("This timeframe's deliverer positions are already full.");

  const assignment = await prisma.delivererRosterAssignment.create({
    data: { delivererId, slotId, date, assignedBy: adminUserId },
  });

  await logAdminAction({
    adminId: adminUserId,
    action: "DELIVERER_ROSTER_ASSIGNED",
    targetType: "deliverer_roster_assignment",
    targetId: assignment.id,
    message: `${slot.label} on ${dateStr}`,
  });

  await createNotification({
    recipientId: deliverer.userId,
    type: "ROSTER_ASSIGNED",
    title: "You're on the roster",
    message: `You've been scheduled for ${slot.label} on ${dateStr}. Arrive by ${formatArrivalTime(slot.windowStart)} (${DELIVERER_ARRIVAL_LEAD_MINS} minutes early).`,
    targetUrl: "/studashboard/marketplace/deliverer",
  });

  return assignment;
}

export async function cancelRosterAssignment(assignmentId: string, adminUserId: string) {
  const existing = await prisma.delivererRosterAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, status: true, deliverer: { select: { userId: true } }, slot: { select: { label: true } } },
  });
  if (!existing) throw notFound("Roster assignment not found.");

  await prisma.delivererRosterAssignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
  await logAdminAction({
    adminId: adminUserId,
    action: "DELIVERER_ROSTER_CANCELLED",
    targetType: "deliverer_roster_assignment",
    targetId: assignmentId,
  });

  await createNotification({
    recipientId: existing.deliverer.userId,
    type: "ROSTER_CANCELLED",
    title: "Roster assignment cancelled",
    message: `Your ${existing.slot.label} assignment was cancelled by an admin.`,
    targetUrl: "/studashboard/marketplace/deliverer",
  });
}
