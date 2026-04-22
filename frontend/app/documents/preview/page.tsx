import { DocumentPreviewClient } from "./preview-client";

export default function DocumentPreviewPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    entityId?: string;
    lang?: string;
    templateVariantId?: string;
  };
}) {
  return (
    <DocumentPreviewClient
      type={searchParams.type}
      entityId={searchParams.entityId}
      lang={searchParams.lang}
      templateVariantId={searchParams.templateVariantId}
    />
  );
}
