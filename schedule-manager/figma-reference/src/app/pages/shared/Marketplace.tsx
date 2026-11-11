import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Search, Filter, Store, Wrench, Activity, ShoppingCart,
  ChevronRight, Star, Sparkles, TrendingUp, Tag, Briefcase,
  Zap, Clock, Trash2, Plus, Minus, X, MapPin, Package,
  ChevronLeft, Check, AlertTriangle, SearchX, Coffee,
} from 'lucide-react';
import { mockProducts, mockSkills, mockBusinesses } from './MarketplaceData';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';

// ── Design tokens ──────────────────────────────────────────────────────────
const BLUE = '#007AFF';
const GRAY = '#8E8E93';
const PAGE_BG = '#F2F2F7';
const CARD_SHADOW = '0 4px 12px rgba(0,0,0,0.05)';
const EO = [0.25, 0.46, 0.45, 0.94] as const;
const spring = { type: 'spring' as const, damping: 20, stiffness: 300 };
const bouncy = { type: 'spring' as const, damping: 10, stiffness: 400 };

// ── Types ──────────────────────────────────────────────────────────────────
type CartItem = { id: string; title: string; seller: string; price: number; qty: number; imageSeed: string };
type Stage = 'entry' | 'auth' | 'dashboard' | 'checkout' | 'success';
type GhostState = { seed: string; startX: number; startY: number; endX: number; endY: number } | null;

// ── Flow 1: Shimmer skeleton ───────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-full h-52 rounded-[28px] bg-[#E5E5EA]"
      />
      <SectionSkeleton count={4} delay={0.1} />
      <SectionSkeleton count={5} delay={0.2} />
    </div>
  );
}

function SectionSkeleton({ count = 4, delay = 0 }: { count?: number; delay?: number }) {
  return (
    <div className="space-y-4">
      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        className="h-6 w-40 rounded-lg bg-[#E5E5EA]" 
      />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} delay={delay + i * 0.1} />
        ))}
      </div>
    </div>
  );
}

function ProductCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex-none w-[220px] bg-white rounded-2xl overflow-hidden border border-[#E5E5EA] shadow-sm">
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }}
        className="aspect-[4/3] rounded-t-2xl bg-[#E5E5EA]"
      />
      <div className="p-4 space-y-2.5">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }} className="h-4 w-3/4 rounded-lg bg-[#E5E5EA]" />
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }} className="h-3 w-1/2 rounded-lg bg-[#E5E5EA]" />
        <div className="flex justify-between mt-3">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }} className="h-4 w-1/3 rounded-lg bg-[#E5E5EA]" />
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }} className="h-4 w-1/4 rounded-lg bg-[#E5E5EA]" />
        </div>
      </div>
    </div>
  );
}

