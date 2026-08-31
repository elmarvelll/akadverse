// src/app/studashboard/marketplace/checkout/page.tsx
//
// Order preview (items, editable delivery location, price breakdown) +
// "Proceed to Payment", which opens a Paystack popup
// (loadPaystackScript.ts) using the test publishable key. Real flow:
//   1. GET  .../checkout/summary       — render the preview below.
//   2. POST .../checkout/initialize    — creates the real Order rows,
//      returns a Paystack reference + amount.
//   3. Paystack popup collects payment.
//   4. POST .../checkout/verify        — server-side confirms with
//      Paystack (never trusts the popup's own callback alone) and marks
//      the orders paid. /api/webhooks/paystack does the same
//      confirmation independently, for when this call never happens
//      (tab closed right after paying).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MapPin, ShoppingBag } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import api from "@/lib/axios";
import { loadPaystackScript } from "./_components/loadPaystackScript";
import type { CheckoutSummary, InitializeCheckoutResponse } from "@/types/checkout";

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

type PageStatus = "loading" | "ready" | "empty" | "error" | "paying" | "verifying" | "success" | "payment-error";

export default function CheckoutPage() {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await api.get<CheckoutSummary>("/marketplace/checkout/summary");
        if (cancelled) return;
        setSummary(res.data);
        setLocation(res.data.location);
        setStatus(res.data.items.length === 0 ? "empty" : "ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProceedToPayment = async () => {
    if (!location.trim()) {
      setError("Please add a delivery location.");
      return;
    }

    setError("");
    setStatus("paying");

    try {
      await loadPaystackScript();
      const res = await api.post<InitializeCheckoutResponse>("/marketplace/checkout/initialize", { location });
      const { reference, amountKobo, email } = res.data;

      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_KEY;
      if (!publicKey || !window.PaystackPop) {
        throw new Error("Payment isn't available right now.");
      }

      window.PaystackPop.setup({
        key: publicKey,
        email,
        amount: amountKobo,
        ref: reference,
        currency: "NGN",
        onClose: () => setStatus("ready"),
        callback: (response) => {
          verifyPayment(response.reference);
        },
      }).openIframe();
    } catch (err) {
      const message =
        (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) ||
        (err instanceof Error ? err.message : "Couldn't start payment. Please try again.");
      setError(message);
      setStatus("ready");
    }
  };

  const verifyPayment = async (reference: string) => {
    setStatus("verifying");
    try {
      await api.post("/marketplace/checkout/verify", { reference });
      setStatus("success");
    } catch (err) {
      const message =
        (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "We couldn't confirm your payment.";
      setError(message);
      setStatus("payment-error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16 max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link
          href="/studashboard/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-6"
        >
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        {status === "loading" && (
          <div className="flex justify-center py-24">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center text-center py-24">
            <AlertCircle size={28} className="text-gray-400 mb-3" />
            <p className="text-gray-500">Couldn&apos;t load your checkout. Please try again.</p>
          </div>
        )}

        {status === "empty" && (
          <div className="flex flex-col items-center text-center py-24 bg-white rounded-2xl border border-gray-100">
            <ShoppingBag size={28} className="text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">Your cart is empty.</p>
            <Link href="/studashboard/marketplace" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition">
              Browse the marketplace
            </Link>
          </div>
        )}

        {status === "success" && (
          <div className="text-center bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
            <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={28} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Order placed!</h1>
            <p className="text-sm text-gray-500 mb-8">Your payment was confirmed and your order is on its way to the seller.</p>
            <Link
              href="/studashboard/marketplace"
              className="block w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition"
            >
              Back to Marketplace
            </Link>
          </div>
        )}

        {summary && (status === "ready" || status === "paying" || status === "verifying" || status === "payment-error") && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Checkout</h1>
            <p className="text-gray-500 mb-8">Review your order before paying.</p>

            <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Your order</h2>
              <div className="space-y-4">
                {summary.items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {item.image ? (
                        <Image src={item.image} alt={item.productName} fill sizes="56px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">No image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-500">by {item.sellerName}</p>
                      {item.variantName && <p className="text-xs text-gray-400">{item.variantName}</p>}
                      <p className="text-xs text-gray-500 mt-0.5">Qty {item.quantity}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Est. delivery: {item.estimatedDeliveryDate} · {item.deliveryWindow}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 shrink-0">
                      ₦{nairaFormatter.format(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <label htmlFor="location" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="text-gray-400" />
                Delivery location
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={status === "paying" || status === "verifying"}
                placeholder="e.g. Block C, Female Hostel"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition disabled:opacity-60"
              />
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₦{nairaFormatter.format(summary.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Service fee</span>
                <span>₦{nairaFormatter.format(summary.serviceFee)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span>₦{nairaFormatter.format(summary.total)}</span>
              </div>
            </section>

            {error && <div className="text-sm p-3 rounded-lg text-red-700 bg-red-100 mb-4">{error}</div>}

            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={status === "paying" || status === "verifying"}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {(status === "paying" || status === "verifying") && <Loader2 size={18} className="animate-spin" />}
              {status === "verifying" ? "Confirming payment…" : status === "paying" ? "Opening payment…" : "Proceed to Payment"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
