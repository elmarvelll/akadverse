// Recurring delivery rosters (services/marketplace/delivery-roster/): the weekly template, per-slot delivery limits,
// date-specific exceptions, delivery plans, and how both checkouts, the late-payment path and the coordinator's
// assignment flow follow them. Real local Postgres as the restricted marketplace_app role; Paystack/Resend faked.
//
// Central slots and each operation's default limit are global, so every test starts from (and leaves) "no central
// slots, no default limit" — otherwise the other checkout tests would start being scheduled into slots.
import "../helpers/env";
import { signInAs } from "../helpers/session";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-error";
import { installFakeProviders, paystack, resend } from "../helpers/fake-providers";
import { addToCart, businessCheckoutScenario, lagosDatePlus, makeUser, vendorCheckoutScenario } from "../helpers/fixtures";
import { createVendorOrdersForCheckout } from "@/services/marketplace/vendor-checkout/create-vendor-orders-for-checkout";
import { calculateVendorCheckoutSummary } from "@/services/marketplace/vendor-checkout/calculate-vendor-checkout-summary";
import { createOrdersForCheckout } from "../helpers/priced-checkout";
import { getCheckoutSummary } from "../helpers/priced-checkout";
import { reconcileCheckoutPayment } from "@/services/marketplace/checkout/reconcile-checkout-payment";
import { rejectOrder } from "@/services/marketplace/order/reject-order";
import { refundVendorItem } from "@/services/marketplace/admin/vendor-delivery/refund-vendor-item";
import { applyRosterChange, parseRosterChange, previewRosterChange, type RosterChange } from "@/services/marketplace/delivery-roster/roster-changes";
import { decideOccurrence, resolveOccurrence } from "@/services/marketplace/delivery-roster/roster-resolution";
import { countReservedDeliveries } from "@/services/marketplace/delivery-roster/roster-capacity";
import { getRosterDate, getRosterWeek } from "@/services/marketplace/delivery-roster/roster-views";
import { createCentralSlot } from "@/services/marketplace/delivery-roster/roster-slots";
import { setPlannedDeliverer } from "@/services/marketplace/delivery-roster/delivery-plans";
import { assignPlannedDeliveries } from "@/services/marketplace/delivery-roster/assign-planned";
import { addDays, isoDate, isoWeekday, utcDate } from "@/services/marketplace/delivery-roster/shared/roster-calendar";
import { todayInSchoolTimezone } from "@/services/marketplace/vendor-delivery/validate-delivery-date";
import { notifyOverflowAssignments } from "@/services/marketplace/delivery-roster/overflow-notifications";
import { listMySchedule } from "@/services/marketplace/deliverer/list-my-schedule";
import { listAssignedDeliveryItems } from "@/services/marketplace/delivery/list-assigned-delivery-items";
import { GET as getSchedule } from "@/app/api/marketplace/deliverer/schedule/route";
import { listMyRoster } from "@/services/marketplace/deliverer/list-my-roster";
import { getWeek, postChange } from "@/app/api/marketplace/admin/delivery-roster/route.controller";

import { findCentralSlot } from "@/services/marketplace/delivery-roster/central-scheduling";
import { getDeliveryOverview } from "@/services/marketplace/delivery-roster/delivery-overview";
import { GET as getOverview } from "@/app/api/marketplace/admin/deliveries/overview/route";

const isConflict = (e: unknown) => e instanceof ServiceError && e.status === 409;
const isBadRequest = (e: unknown) => e instanceof ServiceError && e.status === 400;

async function resetGlobalRoster() {
  await prisma.centralDeliverySlot.updateMany({ data: { active: false } });
  await prisma.deliveryRosterSettings.updateMany({ data: { defaultMaxDeliveries: null } });
}

before(() => installFakeProviders());
beforeEach(async () => {
  paystack.reset();
  resend.reset();
  signInAs(null);
  await resetGlobalRoster();
});
afterEach(() => resetGlobalRoster());
after(() => prisma.$disconnect());

let adminId: string;
const admin = async () => (adminId ??= (await makeUser({ isAdmin: true })).id);

async function makeDeliverer(status: "APPROVED" | "SUSPENDED" = "APPROVED") {
  const user = await makeUser();
  return prisma.deliverer.create({ data: { userId: user.id, firstName: "Del", lastName: user.lastName, email: user.email, status } });
}

const change = async (operation: "VENDOR" | "MARKETPLACE", c: RosterChange, decision = {}) => applyRosterChange(operation, c, await admin(), decision);
const cell = (slotId: string, weekday: number, delivererIds: string[], maxDeliveries: number | null = null): RosterChange => ({ kind: "cell", slotId, weekday, delivererIds, maxDeliveries });

type V = Awaited<ReturnType<typeof vendorCheckoutScenario>>;
const bookVendor = (s: V, userId = s.buyer.id, date = s.date) => createVendorOrdersForCheckout(userId, { slotId: s.slot.id, location: "Hall", date });
async function payVendor(res: { reference: string; amountKobo: number }) {
  paystack.set(res.reference, { status: "success", amount: res.amountKobo });
  return reconcileCheckoutPayment(res.reference, "verify");
}
async function extraBuyer(s: V) {
  const buyer = await makeUser();
  await addToCart(buyer.id, s.product.id, 1);
  return buyer;
}
const planOfBooking = (bookingId: string) => prisma.scheduledDelivery.findUniqueOrThrow({ where: { bookingId } });

