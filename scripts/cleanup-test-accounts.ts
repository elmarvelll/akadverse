// DESTRUCTIVE one-off: removes every user account except the retained Marvelous test accounts, plus all user-generated data
// that belongs to them, from BOTH databases. Reference/developer data (CCMAS, colleges, departments, programmes, courses,
// curriculum, sessions, settings, slots...) is never touched. The schema and migrations are never touched.
//
// Safety design (the two databases are separate servers, so there is NO atomic cross-database rollback):
//   - DRY RUN is the default. Nothing is written unless --execute is passed.
//   - DRIFT GUARD: the retained set must be exactly the 5 approved accounts, the delete set exactly the 10 approved accounts,
//     and every projected row count must equal the approved numbers below — otherwise it aborts before writing anything.
//   - BACKUP + MANIFEST first: every row to be deleted is saved as JSON in .cleanup-backups/<timestamp>/ (git-ignored).
//   - ORDER: E-Learning first, then Main, each in ONE transaction. If Main fails after E-Learning succeeded, the accounts still
//     exist with no student profile (a state the app already supports) and re-running finishes the job.
//   - IDEMPOTENT: every delete is keyed on the manifest's user ids, so a finished phase deletes 0 rows when re-run.
//   - STATUS: status.json records each phase (pending | done | failed) so a partial run is reported exactly and can be resumed.
//
// Usage:
//   npx tsx --env-file=.env scripts/cleanup-test-accounts.ts                               # dry run (default)
//   npx tsx --env-file=.env scripts/cleanup-test-accounts.ts --execute                     # run it
//   npx tsx --env-file=.env scripts/cleanup-test-accounts.ts --execute --manifest <dir>    # resume a partial run
//   npx tsx --env-file=.env scripts/cleanup-test-accounts.ts --verify                      # read-only post-check

import fs from "node:fs";
import path from "node:path";
import { prisma as core } from "../src/lib/prisma";
import { elearningDb as db } from "../src/lib/db/elearning";

// ---- what was approved ------------------------------------------------------------------------------------------------------
const RETAINED = new Map([
  ["076894a1-5a31-4005-bb88-66d84923f421", "marvelousifezue31@gmail.com"],
  ["495b75c5-46bc-4e01-813e-ee8ae6871371", "marvelousifezue31@stu.cu.edu.ng"],
  ["0ed138ab-1ff9-4637-bc08-98e27577c8ba", "marvelousifezue31@faculty.cu.edu.ng"],
  ["b02c30bf-e7f3-4bae-88c1-049d1e6bd654", "marvelousifezue31@hodeie.cu.stu.ng"],
  ["91fa7355-6405-4278-89cd-d733146c1369", "marvelousifezue31@dapu.cu.edu.ng"],
]);
const TO_DELETE = new Map([
  ["28ff8971-e80d-426f-9b9f-2d3f6337a507", "marvelousifezue15@gmail.com"],
  ["2fff86ee-bd9c-4f1d-b0b9-69f4c55a344c", "isaacisimi@gmail.com"],
  ["4f275ba7-b897-4c84-8efe-5b7cc591c46a", "chatchidiup@gmail.com"],
  ["f3905c8a-fff7-46bc-9f9d-091f6e5195f3", "mhenry.2303502@stu.cu.edu.ng"],
  ["71bdcdf2-9765-46ad-acb5-08bc64bd5adb", "awesomenes884@gmail.com"],
  ["a7997be0-df71-49f5-8d8b-80a40823a1bd", "ronuoha.2301590@stu.cu.edu.ng"],
  ["74592a43-7b81-4313-8a6f-1de9ae5af10a", "saguele.2302241@stu.cu.edu.ng"],
  ["e8a8b704-4cc6-4ab9-8eae-72564fd23830", "onuoharobert8@gmail.com"],
  ["04f1f5b2-8c91-4082-8205-90e67d7c16f7", "inventorfiyin.2022@gmail.com"],
  ["4e805367-6ab0-4d9e-9ef8-d7ad242da2dd", "mifezue.2301777@stu.cu.edu.ng"],
]);
const EXPECTED_MAIN = { deliveryItem: 1, delivery_x_businesses: 1, delivery: 1, orderEvent: 42, orderItem: 6, order: 5, cartItem: 4, variantValueOnProductVariant: 7, productVariant: 7, variantValue: 7, variantField: 3, productImage: 4, product: 6, side: 1, businessDeliveryDay: 11, vendorTimeframeCapacity: 3, business: 9, notification: 16, user: 10 } as const;
const EXPECTED_ELEARNING = { studentProfile: 1 } as const;

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const VERIFY = args.includes("--verify");
const manifestArg = args.includes("--manifest") ? args[args.indexOf("--manifest") + 1] : null;
const ROOT = process.cwd(); // run from the repo root
const json = (o: unknown) => JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v), 2);

