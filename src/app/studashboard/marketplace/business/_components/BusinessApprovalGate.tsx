// src/app/studashboard/marketplace/business/_components/BusinessApprovalGate.tsx
//
// Wraps every tab of the business dashboard (Profile/Products/Orders/
// Analytics — see ../[id]/layout.tsx). A business that isn't APPROVED yet
// doesn't get the normal dashboard: the seller sees a clear pending/
// rejected status instead of the sidebar + tabs, per
// BusinessApprovalStatus's doc comment in prisma/schema.prisma. Once
// approved, renders the sidebar + tab content exactly as before.

"use client";

import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, Clock, Loader2, XCircle } from "lucide-react";
import api from "@/lib/axios";
import BusinessSidebar from "./BusinessSidebar";
import { BusinessContext } from "./BusinessContext";
import type { BusinessDetail } from "@/types/business";

type GateState = "loading" | "approved" | "pending" | "rejected" | "not-found" | "error";

export default function BusinessApprovalGate({ id, children }: { id: string; children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [business, setBusiness] = useState<BusinessDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState("loading");
      try {
        const res = await api.get<{ business: BusinessDetail }>(`/marketplace/businesses/${id}`);
        if (cancelled) return;
        setBusiness(res.data.business);
        if (res.data.business.approvalStatus === "APPROVED") setState("approved");
        else if (res.data.business.approvalStatus === "REJECTED") setState("rejected");
        else setState("pending");
      } catch (err) {
        if (cancelled) return;
        setState(isAxiosError(err) && err.response?.status === 404 ? "not-found" : "error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === "loading") {
    return (
      <div className="flex-1 flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (state === "not-found" || state === "error") {
    return (
      <div className="flex-1 flex flex-col items-center text-center py-24">
        <AlertCircle size={28} className="text-gray-400 mb-3" />
        <p className="text-gray-500">
          {state === "not-found" ? "This business doesn't exist, or isn't yours." : "Couldn't load this business. Please try again."}
        </p>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex-1 max-w-lg mx-auto text-center py-24 px-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5">
          <Clock size={26} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{business?.name} is pending review</h1>
        <p className="text-sm text-gray-500">
          An admin needs to approve this business before its dashboard, products, and orders become available. You&apos;ll
          get an email and a notification once it&apos;s reviewed.
        </p>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="flex-1 max-w-lg mx-auto text-center py-24 px-4">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-5">
          <XCircle size={26} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{business?.name} was not approved</h1>
        <p className="text-sm text-gray-500">{business?.rejectionReason || "Contact support for more details."}</p>
      </div>
    );
  }

  return (
    <BusinessContext.Provider value={business}>
      <div className="flex flex-col sm:flex-row gap-8 flex-1 min-w-0">
        <BusinessSidebar id={id} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </BusinessContext.Provider>
  );
}
