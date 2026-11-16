"use client";
import { ArrowDown } from "lucide-react";
export function JumpToLatest({ onClick, label = "Jump to latest transcription", className = "" }: { onClick: () => void; label?: string; className?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50 active:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className}`}><ArrowDown size={16} aria-hidden /></button>;
}
