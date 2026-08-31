// services/marketplace/admin/shared/marketplace-settings.ts
//
// The two admin-configurable operational time windows: the Seller Drop-off
// Window (when sellers should physically hand orders to the delivery
// coordinator) and the Deliverer Handoff Window (when the coordinator hands
// assigned batches to deliverers). Backed by MarketplaceSettings, a
// singleton row (always id "default"). Read by the seller dashboard, the
// deliverer dashboard, and the admin Settings tab; written only by admins.
//
// Kept as one shared module (not duplicated per consumer) so there is
// exactly one source of truth for these values, per the requirement that
// they must not be hardcoded into any dashboard.

import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/service-error";

const SETTINGS_ID = "default";

export interface MarketplaceSettingsDto {
  dropoffWindowStart: string;
  dropoffWindowEnd: string;
  handoffWindowStart: string;
  handoffWindowEnd: string;
  // Where the central drop-off point physically is (address/room string).
  // Null until an admin sets it via the Settings tab.
  dropoffLocation: string | null;
  updatedAt: string;
}

function toDto(row: {
  dropoffWindowStart: string;
  dropoffWindowEnd: string;
  handoffWindowStart: string;
  handoffWindowEnd: string;
  dropoffLocation: string | null;
  updatedAt: Date;
}): MarketplaceSettingsDto {
  return {
    dropoffWindowStart: row.dropoffWindowStart,
    dropoffWindowEnd: row.dropoffWindowEnd,
    handoffWindowStart: row.handoffWindowStart,
    handoffWindowEnd: row.handoffWindowEnd,
    dropoffLocation: row.dropoffLocation,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Loads the singleton settings row, creating it with schema defaults on
 * first read if it doesn't exist yet. Any authenticated user may read this
 * — it's operational information sellers/deliverers need to see, not an
 * admin secret.
 */
export async function getMarketplaceSettings(): Promise<MarketplaceSettingsDto> {
  const row = await prisma.marketplaceSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
  return toDto(row);
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function assertValidWindow(startLabel: string, start: string, endLabel: string, end: string) {
  if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    throw badRequest(`${startLabel}/${endLabel} must be "HH:MM" 24-hour times.`);
  }
  if (start >= end) {
    throw badRequest(`${startLabel} must be before ${endLabel}.`);
  }
}

/**
 * Admin-only update of either or both windows. Only the fields supplied are
 * changed — the other window is left untouched, so an admin can update the
 * drop-off window without needing to also resend the handoff window.
 */
export async function updateMarketplaceSettings(
  input: {
    dropoffWindowStart?: string;
    dropoffWindowEnd?: string;
    handoffWindowStart?: string;
    handoffWindowEnd?: string;
    dropoffLocation?: string | null;
  },
  adminUserId: string
): Promise<MarketplaceSettingsDto> {
  const current = await prisma.marketplaceSettings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });

  const next = {
    dropoffWindowStart: input.dropoffWindowStart ?? current.dropoffWindowStart,
    dropoffWindowEnd: input.dropoffWindowEnd ?? current.dropoffWindowEnd,
    handoffWindowStart: input.handoffWindowStart ?? current.handoffWindowStart,
    handoffWindowEnd: input.handoffWindowEnd ?? current.handoffWindowEnd,
    dropoffLocation: input.dropoffLocation === undefined ? current.dropoffLocation : input.dropoffLocation?.trim() || null,
  };
  assertValidWindow("dropoffWindowStart", next.dropoffWindowStart, "dropoffWindowEnd", next.dropoffWindowEnd);
  assertValidWindow("handoffWindowStart", next.handoffWindowStart, "handoffWindowEnd", next.handoffWindowEnd);

  const row = await prisma.marketplaceSettings.update({
    where: { id: SETTINGS_ID },
    data: { ...next, updatedBy: adminUserId },
  });
  return toDto(row);
}
