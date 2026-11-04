"use client";

// Where one document stands with the AI study assistant (services/e-learning/ai-ingest), plus Send/Retry when it
// isn't on its way: never sent (uploaded before the AI service was connected), failed, or stuck pending. Rendered only
// when the AI service is configured.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryIngestAction } from "./actions";

export type AiBadgeState = "none" | "pending" | "stuck" | "ingested" | "failed" | "unsupported" | "retry";

const LOOK: Record<AiBadgeState, { text: string; className: string }> = {
  unsupported: { text: "AI: unsupported format", className: "border-gray-300 bg-gray-50 text-gray-800" },
  retry: { text: "AI: retry pending", className: "border-amber-300 bg-amber-50 text-amber-900" },
  none: { text: "AI: not sent", className: "border-gray-300 bg-gray-50 text-gray-800" },
  pending: { text: "AI: queued", className: "border-amber-300 bg-amber-50 text-amber-900" },
  stuck: { text: "AI: no response", className: "border-amber-300 bg-amber-50 text-amber-900" },
  ingested: { text: "AI: ready", className: "border-green-300 bg-green-50 text-green-900" },
  failed: { text: "AI: failed", className: "border-red-300 bg-red-50 text-red-900" },
};

export default function AiIngestBadge({ offeringId, materialId, state, detail }: { offeringId: string; materialId: string; state: AiBadgeState; detail: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canSend = state === "none";
  const look = LOOK[state];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span title={detail ?? undefined} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${look.className}`}>{look.text}</span>
      {canSend && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            start(async () => {
              const r = await retryIngestAction(offeringId, materialId);
              if (!r.ok) setError(r.error);
              router.refresh();
            });
          }}
          className="text-xs font-semibold text-blue-700 underline disabled:opacity-60"
        >
          {pending ? "Sending…" : state === "none" ? "Send to AI" : "Retry"}
        </button>
      )}
      {error && <span role="alert" className="text-xs text-red-800">{error}</span>}
    </span>
  );
}
