import { prisma } from "@/lib/prisma";
import { LIVE_ITEM, liveOrderWhere, loadOccurrenceUsage, usageKey, usedOf } from "@/services/marketplace/delivery-roster/roster-capacity";
import { loadRosterWindow } from "@/services/marketplace/delivery-roster/roster-resolution";
import { addDays, isoDate } from "@/services/marketplace/delivery-roster/shared/roster-calendar";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import type { DelivererScheduleRow } from "@/lib/delivery-schedule";

// Read the signed-in deliverer's planned and actual schedule. Actual item
// ownership wins after dispatch, including legacy assignments without a plan.
export async function listMySchedule(delivererId: string): Promise<DelivererScheduleRow[]> {
  const [assigned, person] = await Promise.all([
    prisma.orderItem.findMany({ where: { deliveryStatus: { not: null }, deliveryItem: { delivery: { deliverymanId: delivererId } } },
      select: { orderId: true, order: { select: { vendorDeliveryBookingId: true } } } }),
    prisma.deliverer.findUnique({ where: { id: delivererId }, select: { firstName: true, lastName: true } }),
  ]);
  const plans = await prisma.scheduledDelivery.findMany({ where: { OR: [
    { plannedDelivererId: delivererId, date: { gte: addDays(todayInSchoolTimezone(), -30) } },
    { orderId: { in: assigned.map((i) => i.orderId) } },
    { bookingId: { in: assigned.map((i) => i.order.vendorDeliveryBookingId).filter((id): id is string => !!id) } },
  ] }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  if (!plans.length) return [];
  const orders = await prisma.order.findMany({ where: { ...liveOrderWhere(), paymentStatus: "paid", OR: [
    { id: { in: plans.map((p) => p.orderId).filter((id): id is string => !!id) } },
    { vendorDeliveryBookingId: { in: plans.map((p) => p.bookingId).filter((id): id is string => !!id) }, vendorDeliveryBooking: { status: "CONFIRMED" } },
  ] }, select: { id: true, vendorDeliveryBookingId: true, business: { select: { name: true } },
    items: { where: LIVE_ITEM, select: { deliveryStatus: true, deliveryItem: { select: { status: true, delivery: { select: { deliverymanId: true } } } } } } } });
  const from = plans[0].date;
  const to = plans[plans.length - 1].date;
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const contexts = new Map(await Promise.all(Array.from(new Set(plans.map((p) => p.operation))).map(async (operation) => {
    const [window, usage] = await Promise.all([loadRosterWindow(operation, from, days), loadOccurrenceUsage(operation, from, to)]);
    return [operation, { window, usage }] as const;
  })));
  const rows: DelivererScheduleRow[] = [];
  for (const plan of plans) {
    const related = orders.filter((o) => (plan.orderId ? o.id === plan.orderId : o.vendorDeliveryBookingId === plan.bookingId) && o.items.some((i) =>
      i.deliveryStatus !== null ? i.deliveryItem?.delivery.deliverymanId === delivererId : plan.plannedDelivererId === delivererId));
    if (!related.length) continue;
    const own = related.flatMap((o) => o.items).filter((i) => i.deliveryStatus !== null && i.deliveryItem?.delivery.deliverymanId === delivererId);
    const { window, usage } = contexts.get(plan.operation)!;
    const slot = window.slots.find((s) => s.id === plan.slotId);
    if (!slot) continue;
    const occurrence = window.occurrence(plan.slotId, plan.date);
    const statuses: string[] = own.map((i) => i.deliveryItem!.status);
    if (plan.plannedDelivererId === delivererId && related.some((o) => o.items.some((i) => i.deliveryStatus === null))) statuses.push("PLANNED");
    const status = statuses.length === 0 || statuses.every((s) => s === "PLANNED") ? "PLANNED" : statuses.every((s) => s === "DELIVERED") ? "DELIVERED"
      : statuses.includes("OUT_FOR_DELIVERY") ? "OUT_FOR_DELIVERY" : statuses.includes("PICKED_UP") ? "PICKED_UP" : statuses.includes("ASSIGNED") ? "ASSIGNED" : "FAILED";
    const used = usage.get(usageKey(slot.id, plan.date));
    rows.push({ id: plan.id, operation: plan.operation, date: isoDate(plan.date), slotId: slot.id,
      slotLabel: slot.label, windowStart: slot.windowStart, windowEnd: slot.windowEnd,
      isOverflow: plan.isOverflow, limit: occurrence.limit,
      full: occurrence.limit !== null && usedOf(used) - (used?.overflow ?? 0) >= occurrence.limit,
      dispatched: own.length > 0, status, delivererName: person ? `${person.firstName} ${person.lastName}` : "You",
      orderIds: related.map((o) => o.id), businessNames: Array.from(new Set(related.map((o) => o.business.name))) });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.windowStart.localeCompare(b.windowStart) || a.id.localeCompare(b.id));
}
