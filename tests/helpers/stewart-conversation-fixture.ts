// In-memory conversation HTTP fixture for UI-only browser scripts. Real DB coverage lives in stewart-conversations.test.ts.
import { conversationTitle, temporaryConversationTitle } from "../../services/e-learning/student/stewart/conversation-title";
interface FixtureMessage { id: string; requestId: string; role: "USER" | "ASSISTANT"; status: string; content: string; createdAt: string; metadata?: unknown }
interface FixtureConversation { id: string; clientKey: string; title: string; createdAt: string; updatedAt: string; courseId: string; courseCode: string; weekNumber: number; documentId: string | null; documentTitle: string | null; messages: FixtureMessage[] }
export function conversationFixture() {
  const chats = new Map<string, FixtureConversation>();
  let sequence = 0;
  const summary = (c: FixtureConversation) => ({ ...c, messages: undefined, clientKey: undefined });
  const parse = (bytes: Buffer) => bytes.length ? JSON.parse(bytes.toString()) : {};
  function handle(path: string, method: string | undefined, bytes: Buffer) {
    if (!path.includes("/stewart/conversations")) return;
    if (path.endsWith("/conversations")) {
      if (method === "GET") return { status: 200, body: { conversations: [...chats.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summary), nextCursor: null } };
      if (method === "POST") {
        const body = parse(bytes);
        const existing = [...chats.values()].find((c) => c.clientKey === body.clientKey);
        if (existing) return { status: 201, body: { conversation: summary(existing) } };
        const now = new Date().toISOString(); const id = `fixture-conversation-${++sequence}`;
        const c: FixtureConversation = { id, clientKey: body.clientKey, title: temporaryConversationTitle(body.message), createdAt: now, updatedAt: now, courseId: body.courseId, courseCode: body.courseCode ?? "ENG 101", weekNumber: body.weekNumber, documentId: body.documentId ?? null, documentTitle: body.documentTitle ?? null, messages: [{ id: `${id}-first`, requestId: body.requestId, role: "USER", status: "FAILED", content: body.message, createdAt: now }] };
        chats.set(id, c); return { status: 201, body: { conversation: summary(c) } };
      }
    }
    const id = path.split("/conversations/")[1]?.split("/")[0]; const c = id ? chats.get(id) : undefined;
    if (!path.endsWith("/messages")) {
      if (!c) return { status: 404, body: { error: "Conversation not found." } };
      if (method === "DELETE") { chats.delete(c.id); return { status: 200, body: { deleted: true } }; }
      return { status: 200, body: { conversation: summary(c), messages: c.messages, nextCursor: null, attachments: [] } };
    }
  }
  function begin(path: string, body: Record<string, unknown>) {
    if (!path.endsWith("/messages")) return body;
    const id = path.split("/conversations/")[1]?.split("/")[0]; const c = chats.get(id);
    if (c && !c.messages.some((m) => m.requestId === body.requestId && m.role === "USER")) c.messages.push({ id: `${id}-${body.requestId}`, requestId: body.requestId as string, role: "USER", status: "FAILED", content: body.content as string, createdAt: new Date().toISOString() });
    return { ...body, messages: [{ role: "student", text: body.content }] };
  }
  function finish(path: string, body: Record<string, unknown>, response: Record<string, unknown>) {
    const id = path.split("/conversations/")[1]?.split("/")[0]; const c = chats.get(id);
    if (!c || typeof response.reply !== "string") return response;
    const user = c.messages.find((m) => m.requestId === body.requestId && m.role === "USER")!; user.status = "COMPLETE";
    let assistant = c.messages.find((m) => m.requestId === body.requestId && m.role === "ASSISTANT");
    if (!assistant) { assistant = { id: `${id}-${body.requestId}-answer`, requestId: body.requestId as string, role: "ASSISTANT", status: "COMPLETE", content: response.reply, createdAt: new Date().toISOString(), metadata: { sources: response.sources, grounded: body.grounded } }; c.messages.push(assistant); }
    c.updatedAt = new Date().toISOString(); c.title = conversationTitle(c.messages[0].content, response.reply);
    return { ...response, userMessage: user, assistantMessage: assistant, conversation: summary(c) };
  }
  return { handle, begin, finish };
}