// ── iOS pill button ────────────────────────────────────────────────────────
function IOSButton({
  children, onClick, variant = 'primary', disabled = false, loading = false, className = '', size = 'md',
}: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost';
  disabled?: boolean; loading?: boolean; className?: string; size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'h-10 px-5 text-sm', md: 'h-12 px-6 text-[15px]', lg: 'h-14 px-8 text-base' };
  return (
    <motion.button
      whileHover={!disabled && !loading ? { y: -2, boxShadow: `0 6px 20px ${BLUE}33` } : {}}
      whileTap={!disabled && !loading ? { scale: 0.97 } : {}}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-full select-none transition-colors ${sizes[size]} ${className} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={variant === 'primary'
        ? { backgroundColor: BLUE, color: '#fff' }
        : { border: `1.5px solid ${BLUE}`, color: BLUE, backgroundColor: 'transparent' }}
    >
      {loading ? (
        <span className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-current"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      ) : children}
    </motion.button>
  );
}

// ── Flow 2: Ghost fly animation ────────────────────────────────────────────
function GhostFly({ ghost, onComplete }: { ghost: GhostState; onComplete: () => void }) {
  if (!ghost) return null;
  const dx = ghost.endX - ghost.startX;
  const dy = ghost.endY - ghost.startY;
  return (
    <motion.div
      className="fixed z-[200] pointer-events-none rounded-xl overflow-hidden shadow-lg"
      style={{ left: ghost.startX, top: ghost.startY, width: 52, height: 52 }}
      animate={{ x: [0, dx / 2 + 60, dx], y: [0, -90, dy], scale: [1, 0.8, 0.25], opacity: [1, 1, 0] }}
      transition={{ duration: 0.45, ease: 'easeInOut', times: [0, 0.55, 1] }}
      onAnimationComplete={onComplete}
    >
      <img src={`https://picsum.photos/seed/${ghost.seed}/120/120`} alt="" className="w-full h-full object-cover" />
    </motion.div>
  );
}

// ── Component 1: Cart Drawer ───────────────────────────────────────────────
function CartDrawer({
  open, onClose, items, onUpdateQty, onRemove, onCheckout,
}: {
  open: boolean; onClose: () => void; items: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void; onCheckout: () => void;
}) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + service;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EO }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[8px]"
            onClick={onClose}
          />
          <motion.div key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { duration: 0.35, ease: EO } }}
            exit={{ x: '100%', transition: { duration: 0.25, ease: EO } }}
            className="fixed right-0 top-0 bottom-0 z-50 w-[400px] max-w-[100vw] bg-white flex flex-col"
            style={{ boxShadow: '-8px 0 40px rgba(0,0,0,0.12)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E5EA]">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Cart</h2>
                <p className="text-sm font-medium" style={{ color: GRAY }}>
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <CartEmptyInline onStartShopping={onClose} />
              ) : (
                <AnimatePresence initial={false}>
                  {items.map(item => (
                    <CartDrawerItem key={item.id} item={item} onUpdateQty={onUpdateQty} onRemove={onRemove} />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-[#E5E5EA]">
                <div className="px-6 py-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: GRAY }} className="font-medium">Subtotal</span>
                    <span className="font-semibold text-slate-800">₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span style={{ color: GRAY }} className="font-medium">Service fee</span>
                    <span className="font-semibold text-slate-800">₦{service.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#E5E5EA] font-bold">
                    <span className="text-slate-900">Total</span>
                    <span style={{ color: BLUE }}>₦{total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="px-6 pb-8 pt-1">
                  <IOSButton variant="primary" className="w-full" size="lg" onClick={onCheckout}>
                    Checkout
                  </IOSButton>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function CartDrawerItem({
  item, onUpdateQty, onRemove,
}: { item: CartItem; onUpdateQty: (id: string, delta: number) => void; onRemove: (id: string) => void }) {
  const [trashHover, setTrashHover] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0, transition: spring }}
      exit={{ opacity: 0, height: 0, overflow: 'hidden', transition: { duration: 0.28, ease: EO } }}
      className="flex items-center gap-3 py-3 border-b border-[#F2F2F7] last:border-0"
    >
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F2F2F7] shrink-0">
        <ImageWithFallback src={`https://picsum.photos/seed/${item.imageSeed}/160/160`} alt={item.title}
          className="w-full h-full object-cover" loading="lazy" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-900 text-sm truncate">{item.title}</h4>
        <p className="text-xs font-medium truncate mt-0.5" style={{ color: GRAY }}>by {item.seller}</p>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={() => onUpdateQty(item.id, -1)}
            className="w-6 h-6 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors">
            <Minus className="w-3 h-3 text-slate-700" />
          </button>
          <AnimatePresence mode="popLayout">
            <motion.span key={item.qty}
              initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15, ease: EO }}
              className="text-sm font-bold text-slate-800 w-5 text-center"
            >{item.qty}</motion.span>
          </AnimatePresence>
          <button onClick={() => onUpdateQty(item.id, 1)}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: `${BLUE}22` }}>
            <Plus className="w-3 h-3" style={{ color: BLUE }} />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <AnimatePresence mode="popLayout">
          <motion.span key={item.qty}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-bold text-slate-900"
          >₦{(item.price * item.qty).toLocaleString()}</motion.span>
        </AnimatePresence>
        <motion.button
          onHoverStart={() => setTrashHover(true)} onHoverEnd={() => setTrashHover(false)}
          onClick={() => onRemove(item.id)} whileTap={{ scale: 0.85 }}
          animate={{ color: trashHover ? '#ef4444' : '#CBD5E1' }}
          className="p-1">
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function CartEmptyInline({ onStartShopping }: { onStartShopping: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EO }}
      className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-[#F2F2F7] rounded-full flex items-center justify-center mb-4">
        <ShoppingCart className="w-8 h-8" style={{ color: GRAY }} />
      </div>
      <h3 className="font-bold text-slate-900 text-lg mb-1">Your cart is empty</h3>
      <p className="text-sm font-medium mb-6 max-w-[200px]" style={{ color: GRAY }}>
        Add items from the marketplace to get started.
      </p>
      <IOSButton variant="primary" size="sm" onClick={onStartShopping}>Start Shopping</IOSButton>
    </motion.div>
  );
}

function AnimatedCoffeeLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] w-full" style={{ backgroundColor: '#F5F5F7' }}>
      <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
        {/* Saucer */}
        <path d="M 20 85 Q 50 95 80 85" stroke="#1C1C1E" strokeWidth="2" strokeLinecap="round" />
        
        {/* Cup handle */}
        <path d="M 75 45 Q 90 45 85 60 Q 80 65 75 65" stroke="#1C1C1E" strokeWidth="2" fill="none" strokeLinecap="round" />
        
        {/* Cup outline */}
        <path d="M 25 30 L 25 65 Q 25 80 50 80 Q 75 80 75 65 L 75 30 Z" fill="#F5F5F7" stroke="#1C1C1E" strokeWidth="2" />
        
        {/* Liquid Back */}
        <g clipPath="url(#cupClip)">
          <motion.path 
            d="M 10 50 Q 50 65 90 50 L 90 90 L 10 90 Z" 
            fill="#F5C56B"
            animate={{ y: [-3, 3, -3] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, delay: 0.15 }}
          />
          {/* Liquid Front */}
          <motion.path 
            d="M 10 55 Q 50 40 90 55 L 90 90 L 10 90 Z" 
            fill="#F5A623"
            animate={{ y: [-3, 3, -3] }}
            transition={{ duration: 2, ease: "easeInOut", repeat: Infinity }}
          />
        </g>
        
        <defs>
          <clipPath id="cupClip">
            <path d="M 26 31 L 26 65 Q 25 79 50 79 Q 75 79 74 65 L 74 31 Z" />
          </clipPath>
        </defs>
        <path d="M 25 30 L 25 65 Q 25 80 50 80 Q 75 80 75 65 L 75 30" stroke="#1C1C1E" strokeWidth="2" fill="none" />
      </svg>
      <div className="mt-4 flex items-center text-[#1C1C1E] font-medium text-[16px] font-sans">
        Loading
        <span className="flex w-6 relative overflow-hidden">
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>.</motion.span>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}>.</motion.span>
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}>.</motion.span>
        </span>
      </div>
    </div>
  );
}

