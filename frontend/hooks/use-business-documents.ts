"use client";

import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, BusinessDocument, BusinessDocumentCreateInput, BusinessDocumentSource, BusinessDocumentStatus, BusinessDocumentType } from "@/lib/types";

export function useCreateBusinessDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BusinessDocumentCreateInput) => {
      const response = await apiClient.post<ApiResponse<BusinessDocument>>("/business-documents", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateProject360(queryClient, projectId);
      toast("Đã tạo hồ sơ tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo hồ sơ tài liệu.",
        variant: "destructive"
      });
    }
  });
}

export function useUploadBusinessDocumentFile(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, file }: { documentId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<BusinessDocument>>(
        `/business-documents/${documentId}/file`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateProject360(queryClient, projectId);
      toast("Đã tải tệp tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải tệp tài liệu.",
        variant: "destructive"
      });
    }
  });
}

export function useMarkBusinessDocumentSigned(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiClient.post<ApiResponse<BusinessDocument>>(
        `/business-documents/${documentId}/mark-signed`
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateProject360(queryClient, projectId);
      toast("Đã đánh dấu tài liệu đã ký.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể đánh dấu tài liệu đã ký.",
        variant: "destructive"
      });
    }
  });
}

export function useUpdateBusinessDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      payload
    }: {
      documentId: string;
      payload: Partial<BusinessDocumentCreateInput>;
    }) => {
      const response = await apiClient.patch<ApiResponse<BusinessDocument>>(`/business-documents/${documentId}`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateProject360(queryClient, projectId);
      toast("Đã cập nhật thông tin tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể cập nhật tài liệu.",
        variant: "destructive"
      });
    }
  });
}

export function useArchiveBusinessDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiClient.patch<ApiResponse<BusinessDocument>>(`/business-documents/${documentId}`, {
        status: "ARCHIVED"
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await invalidateProject360(queryClient, projectId);
      toast("Đã lưu trữ tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể lưu trữ tài liệu.",
        variant: "destructive"
      });
    }
  });
}

export interface BusinessDocumentListItem {
  items: BusinessDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useBusinessDocuments(filters: {
  page?: number;
  limit?: number;
  type?: BusinessDocumentType;
  status?: BusinessDocumentStatus;
  source?: BusinessDocumentSource;
  customerId?: string;
  projectId?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["business-documents", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      const response = await apiClient.get<ApiResponse<BusinessDocument[]>>(
        `/business-documents?${params.toString()}`
      );
      const meta = response.data.meta;
      return {
        items: response.data.data,
        total: meta?.total ?? 0,
        page: meta?.page ?? 1,
        limit: meta?.limit ?? 20,
        totalPages: meta?.totalPages ?? 1
      } satisfies BusinessDocumentListItem;
    }
  });
}

export function useDeleteBusinessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/business-documents/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["business-documents"] });
      toast("Đã xóa tài liệu.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể xóa tài liệu.",
        variant: "destructive"
      });
    }
  });
}

async function invalidateProject360(queryClient: QueryClient, projectId: string) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "documents"] });
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "overview-360"] });
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] });
}