describe("the weekly template", () => {
  it("pure rule: exception beats weekly beats default; closed means limit 0; limits never come from staff", () => {
    const base = { templateStaff: ["a"], legacyStaff: ["b"], exception: null, cellMax: null, defaultMax: null };
    assert.deepEqual(decideOccurrence(base), { staff: ["a", "b"], staffSource: "weekly", hasException: false, note: null, closed: false, limit: null, limitSource: "none" });
    assert.equal(decideOccurrence({ ...base, defaultMax: 5 }).limit, 5);
    assert.equal(decideOccurrence({ ...base, defaultMax: 5, cellMax: 3 }).limit, 3);
    const ex = { closed: false, maxDeliveries: 1, replaceDeliverers: true, delivererIds: ["c"], note: "swap" };
    assert.deepEqual([decideOccurrence({ ...base, cellMax: 3, exception: ex }).limit, decideOccurrence({ ...base, exception: ex }).staff], [1, ["c"]]);
    assert.deepEqual([decideOccurrence({ ...base, cellMax: 3, exception: { ...ex, closed: true } }).limit, decideOccurrence({ ...base, exception: { ...ex, closed: true } }).closed], [0, true]);
    assert.equal(decideOccurrence({ ...base, templateStaff: ["a", "b", "c", "d"] }).limit, null, "more staff never raises (or sets) a limit");
  });

  it("an assignment recurs on its weekday every week, and only that weekday; different days can have different people", async () => {
    const s = await vendorCheckoutScenario();
    const [david, sarah] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    await prisma.vendorDeliverySlot.update({ where: { id: s.slot.id }, data: { delivererCapacity: 2 } });
    const monday = utcDate("2026-10-19");
    await change("VENDOR", cell(s.slot.id, 1, [david.id]));
    await change("VENDOR", cell(s.slot.id, 2, [sarah.id]));

    for (const week of [0, 1, 7]) {
      assert.deepEqual((await resolveOccurrence("VENDOR", s.slot.id, addDays(monday, week * 7))).staff, [david.id], `Monday +${week} weeks`);
      assert.deepEqual((await resolveOccurrence("VENDOR", s.slot.id, addDays(monday, week * 7 + 1))).staff, [sarah.id], "Tuesday");
    }
    assert.deepEqual((await resolveOccurrence("VENDOR", s.slot.id, addDays(monday, 2))).staff, [], "Wednesday unassigned");
  });

  it("Marketplace and Vendor rosters are separate: same weekday, separate staff, slots and limits", async () => {
    const s = await vendorCheckoutScenario();
    const central = await createCentralSlot({ label: "Central 5-6", windowStart: "17:00", windowEnd: "18:00" }, await admin());
    const [d1, d2] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    await change("VENDOR", cell(s.slot.id, 3, [d1.id], 2));
    await change("MARKETPLACE", cell(central.id, 3, [d2.id], 7));

    const wed = utcDate("2026-10-21");
    assert.deepEqual(await resolveOccurrence("VENDOR", s.slot.id, wed).then((o) => [o.staff, o.limit]), [[d1.id], 2]);
    assert.deepEqual(await resolveOccurrence("MARKETPLACE", central.id, wed).then((o) => [o.staff, o.limit]), [[d2.id], 7]);
    assert.deepEqual((await resolveOccurrence("MARKETPLACE", s.slot.id, wed)).staff, [], "a vendor slot id carries nothing on the Marketplace roster");
    // A slot id from the other roster is refused, whatever the browser sends.
    await assert.rejects(change("MARKETPLACE", cell(s.slot.id, 3, [])), (e) => e instanceof ServiceError && e.status === 404);
    await assert.rejects(change("VENDOR", cell(central.id, 3, [])), (e) => e instanceof ServiceError && e.status === 404);
  });

  it("validation: only approved deliverers can be added, staff can't exceed positions, inputs are checked", async () => {
    const s = await vendorCheckoutScenario();
    const [ok, ok2, suspended] = await Promise.all([makeDeliverer(), makeDeliverer(), makeDeliverer("SUSPENDED")]);
    await assert.rejects(change("VENDOR", cell(s.slot.id, 1, [suspended.id])), isBadRequest);
    await assert.rejects(change("VENDOR", cell(s.slot.id, 1, [ok.id, ok2.id])), isBadRequest, "slot has 1 position");
    await assert.rejects(change("VENDOR", cell(s.slot.id, 1, ["not-a-deliverer"])), isBadRequest);
    // What the browser sends is parsed before it reaches the service.
    const raw = { kind: "cell", slotId: s.slot.id, weekday: 1, delivererIds: [ok.id], maxDeliveries: 1 };
    for (const bad of [{ maxDeliveries: -1 }, { maxDeliveries: 2.5 }, { weekday: 8 }, { weekday: "MONDAY" }, { delivererIds: "x" }, { kind: "drop-table" }]) {
      assert.throws(() => parseRosterChange({ ...raw, ...bad }), isBadRequest, JSON.stringify(bad));
    }
    assert.throws(() => parseRosterChange({ kind: "exception", slotId: s.slot.id, date: lagosDatePlus(-1), closed: true }), isBadRequest, "past dates can't be changed");
    assert.throws(() => parseRosterChange({ kind: "exception", slotId: s.slot.id, date: lagosDatePlus(1) }), isBadRequest, "an exception must change something");
    await change("VENDOR", cell(s.slot.id, 1, [ok.id]));
    assert.equal(await prisma.rosterAssignment.count({ where: { slotId: s.slot.id } }), 1);
  });

  it("every write is audited, and deliverers are notified of weekly changes", async () => {
    const s = await vendorCheckoutScenario();
    const d = await makeDeliverer();
    await change("VENDOR", cell(s.slot.id, 4, [d.id], 3));
    const log = await prisma.adminActionLog.findFirstOrThrow({ where: { targetId: `VENDOR:${s.slot.id}` }, orderBy: { createdAt: "desc" } });
    assert.equal(log.action, "ROSTER_CELL");
    assert.equal(log.adminId, await admin());
    assert.match(log.message ?? "", /every Thursday.*limit=3/);
    const note = await prisma.notification.findFirstOrThrow({ where: { userId: d.userId, type: "ROSTER_ASSIGNED" } });
    assert.match(note.message, /every Thursday/);
    await change("VENDOR", cell(s.slot.id, 4, [], 3));
    assert.equal(await prisma.notification.count({ where: { userId: d.userId, type: "ROSTER_CANCELLED" } }), 1);
  });
});

