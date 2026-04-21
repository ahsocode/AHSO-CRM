"use client";

import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, BusinessDocument, BusinessDocumentCreateInput } from "@/lib/types";

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
    }
  });
}

async function invalidateProject360(queryClient: QueryClient, projectId: string) {
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "documents"] });
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "overview-360"] });
  await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] });
}
