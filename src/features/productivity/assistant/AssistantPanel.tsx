"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Send, RefreshCw, Trash2, Maximize2, Minimize2 } from "lucide-react";
import { PipWorking } from "./PipWorking";
import { workspaceChanged } from "./workspace-changed";
import { PipAvatar } from "./PipAvatar";
import { PipMarkdown } from "./PipMarkdown";
import { invalidateWorkspace } from "../client";
import { useSpeechToText } from "@/app/components/voice/useSpeechToText";
import { VoiceInputControls, VoiceInputStatus } from "@/app/components/voice/VoiceInputControls";
import { useFollowLatest } from "@/app/components/scroll/useFollowLatest";

type Conversation = { id: string; title: string };
type Execution = { id: string; messageId: string; toolName: string; status: string; result: Record<string, unknown> | null; error: { error?: string } | null };
type Pending = { id: string; preview: { tool: string; arguments: Record<string, unknown>; current?: unknown }; expiresAt: string; expired: boolean };
type View = { conversation: Conversation; messages: { id: string; sequence: number; role: string; content: string; status: string }[]; executions: Execution[]; pending: Pending[]; hasOlder: boolean };
const root = "/api/productivity/assistant";
const labels: Record<string, string> = { awaiting_confirmation: "Awaiting your confirmation", completed: "Confirmed", failed: "Not completed", unknown: "Outcome unconfirmed", pending: "Not yet confirmed", cancelled: "Cancelled", processing: "Processing", interrupted: "Interrupted", awaiting_clarification: "More information needed" };
function refreshWorkspace(previous: View | undefined, next: View) {
  if (!workspaceChanged(previous?.executions || [], next.executions)) return;
  const tags = ["initial", "context", "today", "tasks", "schedule", "habits", "official", "buddy"];
  invalidateWorkspace(tags);
  window.dispatchEvent(new CustomEvent("productivity:invalidated", { detail: tags }));
}
export function AssistantPanel({ ownerId, studentName }: { ownerId: string; studentName?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false), [dialogOpen, setDialogOpen] = useState(false), [deleteReview, setDeleteReview] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]), [moreConversations, setMoreConversations] = useState(false), [view, setView] = useState<View>();
  const [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const focusOnOpen = useRef(false);
  const alive = useRef(true), busyRef = useRef(false), controllers = useRef(new Set<AbortController>());
  const drafts = useRef(new Map<string, string>()), current = useRef("");
  const requestIdentity = useRef<{ content: string; conversation: string; id: string } | null>(null);
  const decisionIdentity = useRef(new Map<string, string>());
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLTextAreaElement>(null);
  const { ref: messageLogRef, paused: scrollPaused, pause: pauseFollow, follow: scrollLatest } = useFollowLatest<HTMLDivElement>(`${ownerId}:${view?.conversation.id || ""}:${open}`);
  const speech = useSpeechToText({ value: draft, onChange: setDraft, contextKey: `${ownerId}:${view?.conversation.id || "new"}`, disabled: !open || dialogOpen || busy || !view, maxChars: 4000 });
  useEffect(() => {
    alive.current = true;
    const activeControllers = controllers.current, accountDrafts = drafts.current;
    return () => { alive.current = false; for (const controller of activeControllers) controller.abort(); activeControllers.clear(); accountDrafts.clear(); };
  }, []);
  useEffect(() => {
    const observe = () => setDialogOpen(!!document.querySelector("dialog[open]"));
    const observer = new MutationObserver(observe); observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] }); observe();
    return () => observer.disconnect();
  }, []);
  const request = useCallback(async <T,>(url: string, payload?: Record<string, unknown>): Promise<T> => {
    const controller = new AbortController(); controllers.current.add(controller);
    const timer = window.setTimeout(() => controller.abort(), payload ? 80000 : 20000);
    try {
      const response = await fetch(url, { method: payload ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-productivity-user": ownerId }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      const value = await response.json();
      if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "The assistant could not load this request.");
      if (!alive.current) throw new Error("Account changed.");
      return value.result as T;
    } catch (failure) {
      if (failure instanceof Error && failure.name !== "AbortError") throw failure;
      throw new Error("The connection ended before the outcome was confirmed. Reload the conversation before repeating a change.");
    } finally { window.clearTimeout(timer); controllers.current.delete(controller); }
  }, [ownerId]);
  const loadList = useCallback(async () => { const rows = await request<Conversation[]>(root); if (alive.current) { setConversations(rows); setMoreConversations(rows.length === 30); } return rows; }, [request]);
  const select = useCallback(async (id: string) => {
    if (current.current) drafts.current.set(current.current, draft);
    const next = await request<View>(`${root}?conversation=${encodeURIComponent(id)}`);
    if (alive.current) { current.current = id; setView(next); setDeleteReview(false); setDraft(drafts.current.get(id) || ""); setError(""); requestIdentity.current = null; }
  }, [draft, request]);
  const act = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await work(); } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "The request could not be completed."); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }, []);
  async function initialise() {
    await act(async () => {
      const rows = await loadList();
      if (!view && rows[0]) await select(rows[0].id);
    });
  }
  useEffect(() => {
    if (focusOnOpen.current && open && view && !busy && !dialogOpen) {
      input.current?.focus();
      focusOnOpen.current = false;
    }
  }, [open, view, busy, dialogOpen]);
  function show() { focusOnOpen.current = true; setOpen(true); void initialise(); }
  function minimise() { focusOnOpen.current = false; speech.cancel(); setOpen(false); trigger.current?.focus(); }
  async function olderConversations() {
    const last = conversations.at(-1); if (!last) return;
    await act(async () => { const rows = await request<Conversation[]>(`${root}?cursor=${encodeURIComponent(last.id)}`); setConversations(previous => [...previous, ...rows.filter(row => !previous.some(old => old.id === row.id))]); setMoreConversations(rows.length === 30); });
  }
  async function newConversation() {
    await act(async () => {
      const conversation = await request<Conversation>(root, { action: "create" });
      // A newly committed conversation has no messages or operations. Its create
      // response is authoritative; two follow-up history/list reads add no data.
      if (current.current) drafts.current.set(current.current, draft);
      current.current = conversation.id;
      setView({ conversation, messages: [], executions: [], pending: [], hasOlder: false });
      setConversations(rows => [conversation, ...rows.filter(row => row.id !== conversation.id)]);
      setDraft(""); setDeleteReview(false); requestIdentity.current = null;
    });
    input.current?.focus();
  }
  async function send() {
    if (!view || !draft.trim() || speech.active) return;
    await act(async () => {
      const id = view.conversation.id;
      if (!requestIdentity.current || requestIdentity.current.content !== draft || requestIdentity.current.conversation !== id) requestIdentity.current = { content: draft, conversation: id, id: crypto.randomUUID() };
      const next = await request<View>(root, { action: "chat", conversation_id: id, request_id: requestIdentity.current.id, message: draft });
      if (alive.current) { setView(next); setDraft(""); drafts.current.delete(id); requestIdentity.current = null; refreshWorkspace(view, next); }
      setConversations(rows => rows.map(row => row.id === next.conversation.id ? next.conversation : row));
    });
  }
  async function decide(pending: Pending, confirm: boolean) {
    if (!view) return;
    await act(async () => {
      const key = `${pending.id}:${confirm}`;
      if (!decisionIdentity.current.has(key)) decisionIdentity.current.set(key, crypto.randomUUID());
      const next = await request<View>(root, { action: "decide", conversation_id: view.conversation.id, request_id: decisionIdentity.current.get(key), pending_id: pending.id, confirm });
      setView(next); refreshWorkspace(view, next);
    });
  }
  async function removeConversation() {
    if (!view) return;
    await act(async () => {
      await request(root, { action: "delete", conversation_id: view.conversation.id, request_id: crypto.randomUUID(), confirmed: true });
      drafts.current.delete(view.conversation.id); current.current = ""; requestIdentity.current = null;
      setView(undefined); setDraft(""); setDeleteReview(false); await loadList();
    });
  }
  async function reload() {
    await act(async () => {
      if (view) { const next = await request<View>(`${root}?conversation=${encodeURIComponent(view.conversation.id)}`); setView(next); refreshWorkspace(view, next); }
      await loadList();
    });
  }
  async function older() {
    if (!view?.messages.length) return;
    await act(async () => {
      const previous = await request<View>(`${root}?conversation=${encodeURIComponent(view.conversation.id)}&before=${view.messages[0].sequence}`);
      pauseFollow(); setView({ ...view, messages: [...previous.messages, ...view.messages], hasOlder: previous.hasOlder });
    });
  }
  async function recheck(execution: Execution) {
    if (!view) return;
    await act(async () => { const next = await request<View>(root, { action: "reconcile", conversation_id: view.conversation.id, execution_id: execution.id, request_id: crypto.randomUUID() }); setView(next); refreshWorkspace(view, next); });
  }
  const hasProcessing = view?.messages.some(message => message.role === "user" && message.status === "processing");
  useEffect(() => {
    if (!open || !hasProcessing || busy || !view) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await request<View>(`${root}?conversation=${encodeURIComponent(view.conversation.id)}`);
        if (!cancelled && alive.current) { setView(next); refreshWorkspace(view, next); }
      } catch (failure) {
        if (!cancelled && alive.current) setError(failure instanceof Error ? failure.message : "Could not refresh PIP. Use Reload to retry.");
      } finally { if (!cancelled) timer = setTimeout(() => void poll(), 4000); }
    };
    timer = setTimeout(() => void poll(), 4000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, hasProcessing, busy, view, request]);
  return <div className="productivity-assistant" hidden={dialogOpen}>
    <button type="button" className="assistant-launcher" ref={trigger} aria-expanded={open} aria-controls="productivity-assistant-panel" onClick={open ? minimise : show}><PipAvatar/><span>Ask PIP</span></button>
    {open && <section id="productivity-assistant-panel" role="region" aria-label="PIP productivity assistant" className={`assistant-panel ${expanded ? "is-expanded" : ""}`} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); minimise(); } }}>
      <header className="assistant-heading"><PipAvatar/><div><strong>PIP <span className="pip-ai-badge">AI</span></strong><small>Your productivity companion</small></div><button type="button" aria-label="Close PIP" onClick={minimise}><Minus size={18}/></button><button type="button" aria-label={expanded ? "Restore PIP size" : "Expand PIP"} aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}</button></header>
      <div className="assistant-toolbar"><label className="sr-only" htmlFor="assistant-conversation">Conversation</label><select id="assistant-conversation" value={view?.conversation.id || ""} disabled={busy} onChange={event => void act(() => select(event.target.value))}><option value="" disabled>Choose a conversation</option>{conversations.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select><button type="button" disabled={busy} onClick={() => void newConversation()} aria-label="New conversation"><Plus size={18}/></button><button type="button" disabled={busy} onClick={() => void reload()} aria-label="Reload conversation"><RefreshCw size={16}/></button><button type="button" disabled={busy || !view || hasProcessing} onClick={() => setDeleteReview(true)} aria-label="Delete conversation"><Trash2 size={16}/></button></div>
      {deleteReview && <div className="assistant-proposal" role="group" aria-label="Confirm conversation deletion"><strong>Delete this conversation and its messages?</strong><p>Saved tasks, habits, and events will stay in your workspace. Unconfirmed proposals in this chat will be removed.</p><div className="assistant-actions"><button type="button" disabled={busy} onClick={() => void removeConversation()}>Delete conversation</button><button type="button" disabled={busy} onClick={() => setDeleteReview(false)}>Keep conversation</button></div></div>}
      {moreConversations && <button type="button" disabled={busy} onClick={() => void olderConversations()}>Load older conversations</button>}
      <div className="assistant-messages" ref={messageLogRef} tabIndex={0} aria-label="Conversation messages" aria-busy={busy}>
        {(!view || !view.messages.length) && <div className="assistant-welcome"><PipAvatar/><h2>Hi{studentName ? `, ${studentName.split(" ")[0]}` : " there"}! <span aria-hidden>👋</span></h2><p>I’m PIP. Tell me what you’d like to get done. I can help with your tasks, habits, schedule and study buddies.</p><small>Plans become changes only when your workspace confirms they’re saved.</small>{!view && <button type="button" disabled={busy} onClick={() => void newConversation()}>Start a conversation</button>}</div>}
        {view?.hasOlder && <button type="button" disabled={busy} onClick={() => void older()}>Load earlier messages</button>}
        {view?.messages.map(message => <article key={message.id} className={`assistant-message assistant-message-${message.role}`}><strong>{message.role === "user" ? "You" : <><PipAvatar/> PIP</>}</strong>{message.role === "user" ? <p>{message.content}</p> : <PipMarkdown text={message.content}/>}{message.status !== "completed" && <small>{labels[message.status] || message.status}</small>}</article>)}
        {view?.pending.map(pending => <article className="assistant-proposal" key={pending.id}><strong>Review proposed action</strong><p>{proposalLabel(pending.preview.tool, pending.preview.arguments)}</p><Proposal args={pending.preview.arguments} current={pending.preview.current}/><p><small>{pending.expired ? "This proposal expired. Cancel it and request a new one." : `Expires ${new Date(pending.expiresAt).toLocaleTimeString()}`}</small></p><div className="assistant-actions"><button type="button" disabled={busy || pending.expired || hasProcessing} onClick={() => void decide(pending, true)}>Confirm</button><button type="button" disabled={busy || hasProcessing} onClick={() => void decide(pending, false)}>Cancel</button></div></article>)}
        {!!view?.executions.length && <details className="assistant-executions" key={view.conversation.id}><summary><span className="pip-show-activity">Show</span><span className="pip-hide-activity">Hide</span> activity ({view.executions.length})</summary>{[...view.executions].reverse().map(execution => <article key={execution.id}><strong>{execution.toolName.replaceAll("_", " ")}</strong><p>{labels[execution.status] || execution.status}</p>{execution.error?.error && <p>{execution.error.error}</p>}<RecordLink result={execution.result}/>{["unknown", "pending"].includes(execution.status) && <button type="button" disabled={busy || hasProcessing} onClick={() => void recheck(execution)}>Recheck outcome</button>}</article>)}</details>}
        {(busy || hasProcessing) && <PipWorking/>}
        {hasProcessing && !busy && <p role="status">This message is still processing. Reload to check its result; interrupted turns are recovered after their time limit.</p>}
      </div>
      {scrollPaused && <button type="button" className="assistant-latest" onClick={() => scrollLatest(true)}>Jump to latest</button>}
      <div aria-live="polite" className="assistant-error">{error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => void reload()}>Reload</button></p>}</div>
      <form className="assistant-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor="assistant-draft">Message PIP</label><textarea id="assistant-draft" ref={input} rows={3} maxLength={4000} disabled={busy || !view || hasProcessing} value={draft} onChange={event => speech.edit(event.target.value)} placeholder={view ? "Ask PIP about tasks, habits, schedules or study buddies…" : "Start or choose a conversation"}/>
        <div className="assistant-composer-actions"><VoiceInputControls speech={speech} disabled={busy || !view || !!hasProcessing}/><small>{draft.length}/4,000</small><button type="submit" disabled={busy || !view || !draft.trim() || speech.active || hasProcessing}><Send size={16} aria-hidden/> Send</button></div><VoiceInputStatus speech={speech} recipient="PIP"/>
      </form>
    </section>}
  </div>;
}
function Proposal({ args, current }: { args: Record<string, unknown>; current?: unknown }) {
  const input = args.input && typeof args.input === "object" ? args.input as Record<string, unknown> : args.changes && typeof args.changes === "object" ? args.changes as Record<string, unknown> : args;
  const names: Record<string, string> = { title: "Title", name: "Name", description: "Description", priority: "Priority", dueDate: "Deadline date", dueTime: "Deadline time", type: "Habit type", frequency: "Frequency", weekdays: "Weekdays (0 = Sunday)", time: "Time", end: "End time", startDate: "Starts", endDate: "Ends", mustComplete: "Must complete", archived: "Archive", restore: "Restore", outcome: "Outcome", original_date: "Original date", timezone: "Timezone", academic: "Academic category", clearSchedule: "Remove allocated working time", invitation_url: "Group invitation link", contact_details: "Contact details to share", max_members: "Maximum members (including you)", listing_id: "Buddy listing", application_id: "Application" };
  const slot = (input.scheduledSlot || input.slot || args.slot) as { date?: string; start?: string; end?: string; timezone?: string } | undefined;
  const target = current && typeof current === "object" ? current as Record<string, unknown> : {};
  const record = (target.record || target) as Record<string, unknown>;
  const data = record.data as { title?: string; name?: string; revisions?: { name?: string }[] } | undefined;
  const targetName = data?.title || data?.name || data?.revisions?.at(-1)?.name || (typeof record.title === "string" ? record.title : undefined);
  const application = record.application as { user?: { firstName: string; lastName: string } } | undefined;
  return <dl>{application?.user && <div><dt>Applicant</dt><dd>{application.user.firstName} {application.user.lastName}</dd></div>}{targetName && <div><dt>Record</dt><dd>{targetName}</dd></div>}{Object.entries(input).filter(([key]) => names[key]).map(([key, value]) => <div key={key}><dt>{names[key]}</dt><dd>{typeof value === "boolean" ? value ? "Yes" : "No" : Array.isArray(value) ? value.join(", ") : String(value)}</dd></div>)}{slot && <div><dt>Scheduled slot</dt><dd>{slot.date} · {slot.start}–{slot.end} · {slot.timezone}</dd></div>}{!!(args.scheduling as { allowConflicts?: boolean } | undefined)?.allowConflicts && <div><dt>Time conflict</dt><dd>This proposal explicitly keeps an overlapping time.</dd></div>}</dl>;
}
function RecordLink({ result }: { result: Record<string, unknown> | null }) {
  if (!result) return null;
  const buddy = result.buddy as { id?: string } | undefined;
  if (buddy?.id) return <a href={`#buddy?listing=${encodeURIComponent(buddy.id)}`}>Open buddy listing</a>;
  const task = result.task as { id?: string; title?: string } | undefined, event = result.event as { id?: string; title?: string } | undefined, habit = result.habit as { id?: string } | undefined;
  const id = task?.id || event?.id || habit?.id;
  if (!id) return null;
  const section = task ? "tasks?task=" : event ? "schedule?event=" : "habits?habit=";
  return <a href={`#${section}${encodeURIComponent(id)}`}>Open {task?.title || event?.title || "habit"}</a>;
}

function proposalLabel(tool: string, args: Record<string, unknown>) {
  const buddyLabels: Record<string, string> = { create_buddy_group: "Create a study group listing", create_buddy_request: "Create a buddy request", apply_buddy: "Apply to this buddy listing", accept_buddy_application: "Accept this applicant and share the listing’s private details", decline_buddy_application: "Decline this applicant", close_buddy_listing: "Close this buddy listing to new applications" };
  if (buddyLabels[tool]) return buddyLabels[tool];
  if (tool === "delete_task") return "Delete this task";
  if (tool === "archive_event") return args.restore ? "Restore this event" : "Archive this event";
  if (tool === "archive_habit") return args.archived ? "Archive this habit" : "Restore this habit";
  if (tool === "set_backup") return args.slot ? "Set this backup slot" : "Remove the saved backup slot";
  return tool.replaceAll("_", " ");
}
