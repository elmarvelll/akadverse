import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Shell from "@/app/e-learning/_components/Shell";
import ClassroomStuwart from "@/app/e-learning/_components/classroom/ClassroomStuwart";
import { useFollowLatest } from "@/app/components/scroll/useFollowLatest";
import { JumpToLatest } from "@/app/components/scroll/JumpToLatest";
import { usePathname } from "./runtime.browser";
const requests: unknown[] = [];
let saved: unknown[] = []; let failed = false;
Object.assign(window, { platformTest: { requests, fail: () => { failed = true; } } });
window.fetch = async (_input, init) => {
  if (!init?.method || init.method === "GET") return Response.json({ lesson: { topic: "Newton's laws", week: 3, version: 1, documentId: null }, messages: saved });
  const body = JSON.parse(String(init.body)); requests.push(body);
  if (failed) { failed = false; return Response.json({ error: "Stuart is temporarily unavailable. Your class is still live." }, { status: 503 }); }
  saved = [...saved, { id: `${body.requestId}-u`, role: "USER", content: body.question }, { id: `${body.requestId}-a`, role: "ASSISTANT", content: "Force equals mass times acceleration." }];
  return Response.json({ answer: "Force equals mass times acceleration.", messageId: `${body.requestId}-a`, sources: [] });
};
function App() {
  const path = usePathname(); const [text, setText] = useState("Transcript line\n".repeat(90)); const follow = useFollowLatest<HTMLTextAreaElement>("test-transcript");
  return <Shell role="student" name="Test student" isLevelAdviser={false}>
    <h1>{path === "/e-learning/student/dashboard" ? "Student dashboard fixture" : "Live classroom fixture"}</h1>
    <div data-testid="class-video" className="h-64 bg-gray-200">Classroom video remains visible<button type="button" onClick={e => e.currentTarget.textContent = "Video control works"}>Video control</button></div>
    <div className="relative mt-4 w-80"><textarea aria-label="Transcription test" ref={follow.ref} value={text} readOnly className="h-24 w-full" />{follow.paused && <JumpToLatest onClick={() => follow.follow(true)} className="absolute bottom-2 right-2" />}</div>
    <button id="append" onClick={() => setText(t => t + "New transcript line\n".repeat(20))}>Append transcription</button>
    <ClassroomStuwart sessionId="fixture" lesson={{ topic: "Newton's laws", week: 3, version: 1, documentId: null }} />
  </Shell>;
}
createRoot(document.getElementById("root")!).render(<App />);
