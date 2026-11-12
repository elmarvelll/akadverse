"use client";

// A submit button that asks for confirmation first (used for bulk actions like Approve All). Once confirmed it shows the
// same pending state as SubmitButton, so the bulk action can't be triggered twice.

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export default function ConfirmSubmitButton({ message, className = "", disabled, children }: { message: string; className?: string; disabled?: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}
      onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}
    >
      {pending ? <span className="inline-flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin shrink-0" aria-hidden /><span>{children}</span></span> : children}
    </button>
  );
}
