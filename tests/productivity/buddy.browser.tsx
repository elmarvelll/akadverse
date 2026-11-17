import React, { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { BuddySystem } from "../../src/features/productivity/buddy/BuddySystem";
import type { BuddyDetail } from "../../src/features/productivity/buddy/domain";
const invitation = "https://chat.whatsapp.com/Abc123456789";
let owner = false;
const listing: BuddyDetail = { id: "group-1", kind: "GROUP", title: "Calculus Circle", description: "Prepare for MTH exams together", creatorId: "owner", creator: { firstName: "Alex", lastName: "Student" }, status: "OPEN", maxMembers: 3, memberCount: 1, mine: false, application: null, createdAt: "2026-11-17T10:00:00Z", applications: [] };
let membership: BuddyDetail["application"] = null;
window.fetch = async (input, options) => {
  const url = new URL(String(input), location.origin);
  if (options?.method === "POST") return Response.json({ id: listing.id });
  if (options?.method === "PATCH") {
    const body = JSON.parse(String(options.body));
    if (body.action === "apply") membership = "PENDING";
    if (body.action === "accept") { membership = "ACCEPTED"; listing.memberCount = 2; }
    return Response.json({ message: body.action === "apply" ? "Request submitted." : "Application accepted." });
  }
  const card = { ...listing, mine: owner, application: owner ? "ACCEPTED" : membership, pendingCount: membership === "PENDING" ? 1 : 0 };
  if (url.searchParams.has("id")) return Response.json({ ...card, ...(owner || membership === "ACCEPTED" ? { privateDetails: invitation } : {}), applications: owner ? [{ id: "creator", userId: "owner", status: "ACCEPTED", createdAt: listing.createdAt, user: listing.creator }, ...(membership ? [{ id: "application", userId: "applicant", status: membership, createdAt: listing.createdAt, user: { firstName: "Sam", lastName: "Student" } }] : [])] : [] });
  const view = url.searchParams.get("view"), search = url.searchParams.get("search") || "";
  const show = view === "manage" ? owner : view === "joined" ? !owner && membership === "ACCEPTED" : true;
  return Response.json({ items: show && `${listing.title} ${listing.description}`.toLowerCase().includes(search.toLowerCase()) ? [card] : [], hasMore: false });
};
function subscribe(listener: () => void) { window.addEventListener("hashchange", listener); return () => window.removeEventListener("hashchange", listener); }
function Harness() {
  const hash = useSyncExternalStore(subscribe, () => location.hash, () => "");
  const [actor, setActor] = useState(false);
  return <div className="productivity-host"><button id="actor" onClick={() => { owner = !owner; setActor(owner); }}>Switch actor</button><BuddySystem key={String(actor)} active initialId={new URLSearchParams(hash.split("?")[1]).get("listing") || undefined} /></div>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
