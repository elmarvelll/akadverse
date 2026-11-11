"use client";

// Starts (or re-joins) the live class for one offering, then opens its room.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Video } from "lucide-react";
import { startClassAction } from "./actions";
import { callAction } from "./callAction";

export default function StartClassButton({ offeringId, hrefBase }: { offeringId: string; hrefBase: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await callAction(() => startClassAction(offeringId));
            if (res.ok) router.push(`${hrefBase}/${res.sessionId}`);
            else setError(res.error);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
      >
        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Video size={14} aria-hidden />}
        Start class
      </button>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-800">{error}</p>}
    </div>
  );
}
