import { redirect } from "next/navigation";
import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { ServiceError } from "@/lib/service-error";
import { ProductivityClient } from "@/features/productivity/ProductivityClient";

export default async function ProductivityPage() {
  let user;
  try { user = await requireProductivityUser(); }
  catch (error) {
    if (error instanceof ServiceError && error.status === 401) redirect("/login?callbackUrl=%2Fstudashboard%2Fproductivity-layer");
    if (error instanceof ServiceError && error.status === 403) redirect("/");
    throw error;
  }
  return <ProductivityClient userId={user.id} />;
}