// ── Component 2: Product Detail Modal ─────────────────────────────────────
function ProductDetailModal({
  product, onClose, onAddToCart, imgRef: externalImgRef,
}: {
  product: any; onClose: () => void;
  onAddToCart: (product: any, imgEl: HTMLElement | null) => void;
  imgRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const localImgRef = useRef<HTMLDivElement>(null);
  const imgRef = externalImgRef ?? localImgRef;
  const thumbSeeds = [product.imageSeed, `${product.imageSeed}2`, `${product.imageSeed}3`];

  const handleAdd = () => {
    if (added) return;
    setAdded(true);
    const imgEl = imgRef.current?.querySelector('img') as HTMLElement | null;
    onAddToCart({ ...product, qty }, imgEl);
    setTimeout(() => {
      setAdded(false);
    }, 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: EO }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px]" />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.2, ease: EO } }}
        transition={{ duration: 0.25, ease: EO }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors">
          <X className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex flex-col md:flex-row">
          {/* Images */}
          <div className="md:w-[52%] p-5 space-y-3">
            <div ref={imgRef} className="aspect-square rounded-xl overflow-hidden bg-[#F2F2F7]">
              <ImageWithFallback src={`https://picsum.photos/seed/${thumbSeeds[activeThumb]}/500/500`}
                alt={product.title} className="w-full h-full object-cover" loading="eager" />
            </div>
            <div className="flex gap-2">
              {thumbSeeds.map((seed, i) => (
                <button key={i} onClick={() => setActiveThumb(i)}
                  className="flex-1 aspect-square rounded-xl overflow-hidden bg-[#F2F2F7] transition-all"
                  style={activeThumb === i ? { outline: `2px solid ${BLUE}`, outlineOffset: 2 } : { opacity: 0.6 }}>
                  <ImageWithFallback src={`https://picsum.photos/seed/${seed}/120/120`}
                    alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Star className="w-4 h-4 fill-current" style={{ color: '#FF9500' }} />
                <span className="text-sm font-semibold text-slate-800">{product.rating}</span>
                <span className="text-sm" style={{ color: GRAY }}>(42 reviews)</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">{product.title}</h2>
              <p className="text-xl font-bold mb-4" style={{ color: BLUE }}>From ₦{product.price.toLocaleString()}</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: GRAY }}>
                Handcrafted with care by a student creator. Quality guaranteed with fast campus delivery. Perfect for
                gifts, personal use, or resale.
              </p>
              <p className="text-sm font-medium mb-5" style={{ color: GRAY }}>
                Sold by <span className="font-semibold text-slate-800">{product.seller}</span>
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-slate-700">Quantity</span>
                <div className="flex items-center gap-3 bg-[#F2F2F7] rounded-xl px-3 py-2">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}>
                    <Minus className="w-4 h-4 text-slate-700" />
                  </button>
                  <span className="text-base font-bold text-slate-900 w-6 text-center">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)}>
                    <Plus className="w-4 h-4" style={{ color: BLUE }} />
                  </button>
                </div>
              
              </div>
              <motion.button
                whileHover={{ y: -1, boxShadow: '0 6px 16px rgba(0,122,255,0.3)' }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAdd}
                className="w-full h-12 rounded-[24px] font-semibold text-[15px] text-white flex items-center justify-center gap-2 transition-all mt-4"
                style={{ backgroundColor: added ? '#0066CC' : '#007AFF', boxShadow: '0 4px 12px rgba(0,122,255,0.25)' }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <AnimatePresence mode="wait">
                  {added ? (
                    <motion.span key="done"
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="flex items-center gap-2">
                      <Check className="w-5 h-5" />
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2" transition={{ duration: 0.2, ease: "easeOut" }}>
                      <ShoppingCart className="w-4 h-4" /> Add to Cart
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              
              <div className="mt-4 text-center">
                <button onClick={onClose} className="text-[14px] font-medium transition-colors" style={{ color: GRAY }}>
                  Continue browsing
                </button>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Component 3: Checkout Page ─────────────────────────────────────────────
function CheckoutPage({ items, onBack, onPay }: { items: CartItem[]; onBack: () => void; onPay: () => void }) {
  const [loading, setLoading] = useState(false);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + service;
  const first = items[0];

  const handlePay = () => { setLoading(true); setTimeout(() => { setLoading(false); onPay(); }, 800); };

  const card = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: 0.1 + i * 0.07, ease: EO },
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-xl border-b border-[#E5E5EA]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#F2F2F7] flex items-center justify-center hover:bg-[#E5E5EA] transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-base font-bold text-slate-900">Checkout</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">
        {first && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-4" style={{ boxShadow: CARD_SHADOW }}
          >
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Your Order</p>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F2F2F7] shrink-0">
                <ImageWithFallback src={`https://picsum.photos/seed/${first.imageSeed}/200/200`}
                  alt={first.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{first.title}</h3>
                <p className="text-sm font-medium" style={{ color: GRAY }}>by {first.seller}</p>
                <p className="text-xs mt-0.5" style={{ color: GRAY }}>Qty: {first.qty}</p>
              </div>
              <span className="font-bold text-slate-900 shrink-0">₦{(first.price * first.qty).toLocaleString()}</span>
            </div>
            {items.length > 1 && (
              <p className="text-xs font-medium mt-3 pt-3 border-t border-[#F2F2F7]" style={{ color: GRAY }}>
                + {items.length - 1} more item{items.length - 1 !== 1 ? 's' : ''}
              </p>
            )}
            <p className="text-xs font-medium mt-2" style={{ color: GRAY }}>
              Est. delivery: <span className="font-semibold text-slate-700">Tue, Oct 20</span>
            </p>
          </motion.div>
        )}

        <motion.div {...card(1)} className="bg-white rounded-2xl p-4" style={{ boxShadow: CARD_SHADOW }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Delivery Location</p>
          <div className="flex items-center gap-3 border border-[#E5E5EA] rounded-xl px-4 py-3">
            <MapPin className="w-4 h-4 shrink-0" style={{ color: BLUE }} />
            <input type="text" defaultValue="Block D, Hostel 3, University Campus"
              className="flex-1 text-sm font-medium text-slate-800 focus:outline-none bg-transparent" />
          </div>
        </motion.div>

        <motion.div {...card(2)} className="bg-white rounded-2xl p-4" style={{ boxShadow: CARD_SHADOW }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pricing</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: GRAY }}>Subtotal</span>
              <span className="font-semibold text-slate-800">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: GRAY }}>Service fee (5%)</span>
              <span className="font-semibold text-slate-800">₦{service.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-[#E5E5EA] font-bold">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">₦{total.toLocaleString()}</span>
            </div>
          </div>
        </motion.div>

        <motion.div {...card(3)}>
          <motion.button
            whileHover={{ y: -2, boxShadow: `0 8px 24px ${BLUE}44` }}
            whileTap={{ scale: 0.97 }}
            onClick={handlePay} disabled={loading}
            className="w-full h-14 rounded-full text-white font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: BLUE }}>
            {loading ? (
              <span className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span key={i} className="w-2 h-2 rounded-full bg-white"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </span>
            ) : 'Proceed to Payment'}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Flow 4: Success Screen ─────────────────────────────────────────────────
function SuccessScreen({ onBackToMarket }: { onBackToMarket: () => void }) {
  const [phase, setPhase] = useState(0);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 50),
      setTimeout(() => setPhase(2), 280),
      setTimeout(() => { setPhase(3); setFilled(true); }, 480),
      setTimeout(() => setPhase(4), 580),
      setTimeout(() => setPhase(5), 720),
      setTimeout(() => setPhase(6), 960),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: PAGE_BG }}>
      {/* Ambient radial glow */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.18, 0.08] }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
      >
        <div className="w-[700px] h-[700px] rounded-full"
          style={{ background: `radial-gradient(circle, ${BLUE} 0%, transparent 65%)` }} />
      </motion.div>

      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative z-10 bg-white rounded-3xl p-10 w-full max-w-sm text-center"
        style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.12)' }}>

        {/* SVG checkmark */}
        <div className="flex justify-center mb-6">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <motion.circle cx="36" cy="36" r="33" stroke={BLUE} strokeWidth="2.5"
              fill={filled ? BLUE : 'none'}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: phase >= 1 ? 1 : 0 }}
              transition={{ duration: 0.5, ease: EO }}
            />
            <motion.path d="M 22 36 L 31 45 L 50 27"
              stroke={filled ? 'white' : BLUE} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: phase >= 2 ? 1 : 0 }}
              transition={{ duration: 0.3, ease: EO }}
            />
          </svg>
        </div>

        <AnimatePresence>
          {phase >= 4 && (
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EO }}
              className="text-2xl font-bold text-slate-900 mb-2">
              Payment Successful
            </motion.h2>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 5 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: EO }}
              className="text-sm font-medium mb-8" style={{ color: GRAY }}>
              Your order is on its way —<br />Est. delivery Tue, Oct 20
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 6 && (
            <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EO }}>
                <IOSButton variant="primary" className="w-full" size="lg">
                  <Package className="w-4 h-4" /> Track Order
                </IOSButton>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1, ease: EO }}>
                <IOSButton variant="ghost" className="w-full" size="lg" onClick={onBackToMarket}>
                  Back to Marketplace
                </IOSButton>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────
