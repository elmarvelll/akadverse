export type BuddyKind = "GROUP" | "REQUEST";
export type ApplicationStatus = "PENDING" | "ACCEPTED" | "DECLINED";
export interface BuddyCard {
  id: string; kind: BuddyKind; title: string; description: string; creatorId: string;
  creator: { firstName: string; lastName: string }; status: "OPEN" | "FULL" | "MATCHED" | "CLOSED";
  maxMembers: number | null; createdAt: string; memberCount: number; pendingCount?: number;
  mine: boolean; application: ApplicationStatus | null;
}
export interface BuddyDetail extends BuddyCard {
  privateDetails?: string | null;
  applications: { id: string; userId: string; status: ApplicationStatus; createdAt: string; user: { firstName: string; lastName: string }; contactDetails?: string | null }[];
}
export function inviteUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    const whatsapp = url.hostname === "chat.whatsapp.com" && /^\/[A-Za-z0-9_-]{10,100}\/?$/.test(url.pathname) && [...url.searchParams.keys()].every(key => key === "mode");
    const telegram = ["t.me", "telegram.me"].includes(url.hostname) && /^\/(?:\+|joinchat\/)[A-Za-z0-9_-]{5,150}\/?$/.test(url.pathname) && !url.search;
    return whatsapp || telegram ? url.toString() : null;
  } catch { return null; }
}
export function capacity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) throw new Error("Maximum members must be a positive whole number, or empty for unlimited.");
  return number;
}
export function canAccept(status: string, count: number, maximum: number | null) {
  return status === "OPEN" && (maximum === null || count < maximum);
}
