import "../helpers/env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { chooseSlot } from "@/services/marketplace/delivery-roster/central-scheduling";
import { cardsForPanel, DELIVERY_PANELS, deliveryPanel } from "@/app/studashboard/marketplace/deliverer/_components/delivery-panels";
import ScheduleOverview, { scheduleGroups } from "@/app/studashboard/marketplace/deliverer/_components/ScheduleOverview";
import type { DelivererScheduleRow } from "@/lib/delivery-schedule";
import type { ManifestCard, ManifestDelivery } from "@/app/studashboard/marketplace/deliverer/_components/DeliveryCards";

const now = new Date("2026-10-28T14:00:00Z");
const future = "2026-10-29T16:00:00+01:00";
const row = (overrides: Partial<DelivererScheduleRow> = {}): DelivererScheduleRow => ({
  id: "r1", operation: "MARKETPLACE", date: "2026-10-29", slotId: "s1", slotLabel: "Afternoon", windowStart: "16:00", windowEnd: "17:00",
  isOverflow: false, limit: 1, full: true, dispatched: false, status: "PLANNED", delivererName: "Ada Rider", orderIds: ["order123456"], businessNames: ["Campus Shop"], ...overrides,
});

describe("round-robin slot allocation", () => {
  const slots = () => [1, 2, 3].map((id) => ({ id, used: 0, overflow: 0, occurrence: { limit: 2 as number | null } }));
  it("cycles regular slots, then cycles overflow", () => {
    const available = slots();
    const sequence = [];
    for (let i = 0; i < 11; i++) {
      const slot = chooseSlot(available)!;
      sequence.push(slot.id);
      if (slot.used - slot.overflow >= slot.occurrence.limit!) slot.overflow++;
      slot.used++;
    }
    assert.deepEqual(sequence, [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
    assert.deepEqual(available.map((s) => s.overflow), [2, 2, 1]);
  });
  it("reuses freed regular capacity without changing existing overflow classifications", () => {
    const available = slots();
    available.forEach((s) => { s.used = 3; s.overflow = 1; });
    available[1].used--;
    assert.equal(chooseSlot(available)?.id, 2);
  });
  it("an unlimited later slot absorbs remaining orders as regular deliveries", () => {
    const available = slots();
    available[0].used = 2;
    available[1].occurrence.limit = null;
    assert.equal(chooseSlot(available)?.id, 2);
    assert.equal(chooseSlot([]), undefined);
  });
});

describe("delivery panels and schedule overview", () => {
  it("moves scheduled deliveries into processing at slot start and into delivered on confirmation", () => {
    assert.equal(deliveryPanel("ASSIGNED", future, now), "Scheduled");
    assert.equal(deliveryPanel("PLANNED", future, now), "Scheduled");
    assert.equal(deliveryPanel("PROCESSING_ORDER", future, now), "Scheduled");
    assert.equal(deliveryPanel("ASSIGNED", future, new Date(future)), "Ongoing / Processing");
    for (const status of ["PICKED_UP", "OUT_FOR_DELIVERY", "FAILED", "CANCELLED"]) assert.equal(deliveryPanel(status, future, now), "Ongoing / Processing");
    assert.equal(deliveryPanel("DELIVERED", future, now), "Delivered");
    assert.equal(deliveryPanel("ASSIGNED", null, now), "Ongoing / Processing");
  });
  it("groups vendor and business deliveries separately and shows date, slot, staff, counts and overflow", () => {
    const rows = [row(), row({ id: "r2", isOverflow: true, orderIds: ["extra123456"] }), row({ id: "v1", operation: "VENDOR", businessNames: ["Mama Kitchen"] })];
    assert.equal(scheduleGroups(rows).length, 2);
    const html = renderToStaticMarkup(<ScheduleOverview rows={rows} panel="Scheduled" now={now} />);
    for (const text of ["Vendor Deliveries", "Business Deliveries", "2026-10-29", "16:00", "17:00", "Ada Rider", "2 deliveries assigned to you", "1 regular", "1 overflow", "Full slot", "Overflow — extra delivery", "Campus Shop", "Mama Kitchen"]) assert.ok(html.includes(text), text);
    const delivered = renderToStaticMarkup(<ScheduleOverview rows={rows} panel="Delivered" now={now} />);
    assert.ok(!delivered.includes("order123"));
  });
  it("partitions mixed vendor cards without duplicate bookings or unrelated pickup orders", () => {
    const delivery = (bookingId: string, status: ManifestDelivery["status"], vendor: string): ManifestDelivery => ({
      bookingId, reference: bookingId, orderRefs: [bookingId], studentFirstName: "Student", deliveryLocation: "Hall", vendors: [{ name: vendor, items: [{ name: "Food", quantity: 1 }] }],
      status, maskedCode: "1_3_5_", codeLocked: false, attemptsLeft: 5, deadlineAt: future, overdue: false, failedAttempts: 0, retryDeliveryAt: null, pendingLateReview: false, confirmation: null,
    });
    const card: ManifestCard = { key: "k", date: "2026-10-29", windowStart: "16:00", slotLabel: "Afternoon", arriveBy: "15:30", deliverer: { id: "d1", name: "Ada", phone: null }, attendance: { state: "NOT_RECORDED", checkedInAt: null }, meetingPoint: "SUB",
      pickups: [{ businessId: "b1", name: "Vendor A", location: "A", contact: null, orderRefs: ["future1"], itemCount: 1 }, { businessId: "b2", name: "Vendor B", location: "B", contact: null, orderRefs: ["done1"], itemCount: 1 }],
      deliveries: [delivery("future1", "PROCESSING_ORDER", "Vendor A"), delivery("done1", "DELIVERED", "Vendor B")],
    };
    const partitioned = DELIVERY_PANELS.map((panel) => cardsForPanel([card], panel, now));
    assert.deepEqual(partitioned.map((cards) => cards.flatMap((c) => c.deliveries.map((d) => d.bookingId))), [["future1"], [], ["done1"]]);
    assert.deepEqual(partitioned[0][0].pickups.map((p) => p.orderRefs), [["future1"]]);
    assert.equal(partitioned[2][0].pickups[0].name, "Vendor B");
  });
});
