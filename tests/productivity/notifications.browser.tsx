import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { SaveNotificationRegion } from "../../src/features/productivity/SaveNotifications";
import { saveNotifications } from "../../src/features/productivity/notifications";
import { ProductivityError } from "../../src/features/productivity/errors";

declare global { interface Window { toastTest: { start: () => void; succeed: () => void; fail: () => void; rerender: () => void; clear: () => void } } }
let resolve: () => void, reject: (error: Error) => void;
function App() {
  const [count, setCount] = useState(0);
  useEffect(() => { window.toastTest = {
    start: () => { void saveNotifications.run("browser-action", () => new Promise<void>((done, fail) => { resolve = done; reject = fail; }), "Saved successfully.").catch(() => {}); },
    succeed: () => resolve(), fail: () => reject(new ProductivityError("Save failed. Retry the same action.")),
    rerender: () => setCount(value => value + 1), clear: () => saveNotifications.clear(),
  }; }, []);
  return <div className="productivity-host"><div className="productivity-workspace"><SaveNotificationRegion/><button id="outside">Outside control {count}</button><dialog id="test-dialog"><h2>Save dialog</h2><div data-productivity-notifications/><button id="dialog-control">Dialog control</button></dialog></div></div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
