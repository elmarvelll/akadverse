// src/app/page.tsx
//
// "/" is never actually rendered in normal operation — src/proxy.ts
// intercepts every request to this path before it gets here and redirects:
// signed out -> /login, signed in -> the user's role-based dashboard (see
// ROLE_HOME_PATHS in src/proxy.ts). This component only exists as a
// defensive fallback in case the proxy is ever bypassed or misconfigured,
// so visitors never see a blank page.

export default function RootPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-500">Redirecting…</p>
    </div>
  );
}
