"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMaterialAction } from "./actions";

export default function DeleteMaterialButton({ offeringId, materialId }: { offeringId: string; materialId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this material? Students will no longer be able to open it.")) return;
          start(async () => {
            const r = await deleteMaterialAction(offeringId, materialId);
            if (!r.ok) setError(r.error);
            else router.refresh();
          });
        }}
        className="text-xs font-semibold text-red-700 underline disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-800">{error}</span>}
    </span>
  );
}
