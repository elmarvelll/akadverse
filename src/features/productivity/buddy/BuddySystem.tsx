"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Users, Search, Plus, ArrowLeft, ExternalLink, RefreshCw, UserRound, Check, Clock } from "lucide-react";
import { ProdButton, StatusPill } from "../workspace/Design";
import { capacity, inviteUrl, type BuddyCard, type BuddyDetail, type BuddyKind } from "./domain";
import styles from "./buddy.module.css";

const endpoint = "/api/productivity/buddy";
async function api<T>(query: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint + query, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to complete this action. Please retry.");
  return data;
}
const person = (value: { firstName: string; lastName: string }) => `${value.firstName} ${value.lastName}`.trim();
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const tabs = [{ id: "discover", label: "Discover" }, { id: "requests", label: "Buddy Requests" }, { id: "groups", label: "Buddy Groups" }, { id: "my", label: "My Groups" }, { id: "activity", label: "My Requests & Applications" }];

function ListingCard({ item, open }: { item: BuddyCard; open: () => void }) {
  return <article className={styles.card}>
    <div className={styles.cardTop}><span className={styles.symbol}>{item.kind === "GROUP" ? <Users size={20} /> : <UserRound size={20} />}</span><StatusPill tone={item.status === "OPEN" ? "green" : "neutral"}>{label(item.status)}</StatusPill></div>
    <span className={styles.eyebrow}>{item.kind === "GROUP" ? "STUDY COMMUNITY" : "ACCOUNTABILITY PARTNER"}</span>
    <h2>{item.title}</h2><p className={styles.description}>{item.description}</p>
    <p className={styles.meta}>By {person(item.creator)} · {date(item.createdAt)}</p>
    {item.kind === "GROUP" && <><p className={styles.members}><Users size={15} /> {item.memberCount}{item.maxMembers === null ? " members · Unlimited" : ` / ${item.maxMembers} members`}</p>{item.maxMembers !== null && <meter className={styles.meter} aria-label="Group capacity" min={0} max={item.maxMembers} value={item.memberCount} />}</>}
    {item.mine && !!item.pendingCount && <p className={styles.pending}><Clock size={14} />{item.pendingCount} pending requests</p>}
    {item.application && !item.mine && <p className={styles.meta}>My application: {label(item.application)}</p>}
    <ProdButton variant="secondary" onClick={open}>{item.mine ? item.kind === "GROUP" ? "Manage Group" : "Manage Request" : item.application === "ACCEPTED" ? "View " + (item.kind === "GROUP" ? "Group" : "Buddy") : item.application ? label(item.application) + " · View details" : item.status !== "OPEN" ? label(item.status) + " · View details" : item.kind === "GROUP" ? "Request to Join" : "I'm Interested"}</ProdButton>
  </article>;
}

function CreateForm({ busy, submit, cancel, initialKind }: { initialKind: BuddyKind; busy: boolean; submit: (input: Record<string, unknown>) => Promise<void>; cancel: () => void }) {
  const [kind, setKind] = useState<BuddyKind>(initialKind), [error, setError] = useState("");
  const form = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (kind === "GROUP") { if (!inviteUrl(String(data.privateDetails))) throw new Error("Enter a valid WhatsApp or Telegram HTTPS invitation link."); capacity(data.maxMembers); }
      await submit({ ...data, kind });
    } catch (failure) { setError((failure as Error).message); }
  };
  return <section className={styles.panel} aria-labelledby="buddy-create-title"><h2 id="buddy-create-title">Create {kind === "GROUP" ? "a study group" : "a buddy request"}</h2><p>Bring the right people together for your next goal.</p>
    <form onSubmit={form} className={styles.form}>
      <label>Listing type<select value={kind} disabled={busy} onChange={e => setKind(e.target.value as BuddyKind)}><option value="GROUP">Buddy Group</option><option value="REQUEST">Buddy Request</option></select></label>
      <label>Title<input name="title" required maxLength={160} placeholder={kind === "GROUP" ? "e.g. MTH 201 Study Circle" : "e.g. Looking for a revision partner"} /></label>
      <label>Description<textarea name="description" required maxLength={4000} rows={4} placeholder="What are you working towards, and what should others expect?" /></label>
      <label>{kind === "GROUP" ? "Group invitation link" : "Your contact details"}<input key={kind} name="privateDetails" type={kind === "GROUP" ? "url" : "text"} required maxLength={2000} placeholder={kind === "GROUP" ? "https://chat.whatsapp.com/… or https://t.me/+…" : "How your accepted buddy can reach you"} /><small>{kind === "GROUP" ? "Only you and approved members can access this link." : "Only you and your accepted buddy can see your contact details."}</small></label>
      {kind === "GROUP" && <label>Maximum members <span className={styles.optional}>(optional)</span><input name="maxMembers" type="number" min={1} max={2147483647} step={1} placeholder="Unlimited" /><small>You count as the first member. Leave empty for unlimited members.</small></label>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}><ProdButton type="submit" disabled={busy}>{busy ? "Creating…" : "Create " + (kind === "GROUP" ? "Group" : "Request")}</ProdButton><ProdButton variant="ghost" disabled={busy} onClick={cancel}>Cancel</ProdButton></div>
    </form></section>;
}

