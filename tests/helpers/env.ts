// tests/helpers/env.ts
//
// MUST be the first import of every test file. Points Prisma at a LOCAL
// throwaway database before any app module (and its Prisma client) loads, and
// replaces every provider secret with a dummy, so a test run can never touch
// the real database, Paystack, or Resend — whatever is in .env.
//
//   npm run db:local:up            # for_Developers/docker-compose.yml (127.0.0.1:5433)
//   npm run test:db:setup          # applies prisma/migrations to it
//   npm test

const LOCAL_DEFAULT = "postgresql://akadverse:akadverse_local_only@127.0.0.1:5433/akadverse";
const url = process.env.TEST_DATABASE_URL || LOCAL_DEFAULT;

const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  throw new Error(`Refusing to run tests against a non-local database host (${host}). Set TEST_DATABASE_URL to a local Postgres.`);
}

// The E-Learning database (separate DB, same local server).
const elearningUrl = process.env.TEST_ELEARNING_DATABASE_URL || url.replace(/\/akadverse(\?|$)/, "/akadverse_elearning$1");
if (new URL(elearningUrl).hostname !== host) throw new Error("Refusing to run tests against a non-local E-Learning database.");
process.env.ELEARNING_DATABASE_URL = elearningUrl;
process.env.ELEARNING_DIRECT_URL = elearningUrl;
// Storage and the AI provider are faked in tests (tests/helpers/fake-providers.ts); these are never real.
process.env.SUPABASE_URL = "https://storage.akadverse.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.SUPABASE_COURSE_MATERIALS_BUCKET = "course-materials";
process.env.ANTHROPIC_API_KEY = "sk-ant-dummy-for-automated-tests";
process.env.NEXTAUTH_SECRET = "test-nextauth-secret";

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.PAYSTACK_MODE = "test";
process.env.PAYSTACK_TEST_SECRET_KEY = "sk_test_dummy_for_automated_tests";
process.env.PAYSTACK_SECRET_KEY = "sk_live_dummy_never_used";
process.env.NEXT_PUBLIC_PAYSTACK_KEY = "pk_test_dummy";
process.env.RESEND_API_KEY = "re_dummy_for_automated_tests";
process.env.NEXTAUTH_URL = "https://akadverse.test";
process.env.ADMIN_EMAIL = "";
