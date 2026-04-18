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
        description="Route và layout đã sẵn sàng cho tuần triển khai tiếp theo. Phần nghiệp vụ chi tiết sẽ được gắn API thật sau khi hoàn tất phase foundation + auth."
      />
    </div>
  );
}

