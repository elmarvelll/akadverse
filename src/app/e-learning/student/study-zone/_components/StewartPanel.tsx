"use client";

// Pending files stay local; submitted references are retained per conversation until the page closes.

import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, FileText, Loader2, Paperclip, SendHorizontal, Sparkles, X } from "lucide-react";
import { checkStewartAttachment, STEWART_MAX_ATTACHMENTS, STEWART_ATTACHMENT_ACCEPT, STEWART_MAX_ATTACHMENT_MB, STEWART_MAX_MESSAGE_CHARS } from "@/lib/stewart/config";
import { askStewart, attachDocument, discardAttachment, startThread, STEWART_SUGGESTIONS, type StewartAttachment, type StewartContext, type StewartMessage } from "./stewart";

// `threadKey` identifies the conversation (one per week + document); `studyingLabel` is the context line in the header.
// `className` carries the height, which the workspace sets for its stacked / side-by-side layouts.
export default function StewartPanel({ context, threadKey, studyingLabel, className = "", files, onFilesChange, onRetake }: { files: File[]; onFilesChange: (files: File[] | ((current: File[]) => File[])) => void; onRetake: () => void; context: StewartContext; threadKey: string; studyingLabel: string; className?: string }) {
  const [threads, setThreads] = useState<Record<string, StewartMessage[]>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[threadKey] ?? "";
  const setDraft = (value: string) => setDrafts((all) => ({ ...all, [threadKey]: value }));
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, StewartAttachment[]>>({});
  const storedRef = useRef<StewartAttachment[]>([]);
  const cachedUploads = useRef(new Map<File, StewartAttachment>());
  const sending = useRef(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<AbortController | null>(null);
  // Message ids: a per-panel counter (stable, unique within the page visit).
  const nextId = useRef(0);
  const messageId = (key: string, suffix: string) => `${key}-m${(nextId.current += 1)}-${suffix}`;
  useEffect(() => () => {
    uploadRef.current?.abort();
    storedRef.current.forEach(discardAttachment);
  }, []);

  const messages = threads[threadKey] ?? startThread(context, threadKey);
  const typing = pendingKey === threadKey;
  const untouched = !threads[threadKey];
  const ready = (submitted[threadKey]?.length ?? 0) > 0 || files.length > 0;
  const tooLong = draft.length > STEWART_MAX_MESSAGE_CHARS;

  // Keep the newest message in view (scrolls the log only, never the page).
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages.length, typing, threadKey]);

  async function send(text: string) {
    const question = text.trim();
    // One request at a time, and never while a document is still being processed.
    if ((!question && !files.length) || sending.current || pendingKey || uploading || question.length > STEWART_MAX_MESSAGE_CHARS) return;
    sending.current = true;
    const key = threadKey;
    const asked = { ...context };
    const history = [...(threads[key] ?? startThread(asked, key)), { id: messageId(key, "q"), role: "student" as const, text: question || "Explain the relevant content in these attachments." }];
    setDraft("");
    setThreads((t) => ({ ...t, [key]: history }));
    setPendingKey(key);
    try {
      setAttachError(null);
      const attachments = [...(submitted[key] ?? [])];
      if (attachments.length + files.length > STEWART_MAX_ATTACHMENTS) throw new Error(`Use at most ${STEWART_MAX_ATTACHMENTS} attachments per conversation.`);
      const controller = new AbortController();
      uploadRef.current = controller;
      setUploading(files.length > 0);
      for (const file of files) {
        let uploaded = cachedUploads.current.get(file);
        // eslint-disable-next-line react-hooks/purity -- expiry is checked in the async Send event, never during rendering
        if (uploaded && new Date(uploaded.expiresAt).getTime() <= Date.now()) { cachedUploads.current.delete(file); uploaded = undefined; }
        if (!uploaded) {
          uploaded = await attachDocument(file, controller.signal);
          if (controller.signal.aborted) { discardAttachment(uploaded); throw new Error("Upload cancelled."); }
          cachedUploads.current.set(file, uploaded);
          storedRef.current.push(uploaded);
        }
        attachments.push(uploaded);
      }
      setUploading(false);
      const { reply, truncated } = await askStewart(history, asked, attachments);
      files.forEach((file) => cachedUploads.current.delete(file));
      setSubmitted((all) => ({ ...all, [key]: attachments }));
      // Only clear the files from the submitted thread, even if the student switched documents mid-request.
      onFilesChange((current) => current.filter((file) => !files.includes(file)));
      const text = truncated ? `${reply}\n\n(This answer was cut off because it reached the length limit — ask me to continue.)` : reply;
      const id = messageId(key, "a");
      setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { id, role: "stewart", text }] }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sorry, I couldn't answer that just now. Please try again.";
      setDraft(question);
      setThreads((t) => ({ ...t, [key]: history.slice(0, -1) }));
      // Local-only notice: it is shown, but not sent back as if Stewart had said it.
      const id = messageId(key, "e");
      setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { id, role: "stewart", text: message, local: true }] }));
    } finally {
      setPendingKey(null);
      setUploading(false);
      sending.current = false;
    }
  }

  function removePending(index: number) {
    const file = files[index];
    const cached = cachedUploads.current.get(file);
    if (cached) { discardAttachment(cached); cachedUploads.current.delete(file); }
    onFilesChange(files.filter((_, i) => i !== index));
  }

  function onFilesChosen(chosen: File[]) {
    if (fileRef.current) fileRef.current.value = "";
    const next = [...files];
    const errors: string[] = [];
    for (const file of chosen) {
      const problem = checkStewartAttachment(file.name, file.size);
      if (problem) { errors.push(`${file.name}: ${problem}`); continue; }
      if (next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
      if (next.length + (submitted[threadKey]?.length ?? 0) >= STEWART_MAX_ATTACHMENTS) { errors.push(`Use at most ${STEWART_MAX_ATTACHMENTS} files per conversation.`); break; }
      next.push(file);
    }
    onFilesChange(next);
    setAttachError(errors.join(" ") || null);
  }

  return (
    <section aria-label="Stewart, AI study assistant" className={`flex min-h-0 min-w-0 flex-col rounded-2xl border border-gray-200 bg-white ${className}`}>
      <header className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white" aria-hidden>
            <Sparkles size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">Stewart</h2>
            <p className="text-xs text-gray-700">AI Study Assistant</p>
          </div>
        </div>
        <p aria-live="polite" className="mt-2.5 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <BookOpen size={14} className="mt-px shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="font-semibold">Studying:</span> {studyingLabel}
          </span>
        </p>
      </header>

      <ol ref={logRef} role="log" aria-label="Conversation with Stewart" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "student" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-gray-100 text-gray-900"}`}>
              <span className="sr-only">{m.role === "student" ? "You" : "Stewart"}: </span>
              {m.text}
            </div>
          </li>
        ))}
        {typing && (
          <li className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-gray-100 px-3.5 py-2.5 text-sm text-gray-700">
              <Loader2 size={14} className="animate-spin" aria-hidden /> {ready ? "Stewart is reading and thinking…" : "Stewart is thinking…"}
            </div>
          </li>
        )}
      </ol>

      <div className="border-t border-gray-100 p-3">
        {untouched && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {STEWART_SUGGESTIONS.filter((s) => ready || !s.includes("attached")).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={!!pendingKey || uploading}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-blue-200 bg-blue-50 p-2 text-xs text-blue-950" aria-live="polite">
            <p className="font-semibold">Attachments — {files.length} file{files.length === 1 ? "" : "s"}</p>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2">
                <FilePreview file={file} />
                <span className="min-w-0 flex-1 break-words"><strong>{file.name}</strong><span className="block">{file.name.startsWith("Screenshot-") ? "Screenshot" : "Document / image"} · {(file.size / 1024).toFixed(0)} KB</span></span>
                {file.name.startsWith("Screenshot-") && <button type="button" disabled={!!pendingKey} onClick={() => { removePending(index); onRetake(); }} className="underline">Retake</button>}
                <button type="button" disabled={!!pendingKey} aria-label={`Remove ${file.name}`} onClick={() => removePending(index)} className="rounded p-1 hover:bg-blue-100"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {!!submitted[threadKey]?.length && <div className="mb-2 max-h-24 overflow-y-auto text-xs text-gray-600"><p>Available for follow-ups:</p>{submitted[threadKey].map((a) => <div key={a.token} className="flex items-center gap-2"><span className="min-w-0 flex-1 break-words">{a.name}{a.truncated ? " (first part only)" : ""}</span><button type="button" aria-label={`Remove ${a.name} from conversation`} disabled={!!pendingKey} onClick={() => { setSubmitted((all) => ({ ...all, [threadKey]: all[threadKey].filter((item) => item.token !== a.token) })); discardAttachment(a); }}><X size={14} /></button></div>)}</div>}
        {uploading && <p role="status" className="mb-2 text-xs text-blue-800">Uploading attachments and processing documents…</p>}
        {attachError && (
          <p role="alert" className="mb-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <AlertCircle size={14} className="mt-px shrink-0" aria-hidden /> {attachError}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2"
        >
          <input
            ref={fileRef}
            id="stewart-file"
            type="file"
            multiple
            accept={STEWART_ATTACHMENT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            disabled={!!pendingKey}
            onChange={(e) => onFilesChosen(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!pendingKey}
            aria-label="Add files"
            title={`Add files — up to ${STEWART_MAX_ATTACHMENT_MB} MB each`}
            className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-gray-300 px-2 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Paperclip size={16} aria-hidden />}<span className="text-xs">Add files</span>
          </button>
          <label htmlFor="stewart-input" className="sr-only">Ask Stewart a question</label>
          <textarea
            id="stewart-input"
            rows={1}
            disabled={!!pendingKey}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter adds a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder={ready ? "Ask about the attached document…" : "Ask Stewart…"}
            aria-invalid={tooLong}
            aria-describedby="stewart-hint"
            className="max-h-32 min-h-[2.5rem] min-w-0 flex-1 resize-none rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={(!draft.trim() && !files.length) || !!pendingKey || uploading || tooLong}
            aria-label="Send message to Stewart"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <SendHorizontal size={16} aria-hidden />
          </button>
        </form>
        <p id="stewart-hint" className={`mt-2 text-[11px] ${tooLong ? "text-red-800" : "text-gray-600"}`}>
          {tooLong
            ? `That message is too long (${draft.length.toLocaleString("en")} of ${STEWART_MAX_MESSAGE_CHARS.toLocaleString("en")} characters).`
            : uploading
              ? "You can send your question once the document has finished uploading."
              : "Stewart can make mistakes — check important answers against your course material."}
        </p>
      </div>
    </section>
  );
}

function FilePreview({ file }: { file: File }) {
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return;
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- local, temporary attachment preview
  return /\.(png|jpe?g|webp)$/i.test(file.name) ? <img ref={imageRef} alt={`Preview of ${file.name}`} className="h-10 w-12 rounded object-contain" /> : <FileText size={16} className="shrink-0" aria-hidden />;
}
