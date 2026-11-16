import DeliveryRosterManager from "./_components/DeliveryRosterManager";

export default async function AdminDeliveryRosterPage({ searchParams }: { searchParams: Promise<{ operation?: string }> }) {
  const operation = (await searchParams).operation === "VENDOR" ? "VENDOR" : "MARKETPLACE";
  return <DeliveryRosterManager initialOperation={operation} />;
}
