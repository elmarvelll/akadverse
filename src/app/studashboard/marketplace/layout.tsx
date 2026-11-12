// src/app/studashboard/marketplace/layout.tsx
//
// Wraps every page under studashboard/marketplace/** in exactly one
// NotificationProvider (one shared EventSource for the whole marketplace
// session — see _components/NotificationProvider.tsx's header comment for
// why this needs to be mounted exactly once, high up the tree, rather than
// per-page). Purely a context wrapper — visual chrome (navbars etc.) stays
// owned by each page/section as it already was.

import { NotificationProvider } from "./_components/NotificationProvider";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}
