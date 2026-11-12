// src/app/components/email-domain-input.tsx
//
// SIGN-UP email field (AGENTS.md §8). The person types only the part before the "@"; the domain after it is FIXED and
// comes from the Role chosen in the separate Role field (Student -> stu.cu.edu.ng, etc. — see
// src/lib/account-domains.ts). It is shown as plain, non-editable text attached to the input, and the complete resulting
// address is displayed underneath so it is always obvious what will be used. The server rebuilds and re-checks the
// address itself; this component only displays it. (Login does NOT use this: it accepts any email.)

"use client";

import { Mail } from "lucide-react";
import { getAccountType, type AccountTypeRole } from "@/lib/account-domains";

interface EmailDomainInputProps {
  localPart: string;
  onLocalPartChange: (value: string) => void;
  // The selected role decides the domain.
  accountType: AccountTypeRole;
  isDarkMode: boolean;
}

export function EmailDomainInput({ localPart, onLocalPartChange, accountType, isDarkMode }: EmailDomainInputProps) {
  const domain = getAccountType(accountType).domain.toLowerCase();
  const inputClasses = isDarkMode
    ? "bg-[#171717] border-[#262626] text-white placeholder-[#a3a3a3]"
    : "bg-white border-gray-300 text-gray-900 placeholder-gray-500";

  return (
    <div>
      <div className={`flex rounded-2xl border overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition ${inputClasses}`}>
        <div className="relative flex-1 min-w-0">
          <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? "text-[#a3a3a3]" : "text-gray-500"}`} size={20} />
          <input
            id="su-email"
            type="text"
            placeholder="Email"
            value={localPart}
            onChange={(e) => onLocalPartChange(e.target.value)}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="su-email-domain"
            className="w-full pl-12 pr-2 py-3 bg-transparent focus:outline-none text-base sm:text-sm"
          />
        </div>
        <span
          id="su-email-domain"
          data-testid="email-domain"
          title="The domain is set by your role"
          className={`shrink-0 flex items-center border-l px-3 text-base sm:text-sm font-medium select-none ${
            isDarkMode ? "border-[#262626] bg-[#1f1f1f] text-[#e5e5e5]" : "border-gray-300 bg-gray-50 text-gray-900"
          }`}
        >
          @{domain}
        </span>
      </div>
      {localPart.trim() ? (
        // The complete address — deliberately prominent (not a small caption): it is exactly what will be used.
        <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isDarkMode ? "bg-blue-500/15 text-blue-200" : "bg-blue-50 text-blue-800"}`}>
          <Mail size={15} className="shrink-0" />
          <span className="min-w-0 break-all" data-testid="full-email">{localPart.trim()}@{domain}</span>
        </div>
      ) : (
        <p className={`mt-1.5 text-xs ${isDarkMode ? "text-[#a3a3a3]" : "text-gray-600"}`}>
          Type the part before the @ — the domain is set by the role you choose above.
        </p>
      )}
    </div>
  );
}
