"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePolicies, useUpdatePolicies } from "@/hooks/use-settings";
import { Policies } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PolicyEditor } from "./_components/policy-editor";

export default function PoliciesPage() {
  const policiesQuery = usePolicies();
  const updatePoliciesMutation = useUpdatePolicies();
  const { error, success } = useToast();

  const handleSave = async (values: Policies) => {
    try {
      await updatePoliciesMutation.mutateAsync(values);
      success("Đã lưu chính sách");
    } catch {
      error("Không thể lưu chính sách");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Policies"
        description="Giữ một nguồn chuẩn duy nhất cho payment terms, tax, warranty và service trước khi các module khác tiêu thụ."
        action={
          <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
            Về quản trị
          </Link>
        }
      />

      <PolicyEditor
        initialValues={policiesQuery.data}
        isLoading={policiesQuery.isLoading}
        isSaving={updatePoliciesMutation.isPending}
        onSubmit={handleSave}
      />
    </div>
  );
}
