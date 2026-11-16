import type { DelivererScheduleRow } from "@/lib/delivery-schedule";
import { deliveryPanel, type DeliveryPanel } from "./delivery-panels";

export function scheduleGroups(rows: DelivererScheduleRow[]) {
  const groups = new Map<string, DelivererScheduleRow[]>();
  for (const row of rows) {
    const key = `${row.date}|${row.operation}|${row.slotId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return Array.from(groups.values()).sort((a, b) => a[0].date.localeCompare(b[0].date) || a[0].windowStart.localeCompare(b[0].windowStart));
}

export default function ScheduleOverview({ rows, panel, now }: { rows: DelivererScheduleRow[]; panel: DeliveryPanel; now: Date }) {
  const visible = rows.filter((r) => deliveryPanel(r.status, `${r.date}T${r.windowStart}:00+01:00`, now) === panel);
  return <section aria-label="Delivery schedule overview" className="space-y-3">
    <h2 className="font-semibold text-gray-900">Your deliveries by date and time slot</h2>
    {visible.length === 0 && <p className="text-sm text-gray-500">No scheduled orders in this panel.</p>}
    {scheduleGroups(visible).map((group) => {
      const first = group[0];
      const overflow = group.filter((r) => r.isOverflow).length;
      return <div key={`${first.date}|${first.operation}|${first.slotId}`} className="rounded-xl border bg-white p-4 text-sm">
        <p className="font-semibold">{first.operation === "VENDOR" ? "Vendor Deliveries" : "Business Deliveries"} · {first.date}</p>
        <p>{first.slotLabel} · {first.windowStart}–{first.windowEnd} · {first.delivererName}</p>
        <p>{group.length} deliveries assigned to you · {group.length - overflow} regular · {overflow} overflow</p>
        {first.full && <p className="font-semibold text-amber-800">Full slot · Regular limit: {first.limit}</p>}
        <ul className="mt-2 space-y-2">{group.map((r) => <li key={r.id}>
          <p>{r.businessNames.join(", ")} · {r.orderIds.map((id) => `Order #${id.slice(0, 8)}`).join(", ")}</p>
          <p className={r.isOverflow ? "font-semibold text-amber-800" : "text-gray-600"}>{r.status === "PLANNED" ? "Awaiting dispatch" : r.status.replaceAll("_", " ")} · {r.isOverflow ? "Overflow — extra delivery" : "Regular assignment"}</p>
        </li>)}</ul>
      </div>;
    })}
  </section>;
}
