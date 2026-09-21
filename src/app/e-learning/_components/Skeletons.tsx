// src/app/e-learning/_components/Skeletons.tsx
//
// Loading placeholders shared by every E-Learning `loading.tsx` (Next.js renders them instantly while the server
// prepares the real page). Server-safe (no hooks). Each variant matches the layout of what it stands in for — same
// grid, same card/table shell — so the page doesn't jump when the real content arrives. The wrapper announces
// "Loading" to screen readers; the grey blocks themselves are decorative (aria-hidden).

export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}

export function LoadingRegion({ label = "Loading", children }: { label?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function HeaderBones() {
  return (
    <div className="space-y-2">
      <Bone className="h-7 w-2/3 max-w-sm" />
      <Bone className="h-4 w-1/2 max-w-xs" />
    </div>
  );
}

export function CardGridBones({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <Bone className="h-4 w-1/3" />
          <Bone className="h-5 w-4/5" />
          <div className="flex gap-2"><Bone className="h-5 w-16" /><Bone className="h-5 w-16" /></div>
          <Bone className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function TableBones({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
        {Array.from({ length: cols }, (_, i) => <Bone key={i} className="h-4 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-gray-100 px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }, (_, c) => <Bone key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-[6rem]" : ""}`} />)}
        </div>
      ))}
    </div>
  );
}

export function ListBones({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0 flex-1 space-y-2"><Bone className="h-4 w-2/5" /><Bone className="h-3 w-3/5" /></div>
          <Bone className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function FormBones({ fields = 4 }: { fields?: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-10 w-full" /></div>
      ))}
      <Bone className="h-10 w-32" />
    </div>
  );
}

export function FiltersBones() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-end gap-3">
      {Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-1.5"><Bone className="h-3 w-16" /><Bone className="h-10 w-40 max-w-full" /></div>)}
      <Bone className="h-10 w-28" />
    </div>
  );
}

export function WeekChipsBones() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="h-9 w-20 shrink-0 rounded-full" />)}
    </div>
  );
}

// Overview card + a couple of content sections — course detail pages.
export function DetailBones() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Bone className="h-4 w-24" /><Bone className="h-8 w-4/5 max-w-lg" /><div className="flex gap-2"><Bone className="h-5 w-16" /><Bone className="h-5 w-16" /></div></div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <Bone className="h-5 w-24" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Bone className="h-10" /><Bone className="h-10" /><Bone className="h-10" /></div>
        <Bone className="h-4 w-full" /><Bone className="h-4 w-5/6" />
      </div>
      <Bone className="h-5 w-48" />
      <WeekChipsBones />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3"><Bone className="h-4 w-20" /><Bone className="h-12 w-full" /><Bone className="h-12 w-full" /></div>
    </div>
  );
}
