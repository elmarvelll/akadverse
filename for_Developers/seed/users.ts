// for_Developers/seed/users.ts
//
// Core-database User rows for every account in accounts.ts. Upserted by email (unique), so re-running never
// duplicates; the password, role and admin flag are reset to the documented values each run, so a dev who changed
// a password locally can always get back in with TEST_CREDENTIALS.md.
//
// Passwords are hashed exactly like src/app/api/register/route.ts does (bcryptjs, 10 rounds), so the real
// CredentialsProvider in src/lib/auth.ts accepts them unchanged.

import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { ACCOUNTS, type AccountKey } from "./accounts";
import { devId } from "./ids";

const BCRYPT_SALT_ROUNDS = 10;

export type SeededUsers = Record<AccountKey, { id: string; email: string }>;

export async function seedUsers(db: PrismaClient): Promise<SeededUsers> {
  const out = {} as SeededUsers;
  for (const [key, account] of Object.entries(ACCOUNTS) as [AccountKey, (typeof ACCOUNTS)[AccountKey]][]) {
    const password = await bcrypt.hash(account.password, BCRYPT_SALT_ROUNDS);
    const data = {
      firstName: account.firstName,
      lastName: account.lastName,
      password,
      role: account.role,
      isAdmin: "isAdmin" in account ? account.isAdmin : false,
    };
    const user = await db.user.upsert({
      where: { email: account.email },
      update: data,
      create: { id: devId(`user:${key}`), email: account.email, ...data },
      select: { id: true, email: true },
    });
    out[key] = user;
  }
  console.log(`  ✔ ${Object.keys(out).length} development accounts`);
  return out;
}
