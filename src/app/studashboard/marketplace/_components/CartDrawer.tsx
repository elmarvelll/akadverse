// src/app/studashboard/marketplace/_components/CartDrawer.tsx
//
// Slides in from the right over a backdrop when the navbar's cart icon is
// clicked. Purely presentational — items and the quantity/remove handlers
// come from useCart.ts (owned by whichever page renders this), so the
// drawer's contents always match the navbar's cart-count badge.

"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { CartLineItem } from "@/types/cart";

const nairaFormatter = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartLineItem[];
  subtotal: number;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export default function CartDrawer({ open, onClose, items, subtotal, onUpdateQuantity, onRemove }: CartDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} />
                Your Cart
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.length === 0 ? (
                <p className="text-sm text-gray-500 text-center mt-10">Your cart is empty.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {item.image ? (
                        <Image src={item.image} alt={item.productName} fill sizes="64px" className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">No image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-gray-900 text-sm truncate">{item.productName}</h3>
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          aria-label="Remove item"
                          className="text-gray-300 hover:text-red-500 transition shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">by {item.sellerName}</p>
                      {item.variantName && <p className="text-xs text-gray-400 mt-0.5">{item.variantName}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="text-gray-400 hover:text-gray-700 transition disabled:opacity-30"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stock}
                            className="text-gray-400 hover:text-gray-700 transition disabled:opacity-30"
                            aria-label="Increase quantity"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <span className="font-semibold text-sm text-gray-900">
                          ₦{nairaFormatter.format(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">Subtotal</span>
                <span className="font-bold text-gray-900">₦{nairaFormatter.format(subtotal)}</span>
              </div>
              {items.length === 0 ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 bg-blue-500 text-white font-semibold rounded-full opacity-50 cursor-not-allowed"
                >
                  Checkout
                </button>
              ) : (
                <Link
                  href="/studashboard/marketplace/checkout"
                  className="block w-full text-center py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full transition"
                >
                  Checkout
                </Link>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
