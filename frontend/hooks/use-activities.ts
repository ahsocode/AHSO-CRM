import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

export interface ActivityListItem {
  id: string;
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'SURVEY' | 'DEMO' | 'NOTE' | 'FOLLOWUP';
  title: string;
  content?: string;
  scheduledAt?: string;
  doneAt?: string;
  isCompleted: boolean;
  attachmentUrl?: string;
  customer?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    code: string;
    name: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDetail extends ActivityListItem {
  customer?: {
    id: string;
    name: string;
    status: string;
  };
  project?: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ActivityInput {
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'SURVEY' | 'DEMO' | 'NOTE' | 'FOLLOWUP';
  title: string;
  content?: string;
  customerId?: string;
  projectId?: string;
  attachmentUrl?: string;
  scheduledAt?: Date;
  isCompleted?: boolean;
}

export interface ActivityFilters {
  page?: number;
  limit?: number;
  type?: string;
  customerId?: string;
  projectId?: string;
  userId?: string;
  isCompleted?: boolean;
  search?: string;
}

export function useActivities(filters: ActivityFilters) {
  return useQuery({
    queryKey: ['activities', filters],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ActivityListItem[]; meta: any }>('/activities', { params: filters });
      return {
        items: res.data.data,
        meta: res.data.meta
      };
    },
    staleTime: 30_000,
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activities', id],
    queryFn: async () => {
      const res = await apiClient.get(`/activities/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ActivityInput) => apiClient.post('/activities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({
        title: 'Thành công',
        description: 'Đã tạo hoạt động',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể tạo hoạt động',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; input: Partial<ActivityInput> }) =>
      apiClient.patch(`/activities/${data.id}`, data.input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', variables.id] });
      toast({
        title: 'Thành công',
        description: 'Đã cập nhật hoạt động',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể cập nhật hoạt động',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/activities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      toast({
        title: 'Thành công',
        description: 'Đã xoá hoạt động',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Lỗi',
        description: error.response?.data?.message || 'Không thể xoá hoạt động',
        variant: 'destructive',
      });
    },
  });
}
