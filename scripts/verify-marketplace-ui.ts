// REAL-BROWSER check (headless Chrome via puppeteer-core) of the UI changes in docs/AKADVERSE_IMPLEMENTATION_CHANGELOG.md,
// against a running server that uses the LOCAL databases only:
//   - Navigation: on every Marketplace page that sits under the fixed top navbar, "Back to Marketplace" is fully
//     below the navbar and is the topmost element at its own position (not covered), at phone / tablet / desktop
//     widths, with no horizontal page overflow. (Before the fix it started 8-16px under the navbar from 640px up.)
//   - Seller Orders: the drop-off action panel appears for a ready-for-pickup order, with the pickup point.
//   - Vendor dashboard: the delivery schedule section and newest-first order list render.
//   - Vendor checkout: the delivery-date chips render from the server's availability.
//   - Study Zone: a week with several documents shows the dropdown; choosing another document swaps the viewer;
//     the Stewart upload control is present beside the message box.
//
// It refuses to run unless both database URLs are local. It creates its own uniquely-named records and signs in by
// minting a NextAuth session cookie with NEXTAUTH_SECRET (start the server with the SAME throwaway secret).
//
// Run (server first, in another shell, with the same env):
//   DATABASE_URL=… DIRECT_URL=… ELEARNING_DATABASE_URL=… ELEARNING_DIRECT_URL=… NEXTAUTH_SECRET=local-ui-check \
//     NEXTAUTH_URL=http://localhost:3100 npx next start -p 3100
//   PP_DIR=<dir with puppeteer-core> BASE_URL=http://localhost:3100 npx tsx scripts/verify-marketplace-ui.ts

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";

