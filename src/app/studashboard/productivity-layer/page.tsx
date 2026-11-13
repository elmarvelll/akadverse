import { redirect, unstable_rethrow } from "next/navigation";
import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { ServiceError } from "@/lib/service-error";
import { ProductivityClient } from "@/features/productivity/ProductivityClient";
import { WorkspaceFailure } from "@/features/productivity/WorkspaceFailure";
import { publicProductivityError } from "@/services/productivity-layer/errors";

export default async function ProductivityPage() {
  let user;
  try { user = await requireProductivityUser(); }
  catch (error) {
    unstable_rethrow(error);
    if (error instanceof ServiceError && error.status === 401) redirect("/login?callbackUrl=%2Fstudashboard%2Fproductivity-layer");
    if (error instanceof ServiceError && error.status === 403) redirect("/");
    const failure = publicProductivityError(error), referenceId = crypto.randomUUID();
    console.error("Productivity page failed", { referenceId, code: failure.code });
    return <WorkspaceFailure message={failure.error} referenceId={referenceId} />;
  }
  return <ProductivityClient userId={user.id} />;
}
