"use client";

// A course document as ONE clickable row (no separate Download button). Clicking asks the server for
// access (which re-checks who you are and that you may see this document) and then opens the temporary
// signed URL. The icon comes from the file's MIME type — the lecturer never picks it.

import { useState } from "react";
import { FileArchive, FileText, Presentation, File as FileIcon, Loader2 } from "lucide-react";

const ICONS: Record<string, { Icon: typeof FileText; color: string; label: string }> = {
  "application/pdf": { Icon: FileText, color: "text-red-700", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { Icon: FileText, color: "text-blue-700", label: "Word document" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { Icon: Presentation, color: "text-orange-700", label: "Presentation" },
  "application/zip": { Icon: FileArchive, color: "text-amber-700", label: "ZIP archive" },
};

export const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function DocumentLink({ id, title, mimeType, fileSize, detail }: { id: string; title: string; mimeType: string; fileSize: number; detail?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { Icon, color, label } = ICONS[mimeType] ?? { Icon: FileIcon, color: "text-gray-700", label: "File" };

  async function open() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/e-learning/documents/${id}/access`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) setError(body.error ?? "Couldn't open that file. Please try again.");
      else window.location.assign(body.url);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={open} disabled={pending} aria-busy={pending} aria-label={`Open ${title} (${label})`} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-400 disabled:opacity-60">
        {pending ? <Loader2 size={22} className="shrink-0 animate-spin text-blue-700" aria-hidden /> : <Icon size={22} className={`shrink-0 ${color}`} aria-hidden />}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-900">{title}</span>
          <span className="block text-xs text-gray-700">{pending ? "Opening…" : `${label} · ${formatSize(fileSize)}${detail ? ` · ${detail}` : ""}`}</span>
        </span>
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-800">{error}</p>}
    </div>
  );
}
