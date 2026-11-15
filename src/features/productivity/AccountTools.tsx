"use client";
import { productivityErrorMessage } from "./errors";
import { useState } from "react";
import { rpc } from "./client";
import type { Student } from "./schedule/domain";

export function AccountTools() {
  const [zone, setZone] = useState(""), [email, setEmail] = useState("");
  const [zones, setZones] = useState<string[]>([]), [deviceZone, setDeviceZone] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function prepare() {
    try {
      const context = await rpc<{ student: Student; email: string }>("context");
      const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") || ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
      setZones([...new Set([...supported, context.student.timezone, device, "UTC"])].filter(Boolean).sort());
      setDeviceZone(device); setZone(context.student.timezone); setEmail(context.email); setError("");
    }
    catch (e) { setError(productivityErrorMessage(e, "Account settings could not be loaded or saved. Reload the workspace and try again.")); }
  }
  const label = (value: string) => value.replaceAll("_", " ").replaceAll("/", " / ");
  return <details className="account-tools" onToggle={event => { if (event.currentTarget.open) void prepare(); }}><summary>Account settings</summary><div className="account-tools-panel">
    <p>Signed in as <strong>{email || "Loading account…"}</strong></p>
    <label>Timezone<select value={zone} disabled={busy || !zone} onChange={event => setZone(event.target.value)}>
      {!zone && <option value="">Loading timezones...</option>}
      {zones.includes(deviceZone) && <optgroup label="Suggested"><option value={deviceZone}>{label(deviceZone)} (device timezone)</option></optgroup>}
      <optgroup label="Timezones">{zones.filter(value => value !== deviceZone).map(value => <option key={value} value={value}>{label(value)}</option>)}</optgroup>
    </select></label>
    <button disabled={busy || !zone} onClick={async () => {
      setBusy(true); setError("");
      try { await rpc("preferences.save", [zone]); } catch (e) { setError(productivityErrorMessage(e, "Account settings could not be loaded or saved. Reload the workspace and try again.")); } finally { setBusy(false); }
    }}>Save timezone</button>
    {error && <p className="error" role="alert">{error}</p>}
  </div></details>;
}
