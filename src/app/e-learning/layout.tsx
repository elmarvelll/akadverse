// src/app/e-learning/layout.tsx
//
// The common E-Learning shell every role's pages render inside (AGENTS.md
// §10): fixed Header + role-specific Sidebar + main content area. src/proxy.ts
// already redirects unauthenticated visitors and blocks a mismatched
// "/e-learning/<role>/..." segment before a request even reaches here —
// this layout re-checks server-side anyway (AGENTS.md §34: never rely on
// the URL, and defense in depth against proxy being bypassed or changed
// later).
//
// Only plain, serializable values (role, isLevelAdviser, name) cross from
// this server component into Sidebar ("use client") — the nav tree itself
// (nav-config.ts, which carries lucide-react icon *components*, i.e.
// functions) is picked inside Sidebar instead of being built here and
// passed down: React server->client props must be plain data, and a
// component reference isn't ("Functions cannot be passed directly to
// Client Components").

import { redirect } from "next/navigation";
import { requireElearningSession, isElearningRole } from "@/services/e-learning/shared/auth";
import { elearningDb } from "@/lib/db/elearning";
import Shell from "./_components/Shell";

export default async function ElearningLayout({ children }: { children: React.ReactNode }) {
  const session = await requireElearningSession().catch(() => null);
  // requireElearningSession already throws unless isElearningRole(role) —
  // this re-check just narrows the type for TypeScript below rather than
  // asserting anything new.
  if (!session || !isElearningRole(session.user.role)) {
    redirect("/login");
  }

  const role = session.user.role;
  const isLevelAdviser =
    role === "faculty"
      ? ((await elearningDb.facultyProfile.findUnique({ where: { userId: session.user.id } }))?.isLevelAdviser ?? false)
      : false;

  return (
    <Shell role={role} name={session.user.firstName || session.user.name} isLevelAdviser={isLevelAdviser}>
      {children}
    </Shell>
  );
}
