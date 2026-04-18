import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserListItem } from "@/lib/types";

function MetricCard({
  title,
  value,
  hint
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="bg-white/90">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-secondary">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function UserOverviewCards({
  users,
  isLoading
}: {
  users: UserListItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="surface-card h-[148px] animate-pulse border border-white/60 bg-white/80" />
        ))}
      </div>
    );
  }

  const activeUsers = users.filter((user) => user.isActive).length;
  const leadershipUsers = users.filter((user) => user.role === "ADMIN" || user.role === "MANAGER").length;
  const missingAvatarUsers = users.filter((user) => !user.avatarUrl).length;

  return (
    <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
      <MetricCard
        title="Tổng tài khoản"
        value={String(users.length)}
        hint="Tất cả user hiện có trong hệ thống CRM."
      />
      <MetricCard
        title="Đang hoạt động"
        value={String(activeUsers)}
        hint={`${users.length - activeUsers} tài khoản đang bị khóa hoặc ngừng sử dụng.`}
      />
      <MetricCard
        title="Nhóm điều phối"
        value={String(leadershipUsers)}
        hint="Bao gồm các tài khoản ADMIN và MANAGER đang quản lý pipeline."
      />
      <MetricCard
        title="Thiếu avatar"
        value={String(missingAvatarUsers)}
        hint="Các hồ sơ nên được bổ sung avatar URL để đồng bộ nhận diện nội bộ."
      />
    </div>
  );
}
