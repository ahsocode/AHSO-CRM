"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Policies } from "@/lib/types";

const policyEditorSchema = z.object({
  paymentTerms: z.string().max(500, "Điều khoản thanh toán không được vượt quá 500 ký tự").optional().or(z.literal("")),
  deliveryTerms: z.string().max(500, "Điều khoản giao hàng không được vượt quá 500 ký tự").optional().or(z.literal("")),
  taxTypes: z.string().max(500, "Thông tin thuế không được vượt quá 500 ký tự").optional().or(z.literal("")),
  warranty: z.string().max(500, "Chính sách bảo hành không được vượt quá 500 ký tự").optional().or(z.literal("")),
  service: z.string().max(500, "Chính sách dịch vụ không được vượt quá 500 ký tự").optional().or(z.literal(""))
});

type PolicyEditorValues = z.infer<typeof policyEditorSchema>;

function toOptionalString(value?: string) {
  return value?.trim() || undefined;
}

function normalizePolicies(values?: Policies): PolicyEditorValues {
  return {
    paymentTerms: values?.paymentTerms ?? "",
    deliveryTerms: values?.deliveryTerms ?? "",
    taxTypes: values?.taxTypes ?? "",
    warranty: values?.warranty ?? "",
    service: values?.service ?? ""
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-danger">{message}</p>;
}

export function PolicyEditor({
  initialValues,
  isLoading,
  isSaving,
  onSubmit
}: {
  initialValues?: Policies;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (values: Policies) => void;
}) {
  const form = useForm<PolicyEditorValues>({
    resolver: zodResolver(policyEditorSchema),
    defaultValues: normalizePolicies(initialValues)
  });

  useEffect(() => {
    form.reset(normalizePolicies(initialValues));
  }, [form, initialValues]);

  if (isLoading) {
    return <LoadingSkeleton className="h-[560px] w-full" />;
  }

  return (
    <Card className="border border-white/70 bg-white/88">
      <CardHeader>
        <CardTitle>Chính sách vận hành</CardTitle>
        <CardDescription>
          Các đoạn văn bản này sẽ là nguồn chuẩn để tái sử dụng trên báo giá, hợp đồng và tài liệu gửi khách.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => {
          onSubmit({
              paymentTerms: toOptionalString(values.paymentTerms),
              deliveryTerms: toOptionalString(values.deliveryTerms),
              taxTypes: toOptionalString(values.taxTypes),
              warranty: toOptionalString(values.warranty),
              service: toOptionalString(values.service)
            });
          })}
        >
          {[
            { key: "paymentTerms", label: "Điều khoản thanh toán" },
            { key: "deliveryTerms", label: "Điều khoản giao hàng / triển khai" },
            { key: "taxTypes", label: "Loại thuế / VAT" },
            { key: "warranty", label: "Chính sách bảo hành" },
            { key: "service", label: "Chính sách dịch vụ" }
          ].map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="text-sm font-semibold text-text-primary" htmlFor={field.key}>
                {field.label}
              </label>
              <Textarea
                id={field.key}
                maxLength={500}
                rows={4}
                {...form.register(field.key as keyof PolicyEditorValues)}
              />
              <FieldError
                message={form.formState.errors[field.key as keyof PolicyEditorValues]?.message}
              />
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Lưu chính sách"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
