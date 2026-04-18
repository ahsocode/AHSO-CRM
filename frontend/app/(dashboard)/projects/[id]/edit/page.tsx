import { ProjectFormScreen } from "../../_components/project-form-screen";

export default function EditProjectPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  return <ProjectFormScreen mode="edit" projectId={params.id} />;
}
