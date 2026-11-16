// services/marketplace/delivery-roster/central-scheduling.ts
//
// Business checkout serializes selection and creation using lockRosterOperation.
// Balance regular slots on the first eligible open day, then distribute overflow.

import type { DayOfWeek } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Db } from "@/services/marketplace/order/shared/db";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import { WEEKDAYS } from "@/services/marketplace/vendor/capacity/vendor-delivery-schedule";
import { addDays, schoolWallClockToInstant } from "./shared/roster-calendar";
import { loadRosterWindow, type ResolvedOccurrence } from "./roster-resolution";
import { loadOccurrenceUsage, usageKey, usedOf, type OccurrenceUsage } from "./roster-capacity";
import type { RosterSlot } from "./roster-slots";

export const MIN_LEAD_DAYS = 2;
export const CENTRAL_SCHEDULING_HORIZON_DAYS = 28;

export interface CentralPlan {
  isOverflow: boolean;
  slot: RosterSlot;
  date: Date;
  occurrence: ResolvedOccurrence;
  windowStartAt: Date;
  windowEndAt: Date;
}

export async function findCentralSlot(businessId: string, db: Db = prisma, now: Date = new Date(), projected: ReadonlyMap<string, OccurrenceUsage> = new Map(), slotIds?: string[]): Promise<CentralPlan | "full" | null> {
  const start = addDays(todayInSchoolTimezone(now), MIN_LEAD_DAYS);
  const end = addDays(start, CENTRAL_SCHEDULING_HORIZON_DAYS - 1);
  const [window, usage, days] = await Promise.all([
    loadRosterWindow("MARKETPLACE", start, CENTRAL_SCHEDULING_HORIZON_DAYS, db),
    loadOccurrenceUsage("MARKETPLACE", start, end, db, { now }),
    db.businessDeliveryDay.findMany({ where: { businessId }, select: { day: true } }),
  ]);
  const slots = window.slots.filter((s) => s.active && (!slotIds || slotIds.includes(s.id)));
  if (slots.length === 0) return null;

  // Same rule as calculateEstimatedDelivery: no configured days = every day.
  const deliveryDays = new Set<DayOfWeek>(days.map((d) => d.day));
  for (const date of window.dates) {
    if (deliveryDays.size > 0 && !deliveryDays.has(WEEKDAYS[date.getUTCDay()])) continue;
    const available = slots.map((slot) => ({ slot, occurrence: window.occurrence(slot.id, date), used: usedOf(usage.get(usageKey(slot.id, date))) + usedOf(projected.get(usageKey(slot.id, date))), overflow: (usage.get(usageKey(slot.id, date))?.overflow ?? 0) + (projected.get(usageKey(slot.id, date))?.overflow ?? 0) }))
      .filter(({ occurrence }) => !occurrence.closed && occurrence.limit !== 0)
      .sort((a, b) => a.slot.windowStart.localeCompare(b.slot.windowStart) || a.slot.id.localeCompare(b.slot.id));
    const chosen = chooseSlot(available);
    if (chosen) {
      const { slot, occurrence } = chosen;
      return { slot, date, occurrence, isOverflow: occurrence.limit !== null && chosen.used - chosen.overflow >= occurrence.limit,
        windowStartAt: schoolWallClockToInstant(date, slot.windowStart), windowEndAt: schoolWallClockToInstant(date, slot.windowEnd) };
    }
  }
  return "full";
}

export function centralFullMessage(businessName: string): string {
  return `Central delivery for ${businessName} has no open slots for the next ${CENTRAL_SCHEDULING_HORIZON_DAYS} days — please try again later.`;
}

// Balance live regular bookings in configured time order, skipping full slots.
// Cancellations refill the least occupied slot; overflow never consumes regular capacity.
// Checkout holds the operation lock across this selection and insertion.
export function chooseSlot<T extends { occurrence: { limit: number | null }; used: number; overflow: number }>(slots: T[]): T | undefined {
  const open = slots.filter((s) => s.occurrence.limit !== 0);
  const regular = open.filter((s) => s.occurrence.limit === null || s.used - s.overflow < s.occurrence.limit);
  return regular.reduce<T | undefined>((best, s) => !best || s.used - s.overflow < best.used - best.overflow ? s : best, undefined)
    ?? open.reduce<T | undefined>((best, s) => !best || s.overflow < best.overflow ? s : best, undefined);
}
