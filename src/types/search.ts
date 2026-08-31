// src/types/search.ts
//
// Shared shape for GET /api/marketplace/search/products, consumed by the
// Explore page (src/app/studashboard/marketplace/explore/page.tsx) when a
// search/filter is active.

export interface ProductSearchResult {
  id: string;
  name: string;
  category: string;
  price: number;
  secureUrl: string | null;
  sellerName: string;
}
