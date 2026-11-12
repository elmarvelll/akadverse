import { redirect } from "next/navigation";

// Course Structure is now one workflow (select -> add -> review -> submit).
export default function Legacy() {
  redirect("/e-learning/dapu/course-structure");
}
