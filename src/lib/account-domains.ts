// src/lib/account-domains.ts
//
// The login/signup "local part + account type" email-domain scheme
// (AGENTS.md §8). A user types just the local part of their email (e.g.
// "marvelousifezue31") and picks an account type from a dropdown shown
// alongside it; the two combine into the full address this app actually
// authenticates with (marvelousifezue31@stu.cu.edu.ng).
//
// Shared between src/app/login/page.tsx, src/app/signup/page.tsx (client)
// and src/app/api/register/route.ts (server) so the domain list only
// exists in one place. No secrets here — safe to import from the client.
//
// IMPORTANT — this selector is NOT an authorization mechanism (§8's
// explicit warning, reiterated in §7): picking "HOD" here only changes
// which email address gets constructed/looked up. It never by itself
// grants the HOD role — see src/app/api/register/route.ts for the (single,
// narrowly-gated, dev-only) exception and why every other signup still
// becomes a `student` account regardless of what's picked here.
//
// The HOD domain below looks inconsistent with the others
// ("HODEIE.cu.stu.ng" vs "...cu.edu.ng") — that's not a typo on my part,
// it's exactly what AGENTS.md §8 specifies, and that section explicitly
// says not to silently "fix" it.

export const ACCOUNT_TYPES = [
  { role: "student", label: "Student", domain: "stu.cu.edu.ng" },
  { role: "faculty", label: "Faculty", domain: "faculty.cu.edu.ng" },
  { role: "hod", label: "HOD", domain: "HODEIE.cu.stu.ng" },
  { role: "dapu", label: "DAPU", domain: "DAPU.cu.edu.ng" },
] as const;
// VC and Dean are intentionally NOT selectable: they have no functionality yet
// (docs/elearning/decisions/dean-vc-not-implemented.md), so nobody can sign up or sign in as one.

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountTypeRole = AccountType["role"];

export function getAccountType(role: AccountTypeRole): AccountType {
  return ACCOUNT_TYPES.find((accountType) => accountType.role === role)!;
}

// Builds the full email address from a local part + selected account type,
// e.g. buildEmail("marvelousifezue31", "student") ->
// "marvelousifezue31@stu.cu.edu.ng". Lower-cased, matching how every email
// is stored/compared elsewhere in this app (see src/lib/auth.ts,
// src/app/api/register/route.ts).
export function buildEmail(localPart: string, role: AccountTypeRole): string {
  return `${localPart.trim()}@${getAccountType(role).domain}`.toLowerCase();
}

// The reverse lookup used server-side (src/app/api/register/route.ts) to
// figure out which account type an already-built email's domain matches,
// if any — an arbitrary email (e.g. a Gmail address used for Google
// sign-up) simply won't match anything here, which is fine.
export function accountTypeForEmail(email: string): AccountTypeRole | null {
  const lower = email.trim().toLowerCase();
  const match = ACCOUNT_TYPES.find((accountType) => lower.endsWith(`@${accountType.domain.toLowerCase()}`));
  return match?.role ?? null;
}

// ---------------------------------------------------------------------------
// Server-side checks. The browser shows the same full email, but the server never trusts what it displays:
// it rebuilds the address from the local part + role and re-checks the domain itself.
// ---------------------------------------------------------------------------

// Letters, digits and . _ + - only (what an institutional mailbox local part can sensibly hold); no "@", spaces or
// control characters, so it can't smuggle in a different domain.
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;

export function isValidLocalPart(localPart: string): boolean {
  return LOCAL_PART_RE.test(localPart.trim());
}

// True only when `email` is exactly "<local>@<the domain of that role>" (case-insensitive).
export function isEmailForRole(email: string, role: AccountTypeRole): boolean {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at <= 0) return false;
  return lower.slice(at + 1) === getAccountType(role).domain.toLowerCase() && isValidLocalPart(lower.slice(0, at));
}
