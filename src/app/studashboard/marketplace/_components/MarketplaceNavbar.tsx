// src/app/studashboard/marketplace/_components/MarketplaceNavbar.tsx
//
// The marketplace's own secondary navbar, rendered below DashboardNavbar
// (see ../page.tsx and ../explore/page.tsx — it's on both) — matches the
// "Student Marketplace" bar in the reference screenshot: search + filter,
// then Explore, My Trade, notifications, and the cart trigger.
//
// Owns the search box text and the selected side/filters (FilterDropdown
// is a controlled child of this). Toggling a filter only stages it —
// filters are just criteria for the *next* search, they don't navigate on
// their own. Only submitting the search box (Enter, or the search icon)
// navigates to /explore with the combined query — see search-params.ts's
// buildExploreHref(). Initial state is read once from
// `window.location.search` (not Next's useSearchParams(), which would
// force a Suspense boundary here) — good enough for "land on a shared
// /explore link with this navbar showing the active search"; the reverse
// direction (this navbar driving /explore's results) doesn't need it.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Compass, Package, ShoppingCart } from "lucide-react";
import FilterDropdown from "./FilterDropdown";
import MyTradeDropdown from "./MyTradeDropdown";
import NotificationDropdown from "./NotificationDropdown";
import { buildExploreHref } from "./search-params";
import type { MarketplaceSide } from "@/services/marketplace/shared/types";

function readInitialParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

interface MarketplaceNavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

export default function MarketplaceNavbar({ cartCount, onCartClick }: MarketplaceNavbarProps) {
  const router = useRouter();

  const [query, setQuery] = useState(() => readInitialParam("q"));
  const [side, setSide] = useState<MarketplaceSide>(() => (readInitialParam("side") === "skills" ? "skills" : "products"));
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(() => {
    const raw = readInitialParam("categories");
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildExploreHref(query, side, selectedCategoryIds));
  };

  const handleToggleCategory = (categorySide: MarketplaceSide, categoryId: string) => {
    // Selecting a category under the *other* side switches the search to
    // that side and starts a fresh selection — see FilterDropdown.tsx. This
    // only stages the filter; it doesn't navigate (see the file header).
    const base = categorySide === side ? selectedCategoryIds : [];
    const isSelected = base.includes(categoryId);
    if (!isSelected && base.length >= 4) return;

    const next = isSelected ? base.filter((id) => id !== categoryId) : [...base, categoryId];
    setSide(categorySide);
    setSelectedCategoryIds(next);
  };

  return (
    <div className="sticky top-16 z-30 bg-white border-b border-gray-100">
      <div className="px-3 sm:px-6 h-20 flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">M</div>
          <span className="font-bold text-gray-900 hidden sm:inline">Student Marketplace</span>
        </div>

        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 sm:max-w-2xl">
          <form onSubmit={handleSubmitSearch} className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, skills…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </form>
          <FilterDropdown selectedSide={side} selectedCategoryIds={selectedCategoryIds} onToggleCategory={handleToggleCategory} />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-6 shrink-0">
          <Link
            href="/studashboard/marketplace/explore"
            className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          >
            <Compass size={16} />
            Explore
          </Link>
          <Link
            href="/studashboard/marketplace/orders"
            className="hidden lg:flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
          >
            <Package size={16} />
            Your Orders
          </Link>
          <MyTradeDropdown />
          <NotificationDropdown />
          <button
            type="button"
            onClick={onCartClick}
            aria-label="Open cart"
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-50 text-gray-700 transition"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
