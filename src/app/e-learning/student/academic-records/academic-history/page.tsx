import { redirect } from "next/navigation";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
// Student result views are hidden until the portal exposes them again.
// Result models, staff workflows and services remain intact.
export default async function Page() {
  await requireElearningRole(["student"]);
  redirect("/e-learning/student/dashboard");
}
