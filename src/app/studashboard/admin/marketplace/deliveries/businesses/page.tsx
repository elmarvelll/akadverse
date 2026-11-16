import Link from "next/link";
import DeliveryRosterManager from "../../delivery-roster/_components/DeliveryRosterManager";

export default function BusinessDeliveries() {
  return <div>
    <h1 className="mb-2 text-2xl font-bold text-gray-900">Business deliveries</h1>
    <p className="mb-4 text-sm text-gray-600">Automatic round-robin allocation across open time ranges, followed by balanced overflow. Normal limits and service-day exceptions apply to new bookings; existing assignments are preserved.</p>
    <div className="mb-6 flex flex-wrap gap-4 text-sm text-blue-700">
      <Link href="/studashboard/admin/marketplace/deliveries/businesses/assign" className="underline">Assign ready orders</Link>
      <Link href="/studashboard/admin/marketplace/dropoffs" className="underline">Receive drop-offs</Link>
      <Link href="/studashboard/admin/marketplace/deliverers" className="underline">Manage personnel</Link>
    </div>
    <DeliveryRosterManager fixedOperation="MARKETPLACE" />
  </div>;
}
