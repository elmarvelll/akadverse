// src/app/studashboard/page.tsx
//
// The student portal's landing page — where src/proxy.ts sends anyone whose
// session role is "student" (the default role for every new account).
//
// Adapted from the design you provided, with two changes to fit this
// project's actual auth setup:
//   1. Import paths fixed to match this project's tsconfig alias
//      ("@/*" -> "./src/*"): useAuth comes from "@/context/AuthContext",
//      not "@/src/context/AuthContext".
//   2. The user's first name now comes from useAuth() (backed by NextAuth's
//      session, itself populated from Prisma — see src/lib/auth.ts's `jwt`
//      callback) instead of a separate fetch("/api/marketplace/user") call.
//      That route doesn't exist in this project, and — since the session
//      already carries firstName — adding it back would just be a second
//      network request for data we already have.

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Zap, House, Bot, BookOpen, ShoppingBag, ShieldCheck, Loader2 } from "lucide-react";
import DashboardNavbar from "@/app/components/dashboard/student/DashboardNavbar";

const workspaces = [
  {
    id: 1,
    title: "Productivity Layer",
    description: "Tools to create, organize, and manage academic work. This workspace includes tools such as Docs and Drive.",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    path: "/studashboard/productivity-layer",
  },
  {
    id: 2,
    title: "Main Menu",
    description: "Access campus tools and the student dashboard.",
    icon: House,
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    path: "/studashboard/main-menu",
  },
  {
    id: 3,
    title: "Marketplace",
    description: "Buy, sell, and hire within your campus community — browse products and skills, list your own, and manage orders.",
    icon: ShoppingBag,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    path: "/studashboard/marketplace",
  },
  {
    id: 4,
    title: "E-Learning",
    description: "Access courses, learning materials, and track academic progress. Includes learning dashboard, my courses, and learning resources.",
    icon: BookOpen,
    color: "text-green-500",
    bgColor: "bg-green-50",
    // Points at the standalone E-Learning system (its own layout/sidebar,
    // own database — see prisma/elearning/schema.prisma), not a page under
    // studashboard/** — E-Learning is a separate academic domain, not a
    // Marketplace section (AGENTS.md §1/§45).
    path: "/e-learning/student/dashboard",
  },
  {
    id: 5,
    title: "AI Studio",
    description: "Your AI-powered academic assistant for research, writing, and study support. This is the main AI workspace where students interact with AI tools such as chat, research assistance, note summarization, and study planning.",
    icon: Bot,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    path: "/studashboard/ai-studio",
  },
  {
    id: 6,
    title: "Admin",
    description: "Platform oversight: users, business verification/blocking, disputes, order events, fines, and reports — currently covers the Marketplace, with other domains on the way.",
    icon: ShieldCheck,
    color: "text-red-500",
    bgColor: "bg-red-50",
    path: "/studashboard/admin",
    // Every admin API call is still gated server-side by requireAdmin()
    // (User.isAdmin, independent of role — see
    // docs/admin/decisions/admin-flag-replaces-role-check.md) regardless
    // of how this URL is reached — this flag only keeps the card from
    // being shown to users who can't use it, it isn't itself a security
    // boundary.
    adminOnly: true,
  },
];

// Picks a greeting word based on the current hour. Recomputed on mount (see
// useEffect below) rather than at module load, so it can't go stale across
// a long-lived tab that's left open past midnight/noon/6pm.
const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
};

const Page = () => {
  const router = useRouter();
  // A plain per-render value: this page shows a spinner until the session has loaded on the client, so the greeting is never part
  // of the server HTML and can't mismatch (facultydashboard does the same).
  const timeOfDay = getTimeOfDayGreeting();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Defensive fallback only: src/proxy.ts already blocks unauthenticated
    // requests to this route at the server level, so in normal operation
    // this branch never runs. It's here in case the proxy is ever bypassed
    // (e.g. a stale client-side cache) so the page doesn't render
    // logged-out UI.
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // While the session is still resolving, show a lightweight spinner
  // instead of flashing a "Good morning, Student" placeholder that then
  // jumps to the real name a moment later.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="animate-spin text-gray-400" size={28} />
      </div>
    );
  }

  const displayName = user?.firstName || "Student";

  return (
    <div className="min-h-screen bg-white font-sans">
      <DashboardNavbar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-12 pt-[50px] sm:pt-[150px]">
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Good {timeOfDay}, {displayName}</h1>
          <p className="text-gray-500">Select a workspace to continue.</p>
        </div>

        {/* Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {workspaces
            .filter((workspace) => !workspace.adminOnly || user?.isAdmin)
            .map((workspace) => {
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
};

export default Page;
