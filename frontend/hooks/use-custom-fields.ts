"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  ActionResponse,
  ApiResponse,
  CustomFieldDefinition,
  CustomFieldResource,
  CustomFieldUpsertInput
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";

export function useCustomFields(resource?: CustomFieldResource) {
  return useQuery({
    queryKey: ["custom-fields", resource ?? "all"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomFieldDefinition[]>>("/custom-fields", {
        params: resource ? { resource } : undefined
      });

      return response.data.data;
    }
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CustomFieldUpsertInput) => {
      const response = await apiClient.post<ApiResponse<CustomFieldDefinition>>("/custom-fields", payload);
      return response.data.data;
    },
    onSuccess: async (field) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["custom-fields"] }),
        queryClient.invalidateQueries({ queryKey: ["custom-fields", field.resource] })
      ]);
      toast("Đã tạo custom field mới.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể tạo custom field."),
        variant: "destructive"
      });
    }
  });
}

export function useUpdateCustomField(fieldId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<CustomFieldUpsertInput>) => {
      const response = await apiClient.patch<ApiResponse<CustomFieldDefinition>>(`/custom-fields/${fieldId}`, payload);
      return response.data.data;
    },
    onSuccess: async (field) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["custom-fields"] }),
        queryClient.invalidateQueries({ queryKey: ["custom-fields", field.resource] })
      ]);
      toast("Đã cập nhật custom field.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể cập nhật custom field."),
        variant: "destructive"
      });
    }
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldId: string) => {
      const response = await apiClient.delete<ApiResponse<ActionResponse>>(`/custom-fields/${fieldId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      toast("Đã xóa custom field.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể xóa custom field."),
        variant: "destructive"
      });
    }
  });
}
