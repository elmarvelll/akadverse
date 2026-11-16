"use client";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
type Snapshot = {
    reference: string;
    subtotalKobo: number;
    deliveryFeeKobo: number;
    serviceFeeKobo: number;
    totalKobo: number;
    orders: {
        orderId: string;
        businessId: string;
        subtotalKobo: number;
        deliveryFeeKobo: number;
        slotLabel: string;
        windowStart: string;
        windowEnd: string;
    }[];
};
const money = (k: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(k / 100);
export default function Financials({ businessId }: {
    businessId: string;
}) {
    const [data, setData] = useState<{
        orders: {
            id: string;
            paymentStatus: string;
            totalAmount: number;
        }[];
        snapshots: Snapshot[];
        payments: {
            reference: string;
            status: string;
            amountKobo: number;
        }[];
    } | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => { api.get(`/marketplace/admin/businesses/${businessId}/financials`).then(r => setData(r.data)).catch(() => setError(true)); }, [businessId]);
    return <section className="space-y-3"><h2 className="text-xl font-semibold">Recent order financial records</h2>{error && <p>Could not load financial records.</p>}{!data && !error && <p>Loading financial records…</p>}{data?.snapshots.map(s => <article key={s.reference} className="border rounded-xl p-4 space-y-2"><p className="break-all font-semibold">Checkout {s.reference}</p><p>Payment: {data.payments.find(p => p.reference === s.reference)?.status ?? "Unknown"}</p>{s.orders.map(o => <div key={o.orderId}><p className="break-all">Order {o.orderId}{o.businessId !== businessId && " (other business in checkout)"}</p><p>Items {money(o.subtotalKobo)} · Delivery {money(o.deliveryFeeKobo)}</p><p>{o.slotLabel} · {o.windowStart} – {o.windowEnd}</p></div>)}<p>Checkout items: {money(s.subtotalKobo)} · Delivery: {money(s.deliveryFeeKobo)}</p><p>Service fee (once per checkout): {money(s.serviceFeeKobo)}</p><p className="font-bold">Expected payment: {money(s.totalKobo)}</p></article>)}{data?.orders.filter(o => !data.snapshots.some(s => s.orders.some(row => row.orderId === o.id))).map(o => <p key={o.id}>Historical order {o.id}: item total {money(Math.round(o.totalAmount * 100))}; {o.paymentStatus}. Detailed fee snapshot unavailable.</p>)}</section>;
}
