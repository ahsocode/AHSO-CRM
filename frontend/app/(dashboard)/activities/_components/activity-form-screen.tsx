'use client';

import { useEffect } from 'react';
import type { Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useCustomers } from '@/hooks/use-customers';
import { useProjects } from '@/hooks/use-projects';
import { activityFormSchema, ActivityFormValues } from './form-schemas';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { ArrowLeft } from 'lucide-react';
import { formatDateTimeLocalInput, parseDateTimeLocalInput } from '@/lib/format';

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

function getDateParamFromScheduledAt(value: Date): string {
  return formatDateTimeLocalInput(value).slice(0, 10);
}

function getInitialScheduledAt(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsedLocal = parseDateTimeLocalInput(value);
  if (parsedLocal) return parsedLocal;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function ActivityFormScreen({ id }: ActivityFormScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const isCalendarFlow = !id && returnTo === 'calendar';
  const initialScheduledAt = !id ? getInitialScheduledAt(searchParams.get('scheduledAt')) : undefined;
  const { data: activity, isLoading: isLoadingActivity } = useActivity(id || '');
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers({
    page: 1,
    limit: 100,
  });
  const customers = customersData?.items ?? [];

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: 'NOTE',
      title: '',
      content: '',
      customerId: '',
      projectId: '',
      attachmentUrl: '',
      scheduledAt: initialScheduledAt,
      isCompleted: false,
    },
  });

  const selectedCustomerId = form.watch('customerId');
  const { data: projectsData, isLoading: isLoadingProjects } = useProjects(
    {
      page: 1,
      limit: 100,
      customerId: selectedCustomerId || undefined,
    },
    Boolean(selectedCustomerId)
  );
  const projects = projectsData?.items ?? [];

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
    if (isCalendarFlow && !values.scheduledAt) {
      form.setError('scheduledAt', {
        type: 'manual',
        message: 'Cần chọn thời gian dự kiến để hoạt động hiển thị trên lịch công tác',
      });
      return;
    }

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
        if (isCalendarFlow && values.scheduledAt) {
          router.push(`/calendar?date=${getDateParamFromScheduledAt(values.scheduledAt)}` as Route);
        } else {
          router.push(`/activities/${result.id}`);
        }
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoadingActivity) {
    return (
      <div className="bg-white rounded-lg p-8 text-center text-text-secondary">
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
        className="text-primary-light hover:bg-info-bg"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-text-primary">
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
                    <FormLabel className="text-text-primary">Loại hoạt động *</FormLabel>
                    <SelectRoot value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="border-border">
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
                    <FormLabel className="text-text-primary">Tiêu đề *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nhập tiêu đề hoạt động"
                        className="border-border focus-visible:ring-primary-light"
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
                    <FormLabel className="text-text-primary">Nội dung</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Nhập chi tiết hoạt động"
                        className="border-border focus-visible:ring-primary-light"
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
                      <FormLabel className="text-text-primary">Khách hàng</FormLabel>
                      <SelectRoot
                        value={field.value || 'none'}
                        onValueChange={(value) => {
                          const next = value === 'none' ? '' : value;
                          field.onChange(next);
                          // Reset project when customer changes
                          if (next !== field.value) {
                            form.setValue('projectId', '');
                          }
                        }}
                        disabled={isLoadingCustomers}
                      >
                        <FormControl>
                          <SelectTrigger className="border-border">
                            <SelectValue
                              placeholder={
                                isLoadingCustomers ? 'Đang tải...' : 'Chọn khách hàng (nếu có)'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">— Không chọn —</SelectItem>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                              {customer.shortName ? ` (${customer.shortName})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-text-primary">Dự án</FormLabel>
                      <SelectRoot
                        value={field.value || 'none'}
                        onValueChange={(value) =>
                          field.onChange(value === 'none' ? '' : value)
                        }
                        disabled={!selectedCustomerId || isLoadingProjects}
                      >
                        <FormControl>
                          <SelectTrigger className="border-border">
                            <SelectValue
                              placeholder={
                                !selectedCustomerId
                                  ? 'Chọn khách hàng trước'
                                  : isLoadingProjects
                                    ? 'Đang tải...'
                                    : projects.length === 0
                                      ? 'Khách hàng chưa có dự án'
                                      : 'Chọn dự án (nếu có)'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">— Không chọn —</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.code} - {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
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
                    <FormLabel className="text-text-primary">
                      Thời gian dự kiến{isCalendarFlow ? ' *' : ''}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="border-border focus-visible:ring-primary-light"
                        {...field}
                        value={field.value instanceof Date ? formatDateTimeLocalInput(field.value) : ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            field.onChange(parseDateTimeLocalInput(e.target.value));
                          } else {
                            field.onChange(undefined);
                          }
                        }}
                      />
                    </FormControl>
                    {isCalendarFlow ? (
                      <p className="text-xs text-text-secondary">
                        Hoạt động tạo từ lịch cần có thời gian để hiển thị đúng trên lịch công tác.
                      </p>
                    ) : null}
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
                    <FormLabel className="text-text-primary">Liên kết tệp đính kèm</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        className="border-border"
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
                          className="border-border"
                        />
                      </FormControl>
                      <FormLabel className="text-text-primary cursor-pointer mb-0">
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
                  className="border-border text-text-primary"
                >
                  Huỷ
                </Button>
                <Button
                  type="submit"
                  className="bg-primary-mid hover:bg-primary-hover"
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
