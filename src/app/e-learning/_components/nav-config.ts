// src/app/e-learning/_components/nav-config.ts
//
// One nav tree per role, matching AGENTS.md §11 (student), §16 (faculty,
// plus the conditional Level Adviser section), §21 (HOD), §25 (DAPU).
// Dean/VC have no functionality yet (§29) so they get no sidebar at all —
// their single placeholder page says so instead.
//
// Kept as plain data (no component imports beyond icon components) so the
// server-side layout can pick the right tree without needing to be a
// client component itself — only Sidebar.tsx (which renders this and needs
// expand/collapse state + the active-route highlight) is "use client".

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  ClipboardList,
  GraduationCap,
  History,
  ListChecks,
  CircleCheckBig,
  UserCheck,
  CheckCircle2,
  BarChart3,
  Inbox,
  SendHorizontal,
  CalendarClock,
  CalendarCheck2,
  Library,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  // A leaf with `children` (and no link of its own) is a nested group, e.g. Course Control inside Academic Essentials.
  href?: string;
  icon?: LucideIcon;
  children?: NavLeaf[];
}

export interface NavSection {
  label: string;
  icon: LucideIcon;
  // A section with no `href` and no `children` isn't valid — every section
  // is either a direct link (Dashboard) or an expandable group (Study Zone).
  href?: string;
  children?: NavLeaf[];
}

export function getStudentNav(): NavSection[] {
  return [
    { label: "Dashboard", icon: LayoutDashboard, href: "/e-learning/student/dashboard" },
    {
      label: "Academic Essentials",
      icon: BookOpen,
      children: [
        {
          label: "Course Control",
          icon: ListChecks,
          children: [
            { label: "Course Registration", href: "/e-learning/student/course-control/registration" },
            { label: "Add / Drop Course", href: "/e-learning/student/course-control/add-drop" },
            { label: "Registration Status", href: "/e-learning/student/course-control/registration-status" },
          ],
        },
        { label: "My Learning", icon: BookOpen, href: "/e-learning/student/my-learning" },
      ],
    },
    // Intentionally empty for now: a placeholder group with no pages yet.
    { label: "Study Zone", icon: Library, children: [] },
    {
      label: "Records & Analytics",
      icon: GraduationCap,
      children: [
        { label: "Results", href: "/e-learning/student/academic-records/results" },
        { label: "GPA / CGPA", href: "/e-learning/student/academic-records/gpa-cgpa" },
        { label: "Academic History", href: "/e-learning/student/academic-records/academic-history" },
      ],
    },
  ];
}

export function getFacultyNav(isLevelAdviser: boolean): NavSection[] {
  const nav: NavSection[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/e-learning/faculty/dashboard" },
    { label: "My Subjects", icon: BookOpen, href: "/e-learning/faculty/my-subjects" },
    { label: "Results Record", icon: FileText, href: "/e-learning/faculty/results" },
  ];

  // Only shown when the faculty member's profile actually carries the
  // responsibility (AGENTS.md §16/§20) — never just because they're
  // faculty.
  if (isLevelAdviser) {
    nav.push({
      label: "Level Adviser",
      icon: UserCheck,
      children: [
        { label: "Course Registrations", href: "/e-learning/faculty/level-adviser/registrations" },
        { label: "Approvals", href: "/e-learning/faculty/level-adviser/approvals" },
      ],
    });
  }

  return nav;
}

export function getHodNav(): NavSection[] {
  return [
    { label: "Dashboard", icon: LayoutDashboard, href: "/e-learning/hod/dashboard" },
    { label: "View Course Structures", icon: ClipboardList, href: "/e-learning/hod/curriculum" },
    {
      label: "Assignments",
      icon: ClipboardList,
      children: [
        { label: "Assign Lecturers", href: "/e-learning/hod/assignments/lecturers" },
        { label: "Assign Level Advisers", href: "/e-learning/hod/assignments/level-advisers" },
        { label: "Assignment History", href: "/e-learning/hod/assignments/history", icon: History },
      ],
    },
    {
      label: "Approvals",
      icon: CheckCircle2,
      children: [
        { label: "Course Registration", href: "/e-learning/hod/approvals/course-registration" },
        { label: "Result Upload", href: "/e-learning/hod/approvals/result-upload" },
      ],
    },
    {
      label: "Results",
      icon: BarChart3,
      children: [
        { label: "By Level", href: "/e-learning/hod/results/by-level" },
        { label: "By Course", href: "/e-learning/hod/results/by-course" },
        { label: "By Student", href: "/e-learning/hod/results/by-student" },
      ],
    },
  ];
}

export function getDapuNav(): NavSection[] {
  return [
    { label: "Dashboard", icon: LayoutDashboard, href: "/e-learning/dapu/dashboard" },
    { label: "Course Structure", icon: Inbox, href: "/e-learning/dapu/course-structure" },
    { label: "Add Course", icon: ClipboardList, href: "/e-learning/dapu/add-course" },
    { label: "Review Saved Courses", icon: CheckCircle2, href: "/e-learning/dapu/course-structure/review" },
    {
      label: "Academic Time Frames",
      icon: CalendarClock,
      children: [
        { label: "Course Registration", href: "/e-learning/dapu/timeframes/course-registration" },
        { label: "Result Upload", href: "/e-learning/dapu/timeframes/result-upload" },
        { label: "Result Revalidation", href: "/e-learning/dapu/timeframes/result-revalidation" },
        { label: "Change of Course", href: "/e-learning/dapu/timeframes/change-of-course" },
        { label: "Make-up Application", href: "/e-learning/dapu/timeframes/makeup-application" },
      ],
    },
    {
      label: "Timetable",
      icon: CalendarCheck2,
      children: [
        { label: "Review", href: "/e-learning/dapu/timetable/review" },
        { label: "Approve", href: "/e-learning/dapu/timetable/approve", icon: CircleCheckBig },
        { label: "Send to HODs", href: "/e-learning/dapu/timetable/send-to-hods", icon: SendHorizontal },
      ],
    },
  ];
}

// Dean/VC intentionally have no nav (AGENTS.md §29) — exported mainly so
// Sidebar.tsx's role switch stays exhaustive and obviously-on-purpose
// rather than silently falling through to an empty array.
export function getDeanNav(): NavSection[] {
  return [];
}

export function getVcNav(): NavSection[] {
  return [];
}
