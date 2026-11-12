// src/app/e-learning/_components/ComingSoon.tsx
//
// Shared placeholder for every E-Learning leaf page whose real feature is
// a later phase (AGENTS.md §44 — Study Zone, Course Control, HOD
// Assignments/Approvals, DAPU Course Structure/Timeframes/Timetable, etc.
// are Phases 2-6; this file only exists so Phase 1's sidebar has no dead
// links). Server component — no client state needed, unlike the
// Marketplace-side ComingSoon (src/app/components/dashboard/shared/ComingSoon.tsx)
// which needs useAuth() for a client-side loading state; here the layout
// above it has already resolved the session server-side.

export default function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 sm:p-12 text-center">
      <p className="text-xs tracking-[0.3em] uppercase text-gray-400 mb-3">{title}</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Coming soon</h1>
      <p className="text-gray-500 max-w-md mx-auto">
        {description ?? "This section isn't built out yet — check back as the E-Learning system grows."}
      </p>
    </div>
  );
}
