import CredentialsProvider from "next-auth/providers/credentials";
import { prisma, corePrismaMatchesCurrentEnvironment } from "@/lib/prisma";
import { DEV_LOGIN_PROVIDER_ID, DEV_STUDENT_EMAIL, DEV_STUDENT_FIRST_NAME, DEV_STUDENT_LAST_NAME, isDevLoginEnabled, isDedicatedTestStudent, requireDevLoginSetup } from "./dev-login-policy";

export function createDevelopmentLoginProvider() {
  if (!isDevLoginEnabled()) return null;
  return CredentialsProvider({
    id: DEV_LOGIN_PROVIDER_ID,
    name: "Development Test Student",
    credentials: {},
    async authorize() {
      // Ignore the entire request's credentials. No submitted user, email, ID,
      // role or admin flag participates in selecting this dedicated identity.
      if (!isDevLoginEnabled()) return null;
      requireDevLoginSetup();
      if (!corePrismaMatchesCurrentEnvironment()) throw new Error("DevLoginRestart");
      let user;
      try {
        user = await prisma.user.upsert({
          where: { email: DEV_STUDENT_EMAIL },
          update: {},
          create: { email: DEV_STUDENT_EMAIL, firstName: DEV_STUDENT_FIRST_NAME, lastName: DEV_STUDENT_LAST_NAME,
            role: "student", isAdmin: false, password: "" },
        });
      } catch {
        // Never return Prisma's connection string, query, or credentials in an
        // authentication error URL. Missing tables/connectivity require setup.
        throw new Error("DevLoginDatabaseUnavailable");
      }
      // Refuse a colliding/promoted account; never reset another account's role,
      // password, name, or admin flag to make this login succeed.
      if (!isDedicatedTestStudent(user)) throw new Error("DevLoginStudentInvalid");
      return { id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` };
    },
  });
}
