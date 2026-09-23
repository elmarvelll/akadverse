// src/app/studashboard/marketplace/_components/FilterDropdown.tsx
//
// The navbar's "Filter" control: a two-level hover flyout. Level 1
// (Products/Skills) is purely a local hover-preview of which category list
// is showing — it doesn't affect the actual search side. Level 2 is that
// side's categories; *clicking* one selects it as a real filter (up to
// `MAX_FILTERS`), which is what actually drives the search — selection
// state is owned by the parent (see MarketplaceNavbar.tsx) since it also
// has to combine with the search box's text query.
//
// Selecting a category under a *different* side than the current
// selection switches the search side and starts a fresh selection — a
// search is either for products or for skills, not both at once.

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { productCategories, skillCategories } from "@/services/marketplace/shared/categories";
import type { MarketplaceSide } from "@/services/marketplace/shared/types";

export const MAX_FILTERS = 4;

interface FilterDropdownProps {
  selectedSide: MarketplaceSide;
  selectedCategoryIds: string[];
  onToggleCategory: (side: MarketplaceSide, categoryId: string) => void;
}

export default function FilterDropdown({ selectedSide, selectedCategoryIds, onToggleCategory }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [previewSide, setPreviewSide] = useState<MarketplaceSide>(selectedSide);

  const categories = previewSide === "products" ? productCategories : skillCategories;
  // Selections only ever belong to one side at a time, so the "which
  // categories are checked" list only applies while previewing that side.
  const activeSelection = previewSide === selectedSide ? selectedCategoryIds : [];
  const atMax = activeSelection.length >= MAX_FILTERS;

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        setOpen(true);
        setPreviewSide(selectedSide);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Filter"
        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
          selectedCategoryIds.length > 0
            ? "border-blue-500 bg-blue-50 text-blue-600"
            : "border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <SlidersHorizontal size={16} className="sm:hidden" />
        <span className="hidden sm:inline">Filter</span>
        {selectedCategoryIds.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
            {selectedCategoryIds.length}
          </span>
        )}
        <ChevronDown size={14} className={`hidden sm:block transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-4 right-4 top-36 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 flex flex-col sm:flex-row bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-40 max-h-[75vh] sm:max-h-none"
          >
            {/* Level 1: Products / Skills (hover preview only) — a
                horizontal pill row on mobile, stacked above level 2;
                the original left-column layout returns at sm: */}
            <div className="flex sm:block sm:w-40 border-b sm:border-b-0 sm:border-r border-gray-100 py-2">
              {(["products", "skills"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPreviewSide(option)}
                  onMouseEnter={() => setPreviewSide(option)}
                  className={`flex-1 sm:w-full text-center sm:text-left px-4 py-2.5 text-sm font-medium capitalize transition ${
                    previewSide === option ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {option}
                  {option === selectedSide && selectedCategoryIds.length > 0 && (
                    <span className="ml-1.5 text-xs text-blue-500">({selectedCategoryIds.length})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Level 2: that side's categories */}
            <AnimatePresence mode="wait">
              <motion.div
                key={previewSide}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="w-full sm:w-64 py-2 max-h-60 sm:max-h-80 overflow-y-auto"
              >
                {atMax && (
                  <p className="px-4 pb-2 text-xs text-amber-600">Up to {MAX_FILTERS} filters — remove one to add another.</p>
                )}
                {categories.map((category) => {
                  const Icon = category.icon;
                  const selected = activeSelection.includes(category.id);
                  const disabled = !selected && atMax;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onToggleCategory(previewSide, category.id)}
                      className={`w-full flex items-center gap-2.5 text-left px-4 py-2 text-sm transition ${
                        selected
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : disabled
                            ? "text-gray-300 cursor-not-allowed"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon size={16} className={`shrink-0 ${selected ? "text-blue-500" : "text-gray-400"}`} />
                      <span className="flex-1">{category.name}</span>
                      {selected && <Check size={14} className="text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
