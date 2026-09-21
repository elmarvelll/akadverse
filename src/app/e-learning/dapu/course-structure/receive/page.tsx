import { redirect } from "next/navigation";

// Add Course now has its own page.
export default function Legacy() {
  redirect("/e-learning/dapu/add-course");
}
