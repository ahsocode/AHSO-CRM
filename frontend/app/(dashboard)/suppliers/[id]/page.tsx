import { SupplierDetailClient } from "../_components/supplier-detail-client";

export const dynamic = "force-dynamic";

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  return <SupplierDetailClient supplierId={params.id} />;
}
