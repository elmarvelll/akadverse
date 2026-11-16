import type { ManifestCard } from "./DeliveryCards";

export type DeliveryPanel = "Scheduled" | "Ongoing / Processing" | "Delivered";
export const DELIVERY_PANELS: DeliveryPanel[] = ["Scheduled", "Ongoing / Processing", "Delivered"];
export function deliveryPanel(status: string, windowStart: string | null | undefined, now = new Date()): DeliveryPanel {
  if (status === "DELIVERED") return "Delivered";
  if ((status === "ASSIGNED" || status === "PROCESSING_ORDER" || status === "PLANNED") && windowStart && new Date(windowStart) > now) return "Scheduled";
  return "Ongoing / Processing";
}

// Filter individual bookings so a mixed-status slot never duplicates a delivery
// across panels. Restrict collection details to those visible bookings too.
export function cardsForPanel(cards: ManifestCard[], panel: DeliveryPanel, now: Date): ManifestCard[] {
  return cards.map((card) => {
    const deliveries = card.deliveries.filter((d) => deliveryPanel(d.status, card.windowStart ? `${card.date}T${card.windowStart}:00+01:00` : null, now) === panel);
    const refs = new Set(deliveries.flatMap((d) => d.orderRefs ?? []));
    const pickups = card.pickups.filter((p) => deliveries.some((d) => d.vendors.some((v) => v.name === p.name)))
      .map((p) => ({ ...p, orderRefs: p.orderRefs.filter((ref) => refs.has(ref)),
        itemCount: deliveries.reduce((n, d) => n + d.vendors.filter((v) => v.name === p.name).reduce((m, v) => m + v.items.reduce((sum, i) => sum + i.quantity, 0), 0), 0) }));
    return { ...card, deliveries, pickups };
  }).filter((c) => c.deliveries.length > 0);
}
