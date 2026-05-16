import { DocumentsClient } from "./_components/documents-client";

export const metadata = {
  title: "Hồ sơ tài liệu",
  description: "Quản lý tài liệu thực tế: hợp đồng đã ký, biên bản, hóa đơn"
};

export default function DocumentsPage() {
  return <DocumentsClient />;
}
