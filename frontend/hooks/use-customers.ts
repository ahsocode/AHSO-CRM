"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ActionResponse,
  ApiResponse,
  ContactUpsertInput,
  CustomerContact,
  CustomerDetail,
  CustomerDetailStats,
  CustomerFilters,
  CustomerListItem,
  CustomerListMeta,
  CustomerUpsertInput
} from "@/lib/types";

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ["customers", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomerListItem[]>>("/customers", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as CustomerListMeta
      };
    }
  });
}

export function useDeletedCustomers(filters: CustomerFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["customers", "deleted", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomerListItem[]>>("/customers/deleted", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as CustomerListMeta
      };
    }
  });
}

export function useCustomer(customerId: string) {
  return useQuery({
    queryKey: ["customers", customerId],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomerDetail>>(`/customers/${customerId}`);
      return response.data.data;
    }
  });
}

export function useCustomerStats(customerId: string) {
  return useQuery({
    queryKey: ["customers", customerId, "stats"],
    enabled: Boolean(customerId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomerDetailStats>>(`/customers/${customerId}/stats`);
      return response.data.data;
    }
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CustomerUpsertInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string }>>("/customers", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useImportCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CustomerUpsertInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string; isNew: boolean }>>("/customers/import", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useUpdateCustomer(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<CustomerUpsertInput>) => {
      const response = await apiClient.patch<ApiResponse<{ id: string }>>(`/customers/${customerId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["customers", customerId, "stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useDeleteCustomer(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/customers/${customerId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerId: string) => {
      const response = await apiClient.patch<ApiResponse<CustomerListItem>>(`/customers/${customerId}/restore`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useCreateContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ContactUpsertInput) => {
      const response = await apiClient.post<ApiResponse<CustomerContact>>(
        `/customers/${customerId}/contacts`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", customerId] });
    }
  });
}

export function useUpdateContact(customerId: string, contactId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<ContactUpsertInput>) => {
      if (!contactId) {
        throw new Error("Không tìm thấy liên hệ cần cập nhật");
      }

      const response = await apiClient.patch<ApiResponse<CustomerContact>>(`/contacts/${contactId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", customerId] });
    }
  });
}

export function useDeleteContact(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/contacts/${contactId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["customers", customerId] });
    }
  });
}

export interface CustomerDuplicateRecord {
  id: string;
  name: string;
  taxCode?: string | null;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  industry?: string | null;
  status: string;
  createdAt: string;
  assignedTo: { id: string; name: string };
  _count: { projects: number; contacts: number; activities: number };
}

export interface CustomerDuplicateGroup {
  customers: CustomerDuplicateRecord[];
}

export function useDuplicateCustomers() {
  return useQuery({
    queryKey: ["customers", "duplicates"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<CustomerDuplicateGroup[]>>("/customers/duplicates");
      return response.data.data;
    },
    staleTime: 0
  });
}

export function useMergeCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { primaryId: string; duplicateIds: string[] }) => {
      const response = await apiClient.post<ApiResponse<{ success: boolean }>>("/customers/merge", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}

export function useBulkCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { action: "assign" | "delete" | "export"; ids: string[]; assignedToId?: string }) => {
      const response = await apiClient.post<ApiResponse<{ action: string; processedCount?: number; items?: Record<string, unknown>[] }>>(
        "/customers/bulk",
        payload
      );
      return response.data.data;
    },
    onSuccess: async (data) => {
      if (data.action !== "export") {
        await queryClient.invalidateQueries({ queryKey: ["customers"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        await queryClient.invalidateQueries({ queryKey: ["reports"] });
      }
    }
  });
}