function Detail({ item, busy, act }: { item: BuddyDetail; busy: boolean; act: (action: string, extra?: Record<string, string>) => Promise<void> }) {
  const [contact, setContact] = useState("");
  const group = item.kind === "GROUP", authorized = item.mine || item.application === "ACCEPTED";
  const safeLink = group && item.privateDetails ? inviteUrl(item.privateDetails) : null;
  const pending = item.applications.filter(a => a.status === "PENDING"), members = item.applications.filter(a => a.status === "ACCEPTED");
  return <>
    <section className={styles.panel}>
      <div className={styles.cardTop}><span className={styles.eyebrow}>{group ? "BUDDY GROUP" : "BUDDY REQUEST"}</span><StatusPill tone={item.status === "OPEN" ? "green" : "neutral"}>{label(item.status)}</StatusPill></div>
      <h2 className={styles.detailTitle}>{item.title}</h2><p className={styles.fullDescription}>{item.description}</p><p className={styles.meta}>Created by {person(item.creator)} · {date(item.createdAt)}</p>
      {group && <div className={styles.stats}><span><strong>{item.memberCount}</strong>Approved members</span><span><strong>{item.maxMembers ?? "Unlimited"}</strong>Member limit</span><span><strong>{item.maxMembers === null ? "Unlimited" : Math.max(0, item.maxMembers - item.memberCount)}</strong>Available spaces</span>{item.mine && <span><strong>{pending.length}</strong>Pending requests</span>}</div>}
      {item.application && !item.mine && <p className={styles.notice}><Check size={16} />My application: {label(item.application)}{item.application === "PENDING" && ". Your request is pending approval."}</p>}
      {authorized && (group ? safeLink ? <div className={styles.access}><h3>{safeLink.includes("whatsapp.com") ? "WhatsApp" : "Telegram"} group access</h3><p>Approval gives you access to the invitation. Use it to join the external chat; AkadVerse does not add you automatically.</p><a className={styles.chatLink} href={safeLink} target="_blank" rel="noopener noreferrer">Join Group Chat <ExternalLink size={16} /></a></div> : <p role="status" className={styles.notice}>A valid invitation link is unavailable. Contact the group creator.</p> : <div className={styles.access}><h3>{item.mine ? "Your private contact details" : "Your buddy's contact details"}</h3><p className={styles.fullDescription}>{item.privateDetails}</p>{item.mine && members.map(a => <p key={a.id}>{person(a.user)}: {a.contactDetails}</p>)}</div>)}
      {!item.mine && !item.application && item.status === "OPEN" && <form className={styles.form} onSubmit={e => { e.preventDefault(); void act("apply", group ? {} : { contactDetails: contact }); }}><p>{group ? "The creator must approve your request before you receive the group invitation link." : "Share your contact details with the creator only if they accept you as their buddy."}</p>{!group && <label>Your contact details<input required maxLength={2000} value={contact} onChange={e => setContact(e.target.value)} /></label>}<ProdButton type="submit" disabled={busy}>{busy ? "Submitting…" : group ? "Request to Join" : "I'm Interested"}</ProdButton></form>}
      {!item.mine && !item.application && item.status !== "OPEN" && <p className={styles.notice}>This listing is {label(item.status).toLowerCase()} and is not accepting applications.</p>}
      {item.mine && item.status !== "CLOSED" && <div className={styles.actions}><ProdButton variant="danger" disabled={busy} onClick={() => { if (window.confirm("Close this listing? New applications and approvals will stop. This cannot be reopened.")) void act("close"); }}>Close {group ? "Group" : "Request"}</ProdButton></div>}
    </section>
    {item.mine && <section className={styles.panel}><h2>{group ? "Membership Requests" : "Interested Students"}</h2><p>Review applicants before sharing access. {pending.length} pending.</p>{pending.length === 0 && <p className={styles.emptySmall}>No pending requests.</p>}{pending.map(a => <div className={styles.personRow} key={a.id}><div><strong>{person(a.user)}</strong><small>Applied {date(a.createdAt)} · Pending</small></div><div className={styles.actions}><ProdButton disabled={busy || item.status !== "OPEN"} onClick={() => void act("accept", { applicationId: a.id })}>Accept</ProdButton><ProdButton variant="secondary" disabled={busy} onClick={() => void act("decline", { applicationId: a.id })}>Decline</ProdButton></div></div>)}
      <h3>{group ? "Approved Members" : "Accepted Buddy"}</h3>{members.length === 0 && <p>No buddy matched yet.</p>}{members.map(a => <div key={a.id} className={styles.personRow}><div><strong>{person(a.user)}{a.userId === item.creatorId ? " · Creator" : ""}</strong><small>Accepted</small></div><Check size={18} /></div>)}
      {item.applications.some(a => a.status === "DECLINED") && <details><summary>Declined applications</summary>{item.applications.filter(a => a.status === "DECLINED").map(a => <p key={a.id}>{person(a.user)} · Declined · {date(a.createdAt)}</p>)}</details>}
    </section>}
  </>;
}

