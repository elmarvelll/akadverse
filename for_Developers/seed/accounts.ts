// for_Developers/seed/accounts.ts
//
// Every development login the seed creates — the single source of truth that for_Developers/TEST_CREDENTIALS.md
// documents. Change an account here, then update that file to match.
//
// All of these are FAKE, development-only accounts on the reserved `example.local` domain. None of them is, or
// resembles, a real person or the real platform administrator (whose identity is src/lib/admin-identity.ts — never
// reuse that local part here, it would silently grant admin).
//
// Roles are the Core `Role` enum (prisma/schema.prisma). Marketplace is students-only (src/proxy.ts,
// src/lib/marketplace-auth.ts), so every Marketplace account — including business owners and the dev admin — is a
// `student`. Admin access is the separate `isAdmin` flag, not a role.

import type { Role } from "@prisma/client";

export interface DevAccount {
  key: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  isAdmin?: boolean;
}

export const ACCOUNTS = {
  // ---- E-Learning ----------------------------------------------------------------------------
  student: { key: "student", email: "student.demo@example.local", password: "Student123!", firstName: "Ada", lastName: "Student", role: "student" },
  studentPendingAdviser: { key: "studentPendingAdviser", email: "student2.demo@example.local", password: "Student123!", firstName: "Bayo", lastName: "Student", role: "student" },
  studentPendingHod: { key: "studentPendingHod", email: "student3.demo@example.local", password: "Student123!", firstName: "Chioma", lastName: "Student", role: "student" },
  faculty: { key: "faculty", email: "faculty.demo@example.local", password: "Faculty123!", firstName: "Femi", lastName: "Lecturer", role: "faculty" },
  adviser: { key: "adviser", email: "adviser.demo@example.local", password: "Adviser123!", firstName: "Grace", lastName: "Adviser", role: "faculty" },
  hod: { key: "hod", email: "hod.demo@example.local", password: "HodDemo123!", firstName: "Hassan", lastName: "Hod", role: "hod" },
  dapu: { key: "dapu", email: "dapu.demo@example.local", password: "DapuDemo123!", firstName: "Dayo", lastName: "Dapu", role: "dapu" },

  // ---- Marketplace -----------------------------------------------------------------------------
  admin: { key: "admin", email: "admin.demo@example.local", password: "Admin123!", firstName: "Dev", lastName: "Admin", role: "student", isAdmin: true },
  buyer: { key: "buyer", email: "buyer.demo@example.local", password: "Buyer123!", firstName: "Bola", lastName: "Buyer", role: "student" },
  plugOwner: { key: "plugOwner", email: "plug.demo@example.local", password: "Plug123!", firstName: "Peter", lastName: "Plug", role: "student" },
  vendorOwner: { key: "vendorOwner", email: "vendor.demo@example.local", password: "Vendor123!", firstName: "Victoria", lastName: "Vendor", role: "student" },
  deliverer: { key: "deliverer", email: "deliverer.demo@example.local", password: "Deliverer123!", firstName: "Dele", lastName: "Deliverer", role: "student" },
} satisfies Record<string, DevAccount>;

export type AccountKey = keyof typeof ACCOUNTS;
