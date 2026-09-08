// src/app/studashboard/marketplace/vendor-dashboard/[id]/orders/page.tsx
//
// The vendor's own Orders tab — no accept/reject controls (spec §6: a
// vendor never accepts/rejects, payment confirmation auto-accepts). Once
// prepared, "Mark Ready" makes it eligible for a deliverer to collect
// directly from the vendor's own location — no central drop-off (spec
// §7-8). Any deliverer currently assigned to collect from this vendor
// shows their pickup code here, since there's no coordinator screen for
// vendor handoffs — see
// docs/marketplace/decisions/vendor-independent-architecture.md.

"use client";

import { use, useEffect, useState } from "react";
import { AlertCircle, Loader2, Package, ShieldCheck } from "lucide-react";
import api from "@/lib/axios";

interface VendorOrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  deliveryStatus: string | null;
}

interface VendorOrder {
  id: string;
  status: string;
  fulfillmentStatus: string | null;
  deliveryOutcome: string;
  totalAmount: number;
  createdAt: string;
  sellerMarkedReadyAt: string | null;
  deliveryLocation: string | null;
  isDisputed: boolean;
  items: VendorOrderItem[];
}

interface PendingPickup {
  id: string;
  pickupOtp: string | null;
  pickupOtpExpiry: string | null;
  delivererName: string;
}

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export default function VendorOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [pendingPickups, setPendingPickups] = useState<PendingPickup[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoadState("loading");
    try {
      const res = await api.get<{ orders: VendorOrder[]; pendingPickups: PendingPickup[] }>(`/marketplace/vendor/${id}/orders`);
      setOrders(res.data.orders);
      setPendingPickups(res.data.pendingPickups);
      setLoadState("loaded");
    } catch {
      setLoadState("error");
    }
  };

  useEffect(() => {
    const run = async () => {
      await load();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const markReady = async (orderId: string) => {
    setBusyId(orderId);
    try {
      await api.post(`/marketplace/vendor/${id}/orders/${orderId}/ready`);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Orders</h1>

      {pendingPickups.length > 0 && (
        <div className="mb-6 space-y-2">
          {pendingPickups.map((pickup) => (
            <div key={pickup.id} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <ShieldCheck size={20} className="text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-purple-900">{pickup.delivererName} is assigned to collect from you</p>
                <p className="text-xs text-purple-700">
                  Give them this code when they arrive: <span className="font-bold tracking-wider">{pickup.pickupOtp}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadState === "loading" && (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}

      {loadState === "error" && (
        <div className="flex flex-col items-center text-center py-16">
          <AlertCircle size={24} className="text-gray-400 mb-3" />
          <p className="text-gray-500">Couldn&apos;t load your orders.</p>
        </div>
      )}

      {loadState === "loaded" && orders.length === 0 && (
        <div className="flex flex-col items-center text-center py-24 bg-white rounded-2xl border border-gray-100">
          <Package size={28} className="text-gray-300 mb-3" />
          <p className="text-gray-500">No orders yet.</p>
        </div>
      )}

      {loadState === "loaded" && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-gray-500">
                    {order.fulfillmentStatus?.replace(/_/g, " ") ?? "Processing"}
                    {order.deliveryOutcome !== "PENDING" && ` · ${order.deliveryOutcome.replace(/_/g, " ").toLowerCase()}`}
                    {order.isDisputed && <span className="text-red-600 font-medium"> · Disputed</span>}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">₦{nairaFormatter.format(order.totalAmount)}</p>
              </div>

              <ul className="space-y-1 mb-3">
                {order.items.map((item) => (
                  <li key={item.id} className="text-sm text-gray-700 flex justify-between">
                    <span>
                      {item.quantity} x {item.productName}
                    </span>
                    <span className="text-gray-400">{item.deliveryStatus?.replace(/_/g, " ") ?? "Preparing"}</span>
                  </li>
                ))}
              </ul>

              {order.fulfillmentStatus === "PROCESSING" && (
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => markReady(order.id)}
                  className="text-xs font-semibold px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-50"
                >
                  {busyId === order.id ? "Marking ready…" : "Mark Ready for Pickup"}
                </button>
              )}
              {order.fulfillmentStatus === "READY_FOR_PICKUP" && (
                <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700">
                  Ready — waiting for deliverer
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
