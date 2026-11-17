import React from "react";
const calls: string[] = [];
let finish: ((cancel?: boolean) => void) | undefined;
Object.assign(window, { portalTest: { calls, finish: (cancel = false) => finish?.(cancel) } });
const router = {
  push: (path: string) => { calls.push(path); return new Promise<void>(resolve => { finish = cancel => { if (!cancel) history.pushState({}, "", path); resolve(); }; }); },
  replace: () => {},
};
export function useRouter() { return router; }
export function useSession() { return { status: "authenticated", data: { user: { id: "local-student", firstName: "Test", name: "Test Student", email: "fixture@example.test", role: "student", isAdmin: false } } }; }
export function signOut() {}
export default function Link({ children, ...props }: React.ComponentProps<"a">) { return <a {...props}>{children}</a>; }
