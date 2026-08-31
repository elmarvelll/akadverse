// src/app/studashboard/admin/marketplace/deliveries/page.tsx
//
// Delivery coordinator's assignment screen: dropped-off order items on one
// side, approved deliverers on the other — select items, pick a deliverer,
// assign. Chrome (navbar + admin tab menu) comes from ../layout.tsx. See
// docs/marketplace/systems/delivery-coordinator-system.md.

"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, Loader2 } from "lucide-react";
import api from "@/lib/axios";

interface ReadyItem {
  id: string;
  orderId: string;
  quantity: number;
  productName: string;
  businessName: string;
  sellerDroppedOffAt: string | null;
}

interface DelivererRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AssignedHandoff {
  businessId: string;
  businessName: string;
  pickupOtp: string;
  pickupOtpExpiry: string;
}

export default function AdminDeliveriesPage() {
  const [readyItems, setReadyItems] = useState<ReadyItem[]>([]);
  const [deliverers, setDeliverers] = useState<DelivererRow[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectedDelivererId, setSelectedDelivererId] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "forbidden" | "error">("loading");
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState("");
  const [lastHandoffs, setLastHandoffs] = useState<AssignedHandoff[]>([]);

  const load = async () => {
    setLoadState("loading");
    try {
      const [itemsRes, deliverersRes] = await Promise.all([
        api.get<{ items: ReadyItem[] }>("/marketplace/admin/deliveries/ready-items"),
        api.get<{ deliverers: DelivererRow[] }>("/marketplace/admin/deliverers"),
      ]);
      setReadyItems(itemsRes.data.items);
      setDeliverers(deliverersRes.data.deliverers.filter((d) => d.status === "APPROVED"));
      setLoadState("loaded");
    } catch (err) {
      setLoadState(isAxiosError(err) && err.response?.status === 403 ? "forbidden" : "error");
    }
  };

  useEffect(() => {
    // Locally-defined wrapper — same convention as
    // src/app/studashboard/marketplace/_components/useCart.ts.
    const run = async () => {
      await load();
    };
    run();
  }, []);

  const toggleItem = (id: string) => {
    setSelectedItemIds((current) => (current.includes(id) ? current.filter((i) => i !== id) : [...current, id]));
  };

  const assign = async () => {
    if (!selectedDelivererId || selectedItemIds.length === 0) return;
    setAssigning(true);
    setMessage("");
    try {
      const res = await api.post<{ message: string; deliveryId: string; handoffs: AssignedHandoff[] }>(
        "/marketplace/admin/deliveries",
        { delivererId: selectedDelivererId, orderItemIds: selectedItemIds }
      );
      setMessage("Assigned.");
      setLastHandoffs(res.data.handoffs);
      setSelectedItemIds([]);
      await load();
    } catch (err) {
      setMessage((isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadState === "forbidden" || loadState === "error") {
    return (
      <div className="flex flex-col items-center text-center py-24 px-4">
        <AlertCircle size={28} className="text-gray-400 mb-3" />
        <p className="text-gray-500">{loadState === "forbidden" ? "Admin access required." : "Couldn't load ready items."}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Assign deliveries</h1>
      <p className="text-sm text-gray-500 mb-6">Items dropped off at the central drop-off point, waiting for a deliverer.</p>

      {lastHandoffs.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-semibold text-blue-900">Read this code to the deliverer:</p>
          {lastHandoffs.map((handoff) => (
            <p key={handoff.businessId} className="text-sm text-blue-900">
              <strong>{handoff.businessName}:</strong>{" "}
              <span className="font-mono text-base font-bold tracking-widest">
                {handoff.pickupOtp.slice(0, 3)} {handoff.pickupOtp.slice(3)}
              </span>{" "}
              <span className="text-blue-700">(valid until {new Date(handoff.pickupOtpExpiry).toLocaleString()})</span>
            </p>
          ))}
          <p className="text-xs text-blue-700">
            Didn&apos;t catch it in time? Codes stay visible on the{" "}
            <a href="/studashboard/admin/marketplace/deliverers/assignments" className="underline">
              Deliverer assignments
            </a>{" "}
            page too.
          </p>
        </div>
      )}

      {readyItems.length === 0 ? (
        <p className="text-sm text-gray-400">No items waiting for assignment.</p>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {readyItems.map((item) => (
              <label key={item.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItemIds.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.quantity} x {item.productName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.businessName} · Order #{item.orderId.slice(0, 8)}
                    {item.sellerDroppedOffAt && ` · dropped off ${new Date(item.sellerDroppedOffAt).toLocaleString()}`}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-wrap items-center gap-3">
            <select
              value={selectedDelivererId}
              onChange={(e) => setSelectedDelivererId(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a deliverer…</option>
              {deliverers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={assigning || !selectedDelivererId || selectedItemIds.length === 0}
              onClick={assign}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {assigning ? "Assigning…" : `Assign ${selectedItemIds.length || ""} item(s)`}
            </button>
            {message && <span className="text-sm text-gray-500">{message}</span>}
          </div>
        </>
      )}
    </div>
  );
}
