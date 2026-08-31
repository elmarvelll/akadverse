// src/app/studashboard/marketplace/orders/page.tsx
//
// Buyer order tracking — item-level status per order, since different
// items in the same order can be in completely different states
// (delivered / out for delivery / still processing / rejected). See
// docs/marketplace/data/order-data-flow.md and
// docs/marketplace/systems/order-history-system.md.

"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, AlertTriangle, Loader2, Package } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import api from "@/lib/axios";

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

interface OrderItemRow {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  deliveryStatus: string | null;
  deliveryOtp: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
}

interface OrderRow {
  id: string;
  status: string;
  fulfillmentStatus: string | null;
  deliveryOutcome: string;
  totalAmount: number;
  createdAt: string;
  businessName: string;
  estimatedDate: string | null;
  deliveryWindow: string | null;
  isDisputed: boolean;
  disputeResolvedAt: string | null;
  items: OrderItemRow[];
}

function itemStatusLabel(item: OrderItemRow): string {
  if (item.cancelledAt) return "Cancelled";
  if (item.rejectedAt) return "Rejected";
  if (!item.deliveryStatus) return "Processing";
  return item.deliveryStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BuyerOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.get<{ orders: OrderRow[] }>("/marketplace/orders");
      setOrders(res.data.orders);
      setLoadState("loaded");
    } catch {
      setLoadState("error");
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

  const disputeOrder = async (orderId: string) => {
    const reason = window.prompt("What went wrong with this order?");
    if (!reason) return;
    setBusyId(orderId);
    try {
      await api.post(`/marketplace/orders/${orderId}/dispute`, { reason });
      await load();
    } catch (err) {
      window.alert((isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "Couldn't submit the dispute.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16 max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Your orders</h1>

        {loadState === "loading" && (
          <div className="flex justify-center py-24">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        )}

        {loadState === "error" && (
          <div className="flex flex-col items-center text-center py-24">
            <AlertCircle size={28} className="text-gray-400 mb-3" />
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
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Order #{order.id.slice(0, 8)} · {order.businessName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.status.replace(/_/g, " ")}
                      {order.deliveryOutcome !== "PENDING" && ` · ${order.deliveryOutcome.replace(/_/g, " ").toLowerCase()}`}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">₦{nairaFormatter.format(order.totalAmount)}</p>
                </div>

                {order.estimatedDate && (
                  <p className="text-xs text-gray-500 mb-3">
                    Estimated delivery: {order.estimatedDate} · {order.deliveryWindow}
                  </p>
                )}

                <ul className="space-y-1.5">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">
                        {item.quantity} x {item.productName}
                      </span>
                      <span className="text-gray-500">{itemStatusLabel(item)}</span>
                    </li>
                  ))}
                </ul>

                {order.items.some((item) => item.deliveryOtp) && (
                  <div className="mt-3 p-3 rounded-xl bg-blue-50 text-blue-800 text-xs">
                    Delivery code:{" "}
                    <span className="font-bold tracking-wider">{order.items.find((item) => item.deliveryOtp)?.deliveryOtp}</span>
                    <br />
                    Only share this code after you have received and checked your order.
                  </div>
                )}

                {order.items.some((item) => item.rejectedAt && item.rejectionReason) && (
                  <div className="mt-3 text-xs text-red-600">
                    {order.items.find((item) => item.rejectionReason)?.rejectionReason}
                  </div>
                )}

                {order.isDisputed ? (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle size={13} />
                    {order.disputeResolvedAt ? "Dispute resolved" : "Dispute under review"}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => disputeOrder(order.id)}
                    className="mt-3 text-xs text-gray-400 hover:text-red-500 underline transition disabled:opacity-50"
                  >
                    Dispute this order
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