function ProductCard({ product, onQuickView, delay = 0 }: {
  product: any; onQuickView: (p: any) => void; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EO }}
      whileHover={{ y: -6 }}
      onClick={() => onQuickView(product)}
      className="group flex-none w-[220px] bg-white rounded-2xl overflow-hidden border border-[#E5E5EA]/60 shadow-sm hover:shadow-xl transition-shadow duration-300 cursor-pointer"
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-[#F2F2F7]">
        <ImageWithFallback
          src={`https://picsum.photos/seed/${product.imageSeed}/400/300`}
          alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-white text-slate-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">Quick View</span>
        </div>
      </div>
      <div className="p-4">
        <h4 className="font-bold text-slate-900 truncate text-sm">{product.title}</h4>
        <p className="text-xs font-medium mt-0.5 truncate" style={{ color: GRAY }}>by {product.seller}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="font-bold text-sm" style={{ color: BLUE }}>₦{product.price.toLocaleString()}</span>
          <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded text-xs font-bold" style={{ color: '#FF9500' }}>
            <Star className="w-3 h-3 fill-current" />{product.rating}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Horizontal scroll section ──────────────────────────────────────────────
function HScrollSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Icon className="w-5 h-5 text-slate-700" />
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x" style={{ scrollbarWidth: 'none' }}>
        {children}
      </div>
    </div>
  );
}

// ── Animated Cat in Hole (No Results illustration) ─────────────────────────

