"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AppIcon } from "@/components/shared/app-icon";
import { AvatarInitials } from "@/components/shared/avatar-initials";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateContact, useDeleteContact, useUpdateContact } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import { CustomerContact } from "@/lib/types";
import {
  contactFormSchema,
  defaultContactFormValues,
  type ContactFormValues
} from "./form-schemas";

const DEPARTMENT_SUGGESTIONS = [
  "Kỹ thuật",
  "Mua hàng",
  "QC / Chất lượng",
  "Kế toán",
  "Ban giám đốc",
  "IT",
  "Vận hành",
  "Pháp lý"
];

export function ContactManager({
  customerId,
  contacts
}: {
  customerId: string;
  contacts: CustomerContact[];
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const createContactMutation = useCreateContact(customerId);
  const updateContactMutation = useUpdateContact(customerId, editingContactId);
  const deleteContactMutation = useDeleteContact(customerId);

  const handleStartCreate = () => {
    setEditingContactId(null);
    updateContactMutation.reset();
    createContactMutation.reset();
    setIsCreating(true);
  };

  const handleStopCreate = () => {
    createContactMutation.reset();
    setIsCreating(false);
  };

  // Group contacts by department
  const grouped = contacts.reduce<Record<string, CustomerContact[]>>((acc, contact) => {
    const key = contact.department?.trim() || "Khác";
    acc[key] = [...(acc[key] ?? []), contact];
    return acc;
  }, {});

  // Sort: departments with contacts first, then alphabetically; "Khác" always last
  const departmentOrder = Object.keys(grouped).sort((a, b) => {
    if (a === "Khác") return 1;
    if (b === "Khác") return -1;
    return a.localeCompare(b, "vi");
  });

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Contacts</p>
          <CardTitle>Đầu mối liên hệ</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            {contacts.length > 0
              ? `${contacts.length} liên hệ · ${departmentOrder.length} bộ phận`
              : "Thêm contact để gắn vào dự án và văn bản xuất đi."}
          </p>
        </div>
        <Button onClick={handleStartCreate} type="button" variant="outline">
          <AppIcon name="plus" className="text-[16px]" />
          Thêm liên hệ
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {deleteContactMutation.isError ? (
          <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">
            {getApiErrorMessage(deleteContactMutation.error, "Không thể xóa liên hệ.")}
          </div>
        ) : null}

        {isCreating ? (
          <ContactEditor
            errorMessage={
              createContactMutation.isError
                ? getApiErrorMessage(createContactMutation.error, "Không thể tạo liên hệ.")
                : null
            }
            initialValues={defaultContactFormValues}
            isPending={createContactMutation.isPending}
            onCancel={handleStopCreate}
            onSubmit={(values) => {
              createContactMutation.mutate(values, {
                onSuccess: () => handleStopCreate()
              });
            }}
            submitLabel="Lưu liên hệ"
          />
        ) : null}

        {contacts.length === 0 && !isCreating ? (
          <EmptyState
            title="Chưa có đầu mối liên hệ"
            description="Tạo contact đầu tiên. Mỗi contact có thể gắn bộ phận để phân loại và xuất đúng tên vào biên bản nghiệm thu, bàn giao."
          />
        ) : null}

        {/* Grouped by department */}
        {departmentOrder.map((dept) => (
          <div key={dept} className="space-y-2">
            {/* Department label — only show when there are multiple departments */}
            {departmentOrder.length > 1 ? (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">
                  {dept}
                </span>
                <div className="h-px flex-1 bg-border/40" />
              </div>
            ) : null}

            {grouped[dept].map((contact) =>
              editingContactId === contact.id ? (
                <ContactEditor
                  key={contact.id}
                  errorMessage={
                    updateContactMutation.isError
                      ? getApiErrorMessage(updateContactMutation.error, "Không thể cập nhật liên hệ.")
                      : null
                  }
                  initialValues={{
                    name: contact.name,
                    title: contact.title ?? "",
                    department: contact.department ?? "",
                    email: contact.email ?? "",
                    phone: contact.phone ?? "",
                    isPrimary: contact.isPrimary,
                    notes: contact.notes ?? ""
                  }}
                  isPending={updateContactMutation.isPending}
                  onCancel={() => {
                    updateContactMutation.reset();
                    setEditingContactId(null);
                  }}
                  onSubmit={(values) => {
                    updateContactMutation.mutate(values, {
                      onSuccess: () => {
                        updateContactMutation.reset();
                        setEditingContactId(null);
                      }
                    });
                  }}
                  submitLabel="Lưu thay đổi"
                />
              ) : (
                <article key={contact.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <AvatarInitials name={contact.name} className="h-11 w-11 shrink-0 rounded-full text-xs" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-text-primary">{contact.name}</p>
                          {contact.isPrimary ? <Badge variant="success">Liên hệ chính</Badge> : null}
                          {contact.department ? (
                            <Badge variant="neutral" className="text-[11px]">
                              {contact.department}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm text-text-secondary">
                          {contact.title ?? "Chưa có chức danh"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                          {contact.phone ? (
                            <span className="flex items-center gap-1.5">
                              <AppIcon name="phone" className="text-[14px] text-text-muted" />
                              {contact.phone}
                            </span>
                          ) : null}
                          {contact.email ? (
                            <span className="flex items-center gap-1.5">
                              <AppIcon name="mail" className="text-[14px] text-text-muted" />
                              {contact.email}
                            </span>
                          ) : null}
                        </div>
                        {contact.notes ? (
                          <p className="mt-2 text-sm text-text-muted">{contact.notes}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        onClick={() => {
                          createContactMutation.reset();
                          setIsCreating(false);
                          updateContactMutation.reset();
                          setEditingContactId(contact.id);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Sửa
                      </Button>
                      <Button
                        className="text-danger hover:text-danger"
                        disabled={deleteContactMutation.isPending}
                        onClick={() => {
                          if (!window.confirm(`Xóa liên hệ "${contact.name}" khỏi khách hàng này?`)) return;
                          deleteContactMutation.mutate(contact.id);
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {deleteContactMutation.isPending ? "Đang xóa..." : "Xóa"}
                      </Button>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ContactEditor({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isPending,
  errorMessage
}: {
  initialValues: ContactFormValues;
  submitLabel: string;
  onSubmit: (values: ContactFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  errorMessage: string | null;
}) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: initialValues
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  return (
    <form
      className="space-y-4 rounded-2xl border border-border/60 bg-white/80 p-4"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field>
          <Label htmlFor="contact-name">Tên liên hệ</Label>
          <Input id="contact-name" placeholder="Nguyễn Văn A" {...form.register("name")} />
          <ErrorText message={form.formState.errors.name?.message} />
        </Field>

        <Field>
          <Label htmlFor="contact-title">Chức danh</Label>
          <Input id="contact-title" placeholder="Trưởng phòng mua hàng" {...form.register("title")} />
          <ErrorText message={form.formState.errors.title?.message} />
        </Field>

        <Field>
          <Label htmlFor="contact-department">Bộ phận</Label>
          <Input
            id="contact-department"
            list="department-suggestions"
            placeholder="Mua hàng, Kỹ thuật, QC..."
            {...form.register("department")}
          />
          <datalist id="department-suggestions">
            {DEPARTMENT_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <ErrorText message={form.formState.errors.department?.message} />
        </Field>

        <Field>
          <Label htmlFor="contact-phone">Điện thoại</Label>
          <Input id="contact-phone" placeholder="0909..." {...form.register("phone")} />
          <ErrorText message={form.formState.errors.phone?.message} />
        </Field>

        <Field className="md:col-span-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" type="email" placeholder="name@company.vn" {...form.register("email")} />
          <ErrorText message={form.formState.errors.email?.message} />
        </Field>
      </div>

      <Field>
        <Label htmlFor="contact-notes">Ghi chú</Label>
        <Textarea
          id="contact-notes"
          placeholder="Vai trò, phạm vi phụ trách hoặc lưu ý làm việc."
          {...form.register("notes")}
        />
        <ErrorText message={form.formState.errors.notes?.message} />
      </Field>

      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-bg-hover/60 px-4 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus:ring-info/20"
          {...form.register("isPrimary")}
        />
        <div>
          <p className="font-semibold text-text-primary">Đặt làm liên hệ chính</p>
          <p className="text-sm text-text-secondary">Nếu bật, hệ thống sẽ tự bỏ cờ chính ở các contact còn lại.</p>
        </div>
      </label>

      {errorMessage ? (
        <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{errorMessage}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={isPending} type="submit">
          {isPending ? "Đang lưu..." : submitLabel}
        </Button>
        <Button disabled={isPending} onClick={onCancel} type="button" variant="ghost">
          Hủy
        </Button>
      </div>
    </form>
  );
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className ?? ""}`}>{children}</div>;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label className="text-sm font-semibold text-text-primary" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}
