import "../helpers/env";
import { after, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { makeUser } from "../helpers/fixtures";
import { browseBuddy, buddyDetail, createBuddy, mutateBuddy } from "@/services/productivity-layer/buddy-system/service";
const users: string[] = [];
const url = "https://chat.whatsapp.com/Abc123456789";
async function student() { const user = await makeUser(); users.push(user.id); return user.id; }
async function group(owner: string, maxMembers: number | null = 3) { return (await createBuddy(owner, { kind: "GROUP", title: "Calculus circle", description: "Prepare for MTH exams", privateDetails: url, maxMembers })).id; }
const apply = (user: string, id: string, contactDetails?: string) => mutateBuddy(user, { id, action: "apply", contactDetails });
const approve = (user: string, id: string, applicationId: string) => mutateBuddy(user, { id, action: "accept", applicationId });
after(async () => { try { await prisma.user.deleteMany({ where: { id: { in: users } } }); } finally { await prisma.$disconnect(); } });
it("atomically creates creator membership, counts creator, searches safely and separates My Groups", async () => {
  const owner = await student(), outsider = await student(), id = await group(owner);
  const detail = await buddyDetail(owner, id); assert.equal(detail.memberCount, 1); assert.equal(detail.applications[0].status, "ACCEPTED"); assert.equal(detail.privateDetails, url);
  const found = await browseBuddy(outsider, new URLSearchParams({ search: "  mTh EXAMS  " })); assert.ok(found.items.some(r => r.id === id)); assert.ok(!JSON.stringify(found).includes(url));
  assert.equal((await buddyDetail(outsider, id)).privateDetails, undefined); assert.equal((await buddyDetail(outsider, id)).applications.length, 0);
  assert.ok((await browseBuddy(owner, new URLSearchParams({ view: "manage" }))).items.some(r => r.id === id));
  assert.ok(!(await browseBuddy(owner, new URLSearchParams({ view: "joined" }))).items.some(r => r.id === id));
  const one = await group(owner, 1); assert.equal((await buddyDetail(owner, one)).status, "FULL"); await assert.rejects(apply(outsider, one));
  await assert.rejects(createBuddy(owner, { kind: "GROUP", title: "Bad", description: "Bad", privateDetails: "https://evil.test", maxMembers: 2 }));
});
it("prevents self-application, duplicate requests, unauthorized approval and unapproved link access", async () => {
  const owner = await student(), applicant = await student(), stranger = await student(), id = await group(owner);
  await assert.rejects(apply(owner, id));
  const outcomes = await Promise.allSettled([apply(applicant, id), apply(applicant, id)]); assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
  assert.equal((await buddyDetail(applicant, id)).application, "PENDING"); assert.equal((await buddyDetail(applicant, id)).privateDetails, undefined);
  const application = (await buddyDetail(owner, id)).applications.find(a => a.userId === applicant)!;
  await assert.rejects(approve(applicant, id, application.id)); await assert.rejects(approve(stranger, id, application.id));
  await approve(owner, id, application.id);
  assert.equal((await buddyDetail(applicant, id)).privateDetails, url); assert.equal((await buddyDetail(applicant, id)).memberCount, 2);
  await assert.rejects(apply(applicant, id));
  assert.ok((await browseBuddy(applicant, new URLSearchParams({ view: "joined" }))).items.some(r => r.id === id));
  assert.ok((await browseBuddy(applicant, new URLSearchParams({ view: "group-applications" }))).items.some(r => r.id === id));
  assert.ok(!(await browseBuddy(owner, new URLSearchParams({ view: "group-applications" }))).items.some(r => r.id === id));
});
it("serializes competing approvals for the last space and rejects further approvals", async () => {
  const owner = await student(), a = await student(), b = await student(), id = await group(owner, 2);
  await apply(a, id); await apply(b, id);
  const pending = (await buddyDetail(owner, id)).applications.filter(a => a.status === "PENDING");
  const results = await Promise.allSettled(pending.map(a => approve(owner, id, a.id)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const detail = await buddyDetail(owner, id); assert.equal(detail.memberCount, 2); assert.equal(detail.status, "FULL");
  assert.ok(!(await browseBuddy(b, new URLSearchParams({ view: "groups" }))).items.some(r => r.id === id));
  const left = detail.applications.find(a => a.status === "PENDING")!; await assert.rejects(approve(owner, id, left.id));
});
it("declines without sharing secrets, preserves closed memberships, and blocks closed approvals", async () => {
  const owner = await student(), a = await student(), b = await student(), id = await group(owner);
  await apply(a, id); await apply(b, id);
  const apps = (await buddyDetail(owner, id)).applications;
  await mutateBuddy(owner, { id, action: "decline", applicationId: apps.find(r => r.userId === a)!.id });
  assert.equal((await buddyDetail(a, id)).application, "DECLINED"); assert.equal((await buddyDetail(a, id)).privateDetails, undefined); await assert.rejects(apply(a, id));
  await mutateBuddy(owner, { id, action: "close" });
  await assert.rejects(approve(owner, id, apps.find(r => r.userId === b)!.id)); await assert.rejects(apply(await student(), id));
  assert.equal((await buddyDetail(owner, id)).status, "CLOSED"); assert.equal((await buddyDetail(owner, id)).privateDetails, url);
  assert.ok((await browseBuddy(owner, new URLSearchParams({ view: "manage" }))).items.some(r => r.id === id));
});
it("supports unlimited groups and refuses corrupted legacy invitations", async () => {
  const owner = await student(), a = await student(), id = await group(owner, null);
  await apply(a, id); await approve(owner, id, (await buddyDetail(owner, id)).applications.find(r => r.userId === a)!.id);
  assert.equal((await buddyDetail(owner, id)).status, "OPEN");
  await prisma.buddyListing.update({ where: { id }, data: { privateDetails: "https://evil.test" } });
  assert.equal((await buddyDetail(a, id)).privateDetails, null);
  await mutateBuddy(owner, { id, action: "close" });
  assert.ok((await browseBuddy(a, new URLSearchParams({ view: "joined" }))).items.some(r => r.id === id));
});
it("matches exactly one buddy under concurrent acceptance and protects both contacts", async () => {
  const owner = await student(), a = await student(), b = await student();
  const id = (await createBuddy(owner, { kind: "REQUEST", title: "Revision partner", description: "Daily revision", privateDetails: "owner@private.test" })).id;
  await apply(a, id, "a@private.test"); await apply(b, id, "b@private.test");
  assert.ok(!JSON.stringify(await buddyDetail(a, id)).includes("owner@private.test"));
  assert.ok(!JSON.stringify(await buddyDetail(owner, id)).includes("a@private.test"));
  const pending = (await buddyDetail(owner, id)).applications;
  const results = await Promise.allSettled(pending.map(r => approve(owner, id, r.id))); assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const detail = await buddyDetail(owner, id), accepted = detail.applications.filter(r => r.status === "ACCEPTED"), declined = detail.applications.find(r => r.status === "DECLINED")!;
  assert.equal(detail.status, "MATCHED"); assert.equal(accepted.length, 1); assert.ok(accepted[0].contactDetails);
  assert.equal((await buddyDetail(accepted[0].userId, id)).privateDetails, "owner@private.test"); assert.equal((await buddyDetail(declined.userId, id)).privateDetails, undefined);
  assert.ok(!JSON.stringify(await browseBuddy(owner, new URLSearchParams({ view: "activity" }))).includes("private.test"));
  assert.ok((await browseBuddy(owner, new URLSearchParams({ view: "created-requests" }))).items.some(r => r.id === id));
  assert.ok((await browseBuddy(a, new URLSearchParams({ view: "applied-requests" }))).items.some(r => r.id === id));
  await assert.rejects(apply(await student(), id, "c@private.test"));
});
