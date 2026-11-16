import { prisma } from "@/lib/prisma";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import { SCHOOL_TIMEZONE } from "@/services/marketplace/vendor-delivery/is-slot-bookable";
import { LIVE_ITEM } from "./roster-capacity";
import { getRosterWeek } from "./roster-views";
import { isoDate, schoolWallClockToInstant } from "./shared/roster-calendar";

export interface DeliveryMetrics {
  total: number;
  today: number;
  upcoming: number;
  pending: number;
  completed: number;
  overdue: number;
  overflow: number;
  fullyOccupiedSlots: number;
  rosteredPersonnel: number;
}

// One Business order or one Vendor booking is one delivery. Multi-vendor
// checkouts count once. Paid live orders only; reservation occupancy is shown
// separately by the existing roster, using its canonical capacity calculation.
export async function getDeliveryOverview(now = new Date()) {
  const today = isoDate(todayInSchoolTimezone(now));
  const [orders, plans, businessWeek, vendorWeek, approvedPersonnel] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "paid", status: { in: ["PENDING_SELLER", "ACCEPTED"] }, items: { some: LIVE_ITEM } },
      select: { id: true, vendorDeliveryBookingId: true, deliveryWindowEnd: true, estimatedDeliveryAt: true,
        vendorDeliveryBooking: { select: { bookedFor: true, status: true, slot: { select: { windowEnd: true } } } },
        items: { where: LIVE_ITEM, select: { deliveryStatus: true } } },
    }),
    prisma.scheduledDelivery.findMany({ select: { orderId: true, bookingId: true, isOverflow: true, date: true } }),
    getRosterWeek("MARKETPLACE"), getRosterWeek("VENDOR"),
    prisma.deliverer.count({ where: { status: "APPROVED" } }),
  ]);
  const planOfOrder = new Map(plans.filter((p) => p.orderId).map((p) => [p.orderId!, p]));
  const planOfBooking = new Map(plans.filter((p) => p.bookingId).map((p) => [p.bookingId!, p]));
  const metrics = (week: typeof businessWeek): DeliveryMetrics => ({
    total: 0, today: 0, upcoming: 0, pending: 0, completed: 0, overdue: 0, overflow: 0,
    fullyOccupiedSlots: week.cells.filter((c) => c.upcoming.status === "full" && c.upcoming.limit !== 0).length,
    rosteredPersonnel: new Set(week.cells.flatMap((c) => c.upcoming.staff.filter((p) => p.status === "APPROVED").map((p) => p.id))).size,
  });
  const business = metrics(businessWeek), vendor = metrics(vendorWeek);
  const units = new Map<string, typeof orders>();
  for (const order of orders) {
    if (order.vendorDeliveryBooking && order.vendorDeliveryBooking.status !== "CONFIRMED") continue;
    const key = order.vendorDeliveryBookingId ?? order.id;
    units.set(key, [...(units.get(key) ?? []), order]);
  }
  for (const unit of units.values()) {
    const first = unit[0], booking = first.vendorDeliveryBooking;
    const plan = booking ? planOfBooking.get(first.vendorDeliveryBookingId!) : planOfOrder.get(first.id);
    const date = booking?.bookedFor ?? plan?.date ?? first.estimatedDeliveryAt;
    const end = booking ? schoolWallClockToInstant(booking.bookedFor, booking.slot.windowEnd) : first.deliveryWindowEnd;
    const m = booking ? vendor : business;
    const complete = unit.every((o) => o.items.every((i) => i.deliveryStatus === "DELIVERED"));
    m.total++;
    if (date && isoDate(date) === today) m.today++;
    if (complete) m.completed++;
    else {
      m.pending++;
      if (date && isoDate(date) > today) m.upcoming++;
      if (end && end < now) m.overdue++;
    }
    if (plan?.isOverflow) m.overflow++;
  }
  return { today, timezone: SCHOOL_TIMEZONE, business, vendor, approvedPersonnel,
    occupancyPeriod: "Next occurrence of each weekday (7 days)", generatedAt: now.toISOString() };
}
