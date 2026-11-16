import { useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "@/app/studashboard/marketplace/page";
import Checkout from "@/app/studashboard/marketplace/checkout/page";
import { NotificationProvider } from "@/app/studashboard/marketplace/_components/NotificationProvider";
import { state } from "./runtime";
declare global { interface Window { marketplaceTest: typeof state } }
window.marketplaceTest = state;
window.alert = text => { state.alerts.push(String(text)); };
window.PaystackPop = { setup: options => ({ openIframe: () => { state.popupAmounts.push(options.amount); options.callback?.({ reference: options.ref }); } }) };
window.EventSource = class { addEventListener() {} close() {} } as unknown as typeof EventSource;
function App() {
  const [mode, setMode] = useState("home"); state.show = setMode;
  return <NotificationProvider>{mode === "home" ? <Home /> : <Checkout />}</NotificationProvider>;
}
createRoot(document.getElementById("root")!).render(<App />);