for (const name of ["DATABASE_URL", "ELEARNING_DATABASE_URL"]) {
  const host = new URL(process.env[name] ?? "http://missing").hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(`${name} must point at a local database (got host "${host}"). Refusing to run.`);
    process.exit(1);
  }
}

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const VIEWPORTS = [
  { name: "phone", w: 375, h: 812 },
  { name: "tablet", w: 768, h: 1024 },
  { name: "desktop", w: 1280, h: 800 },
];
let passed = 0;
let failed = 0;
const ok = (name: string, condition: boolean, detail = "") => {
  if (condition) passed++;
  else failed++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { elearningDb } = await import("../src/lib/db/elearning");
  const puppeteer = createRequire(`${process.env.PP_DIR}/`)("puppeteer-core");
  const tag = randomUUID().slice(0, 8);

  // ---- seed (local only) ------------------------------------------------------------------------------------------
  const user = await prisma.user.create({ data: { firstName: "UI", lastName: tag, email: `ui-${tag}@stu.example.test`, password: "x", role: "student" } });
  const buyer = await prisma.user.create({ data: { firstName: "Buyer", lastName: tag, email: `buyer-${tag}@stu.example.test`, password: "x", role: "student" } });
  await prisma.marketplaceSettings.upsert({
    where: { id: "default" },
    update: { dropoffLocation: "Room 12, Student Centre", dropoffLocationName: "Central Drop-off", dropoffLocationInstructions: "Ask for the coordinator at the front desk." },
    create: { id: "default", dropoffLocation: "Room 12, Student Centre", dropoffLocationName: "Central Drop-off", dropoffLocationInstructions: "Ask for the coordinator at the front desk." },
  });
  const business = await prisma.business.create({ data: { name: `A Business With A Deliberately Long Name For Layout Checks ${tag}`, industry: "Food", description: "d", userId: user.id, approvalStatus: "APPROVED" } });
  const product = await prisma.product.create({ data: { name: `Product ${tag}`, category: "Food", description: "d", price: 1500, stock: 9, businessId: business.id } });
  await prisma.order.create({
    data: { userId: buyer.id, businessId: business.id, status: "ACCEPTED", fulfillmentStatus: "READY_FOR_PICKUP", paymentStatus: "paid", totalAmount: 1500, sellerMarkedReadyAt: new Date(), items: { create: [{ productId: product.id, quantity: 1, price: 1500 }] } },
  });
  const vendor = await prisma.business.create({ data: { name: `Vendor ${tag}`, industry: "Food", description: "d", userId: user.id, type: "SCHOOL_VENDOR", approvalStatus: "APPROVED", location: "Cafeteria" } });
  const vendorProduct = await prisma.product.create({ data: { name: `Jollof ${tag}`, category: "Food", description: "d", price: 2000, stock: 9, businessId: vendor.id } });
  const slot = await prisma.vendorDeliverySlot.create({ data: { label: `UI slot ${tag}`, windowStart: "23:00", windowEnd: "23:59", bookingCutoffMins: 0 } });
  await prisma.vendorTimeframeCapacity.create({ data: { businessId: vendor.id, slotId: slot.id, capacity: 4 } });
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()) + "T00:00:00.000Z");
  const vendorOrderIds: string[] = [];
  for (const minutesAgo of [30, 10]) {
    const booking = await prisma.vendorDeliveryBooking.create({ data: { userId: buyer.id, slotId: slot.id, paystackReference: `UI-${tag}-${minutesAgo}`, deliveryFee: 1000, status: "CONFIRMED", bookedFor: today } });
    const order = await prisma.order.create({
      data: { userId: buyer.id, businessId: vendor.id, status: "ACCEPTED", fulfillmentStatus: "PROCESSING", paymentStatus: "paid", totalAmount: 2000, vendorDeliveryBookingId: booking.id, paystackReference: booking.paystackReference, createdAt: new Date(Date.now() - minutesAgo * 60_000), items: { create: [{ productId: vendorProduct.id, quantity: 1, price: 2000 }] } },
    });
    vendorOrderIds.push(order.id);
  }
  // The signed-in user's own carts (they buy from someone else's shops).
  const otherOwner = await prisma.user.create({ data: { firstName: "Other", lastName: tag, email: `other-${tag}@stu.example.test`, password: "x", role: "student" } });
  const shop = await prisma.business.create({ data: { name: `Shop ${tag}`, industry: "Food", description: "d", userId: otherOwner.id, approvalStatus: "APPROVED" } });
  const shopProduct = await prisma.product.create({ data: { name: `Notebook ${tag}`, category: "Books", description: "d", price: 900, stock: 5, businessId: shop.id } });
  await prisma.cartItem.create({ data: { userId: user.id, productId: shopProduct.id, quantity: 1 } });
  const otherVendor = await prisma.business.create({ data: { name: `Kitchen ${tag}`, industry: "Food", description: "d", userId: otherOwner.id, type: "SCHOOL_VENDOR", approvalStatus: "APPROVED" } });
  const meal = await prisma.product.create({ data: { name: `Rice ${tag}`, category: "Food", description: "d", price: 1800, stock: 5, businessId: otherVendor.id } });
  await prisma.vendorTimeframeCapacity.create({ data: { businessId: otherVendor.id, slotId: slot.id, capacity: 3 } });
  await prisma.cartItem.create({ data: { userId: user.id, productId: meal.id, quantity: 1 } });

  // E-Learning: a current session/semester with a course whose Week 2 has three documents.
  await elearningDb.academicSession.updateMany({ data: { isCurrent: false } });
  await elearningDb.semester.updateMany({ data: { isCurrent: false } });
  const session = await elearningDb.academicSession.create({ data: { name: `UI-${tag}`, isCurrent: true } });
  const semester = await elearningDb.semester.create({ data: { academicSessionId: session.id, name: "First", sequence: 1, isCurrent: true, startDate: new Date("2026-09-07T00:00:00Z"), endDate: new Date("2026-12-18T00:00:00Z") } });
  const college = await elearningDb.college.create({ data: { name: `College ${tag}`, code: `C${tag}` } });
  const department = await elearningDb.department.create({ data: { collegeId: college.id, name: `Dept ${tag}`, code: `D${tag}` } });
  const programme = await elearningDb.programme.create({ data: { departmentId: department.id, name: `Programme ${tag}`, code: `P${tag}` } });
  const course = await elearningDb.course.create({ data: { code: `UIT ${tag}`, title: "Interface Testing", creditUnits: 3 } });
  const curriculum = await elearningDb.curriculum.create({ data: { programmeId: programme.id, academicSessionId: session.id, semesterId: semester.id, name: `Cur ${tag}`, status: "PUBLISHED", createdByUserId: "ui" } });
  const curriculumCourse = await elearningDb.curriculumCourse.create({ data: { curriculumId: curriculum.id, courseId: course.id, level: 100, creditUnits: 3 } });
  const offering = await elearningDb.courseOffering.create({ data: { curriculumCourseId: curriculumCourse.id } });
  await elearningDb.facultyProfile.create({ data: { userId: `lec-${tag}`, departmentId: department.id } });
  await elearningDb.studentProfile.create({ data: { userId: user.id, departmentId: department.id, programmeId: programme.id, level: 100, admissionSessionId: session.id } });
  await elearningDb.courseRegistration.create({ data: { studentUserId: user.id, academicSessionId: session.id, semesterId: semester.id, status: "APPROVED", items: { create: [{ courseId: course.id }] } } });
  const titles = ["Main lecture note", "Supplementary reading", "Worked examples"];
  for (const [i, title] of titles.entries()) {
    await elearningDb.courseMaterial.create({
      data: { courseOfferingId: offering.id, uploadedByFacultyUserId: `lec-${tag}`, title, type: "NOTES", startWeek: 2, endWeek: 2, fileName: `doc${i}.pdf`, mimeType: "application/pdf", fileSize: 1000, storageBucket: "course-materials", storagePath: `ui/${tag}/${i}.pdf`, createdAt: new Date(Date.now() + i * 1000) },
    });
  }

  // ---- sign in ----------------------------------------------------------------------------------------------------
  const sessionToken = await encode({
    secret: process.env.NEXTAUTH_SECRET!,
    token: { id: user.id, sub: user.id, email: user.email, name: "UI Tester", firstName: "UI", lastName: tag, role: "student", isAdmin: false },
  });
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setCookie({ name: "next-auth.session-token", value: sessionToken, url: BASE, httpOnly: true });
  const shots = process.env.SHOTS_DIR;

  const open = async (path: string, waitFor: string) => {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 60_000 });
    await page.waitForFunction((text: string) => document.body.innerText.includes(text), { timeout: 30_000 }, waitFor).catch(() => {});
    await sleep(150);
  };

  try {
    // ---- navigation under the fixed navbar ------------------------------------------------------------------------
    const pages: { path: string; waitFor: string }[] = [
      { path: "/studashboard/marketplace/checkout", waitFor: "Checkout" },
      { path: "/studashboard/marketplace/vendor-checkout", waitFor: "Delivery date" },
      { path: "/studashboard/marketplace/orders", waitFor: "Your orders" },
      { path: "/studashboard/marketplace/business/create", waitFor: "Back to Marketplace" },
      { path: "/studashboard/marketplace/vendor/apply", waitFor: "Back to Marketplace" },
      { path: "/studashboard/marketplace/deliverer/apply", waitFor: "Back to Marketplace" },
      { path: `/studashboard/marketplace/business/${business.id}`, waitFor: "Back to Marketplace" },
      { path: `/studashboard/marketplace/business/${business.id}/orders`, waitFor: "Orders" },
      { path: `/studashboard/marketplace/vendor-dashboard/${vendor.id}`, waitFor: "Delivery Schedule" },
      { path: `/studashboard/marketplace/vendor-dashboard/${vendor.id}/orders`, waitFor: "Orders" },
      { path: "/studashboard/marketplace/explore", waitFor: "Back to Marketplace" },
      { path: `/studashboard/marketplace/vendor/${otherVendor.id}`, waitFor: "Back to Marketplace" },
    ];
    for (const viewport of VIEWPORTS) {
      await page.setViewport({ width: viewport.w, height: viewport.h });
      for (const target of pages) {
        await open(target.path, target.waitFor);
        const m = await page.evaluate(() => {
          const link = [...document.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Back to Marketplace");
          const navs = [...document.querySelectorAll("nav, div")].filter((el) => ["fixed", "sticky"].includes(getComputedStyle(el).position) && el.getBoundingClientRect().top <= 70 && el.getBoundingClientRect().height > 30 && el.getBoundingClientRect().width > 300);
          const barBottom = Math.max(0, ...navs.map((el) => el.getBoundingClientRect().bottom));
          if (!link) return { found: false, barBottom, top: 0, covered: true, overflow: 0, width: 0, height: 0 };
          const r = link.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { found: true, barBottom, top: r.top, covered: !(at && (at === link || link.contains(at))), overflow: document.documentElement.scrollWidth - window.innerWidth, width: r.width, height: r.height };
        });
        const label = `${viewport.name} ${target.path.replace(/[0-9a-f-]{36}/, ":id")}`;
        ok(`${label}: back link visible below the navbar`, m.found && m.top >= m.barBottom && !m.covered && m.height >= 36, m.found ? `link top ${Math.round(m.top)}px, bars end ${Math.round(m.barBottom)}px, ${Math.round(m.width)}x${Math.round(m.height)}${m.covered ? ", COVERED" : ""}` : "link not found");
        ok(`${label}: no horizontal overflow`, m.overflow <= 1, `${m.overflow}px`);
        if (shots && target.path.endsWith("/checkout")) await page.screenshot({ path: `${shots}/checkout-${viewport.name}.png` });
      }
    }

    // ---- feature renders (desktop) --------------------------------------------------------------------------------
    await page.setViewport({ width: 1280, height: 900 });
    await open(`/studashboard/marketplace/business/${business.id}/orders`, "ready to drop off");
    let text = await page.evaluate(() => document.body.innerText);
    ok("seller orders: drop-off panel shows for the ready order", text.includes("1 order ready to drop off") && text.includes("Central Drop-off") && text.includes("Room 12, Student Centre") && text.includes("Ask for the coordinator"));
    ok("seller orders: next action is offered", text.includes("get my code") && text.includes("Next:"));
    if (shots) await page.screenshot({ path: `${shots}/seller-dropoff.png` });

    await open(`/studashboard/marketplace/vendor-dashboard/${vendor.id}`, "Recurring delivery days");
    text = await page.evaluate(() => document.body.innerText);
    ok("vendor dashboard: schedule section with weekdays, upcoming dates and usage", text.includes("Recurring delivery days") && text.includes("Next 8 days") && text.includes("2 paid") && text.includes("Close this date"));
    const weekdayButtons = await page.$$eval('[aria-labelledby="delivery-weekdays-label"] button', (els: Element[]) => els.length);
    ok("vendor dashboard: seven weekday toggles", weekdayButtons === 7, String(weekdayButtons));
    if (shots) await page.screenshot({ path: `${shots}/vendor-schedule.png`, fullPage: true });

    await open(`/studashboard/marketplace/vendor-dashboard/${vendor.id}/orders`, "All orders");
    const orderRefs = await page.$$eval("p", (els: Element[]) => els.map((e) => e.textContent ?? "").filter((t) => /^Order #[0-9a-f]{8}$/.test(t.trim())).map((t) => t.trim().slice(7)));
    ok("vendor orders: newest first by default", orderRefs[0] === vendorOrderIds[1].slice(0, 8) && orderRefs[1] === vendorOrderIds[0].slice(0, 8), orderRefs.join(", "));

    await open("/studashboard/marketplace/vendor-checkout", "Delivery date");
    const chips = await page.$$eval('[role="radiogroup"] [role="radio"]', (els: Element[]) => els.map((e) => ({ label: e.textContent ?? "", disabled: (e as HTMLButtonElement).disabled })));
    ok("vendor checkout: one date chip per day of the booking window", chips.length === 8, `${chips.length} chips`);
    ok("vendor checkout: at least one date is selectable", chips.some((c: { disabled: boolean }) => !c.disabled));

    // ---- Study Zone ----------------------------------------------------------------------------------------------
    await open(`/e-learning/student/study-zone/${course.id}`, "Week 2 documents");
    const options = await page.$$eval("#study-document-select option", (els: Element[]) => els.map((e) => e.textContent ?? ""));
    ok("study zone: the week's dropdown lists all three documents", options.length === 3 && titles.every((t) => options.some((o: string) => o.includes(t))), options.join(" | "));
    const viewerTitle = () => page.$eval('[role="tabpanel"] h2', (el: Element) => el.textContent ?? "");
    const selected = () => page.$eval("#study-document-select", (el: Element) => (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? "");
    ok("study zone: the first note is selected and shown by default", (await viewerTitle()) === titles[0] && (await selected()).includes(titles[0]));
    const thirdValue = await page.$eval("#study-document-select option:nth-child(3)", (el: Element) => (el as HTMLOptionElement).value);
    await page.select("#study-document-select", thirdValue);
    await sleep(300);
    ok("study zone: choosing another note loads exactly that document", (await viewerTitle()) === titles[2] && (await selected()).includes(titles[2]), await viewerTitle());
    text = await page.evaluate(() => document.body.innerText);
    ok("study zone: week tab says there are more documents", text.includes("+2 more"));
    const upload = await page.$eval('button[aria-label="Attach a document"]', (el: Element) => ({ w: el.getBoundingClientRect().width, nextIsInput: Boolean(el.parentElement?.querySelector("textarea#stewart-input")) }));
    ok("study zone: Stewart has an upload control beside the message box", upload.w >= 36 && upload.nextIsInput);
    const accept = await page.$eval("#stewart-file", (el: Element) => (el as HTMLInputElement).accept);
    ok("study zone: upload accepts the supported document types", accept === ".pdf,.docx,.pptx,.txt,.md", accept);
    if (shots) await page.screenshot({ path: `${shots}/study-zone.png` });
    await page.setViewport({ width: 375, height: 812 });
    await open(`/e-learning/student/study-zone/${course.id}`, "Week 2 documents");
    const narrow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok("study zone: no horizontal overflow on a phone", narrow <= 1, `${narrow}px`);
  } finally {
    await browser.close();
    await prisma.$disconnect();
    await elearningDb.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
