"use client";
import { useEffect, useLayoutEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Workspace } from "./workspace/Workspace";
import { setProductivityAccount } from "./client";

function AccountWorkspace({ userId }: { userId: string }) {
  const [expired, setExpired] = useState(false);
  useLayoutEffect(() => {
    setProductivityAccount(userId);
    return () => setProductivityAccount("");
  }, [userId]);
  useEffect(() => {
    const ended = () => { setProductivityAccount(""); setExpired(true); };
    window.addEventListener("productivity:session-ended", ended);
    return () => window.removeEventListener("productivity:session-ended", ended);
  }, []);
  if (expired) return <div role="alert"><p>Your session changed or expired. Reload to continue with your current account.</p><Link href="/login?callbackUrl=%2Fstudashboard%2Fproductivity-layer">Sign in</Link> <button onClick={() => window.location.reload()}>Reload workspace</button></div>;
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
