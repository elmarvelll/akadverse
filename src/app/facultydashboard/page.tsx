// src/app/facultydashboard/page.tsx
//
// The faculty hub — where src/proxy.ts sends anyone whose session role is
// "faculty". Same pattern as the student hub (src/app/studashboard/page.tsx):
// a card grid of available workspaces rather than dropping straight into
// one. Faculty has no Marketplace access (Marketplace is students-only —
// AGENTS.md §9), so there's no Marketplace/Productivity Layer card here,
// only what's actually relevant: Main Menu, E-Learning, AI Studio.
//
// This used to be a bare "Coming soon" placeholder with no link anywhere
// to the real E-Learning Faculty portal built at /e-learning/faculty/... —
// that made it unreachable for a faculty user signing in normally. This
// page's E-Learning card is what fixes that (see src/proxy.ts's
// ROLE_HOME_PATHS comment for the fuller story).

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { House, BookOpen, Bot, Loader2 } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";

// Reusing the student portal's navbar deliberately — it's just branding +
// sign-out (see that file's own header comment), nothing student-specific,
// so duplicating it here for a faculty-labeled copy would only be visual
// noise to keep in sync for no behavioral difference.

const workspaces = [
  {
    id: 1,
    title: "Main Menu",
    description: "Access campus tools and the faculty dashboard.",
    icon: House,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    path: "/facultydashboard/main-menu",
  },
  {
    id: 2,
    title: "E-Learning",
    description: "Your courses, learning resources, results record, and — if you're a Level Adviser — course registration approvals.",
    icon: BookOpen,
    color: "text-green-500",
    bgColor: "bg-green-50",
    // The standalone E-Learning system (its own layout/sidebar, own
    // database — see prisma/elearning/schema.prisma), not a page under
    // facultydashboard/** — E-Learning is a separate academic domain.
    path: "/e-learning/faculty/dashboard",
  },
  {
    id: 3,
    title: "AI Studio",
    description: "Your AI-powered academic assistant for lecture prep, research, and course material support.",
    icon: Bot,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    path: "/facultydashboard/ai-studio",
  },
];

const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
};

export default function FacultyDashboardPage() {
  const router = useRouter();
  // A plain per-render value rather than useState+effect (studashboard's
  // version does that, and lint flags it — setState synchronously in an
  // effect body): recomputing on every render gets the same "stays fresh
  // across a long-lived tab" behavior without the lint warning, since
  // React re-renders this component whenever auth state settles anyway.
  const timeOfDay = getTimeOfDayGreeting();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Defensive fallback only — src/proxy.ts already blocks unauthenticated
    // requests to this route server-side; see the identical comment on
    // src/app/studashboard/page.tsx for why this is still here.
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  const displayName = user?.firstName || "Faculty";

  return (
    <div className="min-h-screen bg-white font-sans">
      <DashboardNavbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-12 pt-[50px] sm:pt-[150px]">
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Good {timeOfDay}, {displayName}</h1>
          <p className="text-gray-500">Select a workspace to continue.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            return (
              <div
                key={workspace.id}
                onClick={() => router.push(workspace.path)}
                className="relative overflow-hidden p-6 sm:p-8 min-h-[240px] sm:min-h-[260px] border border-transparent rounded-[20px] shadow-[0_2px_8px_rgba(16,24,40,0.07)] hover:border-transparent hover:shadow-[0_6px_14px_rgba(16,24,40,0.10)] transition-all cursor-pointer group"
              >
                <div className="pointer-events-none absolute top-3 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2">
                  <Icon size={120} className="text-gray-200" />
                </div>
                <div className={`w-14 h-14 ${workspace.bgColor} rounded-xl flex items-center justify-center mb-6 shadow-[0_2px_6px_rgba(16,24,40,0.04)]`}>
                  <Icon size={31} className={workspace.color} />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition">
                  {workspace.title}
                </h3>
                <p className="text-md text-gray-500 leading-relaxed">{workspace.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
