"use client";
import Link from "next/link";

export function WorkspaceFailure({ message, referenceId, retry }: { message: string; referenceId?: string; retry?: () => void }) {
  return <main role="alert"><h1>Your workspace could not be loaded</h1><p>{message}</p>{referenceId && <p>Error reference: {referenceId}</p>}<p>Reload to check the latest saved records before repeating an action.</p><button onClick={retry || (() => window.location.reload())}>Retry loading</button> <Link href="/studashboard">Back to student dashboard</Link></main>;
}
