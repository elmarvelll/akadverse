"use client";
export default function ProductivityError({ reset }: { reset: () => void }) {
  return <div role="alert"><h1>Your workspace could not be loaded</h1><p>Please retry. Saved records have not been reset.</p><button onClick={reset}>Retry</button></div>;
}
