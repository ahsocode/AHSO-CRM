import { DocumentPreviewClient } from "./preview-client";

export default function DocumentPreviewPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    entityId?: string;
    lang?: string;
  };
}) {
  return (
    <DocumentPreviewClient
      type={searchParams.type}
      entityId={searchParams.entityId}
      lang={searchParams.lang}
    />
  );
}
