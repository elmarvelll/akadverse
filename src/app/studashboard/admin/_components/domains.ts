// src/app/studashboard/admin/_components/domains.ts
//
// The platform's major workspaces (mirrors src/app/studashboard/page.tsx's
// own workspace list) as admin-manageable domains — shared between the
// sidebar and the Overview landing grid so they can never list different
// domains. Marketplace is the only one with real admin functionality
// today; the rest are honestly "Coming Soon," same convention as the
// Overview stat cards' Skill Owners tile — not stubbed as if they worked.

import { ShoppingBag, BookOpen, Zap, Compass, Bot, type LucideIcon } from "lucide-react";

export interface AdminDomain {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  implemented: boolean;
}

export const ADMIN_DOMAINS: AdminDomain[] = [
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Users, business verification/blocking, disputes, order events, fines, and business reports.",
    href: "/studashboard/admin/marketplace",
    icon: ShoppingBag,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    implemented: true,
  },
  {
    id: "e-learning",
    label: "E-Learning",
    description: "Course and learning-resource oversight.",
    href: "/studashboard/admin/e-learning",
    icon: BookOpen,
    color: "text-green-500",
    bgColor: "bg-green-50",
    implemented: false,
  },
  {
    id: "productivity-layer",
    label: "Productivity Layer",
    description: "Oversight of Docs, Drive, and other productivity tools.",
    href: "/studashboard/admin/productivity-layer",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    implemented: false,
  },
  {
    id: "opportunity-hub",
    label: "Opportunity Hub",
    description: "Oversight of listed opportunities and postings.",
    href: "/studashboard/admin/opportunity-hub",
    icon: Compass,
    color: "text-teal-500",
    bgColor: "bg-teal-50",
    implemented: false,
  },
  {
    id: "ai-studio",
    label: "AI Studio",
    description: "Oversight of the platform's AI-assisted tools.",
    href: "/studashboard/admin/ai-studio",
    icon: Bot,
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    implemented: false,
  },
];
