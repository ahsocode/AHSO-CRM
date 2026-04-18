'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useActivity, useCreateActivity, useUpdateActivity } from '@/hooks/use-activities';
import { activityFormSchema, ActivityFormValues } from './form-schemas';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { ArrowLeft } from 'lucide-react';

const ACTIVITY_TYPES = [
  { value: 'CALL', label: 'Cuộc gọi' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Họp mặt' },
  { value: 'SURVEY', label: 'Khảo sát' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'NOTE', label: 'Ghi chú' },
  { value: 'FOLLOWUP', label: 'Theo dõi' },
];

interface ActivityFormScreenProps {
  id?: string;
}

export function ActivityFormScreen({ id }: ActivityFormScreenProps) {
  const router = useRouter();
  const { data: activity, isLoading: isLoadingActivity } = useActivity(id || '');
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: 'NOTE',
      title: '',
      content: '',
      customerId: '',
      projectId: '',
      attachmentUrl: '',
      scheduledAt: undefined,
      isCompleted: false,
    },
  });

  useEffect(() => {
    if (activity) {
      form.reset({
        type: activity.type,
        title: activity.title,
        content: activity.content || '',
        customerId: activity.customer?.id || '',
        projectId: activity.project?.id || '',
        attachmentUrl: activity.attachmentUrl || '',
        scheduledAt: activity.scheduledAt ? new Date(activity.scheduledAt) : undefined,
        isCompleted: activity.isCompleted,
      });
    }
  }, [activity, form]);

  const onSubmit = async (values: ActivityFormValues) => {
    const input = {
      type: values.type,
      title: values.title,
      content: values.content || undefined,
      customerId: values.customerId || undefined,
      projectId: values.projectId || undefined,
      attachmentUrl: values.attachmentUrl || undefined,
      scheduledAt: values.scheduledAt,
    };

    try {
      if (id) {
        await updateMutation.mutateAsync({
          id,
          input: { ...input, isCompleted: values.isCompleted },
        });
        router.push(`/activities/${id}`);
      } else {
        const result = await createMutation.mutateAsync(input);
        router.push(`/activities/${result.data.id}`);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoadingActivity) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-[#5D6D7E]">
        <LoadingSkeleton className="h-12 w-48 mx-auto mb-4" />
        <LoadingSkeleton className="h-4 w-64 mx-auto mb-2" />
        <LoadingSkeleton className="h-4 w-64 mx-auto" />
      </div>
    );
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="text-[#2E86C1] hover:bg-[#D6EAF8]"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1C2833]">
            {id ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động mới'}
          </CardTitle>
          <CardDescription>
            {id ? 'Cập nhật thông tin hoạt động' : 'Tạo một hoạt động mới để ghi nhớ'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1C2833]">Loại hoạt động *</FormLabel>
                    <SelectRoot value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="border-[#D5D8DC]">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIVITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </SelectRoot>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1C2833]">Tiêu đề *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nhập tiêu đề hoạt động"
                        className="border-[#D5D8DC] focus-visible:ring-[#2E86C1]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Content */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1C2833]">Nội dung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Nhập chi tiết hoạt động"
                        className="border-[#D5D8DC] focus-visible:ring-[#2E86C1]"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer and Project */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#1C2833]">Khách hàng</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mã khách hàng (nếu có)"
                          className="border-[#D5D8DC]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#1C2833]">Dự án</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mã dự án (nếu có)"
                          className="border-[#D5D8DC]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Scheduled At */}
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1C2833]">Thời gian dự kiến</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="border-[#D5D8DC] focus-visible:ring-[#2E86C1]"
                        {...field}
                        value={field.value instanceof Date ? field.value.toISOString().slice(0, 16) : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            field.onChange(new Date(e.target.value));
                          } else {
                            field.onChange(undefined);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attachment URL */}
              <FormField
                control={form.control}
                name="attachmentUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[#1C2833]">Liên kết tệp đính kèm</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        className="border-[#D5D8DC]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Completion Status (only for edit) */}
              {id && (
                <FormField
                  control={form.control}
                  name="isCompleted"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="border-[#D5D8DC]"
                        />
                      </FormControl>
                      <FormLabel className="text-[#1C2833] cursor-pointer mb-0">
                        Đánh dấu là hoàn tất
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="border-[#D5D8DC] text-[#1C2833]"
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  className="bg-[#1A5276] hover:bg-[#154360]"
                  disabled={isLoading}
                >
                  {isLoading ? 'Đang lưu...' : id ? 'Cập nhật' : 'Tạo'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
