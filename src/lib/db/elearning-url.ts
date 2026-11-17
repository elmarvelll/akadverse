// Runtime queries use Supabase's transaction pool so idle application instances
// do not reserve the session pool's limited connections. Migration tools still
// use ELEARNING_DIRECT_URL directly from the Prisma schema.
export function elearningRuntimeUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  const url = new URL(value);
  if (url.hostname.endsWith(".pooler.supabase.com")) {
    if (!url.port || url.port === "5432") url.port = "6543";
    if (url.port === "6543") {
      url.searchParams.set("pgbouncer", "true");
      if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "2");
    }
  }
  return url.toString();
}
