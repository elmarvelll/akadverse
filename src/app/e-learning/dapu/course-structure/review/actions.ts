"use server";

// Review Course actions. DAPU authority is re-checked on the server for each one;
// the HOD for a structure is derived from its programme's department, never sent by the client.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { ServiceError } from "@/lib/service-error";
import { publishStructuresToHods } from "@/services/e-learning/dapu/curriculum/publish-structures";

const BASE = "/e-learning/dapu/course-structure/review";

async function dapuOnly() {
  const session = await requireElearningRole(["dapu"]);
  await requireDapuProfile(session);
}

function done(kind: "ok" | "error", message: string): never {
  revalidatePath(BASE);
  revalidatePath("/e-learning/dapu/course-structure");
  redirect(`${BASE}?${kind}=${encodeURIComponent(message)}`);
}

// One or many structures ("Publish to HOD(s)" / "Publish to All HODs"). The server
// decides which are eligible; the rest are reported back, not silently dropped.
export async function publishStructuresAction(fd: FormData) {
  await dapuOnly();
  const ids = fd.getAll("curriculumId").map(String).filter(Boolean);
  let text: string;
  try {
    const r = await publishStructuresToHods(ids);
    text = `Published ${r.published.length} course structure${r.published.length === 1 ? "" : "s"} to the HOD${r.published.length === 1 ? "" : "s"}.`;
    if (r.skipped.length) text += ` Skipped ${r.skipped.length}: ${r.skipped.map((s) => `${s.label} (${s.reason})`).join("; ")}`;
    if (r.published.length === 0) done("error", text);
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    done("error", e.message);
  }
  done("ok", text);
}
