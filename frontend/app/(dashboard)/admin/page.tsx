import Link from "next/link";
import type { Route } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ADMIN_CARDS = [
  {
    href: "/admin/company-info" as Route,
    title: "Company Info",
    description: "Cập nhật tên công ty, thông tin pháp lý và logo đang hiển thị toàn hệ thống.",
    icon: "briefcase" as const
  },
  {
    href: "/admin/policies" as Route,
    title: "Policies",
    description: "Quản lý điều khoản thanh toán, loại thuế, bảo hành và dịch vụ chuẩn.",
    icon: "description" as const
  },
  {
    href: "/admin/roles" as Route,
    title: "Roles",
    description: "Thiết kế role tùy biến, gán permission và theo dõi số user đang sử dụng.",
    icon: "settings" as const
  },
  {
    href: "/users" as Route,
    title: "Users",
    description: "Đi tới module người dùng hiện có để quản trị tài khoản và trạng thái hoạt động.",
    icon: "groups" as const
  },
  {
    href: "/admin/custom-fields" as Route,
    title: "Custom Fields",
    description: "Tạo trường động cho khách hàng, dự án và hợp đồng mà không phải sửa schema chính.",
    icon: "analytics" as const
  },
  {
    href: "/admin/document-templates" as Route,
    title: "Document Templates",
    description: "Chỉnh layout tài liệu bằng canvas drag-drop A4, quản lý variant draft/published và kích hoạt đúng mẫu runtime.",
    icon: "description" as const
  },
  {
    href: "/admin/email-accounts" as Route,
    title: "Email Accounts",
    description: "Tạo mailbox iRedMail cho nhân sự và theo dõi trạng thái kết nối IMAP.",
    icon: "mail" as const
  },
  {
    href: "/admin/ai-providers" as Route,
    title: "AI Providers",
    description: "Cấu hình GPT, Anthropic, Gemini và theo dõi usage AI trong hệ thống.",
    icon: "analytics" as const
  },
  {
    href: "/admin/agents" as Route,
    title: "AI Agents",
    description: "Tạo agent, giới hạn tool được phép và quản lý prompt vận hành.",
    icon: "settings" as const
  },
  {
    href: "/admin/backup" as Route,
    title: "Backup & Restore",
    description: "Sao lưu toàn bộ hệ thống lên Google Drive và khôi phục khi cần.",
    icon: "cloud-upload" as const
  },
  {
    href: "/admin/notifications" as Route,
    title: "Nhắc lịch Email",
    description: "Bật/tắt và cấu hình giờ gửi, ngưỡng ngày nhắc milestone và thanh toán tự động qua email.",
    icon: "mail" as const
  }
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản trị hệ thống"
        description="Khu vực điều phối cấu hình nền cho AHSO CRM: thương hiệu, chính sách, role và người dùng."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full border border-white/70 bg-white/90 transition-transform duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_16px_36px_rgba(26,82,118,0.12)]">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AppIcon name={card.icon} className="h-5 w-5" />
                </div>
                <CardTitle className="mt-4">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-semibold text-primary">Mở module</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