describe("delivery limits (Vendor Market)", () => {
  it("a limit of 3 takes exactly 3 deliveries for that occurrence; the 4th is refused and offered another time", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [], 3));
    for (let i = 0; i < 3; i++) await bookVendor(s, i === 0 ? s.buyer.id : (await extraBuyer(s)).id);
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, utcDate(s.date)), 3);

    const fourth = await extraBuyer(s);
    await assert.rejects(bookVendor(s, fourth.id), (e) => isConflict(e) && /fully booked/.test((e as Error).message));
    const summary = await calculateVendorCheckoutSummary(fourth.id, s.date);
    assert.equal(summary.slots.find((x) => x.id === s.slot.id)?.bookable, false);
    assert.deepEqual([summary.slots.find((x) => x.id === s.slot.id)?.capacity, summary.slots.find((x) => x.id === s.slot.id)?.booked], [3, 3]);
    assert.equal(summary.dates.find((d) => d.date === s.date)?.reason, "fully_booked");
    // Next week's same weekday is a different occurrence with its own room.
    assert.ok(summary.dates.some((d) => d.date !== s.date && d.selectable));
    assert.ok((await bookVendor(s, fourth.id, lagosDatePlus(2))).reference);
  });

  it("concurrent checkouts can't overbook: 5 buyers, limit 2 -> exactly 2 succeed", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [], 2));
    const buyers = [s.buyer, ...(await Promise.all([1, 2, 3, 4].map(() => extraBuyer(s))))];
    const results = await Promise.allSettled(buyers.map((b) => bookVendor(s, b.id)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
    assert.ok(results.filter((r) => r.status === "rejected").every((r) => isConflict((r as PromiseRejectedResult).reason)));
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, utcDate(s.date)), 2);
  });

  it("unpaid, failed, cancelled and refunded deliveries stop taking capacity", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [], 1));
    const date = utcDate(s.date);

    const abandoned = await bookVendor(s);
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 1, "a live unpaid checkout holds its place");
    paystack.set(abandoned.reference, { status: "abandoned", amount: abandoned.amountKobo });
    await reconcileCheckoutPayment(abandoned.reference, "cancel");
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 0, "released on cancel");

    const failed = await bookVendor(s);
    paystack.set(failed.reference, { status: "failed", amount: failed.amountKobo });
    await reconcileCheckoutPayment(failed.reference, "verify");
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 0, "failed payment never consumes");

    const lapsed = await bookVendor(s);
    await prisma.order.updateMany({ where: { paystackReference: lapsed.reference }, data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } });
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 0, "a lapsed reservation stops counting even before the sweep");
    paystack.set(lapsed.reference, { status: "abandoned", amount: lapsed.amountKobo });
    await reconcileCheckoutPayment(lapsed.reference, "cancel");

    const paid = await bookVendor(s);
    await payVendor(paid);
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 1);
    // Vendors no longer refund their own orders; an admin refunds every item.
    const order = await prisma.order.findFirstOrThrow({ where: { paystackReference: paid.reference }, include: { items: true } });
    const admin = await makeUser({ isAdmin: true });
    for (const item of order.items) await refundVendorItem(order.id, item.id, "Out of rice", admin.id);
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, date), 0, "a fully refunded order frees its place");
  });

  it("late payment after release can't overbook: flagged for review when the roster slot filled meanwhile", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [], 1));
    const first = await bookVendor(s);
    await reconcileCheckoutPayment(first.reference, "cancel");
    const taken = await bookVendor(s, (await extraBuyer(s)).id);
    await payVendor(taken);
    paystack.set(first.reference, { status: "success", amount: first.amountKobo });
    assert.equal((await reconcileCheckoutPayment(first.reference, "webhook")).state, "needs_review");
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, utcDate(s.date)), 1);
  });

  it("with no limit configured, vendor checkout behaves exactly as before (only the vendor's own capacity applies)", async () => {
    const s = await vendorCheckoutScenario({ capacity: 2, stock: 10 });
    await bookVendor(s);
    await bookVendor(s, (await extraBuyer(s)).id);
    await assert.rejects(bookVendor(s, (await extraBuyer(s)).id), (e) => isConflict(e) && /fully booked for this delivery time/.test((e as Error).message), "vendor capacity message, not the roster's");
  });
});

describe("changing limits never drops or silently moves deliveries", () => {
  it("cutting a limit below what's booked needs explicit acknowledgement, keeps every order, and stops new bookings", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const weekday = isoWeekday(utcDate(s.date));
    await payVendor(await bookVendor(s));
    await payVendor(await bookVendor(s, (await extraBuyer(s)).id));

    const preview = await previewRosterChange("VENDOR", cell(s.slot.id, weekday, [], 1));
    assert.deepEqual(preview.overCapacity.map((o) => [o.date, o.booked, o.newLimit]), [[s.date, 2, 1]]);
    await assert.rejects(change("VENDOR", cell(s.slot.id, weekday, [], 1)), isConflict, "refused without the decision");
    assert.equal(await prisma.rosterSlotDay.count({ where: { slotId: s.slot.id } }), 0, "nothing was written");

    await change("VENDOR", cell(s.slot.id, weekday, [], 1), { acknowledgeOverCapacity: true });
    assert.equal(await prisma.order.count({ where: { businessId: s.vendor.id, paymentStatus: "paid", status: "ACCEPTED" } }), 2, "both orders kept");
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, utcDate(s.date)), 2);
    await assert.rejects(bookVendor(s, (await extraBuyer(s)).id), isConflict);
    const view = await getRosterDate("VENDOR", s.date);
    assert.equal(view.slots.find((x) => x.slot.id === s.slot.id)?.occurrence.overCapacity, true);
  });

  it("raising or lowering a limit doesn't change anyone's planned deliverer", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const d = await makeDeliverer();
    const weekday = isoWeekday(utcDate(s.date));
    await change("VENDOR", cell(s.slot.id, weekday, [d.id]));
    const res = await bookVendor(s);
    await payVendor(res);
    const booking = await prisma.vendorDeliveryBooking.findFirstOrThrow({ where: { paystackReference: res.reference } });
    await change("VENDOR", cell(s.slot.id, weekday, [d.id], 5));
    await change("VENDOR", cell(s.slot.id, weekday, [d.id], 1));
    assert.equal((await planOfBooking(booking.id)).plannedDelivererId, d.id);
  });
});

