import React, { useSyncExternalStore } from "react";
const changed = () => window.dispatchEvent(new Event("popstate"));
export function usePathname() { return useSyncExternalStore(cb => { window.addEventListener("popstate", cb); return () => window.removeEventListener("popstate", cb); }, () => window.location.pathname); }
export function signOut() {}
export default function Link({ href, children, onClick, ...props }: React.ComponentProps<"a">) { return <a href={href} {...props} onClick={e => { e.preventDefault(); onClick?.(e); history.pushState({}, "", href); changed(); }}>{children}</a>; }
