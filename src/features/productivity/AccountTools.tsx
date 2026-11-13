"use client";
import { ProductivityError, productivityErrorMessage } from "./errors";
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
    catch (e) { setError(productivityErrorMessage(e, "Account settings could not be loaded or saved. Reload the workspace and try again.")); }
  }
  function reviewLocal() {
    setConfirmed(false); setRaw(""); setNotice("");
    try {
      const data = { tasks: JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || '{"version":2,"tasks":[]}'),
        habits: JSON.parse(localStorage.getItem(HABIT_STORAGE_KEY) || '{"version":1,"habits":[]}'),
        schedule: JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"version":1,"events":[],"schedules":[]}') };
      setRaw(JSON.stringify(data, null, 2)); setConfirmed(false); setError("");
    } catch (error) { setError(error instanceof SyntaxError ? "The browser's saved records contain invalid JSON. Your originals have not been changed. Select a valid standalone JSON export instead." : "The browser blocked access to local records. Allow site storage or select a JSON export instead. Your originals have not been changed."); }
  }
  let summary = "";
  try { if (raw) { const data = JSON.parse(raw); summary = `${data.tasks?.tasks?.length || 0} tasks, ${data.habits?.habits?.length || 0} habits, ${data.schedule?.events?.length || 0} events, ${data.schedule?.schedules?.length || 0} categories`; } } catch { summary = "Enter a valid JSON export to review."; }
  return <details className="account-tools" onToggle={event => { if (event.currentTarget.open) void prepare(); }}><summary>Account &amp; import</summary><div className="account-tools-panel">
    <p>Signed in as <strong>{email || "Loading account…"}</strong></p>
    <label>Timezone<input value={zone} onChange={event => setZone(event.target.value)} placeholder="Africa/Lagos" /></label>
    <button disabled={busy || !zone} onClick={async () => {
      setBusy(true); setError(""); setNotice("");
      try { await rpc("preferences.save", [zone]); window.location.reload(); } catch (e) { setError(productivityErrorMessage(e, "Account settings could not be loaded or saved. Reload the workspace and try again.")); } finally { setBusy(false); }
    }}>Save timezone</button>
    <h3>Import existing local records</h3><p>Review records from this browser or select a JSON export from the standalone app. Import only your own records. Local originals are always retained. Previously imported records are skipped, preserving edits saved online.</p>
    <button disabled={busy} onClick={reviewLocal}>Review this browser’s local records</button>
    <label>JSON export<input type="file" accept="application/json,.json" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; if (!file) return;
      setConfirmed(false); setRaw(""); setNotice(""); setError("");
      if (file.size > 2 * 1024 * 1024) { setError("Choose an export smaller than 2 MB."); return; }
      setBusy(true);
      try { setRaw(await file.text()); }
      catch { setError("The selected file could not be read. Check that it is still available on your device, then select it again. Nothing was imported."); }
      finally { setBusy(false); }
    }} /></label>
    <label>Review export<textarea rows={5} value={raw} onChange={event => { setRaw(event.target.value); setConfirmed(false); }} /></label>
    {summary && <p>{summary}</p>}
    <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I own these records and want to import them into {email || "this account"}.</label>
    <button disabled={busy || !confirmed || !raw || !email} onClick={async () => {
      if (busy) return; setBusy(true); setError(""); setNotice("");
      try {
        let input: unknown;
        try { input = JSON.parse(raw); } catch { throw new ProductivityError("The export is not valid JSON. Select a JSON export from the standalone app or correct the text before importing. Nothing was imported."); }
        const result = await rpc<{ tasks: number; habits: number; events: number; categories: number; skipped: number }>("import", [input, true]);
        setNotice(`Saved ${result.tasks} tasks, ${result.habits} habits, ${result.events} events and ${result.categories} categories. Skipped ${result.skipped} previously imported records. Local originals remain intact.`);
        setConfirmed(false);
        try { await Promise.all([rpc("tasks.list"), rpc("habits.list"), rpc("schedule.load")]); }
        catch (error) { setError(`Your import was saved, but the updated records could not be refreshed. ${productivityErrorMessage(error)} Reload the workspace; you do not need to import again.`); }
      } catch (e) { setError(productivityErrorMessage(e, "The import could not be completed. Reload the workspace and retry the same import.") + " Your local originals remain intact."); } finally { setBusy(false); }
    }}>{busy ? "Saving…" : "Import into this account"}</button>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div></details>;
}
