// src/app/studashboard/marketplace/_components/ProductDetailModal.tsx
//
// Opened from a ProductCard's "Show Details" button. Centered modal with
// an image gallery (main image + thumbnail strip when there's more than
// one), full description, a flat variant picker (if the product has any —
// see src/types/product.ts's ProductVariantRow, one name/price/stock
// each — not attribute combinations), a quantity stepper bounded to the
// selected variant's stock, and "Add to Cart" (POST /api/marketplace/cart).
// A variant must be selected before adding to cart whenever the product
// has any.

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2, Minus, Plus, X } from "lucide-react";
import { isAxiosError } from "axios";
import api from "@/lib/axios";
import type { ProductBrowseDetail } from "@/types/marketplace-browse";
import type { CartLineItem } from "@/types/cart";

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

interface ProductDetailModalProps {
  productId: string | null;
  onClose: () => void;
  onAdded: () => void;
}

export default function ProductDetailModal({ productId, onClose, onAdded }: ProductDetailModalProps) {
  const [product, setProduct] = useState<ProductBrowseDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addStatus, setAddStatus] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [addError, setAddError] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      setSelectedVariantId(null);
      setActiveImage(0);
      setQuantity(1);
      setAddStatus("idle");
      try {
        const res = await api.get<{ product: ProductBrowseDetail }>(`/marketplace/products/${productId}`);
        if (cancelled) return;
        setProduct(res.data.product);
        setStatus("loaded");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selectedVariant = product?.variants.find((v) => v.id === selectedVariantId) ?? null;
  const hasVariants = (product?.variants.length ?? 0) > 0;
  const variantRequired = hasVariants && !selectedVariant;
  const displayPrice = selectedVariant ? selectedVariant.price : product?.price ?? 0;
  const availableStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0;

  const gallery = product ? [product.secureUrl, ...product.images.map((i) => i.secureUrl)].filter((u): u is string => Boolean(u)) : [];

  const handleReportBusiness = async () => {
    if (!product) return;
    const reason = window.prompt(`Report ${product.sellerName} — what's the issue?`);
    if (!reason) return;
    setReportStatus("sending");
    try {
      await api.post(`/marketplace/businesses/${product.businessId}/report`, { reason });
      setReportStatus("sent");
    } catch {
      setReportStatus("idle");
      window.alert("Couldn't submit the report. Please try again.");
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddStatus("adding");
    setAddError("");

    try {
      await api.post<{ item: CartLineItem }>("/marketplace/cart", {
        productId: product.id,
        variantId: selectedVariant?.id,
        quantity,
      });
      setAddStatus("added");
      onAdded();
    } catch (err) {
      const message =
        (isAxiosError<{ error?: string }>(err) && err.response?.data?.error) || "Couldn't add this to your cart.";
      setAddError(message);
      setAddStatus("error");
    }
  };

  return (
    <AnimatePresence>
      {productId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-end p-4 pb-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {status === "loading" && (
                <div className="flex justify-center py-24">
                  <Loader2 size={28} className="animate-spin text-gray-400" />
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col items-center text-center py-24 px-6">
                  <AlertCircle size={28} className="text-gray-400 mb-3" />
                  <p className="text-gray-500">Couldn&apos;t load this product.</p>
                </div>
              )}

              {status === "loaded" && product && (
                <div className="px-6 pb-6 grid sm:grid-cols-2 gap-6">
                  <div>
                    <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-100">
                      {gallery[activeImage] ? (
                        <Image
                          src={gallery[activeImage]}
                          alt={product.name}
                          fill
                          sizes="(min-width: 640px) 320px, 90vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
                      )}
                    </div>

                    {gallery.length > 1 && (
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                        {gallery.map((url, index) => (
                          <button
                            key={url + index}
                            type="button"
                            onClick={() => setActiveImage(index)}
                            className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                              index === activeImage ? "border-blue-600" : "border-transparent"
                            }`}
                          >
                            <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{product.category}</p>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{product.name}</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm text-gray-500">by {product.sellerName}</p>
                      {reportStatus === "sent" ? (
                        <span className="text-xs text-gray-400">· Reported</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleReportBusiness}
                          disabled={reportStatus === "sending"}
                          className="text-xs text-gray-400 hover:text-red-500 underline transition disabled:opacity-50"
                        >
                          · Report business
                        </button>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-3">₦{nairaFormatter.format(displayPrice)}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Estimated delivery: {product.estimatedDeliveryDate} · {product.deliveryWindow}
                    </p>
                    <p className="text-sm text-gray-600 mt-4 leading-relaxed">{product.description}</p>

                    {hasVariants && (
                      <div className="mt-5">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Options</p>
                        <div className="flex flex-wrap gap-2">
                          {product.variants.map((variant) => {
                            const selected = selectedVariantId === variant.id;
                            const outOfStock = variant.stock === 0;
                            return (
                              <button
                                key={variant.id}
                                type="button"
                                disabled={outOfStock}
                                onClick={() => {
                                  setSelectedVariantId(variant.id);
                                  setQuantity(1);
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                                  selected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                {selected && <Check size={12} />}
                                {variant.name} — ₦{nairaFormatter.format(variant.price)}
                                {outOfStock && " (out of stock)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Qty</span>
                      <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className="text-gray-400 hover:text-gray-700 transition disabled:opacity-30"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-medium w-5 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(availableStock, q + 1))}
                          disabled={quantity >= availableStock || (hasVariants && !selectedVariant)}
                          className="text-gray-400 hover:text-gray-700 transition disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-xs text-gray-400">
                        {hasVariants && !selectedVariant ? "Select an option" : `${availableStock} in stock`}
                      </span>
                    </div>

                    {addError && <p className="mt-3 text-sm text-red-600">{addError}</p>}

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={variantRequired || availableStock === 0 || addStatus === "adding"}
                      className="mt-5 w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {addStatus === "adding" && <Loader2 size={16} className="animate-spin" />}
                      {variantRequired
                        ? "Select options"
                        : availableStock === 0
                          ? "Out of stock"
                          : addStatus === "added"
                            ? "Added to cart ✓"
                            : "Add to Cart"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
