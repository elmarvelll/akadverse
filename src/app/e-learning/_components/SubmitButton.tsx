"use client";

// Submit button for forms that call a Server Action. While that request runs it is disabled (so a double click can't
// submit twice) and shows a spinner beside its own label — or `pendingLabel` if given. It reads the status of the form
// it sits in (React's useFormStatus), so it works unchanged inside server-rendered pages. It does nothing for plain
// GET filter forms, which navigate instead (their loading state is the route's loading.tsx).

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export default function SubmitButton({
  children,
  pendingLabel,
  className = "",
  disabled,
  ...rest
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending} className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
          <span>{pendingLabel ?? children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
