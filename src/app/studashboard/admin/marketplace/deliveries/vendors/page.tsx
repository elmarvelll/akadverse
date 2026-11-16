"use client";
import { useState } from "react";
import DeliveryRosterManager from "../../delivery-roster/_components/DeliveryRosterManager";
import VendorDelivery from "../../vendor-delivery/page";
import VendorOperations from "../../delivery-operations/page";

export default function VendorDeliveries() {
  const [tab, setTab] = useState("roster");
  return <div>
    <h1 className="mb-2 text-2xl font-bold text-gray-900">Vendor deliveries</h1>
    <p className="mb-4 text-sm text-gray-600">Vendor service days, capacity, personnel and delivery operations. Customer-selected dates and vendor preparation limits remain independent of Business delivery allocation.</p>
    <div role="tablist" aria-label="Vendor delivery tools" className="mb-6 flex flex-wrap gap-2">
      {[["roster", "Roster & schedule"], ["slots", "Time ranges & date roster"], ["operations", "Monitoring & status"]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm ${tab === key ? "bg-blue-600 text-white" : "border border-gray-300 bg-white text-gray-700"}`}>{label}</button>)}
    </div>
    {tab === "roster" && <DeliveryRosterManager fixedOperation="VENDOR" />}
    {tab === "slots" && <VendorDelivery />}
    {tab === "operations" && <VendorOperations />}
  </div>;
}
