"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Workspace } from "./workspace/Workspace";
import { setProductivityAccount } from "./client";
import { ProductivityError, productivityErrorMessage } from "./errors";
import { WorkspaceFailure } from "./WorkspaceFailure";

function AccountWorkspace({ userId }: { userId: string }) {
  const [expired, setExpired] = useState("");
  const [setupFailure, setSetupFailure] = useState<ProductivityError>();
  useLayoutEffect(() => {
    setProductivityAccount(userId);
    return () => setProductivityAccount("");
  }, [userId]);
  useEffect(() => {
    const ended = (event: Event) => { setProductivityAccount(""); setExpired(productivityErrorMessage((event as CustomEvent<unknown>).detail, "Your session changed or expired. Sign in again or reload to continue with your current account.")); };
    const setupRequired = (event: Event) => {
      const failure: unknown = (event as CustomEvent<unknown>).detail;
      if (failure instanceof ProductivityError) setSetupFailure(failure);
    };
    window.addEventListener("productivity:session-ended", ended);
    window.addEventListener("productivity:setup-required", setupRequired);
    return () => { window.removeEventListener("productivity:session-ended", ended); window.removeEventListener("productivity:setup-required", setupRequired); };
  }, []);
  if (expired) return <div role="alert"><p>{expired}</p><Link href="/login?callbackUrl=%2Fstudashboard%2Fproductivity-layer">Sign in</Link> <button onClick={() => window.location.reload()}>Reload workspace</button></div>;
  if (setupFailure) return <WorkspaceFailure message={`${setupFailure.message} Automatic workspace requests are paused. Complete the database setup for this environment before reloading.`} referenceId={setupFailure.referenceId} />;
  return <Workspace />;
}

export function ProductivityClient({ userId }: { userId: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const currentId = session?.user?.id;
  useEffect(() => { if (status === "authenticated" && currentId !== userId) router.refresh(); }, [currentId, status, userId, router]);
  // Remove the entire data-bearing subtree before a different account renders.
  // No user data is held in a global cache or persisted in browser storage.
  if (status !== "authenticated" || currentId !== userId) return <div role="status">{status === "unauthenticated" ? <Link href="/login?callbackUrl=%2Fstudashboard%2Fproductivity-layer">Sign in to open your workspace</Link> : "Loading your account…"}</div>;
  return <AccountWorkspace key={userId} userId={userId} />;
}
