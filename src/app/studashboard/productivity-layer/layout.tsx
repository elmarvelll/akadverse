import type { ReactNode } from "react";
import "@/features/productivity/styles.css";

export const metadata = { title: "Productivity Layer | AkadVerse" };
export default function ProductivityLayout({ children }: { children: ReactNode }) {
  return <div className="productivity-host">{children}</div>;
}
