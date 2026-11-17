// Isolated browser fixtures, never an application route. No provider/database traffic.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AssistantPanel } from "../../src/features/productivity/assistant/AssistantPanel";
import { setProductivityAccount } from "../../src/features/productivity/client";
type Fixture = { id: string; title: string; messages: object[]; executions: object[]; pending: object[] };
const records = new Map<string, Fixture[]>(), requests: object[] = [];
let next = 0;
window.fetch = async (url, options = {}) => {
  const owner = new Headers(options.headers).get("x-productivity-user") || "", rows = records.get(owner) || [];
  records.set(owner, rows);
  const data = options.body ? JSON.parse(String(options.body)) : undefined;
  requests.push({ owner, data, url: String(url) });
  const parsed = new URL(String(url), location.origin), cid = data?.conversation_id || parsed.searchParams.get("conversation");
  const fixture = rows.find(row => row.id === cid);
  const view = () => ({ conversation: { id: fixture!.id, title: fixture!.title }, messages: fixture!.messages, executions: fixture!.executions, pending: fixture!.pending, hasOlder: false });
  if (!data) return Response.json({ result: cid ? view() : rows.map(row => ({ id: row.id, title: row.title })) });
  if (data.action === "create") {
    const row = { id: `conversation-${++next}`, title: "New conversation", messages: [], executions: [], pending: [] }; rows.push(row); return Response.json({ result: row });
  }
  if (data.action === "chat") {
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 450); options.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("aborted", "AbortError")); }); });
    const count = fixture!.messages.length;
    fixture!.messages.push({ id: `user-${count}`, sequence: count, role: "user", content: data.message, status: "completed" });
    if (data.message.includes("delete")) {
      fixture!.pending = [{ id: "pending-0001", expiresAt: new Date(Date.now() + 600000).toISOString(), expired: false, preview: { tool: "delete_task", arguments: { task_id: "task-0001" }, current: { data: { title: "Test reading" } } } }];
      fixture!.messages.push({ id: `reply-${count}`, sequence: count + 1, role: "assistant", content: "Review the proposed deletion.", status: "awaiting_confirmation" });
    } else {
      fixture!.messages.push({ id: `reply-${count}`, sequence: count + 1, role: "assistant", content: `Saved for ${owner}: ${data.message}\n\n## Your plan\n\n- **Study** at 09:00\n- Review notes\n\n[Unsafe](javascript:alert)\n\n<script>alert(1)</script>`, status: "completed" });
      fixture!.executions = [{ id: "execution-1", messageId: `user-${count}`, toolName: "create_task", status: "completed", result: { saved: true, task: { id: "task-0001", title: "Test reading" } }, error: null }];
    }
  }
  if (data.action === "decide") { fixture!.pending = []; fixture!.messages.push({ id: "decision-1", sequence: fixture!.messages.length, role: "assistant", content: data.confirm ? "Confirmed action saved." : "Proposal cancelled.", status: "completed" }); }
  return Response.json({ result: view() });
};
function Harness() {
  const [owner, setOwner] = useState("student-A");
  return <div className="productivity-host"><button id="switch-account" onClick={() => { setProductivityAccount("student-B"); setOwner("student-B"); }}>Switch account</button><button id="open-dialog" onClick={() => (document.getElementById("test-dialog") as HTMLDialogElement).showModal()}>Open dialog</button><dialog id="test-dialog"><button onClick={() => (document.getElementById("test-dialog") as HTMLDialogElement).close()}>Close dialog</button></dialog><AssistantPanel key={owner} ownerId={owner}/></div>;
}
Object.assign(window, { assistantTest: { requests, setDraft(text: string) { const node = document.getElementById("assistant-draft") as HTMLTextAreaElement; const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!; setter.call(node, text); node.dispatchEvent(new Event("input", { bubbles: true })); } } });
createRoot(document.getElementById("root")!).render(<Harness/>);
