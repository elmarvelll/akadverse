"use client";

import StewartResponse from "./LectureBoard";
import FilePreview from "./AttachmentPreview";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BookOpen, Loader2, Paperclip, SendHorizontal, Sparkles, X } from "lucide-react";
import { checkStewartAttachment, STEWART_MAX_ATTACHMENTS, STEWART_ATTACHMENT_ACCEPT, STEWART_MAX_ATTACHMENT_MB, STEWART_MAX_MESSAGE_CHARS } from "@/lib/stewart/config";
import { StewartRequestError, askStewart, attachDocument, discardAttachment, startThread, createChat, deleteChat, listChats, readChat, storedMessage, type ChatConversation, type StewartAttachment, type StewartContext, type StewartMessage } from "./stewart";

export default function StewartPanel({ context, threadKey, studyingLabel, className = "", files, onFilesChange, onRetake, onReferenceCountChange, onComposerKeyChange, onConversationContextChange }: {
  onReferenceCountChange?: (count: number) => void;
  onComposerKeyChange?: (thread: string, key: string) => void;
  onConversationContextChange?: (week: number, documentId: string | null) => string | void;
  files: File[]; onFilesChange: (files: File[] | ((current: File[]) => File[])) => void; onRetake: () => void;
  context: StewartContext; threadKey: string; studyingLabel: string; className?: string;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const key = selections[threadKey] ?? threadKey;
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [conversationByKey, setConversationByKey] = useState<Record<string, ChatConversation>>({});
  const conversationRef = useRef<Record<string, ChatConversation>>({});
  const activeConversation = conversationByKey[key];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState<string | null>(null);
  const [messageCursors, setMessageCursors] = useState<Record<string, string | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<ChatConversation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const selectionVersion = useRef(0);
  const [grounding, setGrounding] = useState<Record<string, boolean>>({});
  const grounded = grounding[key] ?? false;
  const [threads, setThreads] = useState<Record<string, StewartMessage[]>>({});
  const [pendingKeys, setPendingKeys] = useState(new Set<string>());
  const pendingKey = pendingKeys.has(key) ? key : null;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draft = drafts[key] ?? "";
  const setDraft = (value: string) => setDrafts((all) => ({ ...all, [key]: value }));
  const [uploadingKeys, setUploadingKeys] = useState(new Set<string>());
  const uploading = uploadingKeys.has(key);
  const [submitted, setSubmitted] = useState<Record<string, StewartAttachment[]>>({});
  const storedRef = useRef<StewartAttachment[]>([]);
  const [previewFiles, setPreviewFiles] = useState(new Map<string, File>());
  const originals = useRef(new Map<string, File>());
  const [fileStates, setFileStates] = useState(new Map<File, { status: "uploading" | "uploaded" | "failed"; error?: string }>());
  const cachedUploads = useRef(new Map<File, StewartAttachment>());
  const sending = useRef(new Set<string>());
  const requests = useRef(new Map<string, { question: string; requestId: string; clientKey: string; grounded: boolean }>());
  const [attachError, setAttachError] = useState<string | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const scrollBeforePage = useRef<{ key: string; height: number; top: number } | null>(null);
  const currentView = useRef({ key, threadKey, loadingConversation });
  useEffect(() => { currentView.current = { key, threadKey, loadingConversation }; }, [key, threadKey, loadingConversation]);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRefs = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  useEffect(() => { const controllers = uploadRefs.current; const stored = storedRef.current; mounted.current = true; return () => {
    mounted.current = false;
    controllers.forEach((controller) => controller.abort());
    // Persistent files remain reusable after refresh until removal, conversation deletion or six-hour expiry.
    stored.filter((a) => !a.context.conversationId).forEach(discardAttachment);
  }; }, []);
  const messages = threads[key]?.length ? threads[key] : startThread(context, key);
  const referenceCount = submitted[key]?.length ?? 0;
  useEffect(() => { onReferenceCountChange?.(referenceCount); }, [onReferenceCountChange, referenceCount]);
  const typing = pendingKey === key;
  const ready = referenceCount > 0 || files.length > 0;
  const tooLong = draft.length > STEWART_MAX_MESSAGE_CHARS;
  useEffect(() => {
    const log = logRef.current; if (!log) return;
    const previous = scrollBeforePage.current;
    log.scrollTop = previous?.key === key ? previous.top + log.scrollHeight - previous.height : log.scrollHeight;
    scrollBeforePage.current = null;
  }, [messages.length, typing, key]);

  function remember(view: string, conversation: ChatConversation) {
    conversationRef.current[view] = conversation;
    setConversationByKey((all) => ({ ...all, [view]: conversation }));
    setConversations((all) => [conversation, ...all.filter((c) => c.id !== conversation.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  async function refreshHistory(before?: string) {
    setHistoryLoading(true); setHistoryError(null);
    try {
      if (before) {
        const more = await listChats(context.courseId, before);
        setConversations((all) => [...all, ...more.conversations.filter((c) => !all.some((existing) => existing.id === c.id))]); setHistoryCursor(more.nextCursor);
      } else { const page = await listChats(context.courseId); setConversations(page.conversations); setHistoryCursor(page.nextCursor); }
    } catch (error) { setHistoryError(error instanceof Error ? error.message : "Couldn't load conversations."); }
    finally { setHistoryLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    listChats(context.courseId).then((page) => { if (!cancelled) { setConversations(page.conversations); setHistoryCursor(page.nextCursor); setHistoryError(null); } }).catch((error) => { if (!cancelled) setHistoryError(error.message); }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [context.courseId]);

  async function selectConversation(conversation: ChatConversation) {
    const version = ++selectionVersion.current;
    setLoadingConversation(conversation.id); setHistoryError(null);
    try {
      const response = await readChat(conversation.id);
      if (version !== selectionVersion.current) return;
      const targetThread = `w${response.conversation.weekNumber}-${response.conversation.documentId ?? "none"}`;
      const restoredThread = onConversationContextChange?.(response.conversation.weekNumber, response.conversation.documentId);
      const thread = restoredThread ?? (onConversationContextChange ? targetThread : threadKey);
      const view = Object.keys(conversationRef.current).find((k) => conversationRef.current[k].id === conversation.id) ?? conversation.id;
      remember(view, response.conversation);
      setThreads((all) => ({ ...all, [view]: response.messages.map(storedMessage) }));
      setMessageCursors((all) => ({ ...all, [view]: response.nextCursor }));
      const ctx = { ...context, courseId: response.conversation.courseId, courseCode: response.conversation.courseCode, weekNumber: response.conversation.weekNumber, documentId: response.conversation.documentId, documentTitle: response.conversation.documentTitle, conversationId: conversation.id };
      setSubmitted((all) => ({ ...all, [view]: response.attachments.map((a) => ({ ...a, context: ctx })) }));
      const lastUser = response.messages.filter((m) => m.role === "USER").at(-1);
      setGrounding((all) => ({ ...all, [view]: lastUser?.metadata?.grounded === true }));
      setSelections((all) => ({ ...all, [thread]: view })); onComposerKeyChange?.(thread, view);
      setAttachError(null);
    } catch (error) { if (version === selectionVersion.current) setHistoryError(error instanceof Error ? error.message : "Couldn't load this conversation."); }
    finally { if (version === selectionVersion.current) setLoadingConversation(null); }
  }
  function newChat() {
    selectionVersion.current++;
    const view = `draft-${crypto.randomUUID()}`;
    setSelections((all) => ({ ...all, [threadKey]: view })); onComposerKeyChange?.(threadKey, view);
    setLoadingConversation(null); setAttachError(null); setDeleteTarget(null);
  }
  async function removeConversation() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setHistoryError(null);
    try {
      await deleteChat(deleteTarget.id);
      setConversations((all) => all.filter((c) => c.id !== deleteTarget.id));
      for (const [view, c] of Object.entries(conversationRef.current)) if (c.id === deleteTarget.id) {
        delete conversationRef.current[view];
        requests.current.delete(view);
        setSubmitted((all) => { const next = { ...all }; delete next[view]; return next; });
        setDrafts((all) => { const next = { ...all }; delete next[view]; return next; });
        const current = currentView.current;
        const affected = Object.entries(selections).filter(([, selected]) => selected === view).map(([thread]) => thread);
        if (current.key === view && !affected.includes(current.threadKey)) { affected.push(current.threadKey); setAttachError(null); }
        const originalThread = `w${c.weekNumber}-${c.documentId ?? "none"}`;
        if (view === originalThread && !affected.includes(originalThread)) affected.push(originalThread);
        for (const thread of affected) {
          const draftKey = `draft-${crypto.randomUUID()}`;
          setSelections((all) => ({ ...all, [thread]: draftKey })); onComposerKeyChange?.(thread, draftKey);
        }
        setConversationByKey((all) => { const next = { ...all }; delete next[view]; return next; });
        setThreads((all) => { const next = { ...all }; delete next[view]; return next; });
      }
      if (currentView.current.loadingConversation === deleteTarget.id) { selectionVersion.current++; setLoadingConversation(null); }
      setDeleteTarget(null);
    } catch (error) { setHistoryError(error instanceof Error ? error.message : "Couldn't delete this conversation."); }
    finally { setDeleting(false); }
  }
  async function olderMessages() {
    if (!activeConversation || !messageCursors[key]) return;
    const version = ++selectionVersion.current;
    const log = logRef.current;
    if (log) scrollBeforePage.current = { key, height: log.scrollHeight, top: log.scrollTop };
    setLoadingConversation(activeConversation.id);
    try {
      const page = await readChat(activeConversation.id, messageCursors[key]!);
      if (version !== selectionVersion.current) return;
      setThreads((all) => ({ ...all, [key]: [...page.messages.map(storedMessage), ...(all[key] ?? [])] }));
      setMessageCursors((all) => ({ ...all, [key]: page.nextCursor }));
    } catch (error) { scrollBeforePage.current = null; if (version === selectionVersion.current) setHistoryError(error instanceof Error ? error.message : "Couldn't load older messages."); }
    finally { if (version === selectionVersion.current) setLoadingConversation(null); }
  }
  // A refreshed tab may encounter a generation still running on the backend; reconcile until it completes.
  const hasPendingMessage = messages.some((m) => m.status === "PENDING");
  useEffect(() => {
    if (!activeConversation || !hasPendingMessage || pendingKeys.has(key)) return;
    let cancelled = false;
    const timer = window.setInterval(() => { readChat(activeConversation.id).then((page) => {
      if (cancelled) return;
      setThreads((all) => ({ ...all, [key]: page.messages.map(storedMessage) })); remember(key, page.conversation);
    }).catch(() => {}); }, 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeConversation, hasPendingMessage, key, pendingKeys]);

  async function send(text: string, retryId?: string, retryGrounded?: boolean) {
    const question = text.trim() || (files.length ? "Explain the relevant content in these attachments." : "");
    if (!question || sending.current.has(key) || loadingConversation || question.length > STEWART_MAX_MESSAGE_CHARS) return;
    const view = key;
    const mode = retryGrounded ?? grounded;
    const previousRequest = requests.current.get(view);
    const request = previousRequest?.question === question && previousRequest.grounded === mode && (!retryId || previousRequest.requestId === retryId) ? previousRequest : { question, requestId: retryId ?? crypto.randomUUID(), clientKey: crypto.randomUUID(), grounded: mode };
    requests.current.set(view, request);
    sending.current.add(view); setPendingKeys((all) => new Set(all).add(view)); setDrafts((all) => ({ ...all, [view]: "" }));
    const optimistic: StewartMessage = { id: request.requestId, requestId: request.requestId, role: "student", text: question, status: "PENDING", grounded: mode };
    setThreads((all) => { const current = (all[view] ?? []).filter((m) => !m.local); return { ...all, [view]: current.some((m) => m.requestId === request.requestId && m.role === "student") ? current.map((m) => m.requestId === request.requestId && m.role === "student" ? { ...m, status: "PENDING" } : m) : [...current, optimistic] }; });
    let asked: StewartContext = { ...context };
    try {
      setAttachError(null);
      let conversation = conversationRef.current[view];
      if (!conversation) { conversation = (await createChat(context, request.clientKey, question, request.requestId)).conversation; remember(view, conversation); }
      asked = { ...context, courseId: conversation.courseId, courseCode: conversation.courseCode, weekNumber: conversation.weekNumber, documentId: conversation.documentId, documentTitle: conversation.documentTitle, conversationId: conversation.id };
      const attachments = [...(submitted[view] ?? [])];
      if (mode && (attachments.length || files.length)) throw new Error("Remove attachments to use external grounding, or turn grounding off.");
      if (attachments.length + files.length > STEWART_MAX_ATTACHMENTS) throw new Error(`Use at most ${STEWART_MAX_ATTACHMENTS} attachments per conversation.`);
      const controller = new AbortController(); uploadRefs.current.set(view, controller);
      setUploadingKeys((all) => files.length ? new Set(all).add(view) : all);
      const failures: string[] = [];
      for (const file of files) {
        try {
          let uploaded = cachedUploads.current.get(file);
          if (uploaded && (Date.parse(uploaded.expires_at) <= Date.now() || uploaded.context.conversationId !== conversation.id)) { cachedUploads.current.delete(file); uploaded = undefined; }
          if (!uploaded) {
            uploaded = await uploadFile(file, asked, controller.signal);
            if (controller.signal.aborted) throw new Error("Upload cancelled.");
            cachedUploads.current.set(file, uploaded); storedRef.current.push(uploaded);
          }
          attachments.push(uploaded);
        } catch (error) { failures.push(error instanceof Error ? error.message : "Upload failed."); }
      }
      if (failures.length) throw new Error("Some files failed to upload. Retry the failed files or remove them. " + failures.join(" "));
      setUploadingKeys((all) => { const next = new Set(all); next.delete(view); return next; });
      if (attachments.some((a) => a.requires_reattach || Date.parse(a.expires_at) <= Date.now())) throw new StewartRequestError("An attachment expired. Reattach it or remove it explicitly, then retry this message.", "ATTACHMENT_EXPIRED");
      const result = await askStewart([optimistic], asked, attachments, mode, { conversationId: conversation.id, requestId: request.requestId });
      if (!mounted.current) return;
      if (result.conversation) remember(view, result.conversation);
      const user = result.userMessage ? { ...storedMessage(result.userMessage), attachments: [...files.map((file) => ({ name: file.name, file })), ...(storedMessage(result.userMessage).attachments ?? []).filter((a) => !files.some((f) => f.name === a.name))] } : { ...optimistic, status: "COMPLETE" as const, attachments: files.map((file) => ({ name: file.name, file })) };
      const assistant = result.assistantMessage ? storedMessage(result.assistantMessage) : { id: `${request.requestId}-assistant`, requestId: request.requestId, role: "stewart" as const, text: result.reply, sources: result.sources, status: "COMPLETE" as const };
      setThreads((all) => ({ ...all, [view]: [...(all[view] ?? []).filter((m) => m.requestId !== request.requestId && !m.local), user, assistant] }));
      files.forEach((file) => cachedUploads.current.delete(file)); setSubmitted((all) => ({ ...all, [view]: attachments }));
      onFilesChange((current) => current.filter((file) => !files.includes(file)));
      requests.current.delete(view);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof StewartRequestError && ["ATTACHMENT_EXPIRED", "ATTACHMENT_REATTACH_REQUIRED"].includes(error.code ?? "")) {
        const previous = submitted[view] ?? [];
        const recovered = previous.map((a) => originals.current.get(a.attachment_id)).filter((file): file is File => !!file);
        setSubmitted((all) => ({ ...all, [view]: previous.filter((a) => !originals.current.has(a.attachment_id)).map((a) => ({ ...a, requires_reattach: true })) }));
        files.forEach((file) => { const cached = cachedUploads.current.get(file); if (cached) discardAttachment(cached); cachedUploads.current.delete(file); });
        previous.filter((a) => originals.current.has(a.attachment_id)).forEach(discardAttachment);
        onFilesChange((current) => [...current, ...recovered.filter((file) => !current.includes(file))]);
      }
      const message = error instanceof Error ? error.message : "Stewart couldn't answer. Please retry.";
      setDrafts((all) => ({ ...all, [view]: question }));
      setThreads((all) => ({ ...all, [view]: [...(all[view] ?? []).filter((m) => !m.local).map((m) => m.requestId === request.requestId && m.role === "student" ? { ...m, status: "FAILED" as const } : m), { id: `${request.requestId}-error`, role: "stewart", local: true, text: message }] }));
    } finally {
      sending.current.delete(view); uploadRefs.current.delete(view);
      setPendingKeys((all) => { const next = new Set(all); next.delete(view); return next; });
      setUploadingKeys((all) => { const next = new Set(all); next.delete(view); return next; });
    }
  }
  async function uploadFile(file: File, ctx: StewartContext, signal?: AbortSignal) {
    setFileStates((all) => new Map(all).set(file, { status: "uploading" }));
    try {
      const uploaded = await attachDocument(file, ctx, signal);
      originals.current.set(uploaded.attachment_id, file); setPreviewFiles((all) => new Map(all).set(uploaded.attachment_id, file));
      setFileStates((all) => new Map(all).set(file, { status: "uploaded" })); return uploaded;
    } catch (error) { setFileStates((all) => new Map(all).set(file, { status: "failed", error: error instanceof Error ? error.message : "Upload failed." })); throw error; }
  }
  async function retryFile(file: File) {
    if (sending.current.has(key) || pendingKey || uploading) return;
    const conversation = conversationRef.current[key]; if (!conversation) return;
    setUploadingKeys((all) => new Set(all).add(key));
    try { const uploaded = await uploadFile(file, { ...context, weekNumber: conversation.weekNumber, documentId: conversation.documentId, conversationId: conversation.id }); cachedUploads.current.set(file, uploaded); storedRef.current.push(uploaded); }
    catch { /* The individual error is shown beside the file. */ }
    finally { setUploadingKeys((all) => { const next = new Set(all); next.delete(key); return next; }); }
  }
  function removePending(index: number) {
    const file = files[index]; const cached = cachedUploads.current.get(file);
    if (cached) { discardAttachment(cached); cachedUploads.current.delete(file); }
    onFilesChange(files.filter((_, i) => i !== index));
  }
  function onFilesChosen(chosen: File[]) {
    if (fileRef.current) fileRef.current.value = "";
    const next = [...files]; const errors: string[] = [];
    let references = submitted[key] ?? [];
    for (const file of chosen) {
      const problem = checkStewartAttachment(file.name, file.size);
      if (problem) { errors.push(`${file.name}: ${problem}`); continue; }
      const replacements = references.filter((a) => (a.requires_reattach || Date.parse(a.expires_at) <= Date.now()) && a.filename === file.name && a.size_bytes === file.size);
      const retained = replacements.length === 1 ? references.filter((a) => a.attachment_id !== replacements[0].attachment_id) : references;
      if (next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) { references = retained; continue; }
      if (next.length + retained.length >= STEWART_MAX_ATTACHMENTS) { errors.push(`Use at most ${STEWART_MAX_ATTACHMENTS} files per conversation.`); break; }
      references = retained; next.push(file);
    }
    setSubmitted((all) => ({ ...all, [key]: references }));
    onFilesChange(next); setAttachError(errors.join(" ") || null);
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
            <span className="font-semibold">Studying:</span> {activeConversation ? `Week ${activeConversation.weekNumber} · ${activeConversation.documentTitle ?? activeConversation.courseCode}` : studyingLabel}
          </span>
        </p>
      </header>

      <div className="border-b border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between gap-2"><button type="button" onClick={newChat} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">New chat</button>
        <button type="button" onClick={() => refreshHistory()} disabled={historyLoading} className="text-xs text-gray-500 underline">Refresh history</button></div>
        <details className="mt-2"><summary className="cursor-pointer rounded py-1 text-xs font-medium">Chat history</summary>
          {historyLoading && <p role="status" className="py-2 text-xs text-gray-500">Loading conversations…</p>}
          {!historyLoading && !conversations.length && !historyError && <p className="py-2 text-xs text-gray-500">No previous conversations.</p>}
          <ul aria-label="Saved conversations" className="mt-1 max-h-40 space-y-1 overflow-y-auto">{conversations.map((conversation) => <li key={conversation.id} className={`flex min-w-0 items-center gap-1 rounded-lg ${activeConversation?.id === conversation.id ? "bg-blue-50" : "hover:bg-gray-50"}`}>
            <button type="button" onClick={() => selectConversation(conversation)} aria-current={activeConversation?.id === conversation.id ? "page" : undefined} className="min-w-0 flex-1 px-2 py-2 text-left text-xs"><span className="block truncate font-medium">{conversation.title}</span><span className="text-gray-500">Week {conversation.weekNumber}</span></button>
            <button type="button" disabled={deleting} onClick={() => setDeleteTarget(conversation)} aria-label={`Delete ${conversation.title}`} className="shrink-0 rounded px-2 py-1 text-xs text-gray-500 hover:text-red-700">Delete</button>
          </li>)}</ul>
          {historyCursor && <button type="button" disabled={historyLoading} onClick={() => refreshHistory(historyCursor)} className="mt-2 text-xs underline">Load more conversations</button>}
        </details>
        {historyError && <p role="alert" className="mt-2 text-xs text-red-800">{historyError} <button type="button" onClick={() => refreshHistory()} className="underline">Retry history</button></p>}
        {deleteTarget && <div role="alertdialog" aria-label="Delete conversation" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs"><p>Delete “{deleteTarget.title}” and its saved messages?</p><div className="mt-2 flex gap-3"><button type="button" disabled={deleting} onClick={removeConversation} className="font-semibold text-red-800">{deleting ? "Deleting…" : "Confirm delete"}</button><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div></div>}
        {loadingConversation && <p role="status" className="mt-2 text-xs text-gray-500">Loading conversation…</p>}
      </div>
      {messageCursors[key] && <button type="button" onClick={olderMessages} disabled={!!loadingConversation} className="py-2 text-xs underline">Load older messages</button>}
      <ol ref={logRef} role="log" aria-label="Conversation with Stewart" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
            <div className={m.role === "student" ? "min-w-0 max-w-[95%] break-words rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm text-white" : "w-full min-w-0 break-words text-sm text-slate-800"}>
              <span className="sr-only">{m.role === "student" ? "You" : "Stewart"}: </span>
              {m.role === "stewart" && !m.local ? <StewartResponse text={m.text} sources={m.sources} attachmentFiles={previewFiles} educational={m.educational} onAnswer={send} disabled={!!pendingKey || uploading || !!loadingConversation} /> : <span className="whitespace-pre-wrap">{m.text}</span>}
              {m.role === "student" && m.status === "FAILED" && <div className="mt-2 text-xs"><span>Response unavailable. </span><button type="button" disabled={!!pendingKey || uploading || !!loadingConversation} onClick={() => send(m.text, m.requestId, m.grounded)} className="font-semibold underline">Retry response</button></div>}
              {m.role === "student" && m.status === "PENDING" && !typing && <p role="status" className="mt-2 text-xs">Waiting for Stewart’s response…</p>}
              {m.attachments && <ul aria-label="Message attachments" className="mt-2 space-y-1">{m.attachments.map((a, index) => <li key={index} className="flex items-center gap-2">{a.file && <FilePreview file={a.file} />}<span className="text-xs">{a.name}</span></li>)}</ul>}

            </div>
          </li>
        ))}
        {typing && (
          <li className="flex justify-start">
            <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" aria-hidden /> {ready ? "Stewart is reading and thinking…" : "Stewart is thinking…"}
            </div>
          </li>
        )}
      </ol>

      <div className="border-t border-gray-100 p-3">
        <button type="button" aria-pressed={grounded} disabled={!!pendingKey || uploading || !!loadingConversation} onClick={() => setGrounding((all) => ({ ...all, [threadKey]: !grounded }))} className={`mb-2 rounded-xl border px-3 py-2 text-xs font-semibold ${grounded ? "border-blue-600 bg-blue-100 text-blue-900" : "border-gray-300 bg-white text-gray-700"}`}>
          {grounded ? "✓ " : ""}Explain with Grounding
        </button>
        {grounded && <p className="mb-2 text-xs text-gray-600">Uses external sources. Remove attachments to use this mode.</p>}

        {files.length > 0 && (
          <div className="mb-2 max-h-44 space-y-2 overflow-y-auto rounded-xl border border-blue-200 bg-blue-50 p-2 text-xs text-blue-950" aria-live="polite">
            <p className="font-semibold">Attachments — {files.length} file{files.length === 1 ? "" : "s"}</p>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center gap-2">
                <FilePreview file={file} />
                <span className="min-w-0 flex-1 break-words"><strong>{file.name}</strong><span className="block">{file.name.startsWith("Screenshot-") ? "Screenshot" : file.name.split(".").pop()?.toUpperCase()} · {(file.size / 1024).toFixed(0)} KB</span><span role="status" className="block">{fileStates.get(file)?.status ?? "local"}{fileStates.get(file)?.error ? `: ${fileStates.get(file)?.error}` : ""}</span></span>
                {fileStates.get(file)?.status === "failed" && <button type="button" disabled={!!pendingKey || uploading || !!loadingConversation} onClick={() => retryFile(file)} className="underline">Retry</button>}
                {file.name.startsWith("Screenshot-") && <button type="button" disabled={!!pendingKey || uploading || !!loadingConversation} onClick={() => { removePending(index); onRetake(); }} className="underline">Retake</button>}
                <button type="button" disabled={!!pendingKey || uploading || !!loadingConversation} aria-label={`Remove ${file.name}`} onClick={() => removePending(index)} className="rounded p-1 hover:bg-blue-100"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {!!submitted[key]?.length && <div className="mb-2 max-h-24 overflow-y-auto text-xs text-gray-600"><p>Available for follow-ups:</p>{submitted[key].map((a) => <div key={a.attachment_id} className="flex items-center gap-2"><span className="min-w-0 flex-1 break-words">{a.filename}{(a.requires_reattach || Date.parse(a.expires_at) <= now) ? " — expired; reattach or remove" : ""}</span><button type="button" aria-label={`Remove ${a.filename} from conversation`} disabled={!!pendingKey || uploading || !!loadingConversation} onClick={() => { setSubmitted((all) => ({ ...all, [key]: all[key].filter((item) => item.attachment_id !== a.attachment_id) })); discardAttachment(a); }}><X size={14} /></button></div>)}</div>}
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
          className="flex flex-wrap items-end gap-2"
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
            disabled={!!pendingKey || uploading || !!loadingConversation}
            onChange={(e) => onFilesChosen(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!pendingKey || uploading || !!loadingConversation}
            aria-label="Add files"
            title={`Add files — up to ${STEWART_MAX_ATTACHMENT_MB} MB each`}
            className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-300 px-2 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-800 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Paperclip size={16} aria-hidden />}<span className="text-xs">Add files</span>
          </button>
          <div className="basis-full" />
          <label htmlFor="stewart-input" className="sr-only">Ask Stewart a question</label>
          <textarea
            id="stewart-input"
            rows={1}
            disabled={!!pendingKey || uploading || !!loadingConversation}
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
            disabled={(!draft.trim() && !files.length) || !!pendingKey || uploading || tooLong || !!loadingConversation}
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
