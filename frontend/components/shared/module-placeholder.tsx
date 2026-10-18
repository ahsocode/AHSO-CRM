import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export function ModulePlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="Module đang được mở rộng"
        description="Giao diện đã sẵn sàng. Phần nghiệp vụ chi tiết sẽ được kết nối dữ liệu thật trong các đợt triển khai tiếp theo."
      />
    </div>
  );
}

