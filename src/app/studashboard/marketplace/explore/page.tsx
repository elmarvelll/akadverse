// src/app/studashboard/marketplace/explore/page.tsx
//
// Reachable from the marketplace navbar's "Explore" link — and also where
// a search (text query submitted, and/or FilterDropdown category filters
// staged at the time of submitting) lands. With no active search this
// renders the original category browse view (a heading + grid per
// category) — products are real (fetched once from
// GET /api/marketplace/search/products and grouped client-side by
// category, same endpoint SearchResultsView already uses); skills show a
// single "Coming Soon" block instead of the old per-category mock loop,
// since there's no Skill API/service/listing flow anywhere in the app —
// see MarketplaceComingSoon.tsx. With an active search, products still hit
// the real API; skills show the same "Coming Soon" treatment instead of
// the old mock searchSkills().

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, SearchX, Sparkles, X } from "lucide-react";
import api from "@/lib/axios";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import MarketplaceNavbar from "../_components/MarketplaceNavbar";
import CartDrawer from "../_components/CartDrawer";
import ProductCard from "../_components/ProductCard";
import ProductDetailModal from "../_components/ProductDetailModal";
import MarketplaceComingSoon from "../_components/MarketplaceComingSoon";
import { buildExploreHref } from "../_components/search-params";
import { useCart } from "../_components/useCart";
import { productCategories, skillCategories } from "@/services/marketplace/shared/categories";
import type { MarketplaceSide } from "@/services/marketplace/shared/types";
import type { ProductSearchResult } from "@/types/search";

const allCategories = [...productCategories, ...skillCategories];

function CategoryBrowseView({ onShowDetails }: { onShowDetails: (id: string) => void }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [products, setProducts] = useState<ProductSearchResult[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ products: ProductSearchResult[] }>("/marketplace/search/products", { params: { limit: 40 } })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.data.products);
        setStatus("loaded");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-14">
      {status === "loading" && (
        <div className="flex justify-center py-24">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center text-center py-24">
          <AlertCircle size={28} className="text-gray-400 mb-3" />
          <p className="text-gray-500">Couldn&apos;t load products. Please try again.</p>
        </div>
      )}

      {status === "loaded" &&
        productCategories.map((category) => {
          const items = products.filter((product) => product.category === category.name);
          return (
            <section key={category.id}>
              <h2 className="text-xl font-bold text-gray-900 mb-5">{category.name}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400">No listings yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {items.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={{ id: product.id, name: product.name, sellerName: product.sellerName, price: product.price, image: product.secureUrl }}
                      onShowDetails={onShowDetails}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

      <section>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Skills</h2>
        <MarketplaceComingSoon label="Skills" icon={Sparkles} />
      </section>
    </div>
  );
}

function SearchResultsView({
  query,
  side,
  categoryIds,
  onShowDetails,
}: {
  query: string;
  side: MarketplaceSide;
  categoryIds: string[];
  onShowDetails: (id: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);

  useEffect(() => {
    // Skills has no real search backend — see MarketplaceComingSoon.tsx —
    // so there's nothing to fetch for that side at all. `status` is never
    // read for this side (the render branches on `side` before it), so
    // this just skips the fetch without touching state.
    if (side === "skills") return;

    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      try {
        const res = await api.get<{ products: ProductSearchResult[] }>("/marketplace/search/products", {
          params: { q: query || undefined, categories: categoryIds.length > 0 ? categoryIds.join(",") : undefined },
        });
        if (cancelled) return;
        setProductResults(res.data.products);
        setStatus("loaded");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [query, side, categoryIds]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {query && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            &ldquo;{query}&rdquo;
            <Link href={buildExploreHref("", side, categoryIds)} aria-label="Clear search text">
              <X size={12} />
            </Link>
          </span>
        )}
        {categoryIds.map((id) => {
          const category = allCategories.find((c) => c.id === id);
          if (!category) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
            >
              {category.name}
              <Link
                href={buildExploreHref(query, side, categoryIds.filter((c) => c !== id))}
                aria-label={`Remove ${category.name} filter`}
              >
                <X size={12} />
              </Link>
            </span>
          );
        })}
      </div>

      {side === "skills" ? (
        <MarketplaceComingSoon label="Skills" icon={Sparkles} />
      ) : (
        <>
          {status === "loading" && (
            <div className="flex justify-center py-24">
              <Loader2 size={28} className="animate-spin text-gray-400" />
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center text-center py-24">
              <AlertCircle size={28} className="text-gray-400 mb-3" />
              <p className="text-gray-500">Couldn&apos;t load results. Please try again.</p>
            </div>
          )}

          {status === "loaded" && productResults.length === 0 && (
            <div className="flex flex-col items-center text-center py-24">
              <SearchX size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500">No products match your search.</p>
            </div>
          )}

          {status === "loaded" && productResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {productResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{ id: product.id, name: product.name, sellerName: product.sellerName, price: product.price, image: product.secureUrl }}
                  onShowDetails={onShowDetails}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExplorePageInner() {
  const searchParams = useSearchParams();
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const cart = useCart();

  const query = searchParams.get("q") ?? "";
  const side: MarketplaceSide = searchParams.get("side") === "skills" ? "skills" : "products";
  const categoriesParam = searchParams.get("categories") ?? "";
  // Memoized on the raw string (a stable primitive) rather than recomputed
  // as a fresh array every render — SearchResultsView's effect depends on
  // this array by reference, and an unrelated re-render here (e.g. opening
  // the cart drawer) shouldn't make it think the filters changed.
  const categoryIds = useMemo(() => categoriesParam.split(",").filter(Boolean), [categoriesParam]);
  const hasActiveSearch = Boolean(query.trim()) || categoryIds.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16">
        <MarketplaceNavbar cartCount={cart.count} onCartClick={() => setCartOpen(true)} />
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          items={cart.items}
          subtotal={cart.subtotal}
          onUpdateQuantity={cart.updateQuantity}
          onRemove={cart.removeItem}
        />
        <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} onAdded={cart.refresh} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Link
            href="/studashboard/marketplace"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-6"
          >
            <ArrowLeft size={16} />
            Back to Marketplace
          </Link>

          {hasActiveSearch ? (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Search results</h1>
              <p className="text-gray-500 mb-8">Showing matching {side}.</p>
              <SearchResultsView query={query} side={side} categoryIds={categoryIds} onShowDetails={setDetailProductId} />
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Explore</h1>
              <p className="text-gray-500 mb-12">Browse every category the marketplace has to offer.</p>
              <CategoryBrowseView onShowDetails={setDetailProductId} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExplorePageInner />
    </Suspense>
  );
}
