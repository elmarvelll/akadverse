import type { ButtonHTMLAttributes, ReactNode } from "react";

// Native, accessible adaptations of the export's ProdButton and StatusPill.
// Visual source: figma-reference/.../productivity/components.tsx.
export function ProdButton({ variant = "primary", children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; children: ReactNode }) {
  return <button type="button" {...props} className={`prod-button prod-${variant} ${className}`}>{children}</button>;
}
export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "green" | "red" | "amber" }) {
  return <span className={`prod-pill pill-${tone}`}>{children}</span>;
}
export type IconName = "today" | "calendar" | "task" | "habit" | "menu" | "arrow" | "education" | "clock" | "plus" | "pencil";
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    pencil: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></>,
    today: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2m4 0h2"/></>,
    task: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/></>,
    habit: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM20 16v6m-3-3h6M3 2v4M1 4h4"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>, arrow: <path d="m9 5 7 7-7 7"/>,
    education: <><path d="m2 9 10-5 10 5-10 5-10-5Zm4 2v6c4 3 8 3 12 0v-6M22 9v8"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg className={`prod-icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
