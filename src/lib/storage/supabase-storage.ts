// src/lib/storage/supabase-storage.ts
//
// Thin server-side client for Supabase Storage (REST API), used for course materials. Server only:
// it needs SUPABASE_SERVICE_ROLE_KEY, which must never reach the browser or the database.
//
//   SUPABASE_URL                        https://<project-ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY           server secret (Project Settings -> API)
//   SUPABASE_COURSE_MATERIALS_BUCKET    optional, default "Akadverdse documents" (a PRIVATE bucket)
//
// The bucket is private: nothing is downloadable without a short-lived signed URL that the server
// only issues after checking who is asking. Uploads go browser -> Supabase through a signed upload
// URL (so large files never pass through a serverless function's request-size limit), and the
// server verifies the stored object's real size before it accepts the material.

import { ServiceError } from "@/lib/service-error";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ServiceError(503, "File storage isn't set up yet. Ask an administrator to configure Supabase Storage.");
  return { url, key, api: `${url}/storage/v1` };
}
const authHeaders = (key: string) => ({ Authorization: `Bearer ${key}`, apikey: key });
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

async function call(res: Response, what: string) {
  if (res.ok) return res;
  let detail = "";
  try { detail = ((await res.json()) as { message?: string; error?: string }).message ?? ""; } catch { /* not JSON */ }
  throw new ServiceError(502, `File storage failed (${what}${detail ? `: ${detail}` : `, HTTP ${res.status}`}).`);
}

// A one-time URL the BROWSER can upload a single file to. Nothing else in the bucket is reachable with it.
export async function createSignedUploadUrl(bucket: string, path: string) {
  const { key, api, url } = config();
  const res = await call(await fetch(`${api}/object/upload/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`, { method: "POST", headers: authHeaders(key) }), "create upload URL");
  const body = (await res.json()) as { url: string; token?: string };
  // Storage returns a path-relative URL; make it absolute against this project.
  const relative = body.url.startsWith("http") ? body.url : `${api}${body.url.startsWith("/") ? "" : "/"}${body.url}`;
  return { uploadUrl: relative.replace(url, url), path };
}

// The size Storage actually holds for the object (null if it isn't there).
export async function getObjectSize(bucket: string, path: string): Promise<number | null> {
  const { key, api } = config();
  const res = await fetch(`${api}/object/info/${encodeURIComponent(bucket)}/${encodePath(path)}`, { headers: authHeaders(key) });
  if (res.status === 404 || res.status === 400) return null;
  await call(res, "read object info");
  const info = (await res.json()) as { size?: number; metadata?: { size?: number } };
  return info.size ?? info.metadata?.size ?? null;
}

export async function removeObject(bucket: string, path: string) {
  const { key, api } = config();
  await call(await fetch(`${api}/object/${encodeURIComponent(bucket)}`, { method: "DELETE", headers: { ...authHeaders(key), "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: [path] }) }), "delete file");
}

// A short-lived link to view/download one object. Issued only after the caller has been authorized.
export async function createSignedDownloadUrl(bucket: string, path: string, downloadName: string, expiresInSeconds = 60) {
  const { key, api } = config();
  const raw = await fetch(`${api}/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`, { method: "POST", headers: { ...authHeaders(key), "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: expiresInSeconds }) });
  // The record exists but the file is gone from Storage: say so plainly instead of a generic upstream error.
  if (raw.status === 404 || raw.status === 400) throw new ServiceError(404, "This file is no longer available. Please contact your lecturer.");
  const res = await call(raw, "create download URL");
  const body = (await res.json()) as { signedURL: string };
  const signed = body.signedURL.startsWith("http") ? body.signedURL : `${api}${body.signedURL.startsWith("/") ? "" : "/"}${body.signedURL}`;
  return `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(downloadName)}`;
}

// Used by the setup script: create the private bucket (with the size limit enforced by Storage itself) if it's missing.
export async function ensureBucket(bucket: string, fileSizeLimit: number, allowedMimeTypes?: string[]) {
  const { key, api } = config();
  const headers = { ...authHeaders(key), "Content-Type": "application/json" };
  const existing = await fetch(`${api}/bucket/${encodeURIComponent(bucket)}`, { headers });
  if (existing.ok) {
    await call(await fetch(`${api}/bucket/${encodeURIComponent(bucket)}`, { method: "PUT", headers, body: JSON.stringify({ public: false, file_size_limit: fileSizeLimit, ...(allowedMimeTypes ? { allowed_mime_types: allowedMimeTypes } : {}) }) }), "update bucket");
    return "updated" as const;
  }
  await call(await fetch(`${api}/bucket`, { method: "POST", headers, body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: fileSizeLimit, ...(allowedMimeTypes ? { allowed_mime_types: allowedMimeTypes } : {}) }) }), "create bucket");
  return "created" as const;
}
