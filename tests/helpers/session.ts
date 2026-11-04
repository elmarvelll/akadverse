// tests/helpers/session.ts
//
// Lets a test act as a signed-in user for services that read the NextAuth
// session (requireOwnedBusiness / requireOwnedVendor / requireAdmin).
// Replaces next-auth's getServerSession with one that returns whoever
// `signInAs` last set. Must be imported (after ./env) BEFORE any app module,
// and needs `--experimental-test-module-mocks` (see the `test` npm script).

import { mock } from "node:test";

let current: { user: { id: string; email: string; isAdmin?: boolean; role?: string } } | null = null;

mock.module("next-auth", {
  namedExports: {
    getServerSession: async () => current,
  },
});

export function signInAs(user: { id: string; email: string; isAdmin?: boolean } | null) {
  current = user ? { user: { id: user.id, email: user.email, isAdmin: user.isAdmin ?? false, role: "student" } } : null;
}
