// src/app/studashboard/marketplace/vendor/[id]/page.tsx
//
// Public vendor storefront — profile (name, category, location,
// availability), products (opens the shared ProductDetailModal, same one
// Business products use, for multi-variant + side selection), and
// standalone Sides (added directly here, since a buyer can order sides
// alone per spec §9). Fetches GET /api/marketplace/vendor/[id] — see
// services/marketplace/vendor/get-vendor-storefront.ts.

"use client";

import { use, useEffect, useState } from "react";
import { AlertCircle, Clock, Loader2, MapPin } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import MarketplaceNavbar from "../../_components/MarketplaceNavbar";
import ProductCard from "../../_components/ProductCard";
import ProductDetailModal from "../../_components/ProductDetailModal";
import MarketplaceCartDrawer from "../../_components/MarketplaceCartDrawer";
import { useCart } from "../../_components/useCart";
import { useVendorCart } from "../../_components/useVendorCart";
import MarketplaceFooter from "../../_components/MarketplaceFooter";
import api from "@/lib/axios";

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

interface VendorStorefront {
  id: string;
  name: string;
  description: string;
  vendorCategory: string | null;
  location: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  secureUrl: string | null;
  paused: boolean;
  pausedReason: string | null;
  products: { id: string; name: string; category: string; price: number; stock: number; secureUrl: string | null }[];
  sides: { id: string; name: string; price: number; available: boolean; stock: number | null }[];
}

export default function VendorStorefrontPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [vendor, setVendor] = useState<VendorStorefront | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cart = useCart();
  const vendorCart = useVendorCart();
  const refreshCarts = () => {
    cart.refresh();
    vendorCart.refresh();
  };

  useEffect(() => {
    api
      .get<{ vendor: VendorStorefront }>(`/marketplace/vendor/${id}`)
      .then((res) => {
        setVendor(res.data.vendor);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16">
        <MarketplaceNavbar cartCount={cart.count + vendorCart.count} onCartClick={() => setCartOpen(true)} />
        <MarketplaceCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          business={{ items: cart.items, subtotal: cart.subtotal, onUpdateQuantity: cart.updateQuantity, onRemove: cart.removeItem, status: cart.status }}
          vendor={{ items: vendorCart.items, subtotal: vendorCart.subtotal, onUpdateQuantity: vendorCart.updateQuantity, onRemove: vendorCart.removeItem, status: vendorCart.status }}
        />
        <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} onAdded={refreshCarts} />

        {status === "loading" && (
          <div className="flex justify-center py-24">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center text-center py-24 px-6">
            <AlertCircle size={28} className="text-gray-400 mb-3" />
            <p className="text-gray-500">This vendor isn&apos;t available.</p>
          </div>
        )}

        {status === "loaded" && vendor && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <div className="flex items-start gap-4 mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-300 text-xs">
                {vendor.secureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={vendor.secureUrl} alt={vendor.name} className="w-full h-full object-cover" />
                ) : (
                  "No image"
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
                <p className="text-sm text-gray-500">{vendor.vendorCategory ?? "School Vendor"}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
                  {vendor.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {vendor.location}
                    </span>
                  )}
                  {vendor.availabilityStart && vendor.availabilityEnd && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {vendor.availabilityStart} – {vendor.availabilityEnd}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {vendor.paused && (
              <div className="mt-4 text-sm p-3 rounded-lg text-amber-700 bg-amber-50">
                This vendor is temporarily unavailable{vendor.pausedReason ? `: ${vendor.pausedReason}` : "."}
              </div>
            )}

            {vendor.description && <p className="text-sm text-gray-600 mt-4 max-w-2xl leading-relaxed">{vendor.description}</p>}

            <section className="mt-10">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Menu</h2>
              {vendor.products.length === 0 ? (
                <p className="text-sm text-gray-400">No products listed yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {vendor.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={{ id: product.id, name: product.name, sellerName: vendor.name, price: product.price, image: product.secureUrl }}
                      onShowDetails={setDetailProductId}
                    />
                  ))}
                </div>
              )}
            </section>

            {vendor.sides.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Sides</h2>
                <p className="text-xs text-gray-400 mb-3">Order sides on their own, or alongside items from the menu above.</p>
                <div className="flex flex-wrap gap-2">
                  {vendor.sides.map((side) => (
                    <button
                      key={side.id}
                      type="button"
                      onClick={async () => {
                        await api.post("/marketplace/vendor-cart", { sideId: side.id, quantity: 1 });
                        vendorCart.refresh();
                      }}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white hover:border-purple-300 hover:text-purple-700 transition"
                    >
                      + {side.name} — ₦{nairaFormatter.format(side.price)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <MarketplaceFooter />
      </div>
    </div>
  );
}
