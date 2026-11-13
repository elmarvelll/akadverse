"use client";
import { WorkspaceFailure } from "@/features/productivity/WorkspaceFailure";
import { productivityErrorMessage } from "@/features/productivity/errors";

export default function ProductivityError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(error.digest) ? error.digest : undefined;
  return <WorkspaceFailure message={productivityErrorMessage(error, "An unexpected error interrupted the workspace. Reload to recover. If it continues, contact the developer with the error reference when one is shown.")} referenceId={digest} retry={retry} />;
}
