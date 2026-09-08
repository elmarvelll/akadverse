// src/app/studashboard/marketplace/page.tsx
//
// The student marketplace homepage — reachable at
// /studashboard/marketplace via the "Marketplace" workspace card on
// src/app/studashboard/page.tsx (a sibling of "Main Menu", not nested
// under it).
//
// "Popular Products" and "Top Businesses" are real data (fetched from
// GET /api/marketplace/search/products?limit=8 and
// GET /api/marketplace/businesses/featured — see those routes). "Popular
// Skills" and "Best Services" show a "Coming Soon" placeholder instead of
// data — there's no Skill/service-provider API, service, or listing flow
// anywhere in the app (the Skill/SkillOffer models exist in the schema,
// but nothing is wired to them), so there's genuinely nothing real to
// show, and services/marketplace/skills-market/data.ts's mock arrays are
// no longer used here.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Wrench } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";
import MarketplaceNavbar from "./_components/MarketplaceNavbar";
import Hero from "./_components/Hero";
import ProductCard from "./_components/ProductCard";
import SpotlightCard from "./_components/SpotlightCard";
import MarketplaceComingSoon from "./_components/MarketplaceComingSoon";
import MarketplaceCartDrawer from "./_components/MarketplaceCartDrawer";
import ProductDetailModal from "./_components/ProductDetailModal";
import MarketplaceFooter from "./_components/MarketplaceFooter";
import { useCart } from "./_components/useCart";
import { useVendorCart } from "./_components/useVendorCart";
import api from "@/lib/axios";
import type { ProductSearchResult } from "@/types/search";
import type { FeaturedBusiness } from "@/types/marketplace-browse";

interface FeaturedVendor {
  id: string;
  name: string;
  vendorCategory: string | null;
  secureUrl: string | null;
  location: string | null;
  itemCount: number;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{children}</h2>;
}

export default function MarketplacePage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const cart = useCart();
  const vendorCart = useVendorCart();
  const refreshCarts = () => {
    cart.refresh();
    vendorCart.refresh();
  };

  const [popularProducts, setPopularProducts] = useState<ProductSearchResult[]>([]);
  const [topBusinesses, setTopBusinesses] = useState<FeaturedBusiness[]>([]);
  const [popularVendorItems, setPopularVendorItems] = useState<ProductSearchResult[]>([]);
  const [schoolVendors, setSchoolVendors] = useState<FeaturedVendor[]>([]);

  useEffect(() => {
    api
      .get<{ products: ProductSearchResult[] }>("/marketplace/search/products", { params: { limit: 8 } })
      .then((res) => setPopularProducts(res.data.products))
      .catch(() => setPopularProducts([]));

    api
      .get<{ businesses: FeaturedBusiness[] }>("/marketplace/businesses/featured")
      .then((res) => setTopBusinesses(res.data.businesses))
      .catch(() => setTopBusinesses([]));

    api
      .get<{ products: ProductSearchResult[] }>("/marketplace/vendor/popular-items", { params: { limit: 8 } })
      .then((res) => setPopularVendorItems(res.data.products))
      .catch(() => setPopularVendorItems([]));

    api
      .get<{ vendors: FeaturedVendor[] }>("/marketplace/vendor/featured")
      .then((res) => setSchoolVendors(res.data.vendors))
      .catch(() => setSchoolVendors([]));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <div className="pt-16">
        <MarketplaceNavbar cartCount={cart.count + vendorCart.count} onCartClick={() => setCartOpen(true)} />
        <MarketplaceCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          business={{ items: cart.items, subtotal: cart.subtotal, onUpdateQuantity: cart.updateQuantity, onRemove: cart.removeItem }}
          vendor={{ items: vendorCart.items, subtotal: vendorCart.subtotal, onUpdateQuantity: vendorCart.updateQuantity, onRemove: vendorCart.removeItem }}
        />
        <ProductDetailModal productId={detailProductId} onClose={() => setDetailProductId(null)} onAdded={refreshCarts} />

        <Hero />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-16">
          <section>
            <SectionHeading>Popular Vendor Items</SectionHeading>
            {popularVendorItems.length === 0 ? (
              <p className="text-sm text-gray-400">No vendor items are currently available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {popularVendorItems.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{ id: product.id, name: product.name, sellerName: product.sellerName, price: product.price, image: product.secureUrl }}
                    onShowDetails={setDetailProductId}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading>School Vendors</SectionHeading>
            {schoolVendors.length === 0 ? (
              <p className="text-sm text-gray-400">No vendors are currently available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {schoolVendors.map((vendor) => (
                  <Link key={vendor.id} href={`/studashboard/marketplace/vendor/${vendor.id}`}>
                    <SpotlightCard
                      image={vendor.secureUrl}
                      name={vendor.name}
                      subtitle={[vendor.vendorCategory, vendor.location].filter(Boolean).join(" · ") || "School Vendor"}
                      ordersFulfilled={vendor.itemCount}
                      countLabel="items"
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading>Popular Products</SectionHeading>
            {popularProducts.length === 0 ? (
              <p className="text-sm text-gray-400">No products listed yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {popularProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{ id: product.id, name: product.name, sellerName: product.sellerName, price: product.price, image: product.secureUrl }}
                    onShowDetails={setDetailProductId}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading>Popular Skills</SectionHeading>
            <MarketplaceComingSoon label="Skills" icon={Sparkles} />
          </section>

          <section className="grid sm:grid-cols-2 gap-10">
            <div>
              <SectionHeading>Top Businesses</SectionHeading>
              {topBusinesses.length === 0 ? (
                <p className="text-sm text-gray-400">No businesses yet.</p>
              ) : (
                <div className="space-y-3">
                  {topBusinesses.map((business) => (
                    <SpotlightCard
                      key={business.id}
                      image={business.secureUrl}
                      name={business.name}
                      subtitle={business.industry}
                      ordersFulfilled={business.productCount}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <SectionHeading>Best Services</SectionHeading>
              <MarketplaceComingSoon label="Services" icon={Wrench} />
            </div>
          </section>
        </div>

        <MarketplaceFooter />
      </div>
    </div>
  );
}
