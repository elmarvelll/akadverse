// services/marketplace/checkout/create-orders-for-checkout.ts
//
// Creates one Order (with its OrderItems) per business represented in the
// cart, all sharing one Paystack reference — see the comment on
// Order.paystackReference in prisma/schema.prisma for why that column
// isn't unique. Called by
// src/app/api/marketplace/checkout/initialize/route.controller.ts.
//
// These Order rows are the INTERNAL side of a payment attempt, not customer
// orders yet: they're created with paymentStatus "pending", hidden from every
// order list (see order/shared/paid-order.ts), and only become real orders
// when Paystack confirms payment (confirm-payment-by-reference.ts).
//
// Stock is re-validated and RESERVED here, inside the same transaction as
// order creation — a conditional decrement (shared/stock-reservation.ts), so
// concurrent checkouts can never oversell. The reservation is recorded as a
// CheckoutPayment row (same transaction) with an expiry; if the payment is
// cancelled, fails, or expires it is released exactly once
// (release-checkout-reservation.ts). The amount the buyer must pay is
// computed here from database prices and stored on that row — verification
// later compares Paystack's reported amount against it.
//
// Central delivery slots (services/marketplace/delivery-roster/): when the
// admin has configured any, each order is also booked into a slot occurrence
// with room under its delivery limit (central-scheduling.ts), its estimated
// delivery becomes that slot's real window, and a ScheduledDelivery row
// records the slot and the roster's planned deliverer. lockRosterOperation
// serializes that step across concurrent checkouts so a limit can't be
// exceeded. With no central slots configured, nothing here changes.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/service-error";
import { getCartForUser } from "@/services/marketplace/cart/get-cart-for-user";
import { calculateEstimatedDelivery } from "@/services/marketplace/delivery/estimated-delivery.service";
import { calculateBusinessQuote, type DeliverySelections } from "@/services/marketplace/pricing/business-pricing";
import { EmptyCartError } from "./shared/empty-cart-error";
import { reserveLine } from "./shared/stock-reservation";
import { CHECKOUT_CURRENCY, reservationExpiry, toKobo } from "./shared/checkout-payment-config";
import { lockRosterOperation } from "@/services/marketplace/delivery-roster/roster-capacity";
import { createScheduledDelivery } from "@/services/marketplace/delivery-roster/delivery-plans";
export { EmptyCartError };
export async function createOrdersForCheckout(userId: string, location: string, selections: DeliverySelections = {}, quoteToken?: string) {
    const cartItems = await getCartForUser(userId);
    if (cartItems.length === 0) {
        throw new EmptyCartError("Your cart is empty.");
    }
    const byBusiness = new Map<string, typeof cartItems>();
    for (const item of cartItems) {
        byBusiness.set(item.businessId, [...(byBusiness.get(item.businessId) ?? []), item]);
    }
    const reference = `AKD-${Date.now()}-${randomUUID().slice(0, 8)}`;
    // The estimated delivery date/window is calculated per business (each
    // business has its own delivery days) inside the transaction, so
    // every order/item is stamped with it at creation time rather than
    // computed lazily later.
    const orders = await prisma.$transaction(async (tx) => {
        const created = [];
        // Shared with roster/slot edits, payment finalization and other checkouts.
        // Acquire before reading configuration or capacity.
        await lockRosterOperation(tx, "MARKETPLACE");
        const quote = await calculateBusinessQuote(userId, selections, tx);
        if (!quote.available)
            throw conflict("Delivery pricing is unavailable. Please select a priced delivery range.");
        if (!quoteToken || quoteToken !== quote.token)
            throw conflict("Checkout pricing changed. Review the updated summary and confirm the total again.");
        const snapshots = [];
        const now = new Date();
        if (JSON.stringify(cartItems) !== JSON.stringify(quote.items))
            throw conflict("Cart changed. Review checkout again.");
        for (const [businessId, items] of byBusiness) {
            // A business already in the buyer's cart could have been rejected
            // (or hasn't been approved yet) since it was added — search/browse
            // already keep unapproved businesses out of reach for a NEW add, but
            // a stale cart line is still possible, so this is checked again
            // here as the actual point of no return.
            const business = await tx.business.findUnique({ where: { id: businessId }, select: { approvalStatus: true, type: true, blocked: true } });
            // An admin-blocked business can't take new orders (its existing
            // orders/history are untouched) — enforced here, not just hidden in the UI.
            if (business?.approvalStatus !== "APPROVED" || business.blocked) {
                throw conflict(`${items[0].sellerName} isn't currently accepting orders.`);
            }
            // A School Vendor's items never flow through Business checkout — see
            // add-to-cart.ts's own guard; this is the actual point of no return,
            // so it's re-checked here too rather than trusted from the cart read.
            if (business.type !== "BUSINESS") {
                throw conflict(`${items[0].sellerName} orders must go through the Vendor checkout.`);
            }
            // Reserve stock for every line before creating anything for this
            // business. Conditional decrement: if another checkout took the last
            // units first, the update matches no row and the whole transaction
            // (every earlier reservation in it included) rolls back.
            for (const item of items) {
                if (!Number.isInteger(item.quantity) || item.quantity < 1)
                    throw conflict(`${item.productName} has an invalid quantity.`);
                const reserved = await reserveLine(tx, { productId: item.productId, variantId: item.variantId, sideId: null, quantity: item.quantity });
                if (!reserved) {
                    throw conflict(`${item.productName}${item.variantName ? ` (${item.variantName})` : ""} no longer has enough stock.`);
                }
            }
            // A central slot occurrence with room — counted inside this
            // transaction, so an earlier business in this same cart is included.
            const group = quote.groups.find(g => g.businessId === businessId)!;
            const central = group.plan;
            const estimate = central
                ? { estimatedDeliveryAt: central.windowStartAt, deliveryWindowStart: central.windowStartAt, deliveryWindowEnd: central.windowEndAt }
                : calculateEstimatedDelivery((await tx.businessDeliveryDay.findMany({ where: { businessId }, select: { day: true } })).map((d) => d.day), now);
            const order = await tx.order.create({
                data: {
                    userId,
                    businessId,
                    status: "PENDING_SELLER",
                    paymentStatus: "pending",
                    paystackReference: reference,
                    deliveryLocation: location || null,
                    estimatedDeliveryAt: estimate.estimatedDeliveryAt,
                    deliveryWindowStart: estimate.deliveryWindowStart,
                    deliveryWindowEnd: estimate.deliveryWindowEnd,
                    totalAmount: group.subtotalKobo / 100,
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            variantName: item.variantName,
                            quantity: item.quantity,
                            price: item.price,
                            selectedVariants: item.selectedVariants ? JSON.stringify(item.selectedVariants) : null,
                        })),
                    },
                },
            });
            if (central) {
                await createScheduledDelivery(tx, { operation: "MARKETPLACE", orderId: order.id, slotId: central.slot.id, date: central.date, staff: central.occurrence.staff, isOverflow: central.isOverflow });
            }
            snapshots.push({ orderId: order.id, businessId, slotId: central!.slot.id, slotLabel: central!.slot.label, deliveryDate: central!.date.toISOString(), windowStart: central!.windowStartAt.toISOString(), windowEnd: central!.windowEndAt.toISOString(), subtotalKobo: group.subtotalKobo, deliveryFeeKobo: group.deliveryFeeKobo!, totalKobo: group.subtotalKobo + group.deliveryFeeKobo!, items: items.map(i => ({ productId: i.productId, productName: i.productName, variantId: i.variantId, variantName: i.variantName, quantity: i.quantity, unitPriceKobo: Math.round(i.price * 100), lineSubtotalKobo: Math.round(i.price * 100) * i.quantity })) });
            created.push(order);
        }
        const totalAmount = quote.totalKobo / 100;
        const amountKobo = toKobo(totalAmount);
        if (amountKobo <= 0)
            throw conflict("This order has nothing to pay for.");
        // The payment attempt: what must be paid, which cart lines it covers
        // (only those are cleared on success — the cart is left intact until
        // then, so a cancelled payment loses nothing), and when the stock
        // reservation above lapses.
        await tx.checkoutPayment.create({
            data: {
                reference,
                userId,
                kind: "BUSINESS",
                amountKobo,
                currency: CHECKOUT_CURRENCY,
                cartItemIds: cartItems.map((item) => item.id),
                expiresAt: reservationExpiry(),
            },
        });
        await tx.checkoutFinancialSnapshot.create({ data: { reference, subtotalKobo: quote.subtotalKobo, deliveryFeeKobo: quote.deliveryFeeKobo, serviceFeeKobo: quote.serviceFeeKobo, totalKobo: amountKobo, orders: snapshots } });
        return { created, totalAmount, amountKobo };
    }, { maxWait: 10000, timeout: 20000 });
    return { reference, totalAmount: orders.totalAmount, amountKobo: orders.amountKobo, orderIds: orders.created.map((o) => o.id) };
}
