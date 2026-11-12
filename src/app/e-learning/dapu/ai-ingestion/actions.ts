"use server";
import { revalidatePath } from "next/cache";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { retryReviewedTask } from "@/services/e-learning/ai-ingest/worker";
export async function retryTaskAction(data: FormData) {
  await requireElearningRole(["dapu"]);
  const id = data.get("taskId");
  if (typeof id !== "string" || !id || id.length > 100) return;
  await retryReviewedTask(id);
  revalidatePath("/e-learning/dapu/ai-ingestion");
}
