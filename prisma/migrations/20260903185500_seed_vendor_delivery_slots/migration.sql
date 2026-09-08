-- Seeds the three default School Vendor delivery windows (spec: 5-6PM,
-- 6-7PM, 7-8PM). This is reference/operational data, not schema — the
-- project has no separate seed-script convention (see
-- docs/marketplace/decisions/vendor-extends-business.md), so it's shipped
-- as a data migration instead, matching how a one-off default row is
-- otherwise introduced in this codebase. Admins can add/edit/retire rows
-- afterward from the Vendor Delivery admin tab; nothing in application
-- code hardcodes these three windows.
INSERT INTO "VendorDeliverySlot" ("id", "label", "windowStart", "windowEnd", "bookingCutoffMins", "vendorPrepDeadlineMins", "delivererCapacity", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '5:00 PM - 6:00 PM', '17:00', '18:00', 90, 30, 1, true, now(), now()),
  (gen_random_uuid(), '6:00 PM - 7:00 PM', '18:00', '19:00', 90, 30, 1, true, now(), now()),
  (gen_random_uuid(), '7:00 PM - 8:00 PM', '19:00', '20:00', 90, 30, 1, true, now(), now());
