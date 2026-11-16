import type { Db } from "@/services/marketplace/order/shared/db";
import { createTransactionalNotification } from "@/services/marketplace/notifications/notification.service";
import { isoDate } from "./shared/roster-calendar";
import { liveOrderWhere, loadOccurrenceUsage, usageKey, usedOf } from "./roster-capacity";
import { loadRosterWindow } from "./roster-resolution";

// Call inside the payment/assignment transaction. Each recipient's notification
// commits with the change; deterministic IDs make retries safe even across jobs.
export async function notifyOverflowAssignments(tx: Db, orderIds: string[]) {
  if (!orderIds.length) return;
  const plans = await tx.scheduledDelivery.findMany({ where: { operation: "MARKETPLACE", isOverflow: true, orderId: { in: orderIds } } });
  if (!plans.length) return;
  const [admins, people, orders] = await Promise.all([
    tx.user.findMany({ where: { isAdmin: true }, select: { id: true } }),
    tx.deliverer.findMany({ where: { status: "APPROVED", id: { in: plans.map((p) => p.plannedDelivererId).filter((id): id is string => !!id) } } }),
    tx.order.findMany({ where: { ...liveOrderWhere(), id: { in: orderIds }, paymentStatus: "paid" }, select: { id: true, business: { select: { name: true } } } }),
  ]);
  for (const date of Array.from(new Map(plans.map((p) => [isoDate(p.date), p.date])).values())) {
    const [window, usage] = await Promise.all([
      loadRosterWindow("MARKETPLACE", date, 1, tx),
      loadOccurrenceUsage("MARKETPLACE", date, date, tx),
    ]);
    const open = window.slots.filter((s) => s.active && !window.occurrence(s.id, date).closed && window.occurrence(s.id, date).limit !== 0);
    // Never raise an overflow alert while any regular capacity remains. The
    // stored flag preserves the original allocation if capacity later changes.
    if (!open.length || open.some((s) => {
      const limit = window.occurrence(s.id, date).limit;
      const used = usage.get(usageKey(s.id, date));
      return limit === null || usedOf(used) - (used?.overflow ?? 0) < limit;
    })) continue;
    const overflowCount = Array.from(usage.values()).reduce((n, u) => n + (u.overflow ?? 0), 0);
    const affected = window.slots.filter((s) => (usage.get(usageKey(s.id, date))?.overflow ?? 0) > 0)
      .map((s) => `${s.label} (${s.windowStart}–${s.windowEnd})`).join(", ");
    for (const plan of plans.filter((p) => isoDate(p.date) === isoDate(date))) {
      const order = orders.find((o) => o.id === plan.orderId);
      const slot = window.slots.find((s) => s.id === plan.slotId);
      if (!order || !slot) continue;
      const person = people.find((p) => p.id === plan.plannedDelivererId);
      const message = `${isoDate(date)}: all regular slots are full; ${overflowCount} overflow deliveries. Affected slots: ${affected}. Extra Business delivery: order ${order.id}, ${order.business.name}, ${slot.label} ${slot.windowStart}–${slot.windowEnd}. Deliverer: ${person ? `${person.firstName} ${person.lastName}` : "awaiting staffing"}.`;
      for (const admin of admins) await createTransactionalNotification(tx, `overflow:${plan.id}:admin:${admin.id}`, {
        recipientId: admin.id, scope: "ADMIN", type: "DELIVERY_OVERFLOW", title: "Delivery capacity exceeded", message,
        targetUrl: "/studashboard/admin/marketplace/deliveries/businesses", orderId: order.id,
      });
      if (person) await createTransactionalNotification(tx, `overflow:${plan.id}:deliverer:${person.id}`, {
        recipientId: person.userId, type: "DELIVERY_OVERFLOW", title: "Extra delivery assignment", message,
        targetUrl: "/studashboard/marketplace/deliverer", orderId: order.id,
      });
    }
  }
}
