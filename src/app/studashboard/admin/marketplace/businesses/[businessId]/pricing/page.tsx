"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import Financials from "./Financials";
import api from "@/lib/axios";
type Row = {
    slotId: string;
    label: string;
    fee: string;
    active: boolean;
    enabled: boolean; configured: boolean;
};
export default function Pricing({ params }: {
    params: Promise<{
        businessId: string;
    }>;
}) {
    const { businessId } = use(params);
    const [rows, setRows] = useState<Row[]>([]);
    const [serviceFee, setServiceFee] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(true);
    const url = `/marketplace/admin/businesses/${businessId}/pricing`;
    useEffect(() => { api.get(url).then(({ data }) => { setRows(data.slots.map((s: {
        id: string;
        label: string;
        windowStart: string;
        windowEnd: string;
        active: boolean;
    }) => { const p = data.prices.find((p: {
        slotId: string;
    }) => p.slotId === s.id); return { slotId: s.id, label: `${s.label}: ${s.windowStart}–${s.windowEnd}`, fee: p ? String(p.feeKobo / 100) : "", active: p?.active ?? false, enabled: s.active, configured: Boolean(p) }; })); setServiceFee(String(data.serviceFee)); }).catch(() => setMessage("Could not load pricing. Administrator access is required.")).finally(() => setBusy(false)); }, [url]);
    async function save() {
        if (rows.some(r => (r.active || r.configured) && r.fee === "")) { setMessage("Enter a fee for configured or active ranges. To disable a configured price, keep its fee and uncheck Active."); return; } setBusy(true); setMessage(""); try {
        await api.put(url, { prices: rows.filter(r => r.fee !== "").map(r => ({ slotId: r.slotId, fee: Number(r.fee), active: r.active })), serviceFee: Number(serviceFee) });
        setRows(current => current.map(r => ({...r, configured: r.configured || r.fee !== ""})));
            setMessage("Pricing saved. Existing orders are unchanged.");
    }
    catch {
        setMessage("Could not save. Enter valid non-negative amounts with at most two decimal places.");
    }
    finally {
        setBusy(false);
    } }
    return <div className="max-w-3xl mx-auto p-6 space-y-5"><Link href={`/studashboard/admin/marketplace/businesses/${businessId}`}>← Business profile</Link><h1 className="text-2xl font-bold">Delivery &amp; Pricing</h1><p>Prices use the existing central delivery ranges and the business’s delivery weekdays. Unconfigured or inactive prices cannot be purchased.</p>{rows.length === 0 && !busy && <p>No delivery ranges configured. Configure central ranges through the existing delivery roster.</p>}{rows.map((r, i) => <div key={r.slotId} className="border rounded-xl p-4 flex flex-wrap gap-4 items-center"><span>{r.label}{!r.enabled && " (range disabled)"}</span><label>Fee (₦) <input aria-label={`Fee for ${r.label}`} type="number" min="0" step="0.01" value={r.fee} placeholder="Not configured" onChange={e => setRows(rows.map((v, j) => j === i ? { ...v, fee: e.target.value } : v))} className="border p-2 w-32"/></label><label><input type="checkbox" checked={r.active} onChange={e => setRows(rows.map((v, j) => j === i ? { ...v, active: e.target.checked } : v))}/> Active</label></div>)}<label className="block">Global business checkout service fee (₦; charged once)<input type="number" min="0" step="0.01" value={serviceFee} onChange={e => setServiceFee(e.target.value)} className="border p-2 ml-2"/></label><button disabled={busy || serviceFee === ""} onClick={save} className="bg-blue-600 text-white rounded-lg p-3 disabled:opacity-50">{busy ? "Loading…" : "Save pricing"}</button><p role="status">{message}</p><Financials businessId={businessId}/></div>;
}
