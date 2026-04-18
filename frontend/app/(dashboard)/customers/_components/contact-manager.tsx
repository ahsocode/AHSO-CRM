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

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Contacts</p>
          <CardTitle>Đầu mối liên hệ</CardTitle>
          <p className="mt-2 text-sm text-text-secondary">
            Thêm và chỉnh sửa contact ngay trên customer detail để tránh tách luồng thao tác.
          </p>
        </div>
        <Button onClick={handleStartCreate} type="button" variant="outline">
          <AppIcon name="plus" className="h-4 w-4" />
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
                onSuccess: () => {
                  handleStopCreate();
                }
              });
            }}
            submitLabel="Lưu liên hệ"
          />
        ) : null}

        {contacts.length === 0 && !isCreating ? (
          <EmptyState
            title="Chưa có đầu mối liên hệ"
            description="Tạo contact đầu tiên để danh sách khách hàng, lịch follow-up và báo giá có điểm bám rõ ràng."
          />
        ) : null}

        {contacts.map((contact) =>
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
                  <AvatarInitials name={contact.name} className="h-11 w-11 rounded-full text-xs" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">{contact.name}</p>
                      {contact.isPrimary ? <Badge variant="success">Liên hệ chính</Badge> : null}
                    </div>
                    <p className="text-sm text-text-secondary">{contact.title ?? "Chưa có chức danh"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                      if (!window.confirm(`Xóa liên hệ "${contact.name}" khỏi khách hàng này?`)) {
                        return;
                      }

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

              <div className="mt-4 grid gap-3 text-sm text-text-secondary md:grid-cols-2">
                <InfoLine icon="phone" value={contact.phone ?? "Chưa có số điện thoại"} />
                <InfoLine icon="mail" value={contact.email ?? "Chưa có email"} />
              </div>

              {contact.notes ? <p className="mt-3 text-sm text-text-secondary">{contact.notes}</p> : null}
            </article>
          )
        )}
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
          <Label htmlFor="contact-phone">Điện thoại</Label>
          <Input id="contact-phone" placeholder="0909..." {...form.register("phone")} />
          <ErrorText message={form.formState.errors.phone?.message} />
        </Field>

        <Field>
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" type="email" placeholder="name@company.vn" {...form.register("email")} />
          <ErrorText message={form.formState.errors.email?.message} />
        </Field>
      </div>

      <Field>
        <Label htmlFor="contact-notes">Ghi chú</Label>
        <Textarea id="contact-notes" placeholder="Vai trò, phạm vi phụ trách hoặc lưu ý làm việc." {...form.register("notes")} />
        <ErrorText message={form.formState.errors.notes?.message} />
      </Field>

      <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-bg-hover/60 px-4 py-3">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border text-primary focus:ring-info/20"
          {...form.register("isPrimary")}
        />
        <div>
          <p className="font-semibold text-text-primary">Đặt làm liên hệ chính</p>
          <p className="text-sm text-text-secondary">Nếu bật, backend sẽ tự bỏ cờ chính ở các contact còn lại.</p>
        </div>
      </label>

      {errorMessage ? <div className="rounded-xl bg-danger-bg/80 px-4 py-3 text-sm text-danger">{errorMessage}</div> : null}

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

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Label({
  children,
  htmlFor
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label className="text-sm font-semibold text-text-primary" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function ErrorText({ message }: { message?: string }) {
  return message ? <p className="text-sm text-danger">{message}</p> : null;
}

function InfoLine({
  icon,
  value
}: {
  icon: "phone" | "mail";
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <AppIcon name={icon} className="h-4 w-4" />
      <span>{value}</span>
    </div>
  );
}