describe("plans: which deliverer a booked delivery is planned for", () => {
  it("a vendor booking is planned from the roster for its weekday; a date exception overrides only that date", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const [david, sarah] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    const weekday = isoWeekday(utcDate(s.date));
    await change("VENDOR", cell(s.slot.id, weekday, [david.id]));

    const first = await bookVendor(s);
    const firstBooking = await prisma.vendorDeliveryBooking.findFirstOrThrow({ where: { paystackReference: first.reference } });
    assert.equal((await planOfBooking(firstBooking.id)).plannedDelivererId, david.id);

    // David is unavailable that one date: Sarah covers it. The weekly template is untouched.
    const exception: RosterChange = { kind: "exception", slotId: s.slot.id, date: utcDate(s.date), closed: false, maxDeliveries: null, replaceDeliverers: true, delivererIds: [sarah.id], note: "David away" };
    await assert.rejects(change("VENDOR", exception), isConflict, "the already-planned delivery needs a decision");
    const result = await change("VENDOR", exception, { planResolution: "replan" });
    assert.equal(result.replanned, 1);
    assert.equal((await planOfBooking(firstBooking.id)).plannedDelivererId, sarah.id);

    const second = await bookVendor(s, (await extraBuyer(s)).id);
    const secondBooking = await prisma.vendorDeliveryBooking.findFirstOrThrow({ where: { paystackReference: second.reference } });
    assert.equal((await planOfBooking(secondBooking.id)).plannedDelivererId, sarah.id);
    assert.deepEqual((await resolveOccurrence("VENDOR", s.slot.id, addDays(utcDate(s.date), 7))).staff, [david.id], "next week is back to the template");
    assert.deepEqual((await prisma.rosterAssignment.findMany({ where: { slotId: s.slot.id } })).map((a) => a.delivererId), [david.id]);

    // Restoring the weekly roster for that date, keeping the current plans.
    await change("VENDOR", { kind: "clear-exception", slotId: s.slot.id, date: utcDate(s.date) }, { planResolution: "keep" });
    assert.equal((await planOfBooking(secondBooking.id)).plannedDelivererId, sarah.id, "kept as chosen");
    assert.deepEqual((await resolveOccurrence("VENDOR", s.slot.id, utcDate(s.date))).staff, [david.id]);
  });

  it("closing a slot for a date refuses new bookings there and keeps existing ones (after acknowledgement)", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    await payVendor(await bookVendor(s));
    const close: RosterChange = { kind: "exception", slotId: s.slot.id, date: utcDate(s.date), closed: true, maxDeliveries: null, replaceDeliverers: false, delivererIds: [], note: null };
    await assert.rejects(change("VENDOR", close), isConflict);
    await change("VENDOR", close, { acknowledgeOverCapacity: true });
    await assert.rejects(bookVendor(s, (await extraBuyer(s)).id), (e) => isConflict(e) && /isn't available on that date/.test((e as Error).message));
    assert.equal(await prisma.order.count({ where: { businessId: s.vendor.id, paymentStatus: "paid" } }), 1);
  });

  it("roster changes leave manual and dispatched plans alone; re-plans only roster plans the admin chose to re-plan", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const [david, sarah, mike] = await Promise.all([makeDeliverer(), makeDeliverer(), makeDeliverer()]);
    const weekday = isoWeekday(utcDate(s.date));
    await change("VENDOR", cell(s.slot.id, weekday, [david.id]));

    const bookings = [];
    for (let i = 0; i < 3; i++) {
      const res = await bookVendor(s, i === 0 ? s.buyer.id : (await extraBuyer(s)).id);
      await payVendor(res);
      bookings.push(await prisma.vendorDeliveryBooking.findFirstOrThrow({ where: { paystackReference: res.reference }, include: { orders: { include: { items: true } } } }));
    }
    const [dispatchedBooking, manualBooking, rosterBooking] = bookings;
    // One is really assigned to David (dispatched); one an admin planned for Mike by hand.
    // Paid vendor orders are assignable at once — vendors never mark them ready.
    const assigned = await assignPlannedDeliveries(dispatchedBooking.orders[0].items.map((i) => i.id), await admin());
    assert.deepEqual(assigned.assigned.map((a) => a.delivererId), [david.id]);
    await setPlannedDeliverer({ bookingId: manualBooking.id, delivererId: mike.id }, await admin());

    const swap = cell(s.slot.id, weekday, [sarah.id]);
    const impact = await previewRosterChange("VENDOR", swap);
    assert.deepEqual(impact.replans.map((r) => r.scheduledDeliveryId), [(await planOfBooking(rosterBooking.id)).id]);
    assert.deepEqual(impact.unchanged.map((u) => u.reason).sort(), ["dispatched", "manual"]);

    await change("VENDOR", swap, { planResolution: "replan" });
    assert.equal((await planOfBooking(rosterBooking.id)).plannedDelivererId, sarah.id);
    assert.equal((await planOfBooking(manualBooking.id)).plannedDelivererId, mike.id, "manual plan untouched");
    assert.equal((await planOfBooking(dispatchedBooking.id)).plannedDelivererId, david.id, "dispatched plan untouched");
    const delivery = await prisma.deliveryItem.findFirstOrThrow({ where: { orderItemId: dispatchedBooking.orders[0].items[0].id }, include: { delivery: true } });
    assert.equal(delivery.delivery.deliverymanId, david.id, "the real assignment is never changed by the roster");
    assert.equal(delivery.status, "ASSIGNED");
    assert.ok(await prisma.orderEvent.findFirst({ where: { orderId: dispatchedBooking.orders[0].id, type: "DELIVERER_ASSIGNED" } }), "existing events still recorded");
  });

  it("suspended or rejected deliverers are never planned, and can't be planned by hand", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const [david, sarah] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    await prisma.vendorDeliverySlot.update({ where: { id: s.slot.id }, data: { delivererCapacity: 2 } });
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [david.id, sarah.id]));
    await prisma.deliverer.update({ where: { id: david.id }, data: { status: "SUSPENDED" } });
    for (let i = 0; i < 2; i++) {
      const res = await bookVendor(s, i === 0 ? s.buyer.id : (await extraBuyer(s)).id);
      const booking = await prisma.vendorDeliveryBooking.findFirstOrThrow({ where: { paystackReference: res.reference } });
      assert.equal((await planOfBooking(booking.id)).plannedDelivererId, sarah.id);
    }
    const plan = await prisma.scheduledDelivery.findFirstOrThrow({ where: { slotId: s.slot.id } });
    await assert.rejects(setPlannedDeliverer({ scheduledDeliveryId: plan.id, delivererId: david.id }, await admin()), isBadRequest);
  });

  it("vendor bookings made before rosters existed keep working: counted, shown with a roster suggestion, assignable as planned", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const [d, other] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    await change("VENDOR", cell(s.slot.id, isoWeekday(utcDate(s.date)), [d.id], 1));
    // A paid booking written the way checkout did before rosters existed: no ScheduledDelivery row.
    const booking = await prisma.vendorDeliveryBooking.create({
      data: { userId: s.buyer.id, slotId: s.slot.id, paystackReference: `LEGACY-${Date.now()}`, deliveryFee: 1000, status: "CONFIRMED", bookedFor: utcDate(s.date) },
    });
    const order = await prisma.order.create({
      data: {
        userId: s.buyer.id,
        businessId: s.vendor.id,
        status: "ACCEPTED",
        fulfillmentStatus: "PROCESSING",
        paymentStatus: "paid",
        paystackReference: booking.paystackReference,
        vendorDeliveryBookingId: booking.id,
        totalAmount: 2000,
        items: { create: [{ productId: s.product.id, quantity: 1, price: 2000 }] },
      },
      include: { items: true },
    });
    assert.equal(await prisma.scheduledDelivery.count({ where: { bookingId: booking.id } }), 0);
    assert.equal(await countReservedDeliveries("VENDOR", s.slot.id, utcDate(s.date)), 1, "it counts toward the new limit");
    await assert.rejects(bookVendor(s, (await extraBuyer(s)).id), isConflict);

    const row = (await getRosterDate("VENDOR", s.date)).slots.find((x) => x.slot.id === s.slot.id)!.deliveries[0];
    assert.deepEqual([row.scheduledDeliveryId, row.plannedDeliverer?.id, row.planSource], [null, d.id, "SUGGESTED"]);
    assert.equal(await prisma.scheduledDelivery.count({ where: { bookingId: booking.id } }), 0, "viewing never writes");

    // An admin can plan it by hand (the row is created then), and assign it as planned.
    await setPlannedDeliverer({ bookingId: booking.id, delivererId: other.id }, await admin());
    assert.deepEqual(await planOfBooking(booking.id).then((p) => [p.plannedDelivererId, p.planSource, isoDate(p.date)]), [other.id, "MANUAL", s.date]);
    const out = await assignPlannedDeliveries(order.items.map((i) => i.id), await admin());
    assert.deepEqual([out.assigned.map((a) => a.delivererId), out.skipped.length], [[other.id], 0]);
    await assert.rejects(setPlannedDeliverer({ bookingId: booking.id, delivererId: d.id }, await admin()), isConflict, "frozen once dispatched");
  });
});