export function BuddySystem({ active, initialId }: { active: boolean; initialId?: string }) {
  const [tab, setTab] = useState("discover"), [myView, setMyView] = useState("manage"), [activityView, setActivityView] = useState("activity"), [search, setSearch] = useState(""), [query, setQuery] = useState(""), [page, setPage] = useState(1);
  const [items, setItems] = useState<BuddyCard[]>([]), [hasMore, setHasMore] = useState(false), [detail, setDetail] = useState<BuddyDetail | null>(null), [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [revision, setRevision] = useState(0);
  const actionLock = useRef(false), generation = useRef(0);
  const view = tab === "my" ? myView : tab === "activity" ? activityView : tab;
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => { if (!active) return; const focus = () => refresh(); window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [active, refresh]);
  useEffect(() => {
    if (!active || creating) return;
    const controller = new AbortController(), current = ++generation.current;
    const timer = setTimeout(() => { setLoading(true); setError(""); setDetail(null); setItems([]); }, 0);
    const queryString = initialId ? `?id=${encodeURIComponent(initialId)}` : `?${new URLSearchParams({ view, search: query, page: String(page) })}`;
    void api<BuddyDetail | { items: BuddyCard[]; hasMore: boolean }>(queryString, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted || current !== generation.current) return;
      clearTimeout(timer);
      if ("items" in data) { setItems(data.items); setHasMore(data.hasMore); setDetail(null); } else setDetail(data);
      setLoading(false); setError("");
    }).catch(failure => { if (!controller.signal.aborted && current === generation.current) { clearTimeout(timer); setItems([]); setDetail(null); setError(failure.message); setLoading(false); } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, initialId, view, query, page, revision, creating]);
  const go = (id?: string) => { window.location.assign(id ? `#buddy?listing=${encodeURIComponent(id)}` : "#buddy"); };
  const changeTab = (value: string) => { setTab(value); setPage(1); setSearch(""); setQuery(""); setCreating(false); setNotice(""); if (initialId) go(); };
  const mutate = async (action: string, extra: Record<string, string> = {}) => {
    if (actionLock.current || !initialId) return;
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    try { const result = await api<{ message: string }>("", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: initialId, ...extra }) }); setNotice(result.message); refresh(); }
    catch (failure) { setError((failure as Error).message); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const create = async (input: Record<string, unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true);
    try { const result = await api<{ id: string }>("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }); setCreating(false); setTab(input.kind === "GROUP" ? "my" : "activity"); setMyView("manage"); setNotice("Created successfully."); go(result.id); refresh(); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const openCreate = () => { setCreating(true); setError(""); setNotice(""); if (initialId) go(); };
  const empty = tab === "my" ? myView === "manage" ? "You haven't created any groups yet." : "You haven't joined any groups yet." : query ? "No listings match your search." : tab === "activity" ? "Your listings and applications will appear here." : "No open listings yet. Start a community or find your next study partner.";
  return <main className={styles.root}>
    <header className={styles.header}><div><span className={styles.kicker}><Users size={16} /> BETTER TOGETHER</span><h1>Buddy System<span>.</span></h1><p>Find your study partners, join learning communities and stay accountable together.</p></div><ProdButton onClick={openCreate} disabled={busy}><Plus size={17} /> Create</ProdButton></header>
    <nav className={styles.tabs} aria-label="Buddy System sections">{tabs.map(t => <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} className={tab === t.id ? styles.selected : ""} disabled={busy} onClick={() => changeTab(t.id)}>{t.label}</button>)}</nav>
    {notice && <p role="status" className={styles.success}><Check size={17} />{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={refresh}>Retry loading</button></p>}
    {creating ? <CreateForm initialKind={tab === "requests" ? "REQUEST" : "GROUP"} busy={busy} submit={create} cancel={() => setCreating(false)} /> : initialId ? <><ProdButton variant="ghost" onClick={() => go()} disabled={busy}><ArrowLeft size={16} /> Back to listings</ProdButton>{loading ? <p role="status">Loading listing…</p> : detail && <Detail key={detail.id} item={detail} busy={busy} act={mutate} />}</> : <>
      {tab === "my" && <div className={styles.subtabs}>{[{ id: "manage", label: "Groups I Manage" }, { id: "joined", label: "Groups I've Joined" }].map(t => <button type="button" aria-pressed={myView === t.id} className={myView === t.id ? styles.selected : ""} key={t.id} onClick={() => { setMyView(t.id); setPage(1); }}>{t.label}</button>)}</div>}
      {tab === "activity" && <label className={styles.activityFilter}>Show activity<select value={activityView} onChange={event => { setActivityView(event.target.value); setPage(1); }}><option value="activity">All my activity</option><option value="created-requests">Buddy Requests I Created</option><option value="applied-requests">Buddy Requests I Applied To</option><option value="group-applications">Group Requests I Submitted</option></select></label>}
      <div className={styles.toolbar}><label className={styles.search}><Search size={18} /><span className={styles.srOnly}>Search titles and descriptions</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search titles and descriptions…" /></label><ProdButton variant="ghost" onClick={refresh} disabled={loading}><RefreshCw size={16} />Refresh</ProdButton></div>
      {tab === "activity" && <p className={styles.meta}>Your created buddy requests and groups, plus submitted applications. Listing status and your application status are shown separately.</p>}
      {loading ? <div className={styles.empty} role="status"><Users size={32} /><h2>Finding your community…</h2></div> : error ? null : items.length ? <div className={styles.grid}>{items.map(item => <ListingCard key={item.id} item={item} open={() => go(item.id)} />)}</div> : <div className={styles.empty}><Users size={36} /><h2>{empty}</h2><p>Small steps are easier with good company.</p><ProdButton onClick={tab === "my" && myView === "joined" ? () => changeTab("groups") : openCreate}>{tab === "my" && myView === "joined" ? "Discover Groups" : "Create " + (tab === "requests" ? "Buddy Request" : "Group")}</ProdButton></div>}
      {!loading && <div className={styles.pagination}><ProdButton variant="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</ProdButton><span>Page {page}</span><ProdButton variant="secondary" disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next</ProdButton></div>}
    </>}
  </main>;
}
