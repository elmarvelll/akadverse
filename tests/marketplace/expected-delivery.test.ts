import "../helpers/env";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateEstimatedDelivery, formatEstimatedDelivery } from "@/services/marketplace/delivery/estimated-delivery.service";
import { chooseSlot } from "@/services/marketplace/delivery-roster/central-scheduling";

describe("Business minimum delivery date", () => {
  it("uses the earliest Mon/Wed/Fri at least two school calendar days later for every weekday", () => {
    const expected = ["2026-11-04", "2026-11-06", "2026-11-06", "2026-11-09", "2026-11-09", "2026-11-09", "2026-11-11"];
    for (let day = 2; day <= 8; day++) {
      const result = calculateEstimatedDelivery(["MONDAY", "WEDNESDAY", "FRIDAY"], new Date(`2026-11-0${day}T10:00:00Z`));
      assert.equal(result.estimatedDeliveryAt.toISOString(), `${expected[day - 2]}T16:00:00.000Z`);
      assert.equal(result.deliveryWindowEnd.toISOString(), `${expected[day - 2]}T19:30:00.000Z`);
    }
  });
  it("uses the school date across midnight and accepts exactly two days", () => {
    const result = calculateEstimatedDelivery([], new Date("2026-11-02T23:30:00Z"));
    assert.equal(result.estimatedDeliveryAt.toISOString(), "2026-11-05T16:00:00.000Z");
    assert.match(formatEstimatedDelivery(result).window, /5:00 PM - 8:30 PM/);
    assert.equal(calculateEstimatedDelivery([], new Date("2026-11-02T22:30:00Z")).estimatedDeliveryAt.toISOString(), "2026-11-04T16:00:00.000Z");
  });
});

describe("normal and overflow allocation policy", () => {
  it("cycles four ranges of three, with the thirteenth in overflow", () => {
    const slots = [0, 1, 2, 3].map((id) => ({ id, occurrence: { limit: 3 }, used: 0, overflow: 0 }));
    const actual = [];
    for (let i = 0; i < 13; i++) {
      const next = chooseSlot(slots)!;
      const overflow = next.used - next.overflow >= next.occurrence.limit;
      actual.push([next.id, overflow]);
      next.used++;
      if (overflow) next.overflow++;
    }
    assert.deepEqual(actual, Array.from({ length: 13 }, (_, i) => [i % 4, i === 12]));
    assert.ok(slots.every((s) => s.used - s.overflow === 3));
  });
  it("skips zero/full ranges and balances unequal capacities, then refills cancellations", () => {
    const slots = [1, 3, 2, 0].map((limit, id) => ({ id, occurrence: { limit }, used: 0, overflow: 0 }));
    const actual = [];
    for (let i = 0; i < 6; i++) {
      const next = chooseSlot(slots)!;
      actual.push(next.id); next.used++;
    }
    assert.deepEqual(actual, [0, 1, 2, 1, 2, 1]);
    assert.equal(chooseSlot(slots)?.id, 0);
    slots[2].used--;
    assert.equal(chooseSlot(slots)?.id, 2);
    slots[0].occurrence.limit = 0;
    assert.notEqual(chooseSlot(slots)?.id, 0);
    assert.equal(chooseSlot([{ occurrence: { limit: 0 }, used: 0, overflow: 0 }]), undefined);
  });
});