describe("central (Marketplace) deliveries", () => {
  async function centralSetup(limit: number | null) {
    const a = await admin();
    const early = await createCentralSlot({ label: "Early", windowStart: "09:00", windowEnd: "10:00" }, a);
    const late = await createCentralSlot({ label: "Late", windowStart: "17:00", windowEnd: "18:00" }, a);
    // Earlier tests' deliveries (in now-retired slots) share this database, so a strict default may need acknowledging.
    if (limit !== null) await change("MARKETPLACE", { kind: "default", defaultMaxDeliveries: limit }, { acknowledgeOverCapacity: true });
    return { early, late };
  }
  const firstDay = () => addDays(todayInSchoolTimezone(), 2);
  const scheduleOf = (orderId: string) => prisma.scheduledDelivery.findUniqueOrThrow({ where: { orderId } });

  it("with no central slots configured, unpriced Business checkout is refused", async () => {
    const s = await businessCheckoutScenario();
    const { createOrdersForCheckout: createUnpriced } = await import("@/services/marketplace/checkout/create-orders-for-checkout");
    await assert.rejects(createUnpriced(s.buyer.id, "Hall A"), /pricing is unavailable/);
  });

  it("books the earliest slot with room on the seller's delivery days; a full slot sends the next order to the next slot", async () => {
    const { early, late } = await centralSetup(1);
    const d = await makeDeliverer();
    await change("MARKETPLACE", cell(early.id, isoWeekday(firstDay()), [d.id], 1));

    const a = await businessCheckoutScenario({ stock: 5 });
    const first = await createOrdersForCheckout(a.buyer.id, "Hall A");
    const s1 = await scheduleOf(first.orderIds[0]);
    assert.deepEqual([s1.slotId, isoDate(s1.date), s1.plannedDelivererId], [early.id, isoDate(firstDay()), d.id]);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: first.orderIds[0] } });
    assert.equal(order.deliveryWindowStart?.toISOString(), `${isoDate(firstDay())}T08:00:00.000Z`, "09:00 Lagos is 08:00 UTC");
    assert.equal(order.estimatedDeliveryAt?.toISOString(), order.deliveryWindowStart?.toISOString());

    const b = await businessCheckoutScenario({ stock: 5 });
    const summary = await getCheckoutSummary(b.buyer.id);
    assert.match(summary.items[0].deliveryWindow, /5:00 PM - 6:00 PM/, "summary shows the slot checkout will book");
    const second = await createOrdersForCheckout(b.buyer.id, "Hall B");
    const s2 = await scheduleOf(second.orderIds[0]);
    assert.deepEqual([s2.slotId, isoDate(s2.date)], [late.id, isoDate(firstDay())]);
    const c = await businessCheckoutScenario({ stock: 5 });
    const third = await createOrdersForCheckout(c.buyer.id, "Hall C");
    const s3 = await scheduleOf(third.orderIds[0]);
    assert.deepEqual([s3.slotId, isoDate(s3.date), s3.isOverflow], [early.id, isoDate(firstDay()), true], "both regular slots full -> explicit overflow on the same day");
  });

  it("respects the seller's delivery weekdays", async () => {
    await centralSetup(null);
    const s = await businessCheckoutScenario();
    const target = addDays(firstDay(), 2);
    const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
    await prisma.businessDeliveryDay.create({ data: { businessId: s.business.id, day: WEEKDAYS[target.getUTCDay()] } });
    const res = await createOrdersForCheckout(s.buyer.id, "Hall A");
    assert.equal(isoDate((await scheduleOf(res.orderIds[0])).date), isoDate(target));
  });

  it("when every slot has zero capacity or is closed, checkout refuses rather than assign to a closed day", async () => {
    await centralSetup(0);
    const s = await businessCheckoutScenario({ stock: 5 });
    await assert.rejects(createOrdersForCheckout(s.buyer.id, "Hall A"), (e) => isConflict(e) && /pricing is unavailable/.test((e as Error).message));
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: s.product.id } })).stock, 5, "nothing reserved");
    assert.equal((await getCheckoutSummary(s.buyer.id)).items[0].estimatedDeliveryDate, "Unavailable");
  });

  it("concurrent Business checkouts preserve regular limits and explicitly mark round-robin overflow", async () => {
    await centralSetup(1);
    const scenarios = await Promise.all([1, 2, 3, 4, 5].map(() => businessCheckoutScenario({ stock: 5 })));
    const results = await Promise.allSettled(scenarios.map((s) => createOrdersForCheckout(s.buyer.id, "Hall")));
    assert.ok(results.every((r) => r.status === "fulfilled"), "everyone is booked on the eligible date");
    const rows = await prisma.scheduledDelivery.findMany({ where: { orderId: { in: results.map((r) => (r as PromiseFulfilledResult<{ orderIds: string[] }>).value.orderIds[0]) } } });
    assert.equal(rows.filter((r) => !r.isOverflow).length, 2);
    assert.equal(rows.filter((r) => r.isOverflow).length, 3);
    assert.equal(new Set(rows.map((r) => r.orderId)).size, 5);
    assert.ok(rows.every((r) => isoDate(r.date) === isoDate(firstDay())));
    assert.deepEqual(rows.reduce<number[]>((counts, row) => {
      const i = rows[0].slotId === row.slotId ? 0 : 1;
      counts[i] = (counts[i] ?? 0) + 1;
      return counts;
    }, []).sort(), [2, 3]);
  });

  it("cycles four ranges of three bookings before the thirteenth triggers overflow", async () => {
    const { early, late } = await centralSetup(3);
    const last = await createCentralSlot({ label: "Last", windowStart: "19:00", windowEnd: "20:00" }, await admin());
    const final = await createCentralSlot({ label: "Final", windowStart: "20:00", windowEnd: "21:00" }, await admin());
    const rows = [];
    for (let n = 0; n < 13; n++) {
      const scenario = await businessCheckoutScenario();
      const result = await createOrdersForCheckout(scenario.buyer.id, "Hall");
      rows.push(await scheduleOf(result.orderIds[0]));
    }
    assert.deepEqual(rows.map((r) => r.slotId), Array.from({ length: 13 }, (_, i) => [early.id, late.id, last.id, final.id][i % 4]));
    assert.deepEqual(rows.map((r) => r.isOverflow), Array.from({ length: 13 }, (_, i) => i === 12));
    assert.ok(rows.every((r) => isoDate(r.date) === isoDate(firstDay())));
  });

  it("multi-business checkout preview simulates the same round-robin allocations as checkout", async () => {
    const { early, late } = await centralSetup(3);
    const a = await businessCheckoutScenario();
    const b = await businessCheckoutScenario();
    await addToCart(a.buyer.id, b.product.id, 1);
    const summary = await getCheckoutSummary(a.buyer.id);
    assert.deepEqual(summary.items.map((i) => i.deliveryWindow), ["9:00 AM - 10:00 AM", "5:00 PM - 6:00 PM"]);
    const result = await createOrdersForCheckout(a.buyer.id, "Hall");
    const plans = await Promise.all(result.orderIds.map(scheduleOf));
    assert.deepEqual(plans.map((p) => p.slotId), [early.id, late.id]);
  });

  it("skips disabled weekdays and holiday exceptions at the inclusive minimum date", async () => {
    const { early, late } = await centralSetup(2);
    const scenario = await businessCheckoutScenario();
    const minimum = firstDay();
    await change("MARKETPLACE", cell(early.id, isoWeekday(minimum), [], 0));
    await change("MARKETPLACE", cell(late.id, isoWeekday(minimum), [], 0));
    for (const slot of [early, late]) await change("MARKETPLACE", { kind: "exception", slotId: slot.id, date: addDays(minimum, 1), closed: true, maxDeliveries: null, replaceDeliverers: false, delivererIds: [], note: "Holiday" });
    const result = await findCentralSlot(scenario.business.id);
    assert.ok(result && result !== "full");
    assert.equal(isoDate(result.date), isoDate(addDays(minimum, 2)));
  });

  it("an expired pending payment cannot take normal capacity reused by another checkout", async () => {
    const { early } = await centralSetup(1);
    const a = await createOrdersForCheckout((await businessCheckoutScenario()).buyer.id, "Hall");
    const old = addDays(new Date(), -1);
    await prisma.order.updateMany({ where: { paystackReference: a.reference }, data: { createdAt: old } });
    await prisma.checkoutPayment.update({ where: { reference: a.reference }, data: { expiresAt: old } });
    const b = await createOrdersForCheckout((await businessCheckoutScenario()).buyer.id, "Hall");
    assert.equal((await scheduleOf(b.orderIds[0])).slotId, early.id);
    await payVendor(b);
    const latePayment = await payVendor(a);
    assert.equal(latePayment.state, "needs_review");
    assert.equal(await countReservedDeliveries("MARKETPLACE", early.id, firstDay()), 1);
  });

  it("overview counts paid deliveries, overflow and completion independently and gates the API", async () => {
    signInAs(null);
    assert.equal((await getOverview()).status, 401);
    const user = await makeUser(); signInAs(user);
    assert.equal((await getOverview()).status, 403);
    signInAs(null);
    await centralSetup(1);
    const before = await getDeliveryOverview();
    const results = [];
    for (let n = 0; n < 3; n++) results.push(await createOrdersForCheckout((await businessCheckoutScenario()).buyer.id, "Hall"));
    assert.equal((await getDeliveryOverview()).business.total, before.business.total, "unpaid holds are not scheduled delivery statistics");
    for (const result of results) await payVendor(result);
    let view = await getDeliveryOverview();
    assert.equal(view.business.total, before.business.total + 3);
    assert.equal(view.business.overflow, before.business.overflow + 1);
    assert.equal(view.vendor.total, before.vendor.total);
    await prisma.orderItem.updateMany({ where: { orderId: results[0].orderIds[0] }, data: { deliveryStatus: "DELIVERED" } });
    view = await getDeliveryOverview();
    assert.equal(view.business.completed, before.business.completed + 1);
    const vendor = await vendorCheckoutScenario();
    await payVendor(await bookVendor(vendor));
    view = await getDeliveryOverview();
    assert.equal(view.vendor.total, before.vendor.total + 1);
    assert.equal(view.business.total, before.business.total + 3);
  });

  it("sends overflow notices only beyond full regular capacity, commits atomically and deduplicates retries", async () => {
    const { early, late } = await centralSetup(1);
    const d = await makeDeliverer();
    await change("MARKETPLACE", cell(early.id, isoWeekday(firstDay()), [d.id], 1));
    await change("MARKETPLACE", cell(late.id, isoWeekday(firstDay()), [d.id], 1));
    const checkouts = [];
    for (let n = 0; n < 3; n++) {
      const scenario = await businessCheckoutScenario();
      checkouts.push(await createOrdersForCheckout(scenario.buyer.id, "Hall"));
    }
    for (const checkout of checkouts) await payVendor(checkout);
    for (const checkout of checkouts.slice(0, 2)) assert.equal(await prisma.notification.count({ where: { orderId: checkout.orderIds[0], type: "DELIVERY_OVERFLOW" } }), 0);
    const orderId = checkouts[2].orderIds[0];
    const notice = await prisma.notification.findFirstOrThrow({ where: { userId: d.userId, orderId, type: "DELIVERY_OVERFLOW" } });
    assert.match(notice.message, /all regular slots are full; [1-9]\d* overflow/);
    assert.ok(notice.message.includes(isoDate(firstDay())) && notice.message.includes(early.label) && notice.message.includes(orderId));
    assert.ok(await prisma.notification.findFirst({ where: { userId: await admin(), orderId, type: "DELIVERY_OVERFLOW", scope: "ADMIN" } }));
    const before = await prisma.notification.count({ where: { orderId, type: "DELIVERY_OVERFLOW" } });
    await Promise.all([1, 2].map(() => prisma.$transaction((tx) => notifyOverflowAssignments(tx, [orderId]), { timeout: 20000 })));
    await payVendor(checkouts[2]);
    assert.equal(await prisma.notification.count({ where: { orderId, type: "DELIVERY_OVERFLOW" } }), before);
    const newAdmin = await makeUser({ isAdmin: true });
    await assert.rejects(prisma.$transaction(async (tx) => { await notifyOverflowAssignments(tx, [orderId]); throw new Error("rollback"); }, { timeout: 20000 }), /rollback/);
    assert.equal(await prisma.notification.count({ where: { userId: newAdmin.id, orderId, type: "DELIVERY_OVERFLOW" } }), 0);
    await prisma.$transaction((tx) => notifyOverflowAssignments(tx, [orderId]), { timeout: 20000 });
    assert.equal(await prisma.notification.count({ where: { userId: newAdmin.id, orderId, type: "DELIVERY_OVERFLOW" } }), 1);
    const view = await getRosterDate("MARKETPLACE", isoDate(firstDay()));
    const extra = view.slots.flatMap((slot) => slot.deliveries).find((row) => row.orderIds.includes(orderId))!;
    assert.equal(extra.isOverflow, true);
    assert.deepEqual(extra.notifiedDeliverers.map((p) => p.id), [d.id]);
    assert.equal(view.slots.find((s) => s.slot.id === early.id)!.occurrence.status, "full");
  });

  it("keeps overflow alerts quiet when capacity becomes sufficient, without moving confirmed plans", async () => {
    await centralSetup(1);
    const results = [];
    for (let n = 0; n < 3; n++) results.push(await createOrdersForCheckout((await businessCheckoutScenario()).buyer.id, "Hall"));
    await change("MARKETPLACE", { kind: "default", defaultMaxDeliveries: 10 });
    const before = await scheduleOf(results[2].orderIds[0]);
    await payVendor(results[2]);
    assert.equal(await prisma.notification.count({ where: { orderId: before.orderId, type: "DELIVERY_OVERFLOW" } }), 0);
    const after = await scheduleOf(results[2].orderIds[0]);
    assert.deepEqual([after.slotId, after.date, after.isOverflow], [before.slotId, before.date, true]);
  });

  it("shows only the deliverer's own planned and dispatched deliveries with capacity and overflow metadata", async () => {
    const { early } = await centralSetup(1);
    const [d, outsider] = await Promise.all([makeDeliverer(), makeDeliverer()]);
    await change("MARKETPLACE", cell(early.id, isoWeekday(firstDay()), [d.id], 1));
    const scenario = await businessCheckoutScenario();
    const result = await createOrdersForCheckout(scenario.buyer.id, "Hall");
    await payVendor(result);
    let mine = await listMySchedule(d.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].operation, "MARKETPLACE");
    assert.equal(mine[0].full, true);
    assert.equal(mine[0].dispatched, false);
    assert.equal((await listMySchedule(outsider.id)).length, 0);
    await prisma.order.update({ where: { id: result.orderIds[0] }, data: { status: "ACCEPTED", sellerDroppedOffAt: new Date() } });
    const items = await prisma.orderItem.findMany({ where: { orderId: result.orderIds[0] } });
    const runs = await Promise.allSettled([1, 2].map(() => assignPlannedDeliveries(items.map((i) => i.id), adminId)));
    assert.ok(runs.some((r) => r.status === "fulfilled"));
    const owned = await prisma.deliveryItem.findMany({ where: { orderItemId: { in: items.map((i) => i.id) } } });
    assert.equal(owned.length, items.length);
    assert.equal(await prisma.orderEvent.count({ where: { orderId: result.orderIds[0], type: "DELIVERER_ASSIGNED" } }), items.length);
    mine = await listMySchedule(d.id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].dispatched, true);
    const again = await assignPlannedDeliveries(items.map((i) => i.id), adminId);
    assert.equal(again.assigned.length, 0);
    assert.equal(again.skipped.length, items.length);
    assert.equal((await listAssignedDeliveryItems(d.id))[0].windowStartAt, `${isoDate(firstDay())}T08:00:00.000Z`);
    assert.equal((await listAssignedDeliveryItems(outsider.id)).length, 0);
    signInAs(null);
    assert.equal((await getSchedule()).status, 401);
    signInAs(scenario.buyer);
    assert.equal((await getSchedule()).status, 403);
  });

  it("a rejected or cancelled order frees its central slot", async () => {
    const { early } = await centralSetup(1);
    const s = await businessCheckoutScenario({ stock: 5 });
    const res = await createOrdersForCheckout(s.buyer.id, "Hall A");
    paystack.set(res.reference, { status: "success", amount: res.amountKobo });
    await reconcileCheckoutPayment(res.reference, "verify");
    assert.equal(await countReservedDeliveries("MARKETPLACE", early.id, firstDay()), 1);
    signInAs(s.owner);
    await rejectOrder(s.business.id, res.orderIds[0], s.owner.id, "Out of stock");
    assert.equal(await countReservedDeliveries("MARKETPLACE", early.id, firstDay()), 0);
    const next = await businessCheckoutScenario({ stock: 5 });
    const again = await createOrdersForCheckout(next.buyer.id, "Hall B");
    assert.equal((await scheduleOf(again.orderIds[0])).slotId, early.id, "the freed place is reused");
  });

  it("assign as planned hands each order to its planned deliverer through the normal assignment (OTP, events, status)", async () => {
    const { early } = await centralSetup(null);
    const d = await makeDeliverer();
    await change("MARKETPLACE", cell(early.id, isoWeekday(firstDay()), [d.id]));
    const s = await businessCheckoutScenario({ stock: 5 });
    const res = await createOrdersForCheckout(s.buyer.id, "Hall A");
    paystack.set(res.reference, { status: "success", amount: res.amountKobo });
    await reconcileCheckoutPayment(res.reference, "verify");
    // Seller accepted and dropped off at the central point (the OTP handoff itself is covered elsewhere).
    await prisma.order.update({ where: { id: res.orderIds[0] }, data: { status: "ACCEPTED", fulfillmentStatus: "READY_FOR_PICKUP", sellerDroppedOffAt: new Date() } });
    const items = await prisma.orderItem.findMany({ where: { orderId: res.orderIds[0] } });
    const out = await assignPlannedDeliveries(items.map((i) => i.id), await admin());
    assert.equal(out.assigned[0].delivererId, d.id);
    assert.match(out.assigned[0].handoffs[0].pickupOtp ?? "", /^\d{6}$/, "a Business handoff still has its coordinator pickup code");
    assert.equal((await prisma.orderItem.findUniqueOrThrow({ where: { id: items[0].id } })).deliveryStatus, "ASSIGNED");
    assert.ok(await prisma.notification.findFirst({ where: { userId: s.buyer.id, type: "ORDER_ASSIGNED_TO_DELIVERER" } }));
  });
});

