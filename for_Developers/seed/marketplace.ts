// for_Developers/seed/marketplace.ts
//
// Marketplace development data (Core database), small but enough to exercise every main flow:
//
//   "Plug (Dev)"         — an APPROVED, verified ordinary BUSINESS owned by plug.demo: 3 products (one with size
//                          variants), delivery days. Shows on Explore / product search.
//   "Campus Bites (Dev)" — an APPROVED SCHOOL_VENDOR owned by vendor.demo: food products, sides, and per-timeframe
//                          order capacity for each delivery slot (the slots come from a Core migration).
//   buyer.demo           — a cart line, one ACCEPTED/PROCESSING paid order and one PENDING_SELLER order from Plug,
//                          plus notifications for buyer and seller.
//   deliverer.demo       — an APPROVED deliverer (student email already verified).
//   admin.demo          — isAdmin=true (set in users.ts); sees the Admin card and /studashboard/admin.
//
// No real money or bank data: no bank/account numbers, and payment references are clearly fake ("DEV-SEED-…").
// Images are Unsplash URLs (already allowed in next.config.ts and used by the mock listings) — no Cloudinary needed.
//
// Idempotent: stable ids (ids.ts) + upserts. Re-running restores these rows to their seeded state (stock, order
// status…), so it doubles as "put the demo data back the way it was".

