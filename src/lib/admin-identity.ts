// src/lib/admin-identity.ts
//
// The one place that decides "this email belongs to the platform admin":
// the COMPLETE local-part (text before the final "@") must equal
// ADMIN_EMAIL_LOCAL_PART, compared case-insensitively. No domain is pinned, and
// a local-part that merely contains the text (e.g. "not-marvelousifezue31")
// does not match. Server-side only — callers pass the email stored on the
// authenticated user/JWT, never a client-supplied claim.
//
// Admin access itself is still `User.isAdmin` (see src/lib/admin.ts); this
// helper only feeds that existing flag, so nothing else about roles changes and
// the account keeps its portal `role` (student/faculty/hod/dapu…).

export const ADMIN_EMAIL_LOCAL_PART = "marvelousifezue31";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false; // needs both a local part and a domain
  return normalized.slice(0, at) === ADMIN_EMAIL_LOCAL_PART;
}