function AnimatedDog() {
  return (
    <svg viewBox="0 0 200 160" width="200" height="154" className="mx-auto block">
      {/* Dog / Shadow */}
      <ellipse cx="100" cy="145" rx="55" ry="7" fill="#000" opacity={0.08} />
      
      {/* Dog / Tail */}
      <g transform="translate(130, 80)">
        <motion.path 
          d="M 0 0 C 15 -10 30 -30 25 -50" 
          stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" fill="none"
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
          style={{ transformOrigin: "0px 0px" }}
        />
      </g>
      
      {/* Dog / Body */}
      <g stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Head */}
        <path d="M 65 65 C 50 65 40 55 40 40 C 40 25 50 15 65 15 C 80 15 90 25 90 40 C 90 55 80 65 65 65 Z" />
        {/* Snout */}
        <path d="M 40 40 C 20 40 10 45 10 60 C 10 65 25 65 40 60" />
        {/* Nose tip */}
        <circle cx="12" cy="58" r="2" fill="#007AFF" />
        {/* Ears */}
        <path d="M 50 17 C 45 0 35 0 30 15 C 30 25 40 25 45 25" />
        <path d="M 80 17 C 85 0 95 0 100 15 C 100 25 90 25 85 25" />
        {/* Body */}
        <path d="M 60 65 C 60 85 70 95 90 95 C 110 95 130 85 130 80 L 130 115 C 130 130 140 130 140 115 L 140 95 C 150 95 150 75 130 65 Z" />
        {/* Front Legs */}
        <path d="M 75 95 L 75 135 C 75 145 65 145 65 135 L 65 125" />
        <path d="M 95 95 L 95 135 C 95 145 85 145 85 135 L 85 125" />
      </g>
      {/* Eyes */}
      <circle cx="55" cy="35" r="2" fill="#007AFF" />
      <circle cx="75" cy="35" r="2" fill="#007AFF" />
    </svg>
  );
}


// ── Animated Coffee Pour (Connection Error illustration) ────────────────────

function AnimatedCoffeePour() {
  // Base puddle at cx=283, cy=131, rx=13, ry=6
  const BASE_CX = 283;

  return (
    <svg viewBox="0 0 300 200" width="100%" className="max-w-[280px] mx-auto">
      {/* Background */}
      <rect width="300" height="200" fill="#F5F5F7" />

      {/* Plant — top left */}
      <ellipse cx="24" cy="58" rx="20" ry="27" fill="#A8D5B5" opacity={0.72} />
      <ellipse cx="9" cy="70" rx="15" ry="21" fill="#8BC4A0" opacity={0.62} />
      <rect x="15" y="80" width="19" height="27" rx="6" fill="white" stroke="#E5E5EA" strokeWidth="1.2" />
      <line x1="24" y1="80" x2="24" y2="60" stroke="#8BC4A0" strokeWidth="1.5" opacity={0.5} />

      {/* Folder stack — mid right */}
      <rect x="218" y="57" width="54" height="37" rx="6" fill="#E5E5EA" />
      <rect x="222" y="52" width="40" height="6" rx="3" fill="#D1D1D6" />
      <line x1="224" y1="67" x2="266" y2="67" stroke="#C7C7CC" strokeWidth="1.5" opacity={0.65} />
      <line x1="224" y1="73" x2="258" y2="73" stroke="#C7C7CC" strokeWidth="1.5" opacity={0.65} />

      {/* Table surface */}
      <rect x="0" y="148" width="300" height="52" fill="#EAE8E5" opacity={0.5} />

      {/* Cup shadow */}
      <ellipse cx="200" cy="132" rx="66" ry="8" fill="#000" opacity={0.06} />

      {/* Cup body — lying on side, mouth toward right edge */}
      <path
        d="M142,84 L258,84 Q267,84 267,106 Q267,128 258,128 L142,128 Q133,128 133,116 Q133,95 142,84 Z"
        fill="white" stroke="#E5E5EA" strokeWidth="1.5"
      />

      {/* Cup bottom (left, rounded end) */}
      <ellipse cx="134" cy="106" rx="10" ry="22" fill="#F8F8F8" stroke="#E5E5EA" strokeWidth="1.5" />

      {/* Green sleeve */}
      <rect x="186" y="84" width="36" height="44" rx="2" fill="#8BC4A0" opacity={0.88} />
      {/* Coffee bean on sleeve */}
      <ellipse cx="204" cy="106" rx="7" ry="5" fill="none" stroke="#5A8065" strokeWidth="1.5" opacity={0.8} />
      <path d="M201,106 Q204,103 207,106 Q204,109 201,106"
        fill="none" stroke="#3D5E47" strokeWidth="1" opacity={0.7} />

      {/* Handle */}
      <path d="M213,84 Q238,70 234,56 Q230,44 217,49 Q207,55 213,67"
        stroke="#E5E5EA" strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* Cup opening ellipse */}
      <ellipse cx="266" cy="106" rx="9" ry="23" fill="#EDE5D8" stroke="#D5CABC" strokeWidth="1" />
      {/* Coffee visible inside */}
      <ellipse cx="266" cy="110" rx="7" ry="15" fill="#8B5E3C" opacity={0.65} />

      {/* Lid — detached, resting on table */}
      <ellipse cx="282" cy="141" rx="15" ry="5" fill="white" stroke="#E5E5EA" strokeWidth="1.5" />
      <ellipse cx="282" cy="140" rx="12" ry="3" fill="#F5F5F7" />

      {/* Static coffee puddle */}
      <ellipse cx="295" cy="131" rx="28" ry="13" fill="#8B5E3C" opacity={0.28} />

      {/* Static stream */}
      <rect x="260" y="100" width="80" height="12" rx="6" fill="#8B5E3C" opacity={0.6} />
    </svg>
  );
}


