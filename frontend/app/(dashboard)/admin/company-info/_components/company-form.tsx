"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { CompanyInfo } from "@/lib/types";

const companyFormSchema = z.object({
  name: z.string().trim().min(1, "Tên công ty không được để trống").max(255, "Tên công ty quá dài"),
  shortName: z.string().trim().max(50, "Tên viết tắt quá dài").optional().or(z.literal("")),
  taxId: z.string().trim().max(50, "Mã số thuế quá dài").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Địa chỉ quá dài").optional().or(z.literal("")),
  phone: z.string().trim().max(20, "Số điện thoại quá dài").optional().or(z.literal("")),
  email: z.string().trim().email("Email không hợp lệ").optional().or(z.literal("")),
  website: z.string().trim().url("Website không hợp lệ").optional().or(z.literal("")),
  bankName: z.string().trim().max(255, "Tên ngân hàng quá dài").optional().or(z.literal("")),
  bankAccount: z.string().trim().max(50, "Số tài khoản quá dài").optional().or(z.literal("")),
  bankAccountName: z.string().trim().max(255, "Tên chủ tài khoản quá dài").optional().or(z.literal("")),
  bankBranch: z.string().trim().max(255, "Chi nhánh quá dài").optional().or(z.literal("")),
  swiftCode: z.string().trim().max(20, "SWIFT/BIC quá dài").optional().or(z.literal(""))
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

function toOptionalString(value?: string) {
  return value?.trim() || undefined;
}

function normalizeValues(values: CompanyInfo): CompanyFormValues {
  return {
    name: values.name ?? "",
    shortName: values.shortName ?? "",
    taxId: values.taxId ?? "",
    address: values.address ?? "",
    phone: values.phone ?? "",
    email: values.email ?? "",
    website: values.website ?? "",
    bankName: values.bankName ?? "",
    bankAccount: values.bankAccount ?? "",
    bankAccountName: values.bankAccountName ?? "",
    bankBranch: values.bankBranch ?? "",
    swiftCode: values.swiftCode ?? ""
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-danger">{message}</p>;
}

export function CompanyForm({
  initialValues,
  isLoading,
  isSaving,
  onSubmit
}: {
  initialValues?: CompanyInfo;
  isLoading: boolean;
  isSaving: boolean;
  onSubmit: (values: CompanyInfo) => void;
}) {
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: normalizeValues(initialValues ?? { name: "" })
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(normalizeValues(initialValues));
    }
  }, [form, initialValues]);

  if (isLoading) {
    return <LoadingSkeleton className="h-[480px] w-full" />;
  }

  return (
    <Card className="border border-white/70 bg-white/88">
      <CardHeader>
        <CardTitle>Thông tin công ty</CardTitle>
        <CardDescription>
          Dữ liệu này sẽ được dùng cho login screen, topbar và các tài liệu vận hành về sau.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => {
          onSubmit({
              name: values.name.trim(),
              shortName: toOptionalString(values.shortName),
              taxId: toOptionalString(values.taxId),
              address: toOptionalString(values.address),
              phone: toOptionalString(values.phone),
              email: toOptionalString(values.email),
              website: toOptionalString(values.website),
              bankName: toOptionalString(values.bankName),
              bankAccount: toOptionalString(values.bankAccount),
              bankAccountName: toOptionalString(values.bankAccountName),
              bankBranch: toOptionalString(values.bankBranch),
              swiftCode: toOptionalString(values.swiftCode)
            });
          })}
        >
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-name">
              Tên công ty
            </label>
            <Input id="company-name" {...form.register("name")} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-short-name">
              Tên viết tắt
            </label>
            <Input id="company-short-name" {...form.register("shortName")} />
            <FieldError message={form.formState.errors.shortName?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-tax-id">
              Mã số thuế
            </label>
            <Input id="company-tax-id" {...form.register("taxId")} />
            <FieldError message={form.formState.errors.taxId?.message} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-address">
              Địa chỉ
            </label>
            <Input id="company-address" {...form.register("address")} />
            <FieldError message={form.formState.errors.address?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-phone">
              Số điện thoại
            </label>
            <Input id="company-phone" {...form.register("phone")} />
            <FieldError message={form.formState.errors.phone?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-email">
              Email
            </label>
            <Input id="company-email" type="email" {...form.register("email")} />
            <FieldError message={form.formState.errors.email?.message} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-website">
              Website
            </label>
            <Input id="company-website" placeholder="https://example.com" {...form.register("website")} />
            <FieldError message={form.formState.errors.website?.message} />
          </div>

          {/* Bank Details Section */}
          <div className="md:col-span-2 mt-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary pb-2 border-b border-border/60">
              Thông tin tài khoản ngân hàng (Dùng cho chứng từ)
            </h3>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-bank-account">
              Số tài khoản
            </label>
            <Input id="company-bank-account" placeholder="12345678..." {...form.register("bankAccount")} />
            <FieldError message={form.formState.errors.bankAccount?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-bank-name">
              Ngân hàng
            </label>
            <Input id="company-bank-name" placeholder="Vietcombank..." {...form.register("bankName")} />
            <FieldError message={form.formState.errors.bankName?.message} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-bank-account-name">
              Tên chủ tài khoản
            </label>
            <Input id="company-bank-account-name" placeholder="CONG TY TNHH AHSO..." {...form.register("bankAccountName")} />
            <FieldError message={form.formState.errors.bankAccountName?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-bank-branch">
              Chi nhánh
            </label>
            <Input id="company-bank-branch" placeholder="Chi nhánh HCM..." {...form.register("bankBranch")} />
            <FieldError message={form.formState.errors.bankBranch?.message} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-primary" htmlFor="company-swift-code">
              SWIFT/BIC Code (Song ngữ)
            </label>
            <Input id="company-swift-code" placeholder="VCB..." {...form.register("swiftCode")} />
            <FieldError message={form.formState.errors.swiftCode?.message} />
          </div>

          <div className="md:col-span-2 flex justify-end mt-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Lưu thông tin công ty"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
