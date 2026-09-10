// .../vendor-checkout/_components/DeliveryDatePicker.tsx
//
// "Delivery Date" picker (spec §4-6): Today / Tomorrow / Choose custom
// date. Defaults to today wherever it's mounted (the parent seeds `value`
// with todayIsoDate() on first render — see spec §5). Shared between the
// customer's Vendor checkout page and the vendor's own capacity editor
// (spec §3's "same principle should apply to any similar capacity-editing
// interface" — both need the same Today/Tomorrow/custom shape). The
// backend is always the authority on validity (parseAndValidateDeliveryDate)
// — this component only offers a sane, bounded range so a customer/vendor
// rarely hits a rejection at all.

"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";

const MAX_ADVANCE_DAYS = 7; // mirrors MAX_ADVANCE_BOOKING_DAYS in validate-delivery-date.ts

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

const dayFormatter = new Intl.DateTimeFormat("en-NG", { month: "long", day: "numeric" });

interface DeliveryDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  disabled?: boolean;
}

export default function DeliveryDatePicker({ value, onChange, disabled }: DeliveryDatePickerProps) {
  const today = new Date();
  const todayIso = toIsoDate(today);
  const tomorrowIso = toIsoDate(addDays(today, 1));
  const maxIso = toIsoDate(addDays(today, MAX_ADVANCE_DAYS));

  const isCustomSelected = value !== todayIso && value !== tomorrowIso;
  const [customOpen, setCustomOpen] = useState(isCustomSelected);

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <CalendarDays size={13} /> Delivery date
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCustomOpen(false);
            onChange(todayIso);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${
            value === todayIso && !customOpen ? "bg-purple-600 border-purple-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Today — {dayFormatter.format(today)}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCustomOpen(false);
            onChange(tomorrowIso);
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${
            value === tomorrowIso && !customOpen ? "bg-purple-600 border-purple-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Tomorrow — {dayFormatter.format(addDays(today, 1))}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setCustomOpen(true)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 ${
            customOpen ? "bg-purple-600 border-purple-600 text-white" : "border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Choose custom date
        </button>
      </div>
      {customOpen && (
        <input
          type="date"
          value={isCustomSelected ? value : ""}
          min={todayIso}
          max={maxIso}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="mt-2 px-3 py-2 border border-gray-200 rounded-xl text-sm disabled:opacity-50"
        />
      )}
    </div>
  );
}