// ── Demo Control Bar ────────────────────────────────────────────────────────
function DemoControlBar({ onTriggerError }: { onTriggerError: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none">
      <motion.button
        whileHover={{ y: -1, boxShadow: '0 6px 20px rgba(0,0,0,0.13)' }}
        whileTap={{ scale: 0.97 }}
        onClick={onTriggerError}
        className="flex items-center gap-2.5 h-10 px-5 bg-white rounded-full text-sm font-medium pointer-events-auto select-none"
        style={{ color: '#1C1C1E', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      >
        <Coffee className="w-4 h-4" style={{ color: BLUE }} />
        Simulate Connection Error
      </motion.button>
    </div>
  );
}

// ── No results / Error ─────────────────────────────────────────────────────
function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  const card = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay: i * 0.07, ease: EO },
  });

  return (
    <div className="flex justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EO }}
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        {/* Cat illustration */}
        <motion.div {...card(0)} className="pt-8 pb-4 bg-[#F5F5F7]">
          <AnimatedDog />
        </motion.div>

        <div className="px-8 py-6 text-center">
          <motion.h3 {...card(1)} className="text-2xl font-bold text-[#1C1C1E] mb-2">
            No Results Found
          </motion.h3>
          <motion.p {...card(2)} className="text-sm font-medium mb-6 leading-relaxed" style={{ color: GRAY }}>
            No matches for "<span className="font-semibold text-slate-700">{query}</span>".
            Try a different search term.
          </motion.p>
          <motion.div {...card(3)}>
            <IOSButton variant="primary" className="w-full" size="md" onClick={onClear}>
              Go Back
            </IOSButton>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [shake, setShake] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    setTimeout(() => {
      setRetrying(false);
      // In demo: shake to indicate still failing
      setShake(true);
      setTimeout(() => setShake(false), 400);
      onRetry();
    }, 900);
  };

  const card = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.28, delay: i * 0.08, ease: EO },
  });

  return (
    <div className="flex justify-center py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={shake
          ? { x: [0, -5, 5, -4, 4, 0], scale: 1, opacity: 1 }
          : { x: 0, scale: 1, opacity: 1 }}
        transition={shake
          ? { duration: 0.32, ease: 'easeInOut' }
          : { duration: 0.3, ease: EO }}
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        {/* Coffee pour illustration */}
        <motion.div {...card(0)} className="pt-6 pb-2 bg-[#F5F5F7] flex items-center justify-center">
          <AnimatedCoffeePour />
        </motion.div>

        <div className="px-8 py-6 text-center">
          <motion.h3 {...card(1)} className="text-2xl font-bold text-[#1C1C1E] mb-2">
            Connection Error
          </motion.h3>
          <motion.p {...card(2)} className="text-sm font-medium mb-6 leading-relaxed max-w-[220px] mx-auto" style={{ color: GRAY }}>
            Something went wrong. Check your connection and try again.
          </motion.p>
          <motion.div {...card(3)}>
            <IOSButton variant="primary" className="w-full" size="md" loading={retrying} onClick={handleRetry}>
              {retrying ? '' : 'Retry'}
            </IOSButton>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Marketplace Dashboard ──────────────────────────────────────────────────
