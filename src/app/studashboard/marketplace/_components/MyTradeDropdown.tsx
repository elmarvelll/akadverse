// src/app/studashboard/marketplace/_components/MyTradeDropdown.tsx
//
// The navbar's "My Trade" — replaces the separate "My Businesses"/"My
// Skills" dropdowns with one two-level hover flyout, same pattern as
// FilterDropdown: level 1 is the Business/Skills side toggle, level 2 is
// that side's list + a "Create" action. Businesses are real (fetched from
// GET /api/marketplace/businesses, same as before); Skills still has no
// backend, so it stays an empty state with an inert "Create Skill" button,
// same treatment the old BusinessSkillDropdown gave it.

"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ChevronDown, Loader2, Plus } from "lucide-react";
import api from "@/lib/axios";
import type { BusinessSummary } from "@/types/business";

type TradeSide = "business" | "skills";

export default function MyTradeDropdown() {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<TradeSide>("business");
  const [businessStatus, setBusinessStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);

  // Fetches lazily on first hover rather than on every marketplace page
  // load — most visits won't open this dropdown at all.
  const handleOpen = () => {
    setOpen(true);
    if (businessStatus !== "idle") return;

    setBusinessStatus("loading");
    api
      .get<{ businesses: BusinessSummary[] }>("/marketplace/businesses")
      .then((res) => {
        setBusinesses(res.data.businesses);
        setBusinessStatus("loaded");
      })
      .catch(() => setBusinessStatus("error"));
  };

  return (
    <div className="relative" onMouseEnter={handleOpen} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition">
        <Briefcase size={16} />
        My Trade
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 flex bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-40"
          >
            {/* Level 1: Business / Skills */}
            <div className="w-36 border-r border-gray-100 py-2 shrink-0">
              {(["business", "skills"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onMouseEnter={() => setSide(option)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium capitalize transition ${
                    side === option ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {option === "business" ? "Business" : "Skills"}
                </button>
              ))}
            </div>

            {/* Level 2: that side's list + create action */}
            <AnimatePresence mode="wait">
              <motion.div
                key={side}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="w-72 p-4"
              >
                {side === "business" ? (
                  <>
                    {businessStatus === "loading" && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={18} className="animate-spin text-gray-400" />
                      </div>
                    )}
                    {businessStatus === "error" && (
                      <p className="text-sm text-red-500 mb-3">Couldn&apos;t load your businesses.</p>
                    )}
                    {businessStatus === "loaded" && businesses.length === 0 && (
                      <p className="text-sm text-gray-500 mb-3">You haven&apos;t added a business yet.</p>
                    )}
                    {businessStatus === "loaded" && businesses.length > 0 && (
                      <ul className="mb-3 max-h-56 overflow-y-auto space-y-1">
                        {businesses.map((business) => (
                          <li key={business.id}>
                            <Link
                              href={`/studashboard/marketplace/business/${business.id}`}
                              className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition"
                            >
                              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                {business.secureUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not worth a remotePatterns entry for a tiny dropdown avatar
                                  <img src={business.secureUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  business.name.slice(0, 1).toUpperCase()
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="block text-sm font-medium text-gray-900 truncate">{business.name}</span>
                                  {business.approvalStatus === "PENDING_APPROVAL" && (
                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                      Pending
                                    </span>
                                  )}
                                  {business.approvalStatus === "REJECTED" && (
                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                                      Rejected
                                    </span>
                                  )}
                                </span>
                                <span className="block text-xs text-gray-500 truncate">{business.industry}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href="/studashboard/marketplace/business/create"
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition"
                    >
                      <Plus size={16} />
                      Create Business
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-3">You haven&apos;t listed a skill yet.</p>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition"
                    >
                      <Plus size={16} />
                      Create Skill
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
