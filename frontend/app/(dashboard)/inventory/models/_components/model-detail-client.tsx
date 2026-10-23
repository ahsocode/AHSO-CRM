"use client";

import { BomEditor } from "@/components/bom/bom-editor";
import { BomVersionHistory } from "@/components/bom/bom-version-history";
import { useBom } from "@/hooks/use-boms";

export function ModelDetailClient({ bomId }: { bomId: string }) {
  const bomQuery = useBom(bomId);
  const productId = bomQuery.data?.productId;

  return (
    <div className="space-y-6">
      <BomEditor bomId={bomId} />
      {productId ? <BomVersionHistory productId={productId} currentBomId={bomId} /> : null}
    </div>
  );
}