import type { Prisma, PrismaClient } from "@prisma/client";
import type { SeededUsers } from "./users";
import { devId } from "./ids";

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=600&q=70&auto=format&fit=crop`;

export async function seedMarketplace(db: PrismaClient, users: SeededUsers) {
  const now = new Date();

  // Singleton settings row — created with schema defaults only if missing; never overwrites admin changes.
  await db.marketplaceSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default", dropoffLocation: "Dev drop-off point (seed data)" } });

  // ---- Plug (Dev): ordinary Business ---------------------------------------------------------
  const plugId = devId("business:plug");
  const plugData = {
    name: "Plug (Dev)",
    industry: "Electronics & Gadgets",
    description: "Development seed business — phone accessories and gadgets. Not a real shop.",
    type: "BUSINESS" as const,
    approvalStatus: "APPROVED" as const,
    approvedAt: now,
    approvedBy: users.admin.id,
    verified: true,
    verifiedAt: now,
    verifiedBy: users.admin.id,
    blocked: false,
    deliveryRestricted: false,
    contactInfo: "plug.demo@example.local (dev only)",
    location: "Dev campus, Block A",
    serviceDays: "Mon - Fri",
    serviceTimes: "09:00 - 17:00",
    userId: users.plugOwner.id,
  };
  await db.business.upsert({ where: { id: plugId }, update: plugData, create: { id: plugId, ...plugData } });
  for (const day of ["MONDAY", "WEDNESDAY", "FRIDAY"] as const) {
    await db.businessDeliveryDay.upsert({ where: { businessId_day: { businessId: plugId, day } }, update: {}, create: { businessId: plugId, day } });
  }

  const plugProducts = [
    { key: "phone-case", name: "Floral Phone Case", category: "Electronics & Gadgets", price: 4300, cost: 2500, stock: 40, img: "photo-1511707171634-5f897ff02aa9", description: "Slim floral phone case (dev seed)." },
    { key: "desk-lamp", name: "LED Desk Lamp", category: "Room & Dorm Essentials", price: 7200, cost: 4800, stock: 15, img: "photo-1505692952047-1a78307da8f2", description: "Rechargeable LED lamp for late-night reading (dev seed)." },
    { key: "hoodie", name: "Campus Hoodie", category: "Fashion & Accessories", price: 12000, cost: 7000, stock: 20, img: "photo-1542291026-7eec264c27ff", description: "Warm hoodie with size variants (dev seed)." },
  ];
  const product: Record<string, string> = {};
  for (const p of plugProducts) {
    const id = devId(`product:plug:${p.key}`);
    const data = { name: p.name, category: p.category, description: p.description, price: p.price, cost: p.cost, stock: p.stock, image: IMG(p.img), secure_url: IMG(p.img), businessId: plugId };
    await db.product.upsert({ where: { id }, update: data, create: { id, ...data } });
    product[p.key] = id;
  }

  // Variants for the hoodie: one "Size" field, three values, one ProductVariant per value.
  const sizeFieldId = devId("variant-field:hoodie:size");
  await db.variantField.upsert({ where: { id: sizeFieldId }, update: {}, create: { id: sizeFieldId, name: "Size", productId: product.hoodie } });
  for (const [size, stock] of [["M", 8], ["L", 8], ["XL", 4]] as const) {
    const valueId = devId(`variant-value:hoodie:${size}`);
    const variantId = devId(`variant:hoodie:${size}`);
    await db.variantValue.upsert({ where: { id: valueId }, update: {}, create: { id: valueId, value: size, fieldId: sizeFieldId } });
    await db.productVariant.upsert({ where: { id: variantId }, update: { price: 12000, stock }, create: { id: variantId, productId: product.hoodie, price: 12000, stock } });
    await db.variantValueOnProductVariant.upsert({ where: { variantId_valueId: { variantId, valueId } }, update: {}, create: { variantId, valueId } });
  }
  console.log("  ✔ business: Plug (Dev) — 3 products (hoodie has M/L/XL variants)");

  // ---- Campus Bites (Dev): School Vendor -----------------------------------------------------
  const vendorId = devId("business:campus-bites");
  const vendorData = {
    name: "Campus Bites (Dev)",
    industry: "Food & Snacks",
    description: "Development seed school vendor — hot meals 5–8 PM. Not a real vendor.",
    type: "SCHOOL_VENDOR" as const,
    vendorCategory: "Food",
    availabilityStart: "17:00",
    availabilityEnd: "20:00",
    paused: false,
    pausedAt: null,
    pausedReason: null,
    approvalStatus: "APPROVED" as const,
    approvedAt: now,
    approvedBy: users.admin.id,
    blocked: false,
    location: "Dev campus, Cafeteria 2",
    userId: users.vendorOwner.id,
  };
  await db.business.upsert({ where: { id: vendorId }, update: vendorData, create: { id: vendorId, ...vendorData } });

  const vendorProducts = [
    { key: "jollof", name: "Jollof Rice & Chicken", price: 2500, stock: 30, serviceFeeExempt: false },
    { key: "fried-rice", name: "Fried Rice & Turkey", price: 3000, stock: 25, serviceFeeExempt: false },
    { key: "snack-pack", name: "Snack Pack", price: 1500, stock: 50, serviceFeeExempt: false },
  ];
  for (const p of vendorProducts) {
    const id = devId(`product:campus-bites:${p.key}`);
    const data = { name: p.name, category: "Food & Snacks", description: `${p.name} (dev seed).`, price: p.price, stock: p.stock, serviceFeeExempt: p.serviceFeeExempt, image: IMG("photo-1599490659213-e2b9527bd087"), secure_url: IMG("photo-1599490659213-e2b9527bd087"), businessId: vendorId };
    await db.product.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  for (const s of [{ key: "plantain", name: "Fried Plantain", price: 500 }, { key: "coleslaw", name: "Coleslaw", price: 400 }]) {
    const id = devId(`side:campus-bites:${s.key}`);
    await db.side.upsert({ where: { id }, update: { name: s.name, price: s.price, available: true }, create: { id, businessId: vendorId, name: s.name, price: s.price } });
  }
  // Per-timeframe order capacity for every active delivery slot (slots are created by the migration
  // 20260903185500_seed_vendor_delivery_slots).
  const slots = await db.vendorDeliverySlot.findMany({ where: { active: true } });
  for (const slot of slots) {
    await db.vendorTimeframeCapacity.upsert({
      where: { businessId_slotId: { businessId: vendorId, slotId: slot.id } },
      update: { capacity: 10 },
      create: { businessId: vendorId, slotId: slot.id, capacity: 10 },
    });
  }
  console.log(`  ✔ school vendor: Campus Bites (Dev) — 3 products, 2 sides, capacity 10 in ${slots.length} delivery slots`);

  // ---- Deliverer -----------------------------------------------------------------------------
  const delivererData = {
    firstName: "Dele",
    lastName: "Deliverer",
    email: users.deliverer.email,
    hall: "Dev Hall",
    room: "B12",
    status: "APPROVED" as const,
    approvedAt: now,
    approvedBy: users.admin.id,
  };
  await db.deliverer.upsert({ where: { userId: users.deliverer.id }, update: delivererData, create: { id: devId("deliverer:demo"), userId: users.deliverer.id, ...delivererData } });
  await db.user.update({ where: { id: users.deliverer.id }, data: { studentEmailLocalPart: "deliverer.demo", studentEmailVerifiedAt: now } });
  console.log("  ✔ deliverer: deliverer.demo (APPROVED)");

  // ---- Buyer: cart, orders, notifications ----------------------------------------------------
  await db.user.update({ where: { id: users.buyer.id }, data: { location: "Dev Hall, Room A7" } });
  const cartId = devId("cart:buyer:desk-lamp");
  await db.cartItem.upsert({ where: { id: cartId }, update: { quantity: 1 }, create: { id: cartId, userId: users.buyer.id, productId: product["desk-lamp"], quantity: 1 } });

  await upsertOrder(db, {
    key: "accepted",
    buyerId: users.buyer.id,
    businessId: plugId,
    order: { status: "ACCEPTED", acceptedAt: now, fulfillmentStatus: "PROCESSING", paymentStatus: "paid", paystackReference: "DEV-SEED-ORDER-0001" },
    items: [{ key: "case", productId: product["phone-case"], price: 4300, quantity: 2 }],
    events: [
      { key: "created", type: "ORDER_CREATED", actorType: "buyer", actorId: users.buyer.id, message: "Order placed (dev seed)." },
      { key: "accepted", type: "SELLER_ACCEPTED", actorType: "seller", actorId: users.plugOwner.id, message: "Seller accepted the order (dev seed)." },
    ],
  });
  await upsertOrder(db, {
    key: "pending",
    buyerId: users.buyer.id,
    businessId: plugId,
    order: { status: "PENDING_SELLER", acceptedAt: null, fulfillmentStatus: null, paymentStatus: "paid", paystackReference: "DEV-SEED-ORDER-0002" },
    items: [{ key: "hoodie-l", productId: product.hoodie, variantId: devId("variant:hoodie:L"), variantName: "L", price: 12000, quantity: 1 }],
    events: [{ key: "created", type: "ORDER_CREATED", actorType: "buyer", actorId: users.buyer.id, message: "Order placed (dev seed)." }],
  });

  const notifications = [
    { key: "seller-new-order", userId: users.plugOwner.id, type: "NEW_ORDER", title: "New order", message: "You have a new order on Plug (Dev).", link: `/studashboard/marketplace/business/${plugId}/orders`, businessId: plugId },
    { key: "buyer-accepted", userId: users.buyer.id, type: "ORDER_ACCEPTED", title: "Order accepted", message: "Plug (Dev) accepted your order and is preparing it.", link: "/studashboard/marketplace/orders", businessId: plugId },
    { key: "vendor-approved", userId: users.vendorOwner.id, type: "BUSINESS_APPROVED", title: "Business approved", message: "Campus Bites (Dev) has been approved and is now live on the marketplace.", link: `/studashboard/marketplace/vendor-dashboard/${vendorId}`, businessId: vendorId },
  ];
  for (const n of notifications) {
    const id = devId(`notification:${n.key}`);
    const data = { userId: n.userId, scope: "MARKETPLACE" as const, type: n.type, title: n.title, message: n.message, link: n.link, businessId: n.businessId, read: false };
    await db.notification.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  console.log("  ✔ buyer.demo: 1 cart item, 2 orders from Plug (Dev) (ACCEPTED + PENDING_SELLER), notifications");
}

interface SeedOrder {
  key: string;
  buyerId: string;
  businessId: string;
  order: Pick<Prisma.OrderUncheckedCreateInput, "status" | "acceptedAt" | "fulfillmentStatus" | "paymentStatus" | "paystackReference">;
  items: { key: string; productId: string; variantId?: string; variantName?: string; price: number; quantity: number }[];
  events: { key: string; type: Prisma.OrderEventUncheckedCreateInput["type"]; actorType: string; actorId: string; message: string }[];
}

async function upsertOrder(db: PrismaClient, o: SeedOrder) {
  const orderId = devId(`order:${o.key}`);
  const totalAmount = o.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const data = { ...o.order, totalAmount, userId: o.buyerId, businessId: o.businessId, deliveryLocation: "Dev Hall, Room A7", rejectedAt: null, rejectionReason: null, deliveryOutcome: "PENDING" as const };
  await db.order.upsert({ where: { id: orderId }, update: data, create: { id: orderId, ...data } });
  for (const i of o.items) {
    const id = devId(`order-item:${o.key}:${i.key}`);
    const itemData = { orderId, productId: i.productId, variantId: i.variantId ?? null, variantName: i.variantName ?? null, price: i.price, quantity: i.quantity, escrowStatus: "HELD" as const };
    await db.orderItem.upsert({ where: { id }, update: itemData, create: { id, ...itemData } });
  }
  for (const e of o.events) {
    const id = devId(`order-event:${o.key}:${e.key}`);
    // OrderEvent is append-only history: create once, never rewrite.
    await db.orderEvent.upsert({ where: { id }, update: {}, create: { id, orderId, type: e.type, actorType: e.actorType, actorId: e.actorId, message: e.message } });
  }
}
