// services/marketplace/delivery/estimated-delivery.service.ts
//
// The single reusable "estimated delivery" calculation — every screen that
// needs to show a delivery date/window (product profile, checkout page,
// per-order-item display) calls this, so the logic never drifts between
// them. See docs/marketplace/data/delivery-days.md and
// docs/marketplace/data/delivery-windows.md.
//
// Terminology: always "estimated," never "expected" — see
// docs/marketplace/decisions/estimated-not-expected-delivery.md.

import { DayOfWeek } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { conflict } from "@/lib/service-error";
import { findCentralSlot, centralFullMessage, MIN_LEAD_DAYS } from "@/services/marketplace/delivery-roster/central-scheduling";
import { addDays, schoolWallClockToInstant } from "@/services/marketplace/delivery-roster/shared/roster-calendar";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import { SCHOOL_TIMEZONE } from "@/services/marketplace/vendor-delivery/is-slot-bookable";

export { MIN_LEAD_DAYS };
export const DELIVERY_WINDOW = { startHour: 17, startMinute: 0, endHour: 20, endMinute: 30 } as const;
const DAY_BY_JS_INDEX: DayOfWeek[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export interface EstimatedDelivery {
  estimatedDeliveryAt: Date;
  deliveryWindowStart: Date;
  deliveryWindowEnd: Date;
}

function buildResult(day: Date): EstimatedDelivery {
  const deliveryWindowStart = schoolWallClockToInstant(day, "17:00");
  const deliveryWindowEnd = schoolWallClockToInstant(day, "20:30");
  return { estimatedDeliveryAt: deliveryWindowStart, deliveryWindowStart, deliveryWindowEnd };
}

// Fallback for installations without central slots. School calendar dates, inclusive
// two-day minimum; configured central slots always use the actual scheduler below.
export function calculateEstimatedDelivery(deliveryDays: DayOfWeek[], from: Date = new Date()): EstimatedDelivery {
  const candidates = deliveryDays.length ? deliveryDays : DAY_BY_JS_INDEX;
  const today = todayInSchoolTimezone(from);
  for (let offset = MIN_LEAD_DAYS; offset < MIN_LEAD_DAYS + 7; offset++) {
    const day = addDays(today, offset);
    if (candidates.includes(DAY_BY_JS_INDEX[day.getUTCDay()])) return buildResult(day);
  }
  throw new Error("No valid delivery weekday configured.");
}

/**
 * DB-backed convenience wrapper: loads a business's configured delivery
 * days and runs calculateEstimatedDelivery. This is what the checkout flow,
 * product profile, and any other server-side caller should use — see
 * src/app/api/marketplace/products/[id]/route.ts and
 * services/marketplace/checkout/{get-checkout-summary,create-orders-for-checkout,confirm-payment-by-reference}.ts for the two call sites today.
 */
export async function getEstimatedDeliveryForBusiness(businessId: string, from: Date = new Date()): Promise<EstimatedDelivery> {
  const central = await findCentralSlot(businessId, prisma, from);
  if (central === "full") throw conflict(centralFullMessage("this business"));
  if (central) return { estimatedDeliveryAt: central.windowStartAt, deliveryWindowStart: central.windowStartAt, deliveryWindowEnd: central.windowEndAt };
  const rows = await prisma.businessDeliveryDay.findMany({
    where: { businessId },
    select: { day: true },
  });
  return calculateEstimatedDelivery(rows.map((row) => row.day), from);
}

// Formats an EstimatedDelivery for display, e.g.
// "Wednesday, September 2 · 5:00 PM - 8:30 PM" — shared so every screen
// (product profile, checkout, order tracking) renders this identically.
export function formatEstimatedDelivery({ estimatedDeliveryAt, deliveryWindowStart, deliveryWindowEnd }: EstimatedDelivery): {
  date: string;
  window: string;
} {
  const date = estimatedDeliveryAt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: SCHOOL_TIMEZONE });
  const timeFormat: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true, timeZone: SCHOOL_TIMEZONE };
  const window = `${deliveryWindowStart.toLocaleTimeString("en-US", timeFormat)} - ${deliveryWindowEnd.toLocaleTimeString("en-US", timeFormat)}`;
  return { date, window };
}
