"use client";

// Upload Material: the browser sends the file straight to Supabase Storage through a one-time signed
// URL the server issues after authorizing this lecturer; the server then re-checks the stored size
// and only then records the material. The 8 MB limit is checked here for a fast message AND again on
// the server (this check is a convenience, not the protection).
//
// Feedback while it runs: three stages are shown (preparing -> uploading with a real percentage -> saving), the form is
// locked so nothing can be edited or resubmitted mid-upload, and the outcome is announced (success or a clear error).

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CANONICAL_MIME, extensionOf, MATERIAL_LABELS, MATERIAL_TYPES, MAX_MATERIAL_MB, checkFileMeta } from "@/lib/course-materials/config";
import { confirmUploadAction, requestUploadAction } from "./actions";

type Stage = "idle" | "preparing" | "uploading" | "saving";

// PUT the file to the signed URL, reporting real upload progress (fetch can't).
function putWithProgress(url: string, file: File, mime: string, onProgress: (percent: number) => void): Promise<"ok" | "rejected" | "network"> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? "ok" : "rejected");
    xhr.onerror = () => resolve("network");
    xhr.onabort = () => resolve("network");
    xhr.send(file);
  });
}

export default function UploadMaterial({ offeringId, totalWeeks }: { offeringId: string; totalWeeks: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [stage, setStage] = useState<Stage>("idle");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [range, setRange] = useState(false);

  function submit(formData: FormData) {
    if (pending) return; // never start a second upload while one is running
    setError(null);
    setDone(false);
    const file = formData.get("file") as File | null;
    const startWeek = Number(formData.get("startWeek"));
    const endWeek = range ? Number(formData.get("endWeek")) : startWeek;
    const meta = {
      courseOfferingId: offeringId,
      type: String(formData.get("type") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      startWeek,
      endWeek,
      fileName: file?.name ?? "",
      size: file?.size ?? 0,
      mimeType: file?.type ?? "",
    };
    const bad = checkFileMeta(meta.fileName, meta.size, meta.mimeType);
    if (bad) return setError(bad);

    start(async () => {
      const fail = (message: string) => { setError(message); setStage("idle"); };
      setStage("preparing");
      setPercent(0);
      const signed = await requestUploadAction(meta);
      if (!signed.ok) return fail(signed.error);
      setStage("uploading");
      const put = await putWithProgress(signed.uploadUrl, file!, CANONICAL_MIME[extensionOf(meta.fileName)], setPercent);
      if (put === "rejected") return fail("The file couldn't be uploaded. Please try again.");
      if (put === "network") return fail("The upload was interrupted. Check your connection and try again.");
      setStage("saving");
      const saved = await confirmUploadAction({ ...meta, path: signed.path });
      if (!saved.ok) return fail(saved.error);
      formRef.current?.reset();
      setRange(false);
      setDone(true);
      setStage("idle");
      router.refresh();
    });
  }

  const field = "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base sm:text-sm text-gray-900 disabled:bg-gray-50";
  const stageText = stage === "preparing" ? "Preparing upload…" : stage === "uploading" ? `Uploading… ${percent}%` : stage === "saving" ? "Saving…" : "";
  const barWidth = stage === "uploading" ? Math.max(percent, 3) : stage === "saving" ? 100 : 3;
  return (
    <form ref={formRef} action={submit} aria-busy={pending} className="rounded-2xl border border-gray-200 bg-white p-5">
      {/* Locked while an upload runs: nothing to edit, nothing to resubmit. */}
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-900">Material type
            <select name="type" required className={`${field} mt-1`}>
              {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{MATERIAL_LABELS[t].singular}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-900">Title
            <input name="title" required maxLength={200} className={`${field} mt-1`} />
          </label>
        </div>
        <label className="block text-sm font-medium text-gray-900">Description (optional)
          <textarea name="description" rows={2} maxLength={2000} className={`${field} mt-1`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-900">{range ? "From week" : "Week"}
            <input name="startWeek" type="number" min={1} max={totalWeeks} defaultValue={1} required className={`${field} mt-1`} />
          </label>
          {range && (
            <label className="text-sm font-medium text-gray-900">To week
              <input name="endWeek" type="number" min={1} max={totalWeeks} defaultValue={1} required className={`${field} mt-1`} />
            </label>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input type="checkbox" checked={range} onChange={(e) => setRange(e.target.checked)} /> This material covers several weeks
        </label>
        <label className="block text-sm font-medium text-gray-900">File
          <input name="file" type="file" required accept=".pdf,.docx,.pptx,.zip" className={`${field} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-gray-700">Maximum {MAX_MATERIAL_MB} MB. Allowed: PDF, DOCX, PPTX, ZIP.</span>
        </label>
      </fieldset>

      {pending && (
        <div role="status" aria-live="polite" className="mt-4 space-y-1.5">
          <p className="text-sm font-medium text-gray-900">{stageText}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className={`h-full rounded-full bg-blue-700 transition-[width] duration-200 ${stage === "preparing" ? "animate-pulse" : ""}`} style={{ width: `${barWidth}%` }} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {done && <p role="status" className="mt-4 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-900">Material uploaded.</p>}
      <button type="submit" disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">
        {pending && <Loader2 size={14} className="animate-spin" aria-hidden />}
        {pending ? stageText.replace(/….*/, "…") || "Uploading…" : "Upload material"}
      </button>
    </form>
  );
}
