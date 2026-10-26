"use client";

import { CustomerCombobox } from "@/components/shared/customer-combobox";
import { ProjectCombobox } from "@/components/shared/project-combobox";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { CustomerQuickCreateDialog } from "@/components/shared/customer-quick-create-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSurvey, useSurvey, useUpdateSurvey } from "@/hooks/use-surveys";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { surveyFormSchema, SurveyFormValues } from "./form-schemas";

interface SurveyFormScreenProps {
  id?: string;
}

export function SurveyFormScreen({ id }: SurveyFormScreenProps) {
  const router = useRouter();
  const { data: survey, isLoading: isLoadingSurvey } = useSurvey(id ?? "");
  const createMutation = useCreateSurvey("");
  const updateMutation = useUpdateSurvey();

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: {
      title: "",
      surveyedAt: "",
      location: "",
      customerParticipants: "",
      objectives: "",
      summary: "",
      nextStep: "",
      customerId: "",
      projectId: "",
    },
  });

  const selectedCustomerId = form.watch("customerId");

  useEffect(() => {
    if (survey) {
      form.reset({
        title: survey.title,
        surveyedAt: survey.surveyedAt ? survey.surveyedAt.split("T")[0] : "",
        location: survey.location ?? "",
        customerParticipants: survey.customerParticipants ?? "",
        objectives: survey.objectives ?? "",
        summary: survey.summary ?? "",
        nextStep: survey.nextStep ?? "",
        customerId: survey.customerId,
        projectId: survey.projectId ?? "",
      });
    }
  }, [survey, form]);

  const onSubmit = async (values: SurveyFormValues) => {
    const payload = {
      title: values.title,
      surveyedAt: values.surveyedAt || undefined,
      location: values.location || undefined,
      customerParticipants: values.customerParticipants || undefined,
      objectives: values.objectives || undefined,
      summary: values.summary || undefined,
      nextStep: values.nextStep || undefined,
      customerId: values.customerId,
      projectId: values.projectId || undefined,
    };

    try {
      if (id) {
        await updateMutation.mutateAsync({ id, payload });
        router.push(`/surveys/${id}`);
      } else {
        const result = await createMutation.mutateAsync(payload);
        router.push(`/surveys/${result.id}`);
      }
    } catch {
      // Error handled by mutation toast
    }
  };

  if (id && isLoadingSurvey) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-8 w-48" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="text-primary-light hover:bg-primary-bg">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-text-primary">
            {id ? "Chỉnh sửa khảo sát" : "Tạo khảo sát mới"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiêu đề *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nhập tiêu đề khảo sát" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel htmlFor="customerId">Khách hàng *</FormLabel>
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary-mid hover:text-primary"
                          onClick={() => setQuickCreateOpen(true)}
                        >
                          + Tạo mới
                        </button>
                      </div>
                      <FormControl><CustomerCombobox {...field} id="customerId" value={field.value ?? ""} onChange={(value) => { field.onChange(value); if (value !== field.value) form.setValue("projectId", ""); }}  placeholder="Chọn khách hàng" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="projectId">Dự án</FormLabel>
                      <FormControl><ProjectCombobox {...field} id="projectId" value={field.value ?? ""} onChange={field.onChange} customerId={selectedCustomerId || undefined} disabled={!selectedCustomerId} placeholder="Chọn dự án (nếu có)" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="surveyedAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ngày khảo sát</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Địa điểm</FormLabel>
                      <FormControl>
                        <Input placeholder="Địa điểm khảo sát" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="customerParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Người tham dự từ khách hàng</FormLabel>
                    <FormControl>
                      <Input placeholder="Họ tên, chức vụ..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="objectives"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mục tiêu khảo sát</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Mục tiêu, phạm vi khảo sát..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tóm tắt kết quả</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Những phát hiện chính..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextStep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bước tiếp theo</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Hành động, thời hạn..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Huỷ
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending}>
                  {isPending ? "Đang lưu..." : id ? "Cập nhật" : "Tạo khảo sát"}
                </Button>
              </div>
            </form>
          </Form>
          {/* Rendered outside <form>: our Dialog has no portal, so inside the form its inputs
              would submit/reset the parent form (Enter key, react-hook-form reset). */}
          <CustomerQuickCreateDialog
            open={quickCreateOpen}
            onOpenChange={setQuickCreateOpen}
            onCreated={(customer) => {

              form.setValue("customerId", customer.id, { shouldValidate: true, shouldDirty: true });
              form.setValue("projectId", "");
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
