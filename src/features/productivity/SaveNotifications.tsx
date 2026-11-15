"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { saveNotifications, type SaveNotification } from "./notifications";

const empty: SaveNotification[] = [];
function Notification({ row }: { row: SaveNotification }) {
  useEffect(() => () => {
    saveNotifications.resume(row.id, "hover"); saveNotifications.resume(row.id, "focus");
  }, [row.id]);
  return <div className={`productivity-save-notification ${row.state === "error" ? "error" : row.state === "success" ? "success" : "notice"}`}
    onMouseEnter={() => saveNotifications.pause(row.id, "hover")} onMouseLeave={() => saveNotifications.resume(row.id, "hover")}
    onFocusCapture={() => saveNotifications.pause(row.id, "focus")} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) saveNotifications.resume(row.id, "focus"); }}>
    <span role={row.state === "error" ? "alert" : "status"} aria-atomic="true">{row.message}</span>
    <button type="button" aria-label="Dismiss notification" onClick={() => saveNotifications.dismiss(row.id)}>×</button>
  </div>;
}
export function SaveNotificationRegion() {
  const rows = useSyncExternalStore(saveNotifications.subscribe, saveNotifications.snapshot, () => empty);
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Native modal dialogs make the page inert. Keep announcements and close controls
    // inside the active dialog's top layer, rather than behind its backdrop.
    const update = () => setDialog(document.querySelector<HTMLElement>(".productivity-host dialog[open] [data-productivity-notifications]"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);
  const region = <section className="productivity-save-notifications" aria-label="Save notifications">{rows.map(row => <Notification key={row.id} row={row}/>)}</section>;
  return dialog ? createPortal(region, dialog) : region;
}
