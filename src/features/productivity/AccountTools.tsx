"use client";
import { useState } from "react";
import { rpc } from "./client";
import { TASK_STORAGE_KEY } from "./tasks/storage";
import { HABIT_STORAGE_KEY } from "./habits/storage";
import { STORAGE_KEY } from "./schedule/storage";
import type { Student } from "./schedule/domain";

export function AccountTools() {
  const [zone, setZone] = useState(""), [email, setEmail] = useState("");
  const [raw, setRaw] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function prepare() {
    try { const context = await rpc<{ student: Student; email: string }>("context"); setZone(context.student.timezone); setEmail(context.email); }
    catch (e) { setError((e as Error).message); }
  }
  function reviewLocal() {
    try {
      const data = { tasks: JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '{"version":2,"tasks":[]}'),
        habits: JSON.parse(localStorage.getItem(HABIT_STORAGE_KEY) || '{"version":1,"habits":[]}'),
        schedule: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"version":1,"events":[],"schedules":[]}') };
      setRaw(JSON.stringify(data, null, 2)); setConfirmed(false); setError("");
    } catch { setError("Local records could not be read. They remain untouched. You can supply a JSON export below."); }
  }
  let summary = "";
  try { if (raw) { const data = JSON.parse(raw); summary = `${data.tasks?.tasks?.length || 0} tasks, ${data.habits?.habits?.length || 0} habits, ${data.schedule?.events?.length || 0} events, ${data.schedule?.schedules?.length || 0} categories`; } } catch { summary = "Enter a valid JSON export to review."; }
  return <details className="account-tools" onToggle={event => { if (event.currentTarget.open) void prepare(); }}><summary>Account &amp; import</summary><div className="account-tools-panel">
    <p>Signed in as <strong>{email || "Loading account…"}</strong></p>
    <label>Timezone<input value={zone} onChange={event => setZone(event.target.value)} placeholder="Africa/Lagos" /></label>
    <button disabled={busy || !zone} onClick={async () => {
      setBusy(true); setError(""); setNotice("");
      try { await rpc("preferences.save", [zone]); window.location.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    }}>Save timezone</button>
    <h3>Import existing local records</h3><p>Review records from this browser or select a JSON export from the standalone app. Import only your own records. Local originals are always retained. Previously imported records are skipped, preserving edits saved online.</p>
    <button disabled={busy} onClick={reviewLocal}>Review this browser’s local records</button>
    <label>JSON export<input type="file" accept="application/json,.json" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { setError("Choose an export smaller than 2 MB."); return; }
      setRaw(await file.text()); setConfirmed(false); setNotice("");
    }} /></label>
    <label>Review export<textarea rows={5} value={raw} onChange={event => { setRaw(event.target.value); setConfirmed(false); }} /></label>
    {summary && <p>{summary}</p>}
    <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I own these records and want to import them into {email || "this account"}.</label>
    <button disabled={busy || !confirmed || !raw || !email} onClick={async () => {
      if (busy) return; setBusy(true); setError(""); setNotice("");
      try {
        const result = await rpc<{ tasks: number; habits: number; events: number; categories: number; skipped: number }>("import", [JSON.parse(raw), true]);
        await Promise.all([rpc("tasks.list"), rpc("habits.list"), rpc("schedule.load")]);
        setNotice(`Saved ${result.tasks} tasks, ${result.habits} habits, ${result.events} events and ${result.categories} categories. Skipped ${result.skipped} previously imported records. Local originals remain intact.`);
        setConfirmed(false);
      } catch (e) { setError((e as Error).message + " Your local originals remain intact; retrying is safe."); } finally { setBusy(false); }
    }}>{busy ? "Saving…" : "Import into this account"}</button>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div></details>;
}
