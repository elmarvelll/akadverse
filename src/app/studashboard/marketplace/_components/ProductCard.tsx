// src/app/studashboard/marketplace/_components/ProductCard.tsx
//
// Product listing card — image / name / seller / price, matching the
// reference picture's layout. Hovering reveals a centered "Show Details"
// button that opens ProductDetailModal.tsx (rendered by whichever page
// uses this card). Deliberately its own minimal prop shape (rather than
// importing MarketplaceProduct directly) so it can render both the mock
// "Popular Products" listings and real
// GET /api/marketplace/search/products results, which don't share an
// image/categoryId/orders shape — everything else is unused here anyway.

import Image from "next/image";

interface ProductCardProduct {
  id: string;
  name: string;
  sellerName: string;
  price: number;
  image: string | null;
}

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

export default function ProductCard({ product, onShowDetails }: { product: ProductCardProduct; onShowDetails: (id: string) => void }) {
  return (
    <div className="group rounded-2xl border border-gray-100 bg-white shadow-[0_2px_8px_rgba(16,24,40,0.06)] hover:shadow-[0_6px_16px_rgba(16,24,40,0.10)] transition overflow-hidden">
      <div className="relative w-full aspect-square bg-gray-100">
        {product.image ? (
          <Image src={product.image} alt={product.name} fill sizes="(min-width: 1024px) 240px, 45vw" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
          <button
            type="button"
            onClick={() => onShowDetails(product.id)}
            className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition px-4 py-2 rounded-full bg-white text-gray-900 text-xs font-semibold shadow-lg"
          >
            Show Details
          </button>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{product.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">by {product.sellerName}</p>
        <p className="mt-2 font-bold text-blue-600">₦{nairaFormatter.format(product.price)}</p>
      </div>
    </div>
  );
}
