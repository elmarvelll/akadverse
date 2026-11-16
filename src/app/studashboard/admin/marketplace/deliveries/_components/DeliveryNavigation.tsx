"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DeliveryNavigation() {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href !== "/studashboard/admin/marketplace/deliveries" && path.startsWith(`${href}/`));
  return <nav aria-label="Delivery management" className="mb-6 flex flex-wrap gap-2">
    {[["/studashboard/admin/marketplace/deliveries", "Overview"], ["/studashboard/admin/marketplace/deliveries/businesses", "Businesses"], ["/studashboard/admin/marketplace/deliveries/vendors", "Vendors"]].map(([href, label]) =>
      <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${isActive(href) ? "bg-gray-900 text-white" : "border border-gray-300 bg-white text-gray-700"}`}>{label}</Link>)}
  </nav>;
}