type Status = { phase: string; state: "pending" | "done" | "failed"; counts?: Record<string, number>; error?: string };

async function computeSets(delIds: string[]) {
  const biz = (await core.business.findMany({ where: { userId: { in: delIds } }, select: { id: true } })).map((b) => b.id);
  const prod = (await core.product.findMany({ where: { businessId: { in: biz } }, select: { id: true } })).map((p) => p.id);
  const side = (await core.side.findMany({ where: { businessId: { in: biz } }, select: { id: true } })).map((s) => s.id);
  const orders = (await core.order.findMany({ where: { OR: [{ userId: { in: delIds } }, { businessId: { in: biz } }] }, select: { id: true } })).map((o) => o.id);
  const items = (await core.orderItem.findMany({ where: { OR: [{ orderId: { in: orders } }, { productId: { in: prod } }, { sideId: { in: side } }] }, select: { id: true } })).map((i) => i.id);
  const vf = (await core.variantField.findMany({ where: { productId: { in: prod } }, select: { id: true } })).map((x) => x.id);
  const pv = (await core.productVariant.findMany({ where: { productId: { in: prod } }, select: { id: true } })).map((x) => x.id);
  const vv = (await core.variantValue.findMany({ where: { fieldId: { in: vf } }, select: { id: true } })).map((x) => x.id);
  const dItems = await core.deliveryItem.findMany({ where: { OR: [{ orderItemId: { in: items } }, { businessId: { in: biz } }] }, select: { id: true, deliveryId: true } });
  const allDelItems = await core.deliveryItem.findMany({ select: { id: true, deliveryId: true } });
  const dItemIds = dItems.map((d) => d.id);
  const emptyDeliveries = [...new Set(dItems.map((d) => d.deliveryId))].filter((id) => allDelItems.filter((x) => x.deliveryId === id).every((x) => dItemIds.includes(x.id)));
  return { biz, prod, side, orders, items, vf, pv, vv, dItemIds, emptyDeliveries };
}