function MarketplaceDashboard({
  cartItems, onAddToCart, onOpenCart, cartCount,
  onCheckout, forceError = false, onClearError,
}: {
  cartItems: CartItem[];
  onAddToCart: (product: any) => void;
  onOpenCart: () => void;
  cartCount: number;
  onCheckout: () => void;
  forceError?: boolean;
  onClearError?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'products' | 'skills' | 'business'>('products');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [ghost, setGhost] = useState<GhostState>(null);
  const cartIconRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { const t = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(t); }, []);

  const handleModalAddToCart = useCallback((product: any, imgEl: HTMLElement | null) => {
    onAddToCart(product);

    // Ghost fly (Flow 2)
    if (imgEl && cartIconRef.current) {
      const srcRect = imgEl.getBoundingClientRect();
      const dstRect = cartIconRef.current.getBoundingClientRect();
      setGhost({
        seed: product.imageSeed,
        startX: srcRect.left + srcRect.width / 2 - 26,
        startY: srcRect.top + srcRect.height / 2 - 26,
        endX: dstRect.left + dstRect.width / 2 - 26,
        endY: dstRect.top + dstRect.height / 2 - 26,
      });
    }
  }, [onAddToCart]);

  const filteredProducts = mockProducts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.seller.toLowerCase().includes(search.toLowerCase())
  );

  const tabs = [
    { key: 'products' as const, label: 'Products', icon: Store },
    { key: 'skills' as const, label: 'Skills', icon: Wrench },
    { key: 'business' as const, label: 'Business', icon: Briefcase },
  ];

  return (
    <div className="relative">
      {/* Ghost fly overlay */}
      <GhostFly ghost={ghost} onComplete={() => setGhost(null)} />

      {/* Product Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={handleModalAddToCart}
          />
        )}
      </AnimatePresence>

      {/* Force-error overlay (Demo Control trigger) */}
      <AnimatePresence>
        {forceError && (
          <motion.div
            key="force-error-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EO }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-black/40 backdrop-blur-[8px]"
            onClick={onClearError}
          >
            <div onClick={e => e.stopPropagation()}>
              <ErrorState onRetry={() => onClearError?.()} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <div className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-[#E5E5EA]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Marketplace</h1>
              <p className="text-xs font-medium" style={{ color: GRAY }}>Student Products · Skills · Services</p>
            </div>
            <motion.button
              ref={cartIconRef}
              onClick={onOpenCart}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
              style={{ backgroundColor: `${BLUE}15`, color: BLUE }}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Cart</span>
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 1.3 }} animate={{ scale: 1 }}
                    transition={bouncy}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: BLUE }}
                  >{cartCount}</motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Search + tabs */}
          <div className="pb-4 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: GRAY }} />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search products, skills…"
                  className="w-full h-10 pl-10 pr-4 bg-[#F2F2F7] rounded-full text-sm font-medium text-slate-800 placeholder-[#8E8E93] focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': BLUE } as React.CSSProperties}
                />
              </div>
              <button className="w-10 h-10 rounded-full bg-[#F2F2F7] flex items-center justify-center shrink-0">
                <Filter className="w-4 h-4" style={{ color: GRAY }} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                  style={activeTab === tab.key
                    ? { backgroundColor: BLUE, color: '#fff' }
                    : { backgroundColor: '#F2F2F7', color: GRAY }}>
                  <tab.icon className="w-3.5 h-3.5" />{tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <AnimatedCoffeeLoading key="loading" />
          ) : hasError ? (
            <ErrorState key="error" onRetry={() => { setHasError(false); setIsLoading(true); setTimeout(() => setIsLoading(false), 800); }} />
          ) : search && filteredProducts.length === 0 ? (
            <NoResults key="no-results" query={search} onClear={() => setSearch('')} />
          ) : (
            <motion.div key="content"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: EO }}
              className="space-y-10"
            >
              {/* Hero banner */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EO }}
                className="relative rounded-[28px] overflow-hidden h-52 flex items-end p-8"
                style={{ background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, ${BLUE}33 100%)` }}
              >
                <div className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 40%, #007AFF 0%, transparent 55%)' }} />
                <div className="relative z-10">
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">AkadVerse Marketplace</p>
                  <h2 className="text-2xl font-bold text-white mb-1">Student Economy</h2>
                  <p className="text-sm font-medium text-white/70">Buy, sell, and exchange skills on campus</p>
                </div>
                <div className="absolute top-6 right-8 opacity-30">
                  <ShoppingBag className="w-20 h-20 text-white" />
                </div>
              </motion.div>

              {activeTab === 'products' && (
                <>
                  <HScrollSection title="Trending Products" icon={TrendingUp}>
                    {(search ? filteredProducts : mockProducts).slice(0, 8).map((p, i) => (
                      <ProductCard key={p.title + i} product={p} delay={i * 0.06}
                        onQuickView={setSelectedProduct} />
                    ))}
                  </HScrollSection>

                  <HScrollSection title="Fresh Listings" icon={Sparkles}>
                    {mockProducts.slice(4, 12).map((p, i) => (
                      <ProductCard key={p.title + 'fresh' + i} product={p} delay={i * 0.06}
                        onQuickView={setSelectedProduct} />
                    ))}
                  </HScrollSection>
                </>
              )}

              {activeTab === 'skills' && (
                <HScrollSection title="Student Skills & Services" icon={Wrench}>
                  {mockSkills.slice(0, 10).map((skill: any, i: number) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.06, ease: EO }}
                      whileHover={{ y: -4 }}
                      onClick={() => setSelectedProduct({ ...skill, price: skill.price ?? 5000, rating: skill.rating ?? 4.8, imageSeed: skill.title.replace(/ /g, '').toLowerCase() })}
                      className="flex-none w-[260px] bg-white rounded-[22px] p-5 border border-[#E5E5EA]/60 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                    >
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: `${BLUE}15` }}>
                        <Wrench className="w-5 h-5" style={{ color: BLUE }} />
                      </div>
                      <h4 className="font-bold text-slate-900 mb-1 text-sm">{skill.title ?? skill.name}</h4>
                      <p className="text-xs font-medium mb-3" style={{ color: GRAY }}>by {skill.seller ?? skill.provider}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm" style={{ color: BLUE }}>
                          From ₦{(skill.price ?? 5000).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-bold" style={{ color: '#FF9500' }}>
                          <Star className="w-3 h-3 fill-current" />{skill.rating ?? 4.8}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </HScrollSection>
              )}

              {activeTab === 'business' && (
                <HScrollSection title="Student Businesses" icon={Activity}>
                  {mockBusinesses.slice(0, 10).map((biz: any, i: number) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.06, ease: EO }}
                      whileHover={{ y: -4 }}
                      className="flex-none w-[240px] bg-white rounded-[22px] overflow-hidden border border-[#E5E5EA]/60 shadow-sm cursor-pointer hover:shadow-lg transition-shadow"
                    >
                      <div className="h-28 bg-[#F2F2F7] relative overflow-hidden">
                        <ImageWithFallback
                          src={`https://picsum.photos/seed/${biz.imageSeed}/400/200`}
                          alt={biz.title} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="p-4">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{biz.title}</h4>
                        <p className="text-xs font-medium mt-0.5 truncate" style={{ color: GRAY }}>{biz.location ?? 'Campus'}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs font-bold" style={{ color: '#FF9500' }}>
                          <Star className="w-3 h-3 fill-current" />{biz.rating ?? 4.7}
                          <span className="font-normal" style={{ color: GRAY }}>· by {biz.owner}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </HScrollSection>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Entry screen ───────────────────────────────────────────────────────────
function MarketplaceEntry({ onEnter, onLogin }: { onEnter: () => void; onLogin: () => void }) {
  const features = [
    { icon: Store, label: 'Student Products', color: `${BLUE}18` },
    { icon: Wrench, label: 'Skills & Services', color: '#34C75918' },
    { icon: Briefcase, label: 'Student Businesses', color: '#FF950018' },
    { icon: Tag, label: 'Exclusive Deals', color: '#AF52DE18' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EO }}
      className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-sm text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring, delay: 0.1 }}>
          <div className="w-20 h-20 rounded-[24px] flex items-center justify-center mx-auto mb-6"
            style={{ background: `linear-gradient(135deg, ${BLUE} 0%, #5AC8FA 100%)` }}>
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AkadVerse<br />Marketplace</h1>
          <p className="text-base font-medium mb-8" style={{ color: GRAY }}>
            Buy, sell, and trade with fellow students
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {features.map(({ icon: Icon, label, color }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07, ease: EO }}
                className="flex items-center gap-2.5 bg-white rounded-2xl p-3.5 shadow-sm border border-[#E5E5EA]/60">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
                  <Icon className="w-4 h-4" style={{ color: BLUE }} />
                </div>
                <span className="text-sm font-semibold text-slate-800 text-left leading-tight">{label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div className="space-y-3"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, ease: EO }}>
            <IOSButton variant="primary" className="w-full" size="lg" onClick={onEnter}>
              Browse Marketplace
            </IOSButton>
            <IOSButton variant="ghost" className="w-full" size="md" onClick={onLogin}>
              Sign in to sell
            </IOSButton>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Auth screen ────────────────────────────────────────────────────────────
