"use server";

// src/app/e-learning/faculty/my-subjects/[offeringId]/actions.ts
//
// Server Actions for lecturer material uploads. They RETURN errors instead of throwing so the
// message reaches the browser (thrown errors are masked in production). The session is re-derived
// every time and the offering-lecturer check lives in the materials service — the offeringId
// from the client is routing only, never authorization.

import { revalidatePath } from "next/cache";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { confirmUpload, requestUpload, type UploadMeta } from "@/services/e-learning/faculty/materials/upload-material";
import { deleteMaterial } from "@/services/e-learning/faculty/materials/delete-material";
import { ServiceError } from "@/lib/service-error";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T>(fn: (userId: string) => Promise<T>): Promise<Result<T extends object ? T : object>> {
  try {
    const session = await requireElearningRole(["faculty"]);
    return { ok: true, ...((await fn(session.user.id)) as object) } as never;
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("[materials]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function requestUploadAction(meta: UploadMeta) {
  return guard((id) => requestUpload(id, meta));
}

export async function confirmUploadAction(meta: UploadMeta & { path: string }) {
  const res = await guard(async (id) => {
    await confirmUpload(id, meta);
    return {};
  });
  if (res.ok) revalidatePath(`/e-learning/faculty/my-subjects/${meta.courseOfferingId}`);
  return res;
}

export async function deleteMaterialAction(offeringId: string, materialId: string) {
  const res = await guard(async (id) => {
    await deleteMaterial(id, materialId);
    return {};
  });
  if (res.ok) revalidatePath(`/e-learning/faculty/my-subjects/${offeringId}`);
  return res;
}
