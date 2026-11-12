// src/app/studashboard/admin/marketplace/users/[userId]/page.tsx
//
// Admin "View Profile" for one user — safe fields only (never
// password/tokens, see services/marketplace/admin/get-user-detail.ts's own
// comment), plus the businesses they own, each linking to the admin
// Business Profile page. Backed by GET /marketplace/admin/users/[userId],
// which already existed but was unused before this.

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, Loader2, Store } from "lucide-react";
import api from "@/lib/axios";

interface AdminUserDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isAdmin: boolean;
  location: string | null;
  createdAt: string;
  businesses: { id: string; name: string; approvalStatus: string }[];
  businessCount: number;
  orderCount: number;
  delivererStatus: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" });

export default function AdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "forbidden" | "not-found" | "error">("loading");

  useEffect(() => {
    const run = async () => {
      setLoadState("loading");
      try {
        const res = await api.get<{ user: AdminUserDetail }>(`/marketplace/admin/users/${userId}`);
        setUser(res.data.user);
        setLoadState("loaded");
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 403) setLoadState("forbidden");
        else if (isAxiosError(err) && err.response?.status === 404) setLoadState("not-found");
        else setLoadState("error");
      }
    };
    run();
  }, [userId]);

  if (loadState === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (loadState !== "loaded" || !user) {
    return (
      <div className="flex flex-col items-center text-center py-24 px-4">
        <AlertCircle size={28} className="text-gray-400 mb-3" />
        <p className="text-gray-500">
          {loadState === "forbidden"
            ? "Admin access required."
            : loadState === "not-found"
              ? "This user doesn't exist."
              : "Couldn't load this user."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/studashboard/admin/marketplace/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-6"
      >
        <ArrowLeft size={16} />
        Back to Users
      </Link>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shrink-0">
          {user.firstName.slice(0, 1).toUpperCase()}
          {user.lastName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-gray-500 break-words">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{user.role}</span>
            {user.isAdmin && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">Admin</span>}
            {user.delivererStatus && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">
                Deliverer: {user.delivererStatus}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Businesses</p>
          <p className="text-xl font-bold text-gray-900">{user.businessCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Orders placed</p>
          <p className="text-xl font-bold text-gray-900">{user.orderCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Joined</p>
          <p className="text-xl font-bold text-gray-900">{dateFormatter.format(new Date(user.createdAt))}</p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 mb-1">Location</dt>
            <dd className="text-gray-900">{user.location || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">Deliverer status</dt>
            <dd className="text-gray-900">{user.delivererStatus || "Hasn't applied"}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Store size={16} className="text-gray-400" />
          Businesses
        </h2>
        {user.businesses.length === 0 ? (
          <p className="text-sm text-gray-400">This user hasn&apos;t registered a business.</p>
        ) : (
          <div className="space-y-2">
            {user.businesses.map((business) => (
              <Link
                key={business.id}
                href={`/studashboard/admin/marketplace/businesses/${business.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-200 transition"
              >
                <p className="text-sm font-medium text-gray-900">{business.name}</p>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    business.approvalStatus === "APPROVED"
                      ? "bg-green-50 text-green-700"
                      : business.approvalStatus === "REJECTED"
                        ? "bg-red-50 text-red-600"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {business.approvalStatus.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