describe("views and the deliverer's schedule", () => {
  it("the weekly view: slots x 7 days, upcoming bookings, limits, unassigned and exception flags", async () => {
    const s = await vendorCheckoutScenario({ capacity: 10, stock: 10 });
    const d = await makeDeliverer();
    const weekday = isoWeekday(utcDate(s.date));
    await change("VENDOR", cell(s.slot.id, weekday, [d.id], 1));
    await payVendor(await bookVendor(s));
    const week = await getRosterWeek("VENDOR");
    assert.deepEqual(week.days.map((x) => x.name), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
    const cells = week.cells.filter((c) => c.slotId === s.slot.id);
    assert.equal(cells.length, 7);
    const target = cells.find((c) => c.weekday === weekday)!;
    assert.deepEqual([target.deliverers.map((x) => x.id), target.effectiveMax, target.upcoming.booked, target.upcoming.status], [[d.id], 1, 1, "full"]);
    assert.ok(cells.filter((c) => c.weekday !== weekday).every((c) => c.deliverers.length === 0), "other days unassigned");
  });

  it("the deliverer sees recurring shifts for both operations, and a date exception removing them", async () => {
    const s = await vendorCheckoutScenario();
    const central = await createCentralSlot({ label: "Central", windowStart: "12:00", windowEnd: "13:00" }, await admin());
    const d = await makeDeliverer();
    const tomorrow = utcDate(lagosDatePlus(1));
    await change("VENDOR", cell(s.slot.id, isoWeekday(tomorrow), [d.id]));
    await change("MARKETPLACE", cell(central.id, isoWeekday(tomorrow), [d.id]));
    let mine = await listMyRoster(d.id);
    assert.equal(mine.filter((m) => m.date.startsWith(isoDate(tomorrow))).length, 2);
    assert.equal(mine.filter((m) => m.date.startsWith(isoDate(addDays(tomorrow, 7)))).length, 2, "and again next week");
    assert.ok(mine.every((m) => m.status === "SCHEDULED"));

    await change("VENDOR", { kind: "exception", slotId: s.slot.id, date: tomorrow, closed: true, maxDeliveries: null, replaceDeliverers: false, delivererIds: [], note: "Holiday" });
    mine = await listMyRoster(d.id);
    assert.deepEqual(mine.filter((m) => m.date.startsWith(isoDate(tomorrow))).map((m) => m.operation), ["MARKETPLACE"]);
    assert.ok(await prisma.notification.findFirst({ where: { userId: d.userId, title: "Delivery slot closed" } }));
  });
});

describe("authorization", () => {
  const req = (url: string, body?: unknown) =>
    new NextRequest(`https://akadverse.test${url}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  it("only admins can read or change a roster; vendors and deliverers can't, whatever they send", async () => {
    const s = await vendorCheckoutScenario();
    const d = await makeDeliverer();
    const body = { operation: "VENDOR", change: { kind: "cell", slotId: s.slot.id, weekday: 1, delivererIds: [d.id], maxDeliveries: 1 } };

    signInAs(null);
    assert.equal((await postChange(req("/api/marketplace/admin/delivery-roster/changes", body))).status, 401);
    assert.equal((await getWeek(req("/api/marketplace/admin/delivery-roster?operation=VENDOR"))).status, 401);
    for (const who of [s.owner, s.buyer, await prisma.user.findUniqueOrThrow({ where: { id: d.userId } })]) {
      signInAs(who);
      assert.equal((await postChange(req("/api/marketplace/admin/delivery-roster/changes", body))).status, 403);
      assert.equal((await getWeek(req("/api/marketplace/admin/delivery-roster?operation=VENDOR"))).status, 403);
    }
    assert.equal(await prisma.rosterAssignment.count({ where: { slotId: s.slot.id } }), 0, "nothing written");

    signInAs(await prisma.user.findUniqueOrThrow({ where: { id: await admin() } }));
    assert.equal((await postChange(req("/api/marketplace/admin/delivery-roster/changes", body))).status, 200);
    assert.equal((await postChange(req("/api/marketplace/admin/delivery-roster/changes", { ...body, operation: "EVERYTHING" }))).status, 400);
    assert.equal((await getWeek(req("/api/marketplace/admin/delivery-roster?operation=VENDOR"))).status, 200);
  });
});
