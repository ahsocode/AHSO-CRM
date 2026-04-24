"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLogo, useSettings, useUpdateCompanyInfo } from "@/hooks/use-settings";
import { CompanyInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompanyForm } from "./_components/company-form";
import { LogoUploader } from "./_components/logo-uploader";

export default function CompanyInfoPage() {
  const settingsQuery = useSettings();
  const logoQuery = useLogo();
  const updateCompanyMutation = useUpdateCompanyInfo();
  const { error, success } = useToast();

  const handleSave = async (values: CompanyInfo) => {
    try {
      await updateCompanyMutation.mutateAsync(values);
      success("Đã lưu thông tin công ty");
    } catch {
      error("Không thể lưu thông tin công ty");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Company Info"
        description="Quản lý thông tin thương hiệu, pháp lý và logo hiển thị trên toàn bộ AHSO CRM."
        action={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Về quản trị
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <CompanyForm
          initialValues={settingsQuery.data?.company}
          isLoading={settingsQuery.isLoading}
          isSaving={updateCompanyMutation.isPending}
          onSubmit={handleSave}
        />
        <LogoUploader currentLogoUrl={logoQuery.data} isLoading={logoQuery.isLoading} />
      </div>
    </div>
  );
}