async function verify() {
  const users = await core.user.findMany({ select: { id: true, email: true, role: true, isAdmin: true, password: true } });
  console.log("### MAIN users now:", users.length);
  for (const u of users) console.log(`  ${u.email} | ${u.id} | ${u.role} | admin=${u.isAdmin} | password=${u.password ? "set" : "none (Google)"}`);
  const known = new Set(users.map((u) => u.id));
  const retainedOk = [...RETAINED.keys()].every((id) => known.has(id)) && users.length === RETAINED.size;
  const c = (n: number, label: string) => console.log(`  ${label}: ${n}`);
  console.log("### MAIN counts");
  for (const [k, p] of Object.entries({ Business: core.business, Product: core.product, ProductImage: core.productImage, Order: core.order, OrderItem: core.orderItem, OrderEvent: core.orderEvent, Delivery: core.delivery, CartItem: core.cartItem, Notification: core.notification, Deliverer: core.deliverer, VendorDeliveryBooking: core.vendorDeliveryBooking, VendorDeliverySlot: core.vendorDeliverySlot, AdminActionLog: core.adminActionLog, MarketplaceSettings: core.marketplaceSettings, Category: core.category, SkillType: core.skillType, Skill: core.skill, PendingSignup: core.pendingSignup }) as [string, { count: () => Promise<number> }][]) c(await p.count(), k);
  const orphan = async (label: string, ids: (string | null)[]) => { const bad = ids.filter((i) => i && !known.has(i)); console.log(`  orphan check ${label}: ${bad.length === 0 ? "none" : "FOUND " + bad.length}`); return bad.length; };
  console.log("### MAIN dangling user references");
  let orphans = 0;
  orphans += await orphan("Business.userId", (await core.business.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("Order.userId", (await core.order.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("Notification.userId", (await core.notification.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("CartItem.userId", (await core.cartItem.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("VendorDeliveryBooking.userId", (await core.vendorDeliveryBooking.findMany({ select: { userId: true } })).map((r) => r.userId));
  console.log("### E-LEARNING counts (reference data)");
  for (const [k, p] of Object.entries({ College: db.college, Department: db.department, Programme: db.programme, Course: db.course, AcademicSession: db.academicSession, Semester: db.semester, AcademicTimeFrame: db.academicTimeFrame, Curriculum: db.curriculum, CurriculumCourse: db.curriculumCourse, CCMASDocument: db.cCMASDocument, CCMASImportBatch: db.cCMASImportBatch, CCMASDiscipline: db.cCMASDiscipline, CCMASProgramme: db.cCMASProgramme, CCMASCourse: db.cCMASCourse, CCMASProgrammeCourse: db.cCMASProgrammeCourse }) as [string, { count: () => Promise<number> }][]) c(await p.count(), k);
  console.log("### E-LEARNING user-owned data");
  for (const [k, p] of Object.entries({ StudentProfile: db.studentProfile, FacultyProfile: db.facultyProfile, HodProfile: db.hodProfile, DapuProfile: db.dapuProfile, CourseRegistration: db.courseRegistration, CourseRegistrationItem: db.courseRegistrationItem, CourseOffering: db.courseOffering, CourseOfferingLecturer: db.courseOfferingLecturer, LevelAdvisorAssignment: db.levelAdvisorAssignment, CourseMaterial: db.courseMaterial, Result: db.result }) as [string, { count: () => Promise<number> }][]) c(await p.count(), k);
  console.log("### E-LEARNING dangling user references (no matching Main user)");
  orphans += await orphan("StudentProfile.userId", (await db.studentProfile.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("FacultyProfile.userId", (await db.facultyProfile.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("HodProfile.userId", (await db.hodProfile.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("DapuProfile.userId", (await db.dapuProfile.findMany({ select: { userId: true } })).map((r) => r.userId));
  orphans += await orphan("CourseRegistration.studentUserId", (await db.courseRegistration.findMany({ select: { studentUserId: true } })).map((r) => r.studentUserId));
  orphans += await orphan("CourseOfferingLecturer.facultyUserId", (await db.courseOfferingLecturer.findMany({ select: { facultyUserId: true } })).map((r) => r.facultyUserId));
  orphans += await orphan("CourseMaterial.uploadedByFacultyUserId", (await db.courseMaterial.findMany({ select: { uploadedByFacultyUserId: true } })).map((r) => r.uploadedByFacultyUserId));
  orphans += await orphan("LevelAdvisorAssignment.facultyUserId", (await db.levelAdvisorAssignment.findMany({ select: { facultyUserId: true } })).map((r) => r.facultyUserId));
  orphans += await orphan("Curriculum.createdByUserId", (await db.curriculum.findMany({ select: { createdByUserId: true } })).map((r) => r.createdByUserId));
  console.log(`\nRETAINED accounts intact and no others remain: ${retainedOk ? "YES" : "NO"} | dangling references: ${orphans}`);
}

async function main() {
  if (VERIFY) return verify();

  // ---- resolve the delete set ---------------------------------------------------------------------------------------------
  const users = await core.user.findMany({ select: { id: true, email: true } });
  const retainedNow = new Map(users.filter((u) => RETAINED.has(u.id)).map((u) => [u.id, u.email]));
  const strangers = users.filter((u) => !RETAINED.has(u.id) && !TO_DELETE.has(u.id));
  const delNow = users.filter((u) => TO_DELETE.has(u.id));

  let status: Record<string, Status> = { manifest: { phase: "manifest", state: "pending" }, elearning: { phase: "elearning", state: "pending" }, main: { phase: "main", state: "pending" } };
  let dir = manifestArg ? path.dirname(path.resolve(manifestArg)) : "";
  const resuming = !!manifestArg;
  if (resuming) status = JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8"));

  // Guard 1: exactly the approved accounts. (On a resume, some approved deletions may legitimately be done already.)
  if ([...RETAINED.keys()].some((id) => !retainedNow.has(id))) throw new Error("ABORT: a retained account is missing from the database.");
  if (retainedNow.size !== RETAINED.size || [...retainedNow.entries()].some(([id, e]) => RETAINED.get(id) !== e)) throw new Error("ABORT: retained accounts don't match the approved list.");
  if (strangers.length) throw new Error(`ABORT: users exist that are in neither the retained nor the approved-delete list: ${strangers.map((u) => u.email).join(", ")}`);
  if (!resuming && delNow.length !== TO_DELETE.size) throw new Error(`ABORT: expected ${TO_DELETE.size} users to delete, found ${delNow.length}.`);
  for (const u of delNow) if (TO_DELETE.get(u.id) !== u.email) throw new Error(`ABORT: ${u.id} email changed (${u.email}).`);
  const delIds = [...TO_DELETE.keys()];

  // Guard 2: projected counts equal the approved numbers (skipped for phases already done on a resume).
  const sets = await computeSets(delIds);
  const projected = {
    main: { deliveryItem: sets.dItemIds.length, delivery_x_businesses: await core.delivery_x_businesses.count({ where: { businessId: { in: sets.biz } } }), delivery: sets.emptyDeliveries.length,
      orderEvent: await core.orderEvent.count({ where: { OR: [{ orderId: { in: sets.orders } }, { orderItemId: { in: sets.items } }] } }), orderItem: sets.items.length, order: sets.orders.length,
      cartItem: await core.cartItem.count({ where: { OR: [{ userId: { in: delIds } }, { productId: { in: sets.prod } }, { sideId: { in: sets.side } }] } }),
      variantValueOnProductVariant: await core.variantValueOnProductVariant.count({ where: { OR: [{ variantId: { in: sets.pv } }, { valueId: { in: sets.vv } }] } }),
      productVariant: sets.pv.length, variantValue: sets.vv.length, variantField: sets.vf.length, productImage: await core.productImage.count({ where: { productId: { in: sets.prod } } }),
      product: sets.prod.length, side: sets.side.length, businessDeliveryDay: await core.businessDeliveryDay.count({ where: { businessId: { in: sets.biz } } }),
      vendorTimeframeCapacity: await core.vendorTimeframeCapacity.count({ where: { businessId: { in: sets.biz } } }), business: sets.biz.length,
      notification: await core.notification.count({ where: { userId: { in: delIds } } }), user: delNow.length },
    elearning: { studentProfile: await db.studentProfile.count({ where: { userId: { in: delIds } } }) },
  };
  const mismatch = (p: Record<string, number>, e: Record<string, number>) => Object.keys(e).filter((k) => p[k] !== e[k]).map((k) => `${k}: projected ${p[k]} vs approved ${e[k]}`);
  const mainDone = status.main.state === "done", elDone = status.elearning.state === "done";
  const drift = [...(elDone ? [] : mismatch(projected.elearning, EXPECTED_ELEARNING)), ...(mainDone ? [] : mismatch(projected.main, EXPECTED_MAIN))];
  if (drift.length) throw new Error(`ABORT (drift since approval — nothing was written): ${drift.join("; ")}`);

  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"}${resuming ? " (resume)" : ""} — guards passed.`);
  console.log("retained:", [...retainedNow.values()].join(", "));
  console.log("to delete:", delNow.map((u) => u.email).join(", ") || "(already removed)");
  console.log("projected MAIN deletes:", JSON.stringify(projected.main));
  console.log("projected E-LEARNING deletes:", JSON.stringify(projected.elearning));
  if (!EXECUTE) { console.log("\nDry run only — nothing written. Re-run with --execute to perform it."); return; }

  // ---- manifest + backup (fresh runs only) ----------------------------------------------------------------------------------
  const save = () => fs.writeFileSync(path.join(dir, "status.json"), json(status));
  if (!resuming) {
    dir = path.join(ROOT, ".cleanup-backups", new Date().toISOString().replace(/[:.]/g, "-"));
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, "manifest.json"), json({ createdAt: new Date().toISOString(), retained: [...RETAINED], deleted: [...TO_DELETE], projected, sets: { businesses: sets.biz.length, products: sets.prod.length, orders: sets.orders.length, orderItems: sets.items.length } }));
    const backupMain = {
      users: await core.user.findMany({ where: { id: { in: delIds } } }), businesses: await core.business.findMany({ where: { id: { in: sets.biz } } }), sides: await core.side.findMany({ where: { id: { in: sets.side } } }),
      products: await core.product.findMany({ where: { id: { in: sets.prod } } }), productImages: await core.productImage.findMany({ where: { productId: { in: sets.prod } } }),
      variantFields: await core.variantField.findMany({ where: { id: { in: sets.vf } } }), variantValues: await core.variantValue.findMany({ where: { id: { in: sets.vv } } }),
      productVariants: await core.productVariant.findMany({ where: { id: { in: sets.pv } } }), variantLinks: await core.variantValueOnProductVariant.findMany({ where: { OR: [{ variantId: { in: sets.pv } }, { valueId: { in: sets.vv } }] } }),
      orders: await core.order.findMany({ where: { id: { in: sets.orders } } }), orderItems: await core.orderItem.findMany({ where: { id: { in: sets.items } } }),
      orderEvents: await core.orderEvent.findMany({ where: { OR: [{ orderId: { in: sets.orders } }, { orderItemId: { in: sets.items } }] } }),
      deliveryItems: await core.deliveryItem.findMany({ where: { id: { in: sets.dItemIds } } }), deliveryXBusinesses: await core.delivery_x_businesses.findMany({ where: { businessId: { in: sets.biz } } }),
      deliveries: await core.delivery.findMany({ where: { id: { in: sets.emptyDeliveries } } }), businessDeliveryDays: await core.businessDeliveryDay.findMany({ where: { businessId: { in: sets.biz } } }),
      vendorTimeframeCapacity: await core.vendorTimeframeCapacity.findMany({ where: { businessId: { in: sets.biz } } }),
      cartItems: await core.cartItem.findMany({ where: { OR: [{ userId: { in: delIds } }, { productId: { in: sets.prod } }, { sideId: { in: sets.side } }] } }), notifications: await core.notification.findMany({ where: { userId: { in: delIds } } }),
    };
    fs.writeFileSync(path.join(dir, "backup-main.json"), json(backupMain), { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "backup-elearning.json"), json({ studentProfiles: await db.studentProfile.findMany({ where: { userId: { in: delIds } } }) }), { mode: 0o600 });
    status.manifest.state = "done";
    save();
    console.log(`backup + manifest written to ${path.relative(ROOT, dir)}`);
  }
  const resumeHint = `npx tsx --env-file=.env scripts/cleanup-test-accounts.ts --execute --manifest ${path.relative(ROOT, path.join(dir, "manifest.json"))}`;

  // ---- phase 1: E-LEARNING (one transaction) ----------------------------------------------------------------------------------
  if (status.elearning.state !== "done") {
    try {
      const counts = await db.$transaction(async (tx) => {
        const r: Record<string, number> = {};
        const regs = (await tx.courseRegistration.findMany({ where: { studentUserId: { in: delIds } }, select: { id: true } })).map((x) => x.id);
        r.courseRegistrationItem = (await tx.courseRegistrationItem.deleteMany({ where: { courseRegistrationId: { in: regs } } })).count;
        r.courseRegistration = (await tx.courseRegistration.deleteMany({ where: { studentUserId: { in: delIds } } })).count;
        r.studentCourseRegistration = (await tx.studentCourseRegistration.deleteMany({ where: { studentUserId: { in: delIds } } })).count;
        r.result = (await tx.result.deleteMany({ where: { OR: [{ studentUserId: { in: delIds } }, { enteredByUserId: { in: delIds } }] } })).count;
        r.courseMaterial = (await tx.courseMaterial.deleteMany({ where: { uploadedByFacultyUserId: { in: delIds } } })).count;
        r.learningResource = (await tx.learningResource.deleteMany({ where: { uploadedByUserId: { in: delIds } } })).count;
        r.courseAssignment = (await tx.courseAssignment.deleteMany({ where: { facultyUserId: { in: delIds } } })).count;
        r.courseOfferingLecturer = (await tx.courseOfferingLecturer.deleteMany({ where: { facultyUserId: { in: delIds } } })).count;
        r.levelAdvisorAssignmentChange = (await tx.levelAdvisorAssignmentChange.deleteMany({ where: { OR: [{ fromFacultyUserId: { in: delIds } }, { toFacultyUserId: { in: delIds } }, { changedByUserId: { in: delIds } }] } })).count;
        r.levelAdvisorAssignment = (await tx.levelAdvisorAssignment.deleteMany({ where: { OR: [{ facultyUserId: { in: delIds } }, { createdByUserId: { in: delIds } }] } })).count;
        r.facultyProfile = (await tx.facultyProfile.deleteMany({ where: { userId: { in: delIds } } })).count;
        r.hodProfile = (await tx.hodProfile.deleteMany({ where: { userId: { in: delIds } } })).count;
        r.dapuProfile = (await tx.dapuProfile.deleteMany({ where: { userId: { in: delIds } } })).count;
        r.studentProfile = (await tx.studentProfile.deleteMany({ where: { userId: { in: delIds } } })).count;
        if (r.studentProfile !== EXPECTED_ELEARNING.studentProfile && !resuming) throw new Error(`studentProfile deleted ${r.studentProfile}, approved ${EXPECTED_ELEARNING.studentProfile} — rolled back`);
        return r;
      }, { timeout: 120000, maxWait: 30000 });
      status.elearning = { phase: "elearning", state: "done", counts };
      save();
      console.log("E-LEARNING done:", JSON.stringify(counts));
    } catch (e) {
      status.elearning = { phase: "elearning", state: "failed", error: String((e as Error).message) };
      save();
      console.error(`\nE-LEARNING FAILED and was rolled back (nothing changed in either database): ${(e as Error).message}\nResume: ${resumeHint}`);
      process.exit(1);
    }
  }

  // ---- phase 2: MAIN (one transaction) ------------------------------------------------------------------------------------------
  if (status.main.state !== "done") {
    try {
      const counts = await core.$transaction(async (tx) => {
        const r: Record<string, number> = {};
        const step = async (name: string, p: Promise<{ count: number }>) => { r[name] = (await p).count; };
        await step("deliveryItem", tx.deliveryItem.deleteMany({ where: { id: { in: sets.dItemIds } } }));
        await step("delivery_x_businesses", tx.delivery_x_businesses.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("delivery", tx.delivery.deleteMany({ where: { id: { in: sets.emptyDeliveries } } }));
        await step("orderEvent", tx.orderEvent.deleteMany({ where: { OR: [{ orderId: { in: sets.orders } }, { orderItemId: { in: sets.items } }] } }));
        await step("orderItem", tx.orderItem.deleteMany({ where: { id: { in: sets.items } } }));
        await step("order", tx.order.deleteMany({ where: { id: { in: sets.orders } } }));
        await step("cartItem", tx.cartItem.deleteMany({ where: { OR: [{ userId: { in: delIds } }, { productId: { in: sets.prod } }, { sideId: { in: sets.side } }] } }));
        await step("variantValueOnProductVariant", tx.variantValueOnProductVariant.deleteMany({ where: { OR: [{ variantId: { in: sets.pv } }, { valueId: { in: sets.vv } }] } }));
        await step("productVariant", tx.productVariant.deleteMany({ where: { id: { in: sets.pv } } }));
        await step("variantValue", tx.variantValue.deleteMany({ where: { id: { in: sets.vv } } }));
        await step("variantField", tx.variantField.deleteMany({ where: { id: { in: sets.vf } } }));
        await step("productImage", tx.productImage.deleteMany({ where: { productId: { in: sets.prod } } }));
        await step("product", tx.product.deleteMany({ where: { id: { in: sets.prod } } }));
        await step("side", tx.side.deleteMany({ where: { id: { in: sets.side } } }));
        await step("businessDeliveryDay", tx.businessDeliveryDay.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("vendorTimeframeCapacity", tx.vendorTimeframeCapacity.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("vendorTimeframeCapacityOverride", tx.vendorTimeframeCapacityOverride.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("lateDeliveryFine", tx.lateDeliveryFine.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("businessVerificationRequest", tx.businessVerificationRequest.deleteMany({ where: { businessId: { in: sets.biz } } }));
        await step("businessReport", tx.businessReport.deleteMany({ where: { OR: [{ businessId: { in: sets.biz } }, { reporterId: { in: delIds } }] } }));
        await step("business", tx.business.deleteMany({ where: { id: { in: sets.biz } } }));
        await step("notification", tx.notification.deleteMany({ where: { userId: { in: delIds } } }));
        // Anything that would BLOCK the user delete (no cascade) must be empty for these users; refuse rather than force it.
        const blockers = await tx.vendorDeliveryBooking.count({ where: { userId: { in: delIds } } });
        if (blockers) throw new Error(`${blockers} vendor delivery bookings still belong to users being deleted`);
        await step("user", tx.user.deleteMany({ where: { id: { in: delIds } } })); // cascades any remaining per-user rows (already empty per audit)
        const bad = Object.entries(EXPECTED_MAIN).filter(([k, v]) => r[k] !== v && !resuming).map(([k, v]) => `${k}: deleted ${r[k]} vs approved ${v}`);
        if (bad.length) throw new Error(`count mismatch — rolled back: ${bad.join("; ")}`);
        return r;
      }, { timeout: 120000, maxWait: 30000 });
      status.main = { phase: "main", state: "done", counts };
      save();
      console.log("MAIN done:", JSON.stringify(counts));
    } catch (e) {
      status.main = { phase: "main", state: "failed", error: String((e as Error).message) };
      save();
      console.error(`\nMAIN FAILED and was rolled back. STATE: E-Learning = ${status.elearning.state.toUpperCase()} (student profile(s) removed), Main = NOT changed (all 15 accounts still exist).\nThis is a supported, consistent state. Fix the error above, then resume: ${resumeHint}`);
      process.exit(1);
    }
  }
  console.log(`\nALL PHASES DONE. Backup + status: ${path.relative(ROOT, dir)}`);
}

main().then(() => Promise.all([core.$disconnect(), db.$disconnect()])).catch(async (e) => { console.error(String(e.message ?? e)); await Promise.all([core.$disconnect(), db.$disconnect()]); process.exit(1); });