function MarketplaceAuth({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const fields = [
    { label: 'Email', value: email, set: setEmail, type: 'email', placeholder: 'student@university.edu' },
    { label: 'Password', value: password, set: setPassword, type: 'password', placeholder: '••••••••' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); onSuccess(); }, 900);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: EO }}
      className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAGE_BG }}>
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-2 mb-8 text-sm font-semibold" style={{ color: BLUE }}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ ...spring, delay: 0.1 }}
          className="bg-white rounded-3xl p-8" style={{ boxShadow: CARD_SHADOW }}>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h2>
          <p className="text-sm font-medium mb-6" style={{ color: GRAY }}>to your seller account</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(({ label, value, set, type, placeholder }) => (
              <div key={label}>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">{label}</label>
                <input type={type} value={value} onChange={e => set(e.target.value)}
                  placeholder={placeholder} required
                  className="w-full h-11 px-4 border border-[#E5E5EA] rounded-xl text-sm font-medium text-slate-800 placeholder-[#C7C7CC] focus:outline-none transition-all bg-white"
                  style={{ '--tw-ring-color': BLUE } as React.CSSProperties}
                />
              </div>
            ))}
            <IOSButton variant="primary" className="w-full mt-2" size="lg" loading={loading}>
              Sign in
            </IOSButton>
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Root: Marketplace ──────────────────────────────────────────────────────
export function Marketplace() {
  const [stage, setStage] = useState<Stage>('entry');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [forceError, setForceError] = useState(false);

  const handleAddToCart = useCallback((product: any) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === String(product.title));
      if (existing) return prev.map(i => i.id === String(product.title) ? { ...i, qty: i.qty + (product.qty ?? 1) } : i);
      return [...prev, {
        id: String(product.title),
        title: product.title,
        seller: product.seller,
        price: product.price,
        qty: product.qty ?? 1,
        imageSeed: product.imageSeed,
      }];
    });
  }, []);

  const handleUpdateQty = useCallback((id: string, delta: number) => {
    setCartItems(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      .filter(i => i.qty > 0)
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setCartItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleCheckout = () => {
    setCartOpen(false);
    setTimeout(() => setStage('checkout'), 280);
  };

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="relative -mx-6 -my-8 min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      {/* Cart drawer (global overlay) */}
      <CartDrawer
        open={cartOpen && stage === 'dashboard'}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {/* Demo Control Bar — fixed bottom-center, dashboard only */}
      {stage === 'dashboard' && (
        <DemoControlBar onTriggerError={() => setForceError(true)} />
      )}

      <AnimatePresence mode="wait">
        {stage === 'entry' && (
          <motion.div key="entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EO }}>
            <MarketplaceEntry
              onEnter={() => setStage('dashboard')}
              onLogin={() => setStage('auth')}
            />
          </motion.div>
        )}

        {stage === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: EO }}>
            <MarketplaceAuth onSuccess={() => setStage('dashboard')} onBack={() => setStage('entry')} />
          </motion.div>
        )}

        {stage === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EO }}>
            <MarketplaceDashboard
              cartItems={cartItems}
              onAddToCart={handleAddToCart}
              onOpenCart={() => setCartOpen(true)}
              cartCount={cartCount}
              onCheckout={handleCheckout}
              forceError={forceError}
              onClearError={() => setForceError(false)}
            />
          </motion.div>
        )}

        {stage === 'checkout' && (
          <motion.div key="checkout"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: EO }}>
            <CheckoutPage
              items={cartItems}
              onBack={() => { setStage('dashboard'); setCartOpen(true); }}
              onPay={() => setStage('success')}
            />
          </motion.div>
        )}

        {stage === 'success' && (
          <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EO }}>
            <SuccessScreen onBackToMarket={() => {
              setCartItems([]);
              setStage('dashboard');
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Marketplace;
