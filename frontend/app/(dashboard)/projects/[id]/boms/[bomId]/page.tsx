import { BomEditor } from "@/components/bom/bom-editor";

export default function ProjectBomPage({ params }: { params: { id: string; bomId: string } }) {
  return <BomEditor bomId={params.bomId} />;
}
