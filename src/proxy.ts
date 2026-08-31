// src/proxy.ts
//
// Route-protection entry point. As of Next.js 16, this replaces the old
// `middleware.ts` convention — Next.js now looks specifically for a file
// named `proxy.ts` (at the project root, or here in `src/` since this
// project uses the src/ layout) exporting a `proxy` function, and runs it
// before every matched request completes. Only one `proxy.ts` is supported
// per project.
//
// IMPORTANT: proxy/middleware code runs in the Edge Runtime, not Node.js —
// it can't use Prisma (Prisma needs Node APIs/native engines) or import
// src/lib/auth.ts's full NextAuthOptions (which imports Prisma). Instead we
// use NextAuth's lightweight `getToken` helper, which just verifies and
// decodes the JWT cookie using NEXTAUTH_SECRET — no database access needed.
// This is the standard, supported way to check auth state here.
//
// Behavior:
//   - Public pages (/login, /signup) and NextAuth's own endpoints
//     (/api/auth/*) are always allowed through, signed in or not — otherwise
//     nobody could ever reach the login page to sign in.
//   - /api/register is allowed through unauthenticated, since that's how new
//     accounts get created in the first place.
//   - "/" is a dynamic dispatcher, not a real page: a signed-in visitor is
//     immediately redirected to their role's dashboard (see
//     ROLE_HOME_PATHS below); a signed-out visitor falls through to the
//     normal "redirect to /login" handling further down.
//   - Every other page: if there's no valid session token, redirect to
//     /login (preserving the original URL as `callbackUrl` so we can send
//     the user back there after they sign in).
//   - Every other /api/* route: if there's no valid session token, respond
//     with 401 JSON instead of redirecting — redirecting a `fetch()`/axios
//     call to an HTML login page rarely does anything sensible for an API
//     consumer.

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { Role } from "@prisma/client";

// Page routes that must stay reachable without being signed in.
const PUBLIC_PAGE_PATHS = ["/login", "/signup"];

// API path prefixes that must stay reachable without being signed in.
// /api/webhooks is Paystack calling us directly (see
// src/app/api/webhooks/paystack/route.ts) — no session cookie to send, it
// authenticates itself via a signature header instead. /api/cron is Vercel
// Cron calling us on schedule (see vercel.json) — same situation, no
// session cookie, authenticated instead via a shared secret checked in
// src/lib/cron-auth.ts.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/register", "/api/webhooks", "/api/cron"];

// Where a signed-in user's role sends them when they land on "/". Faculty
// and admin routes are simple "coming soon" pages for now — see
// src/app/facultydashboard, src/app/admindashboard.
//
// super_admin has no distinct portal of its own — there used to be one
// (src/app/superadmindashboard, now removed) but Marketplace admin access
// is no longer tied to `role` at all: it's the independent `User.isAdmin`
// flag (see prisma/schema.prisma's comment on that field and
// docs/admin/decisions/admin-flag-replaces-role-check.md). A super_admin
// account lands on the same home as everyone else and, if `isAdmin` is
// also true, sees the Admin card there
// (src/app/studashboard/page.tsx) like any other admin-flagged user.
const ROLE_HOME_PATHS: Record<Role, string> = {
  student: "/studashboard",
  faculty: "/facultydashboard",
  admin: "/admindashboard",
  super_admin: "/studashboard",
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Let public pages and public API routes through untouched, regardless of
  // auth state.
  const isPublicPage = PUBLIC_PAGE_PATHS.includes(pathname);
  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  // Attempt to read and verify the session JWT from the request's cookies.
  // Returns null if there's no cookie, or if it fails signature/expiry
  // verification. Because src/lib/auth.ts's `jwt` callback already stashes
  // `role` on the token, we get it here for free — no extra database call
  // needed inside the proxy.
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Signed in and hitting "/": dispatch to the role's dashboard instead of
  // rendering a generic homepage.
  if (token && pathname === "/") {
    const homePath = ROLE_HOME_PATHS[token.role] ?? ROLE_HOME_PATHS.student;
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  // Signed in and hitting anything else: let the request through.
  if (token) {
    return NextResponse.next();
  }

  // Not signed in and hitting an API route: return a JSON 401 instead of an
  // HTML redirect, since API callers expect JSON, not a redirect chain.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Not signed in and hitting a page: redirect to /login, remembering where
  // they were trying to go so we can send them back after sign-in.
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

// Run on every request EXCEPT:
//   - Next.js internals (_next/static, _next/image)
//   - favicon.ico
//   - common static file extensions (images, etc.), so requests for assets
//     in /public aren't needlessly redirected/checked.
// Everything else (all pages and all /api/* routes) goes through the
// `proxy` function above, which decides route-by-route whether auth is
// required.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
