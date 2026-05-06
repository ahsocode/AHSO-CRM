"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, LogoUploadResult, UploadedFileResult } from "@/lib/types";

export function useUploadLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      onProgress
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<LogoUploadResult>>("/upload/logo", formData, {
        onUploadProgress: (event) => {
          if (!event.total || !onProgress) {
            return;
          }

          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["settings", "logo"], exact: true })
      ]);
    }
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async ({
      file,
      onProgress
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<UploadedFileResult>>("/upload/file", formData, {
        onUploadProgress: (event) => {
          if (!event.total || !onProgress) {
            return;
          }

          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      return response.data.data;
    }
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async ({
      file,
      onProgress
    }: {
      file: File;
      onProgress?: (progress: number) => void;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ApiResponse<UploadedFileResult>>("/upload/avatar", formData, {
        onUploadProgress: (event) => {
          if (!event.total || !onProgress) {
            return;
          }

          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      return response.data.data;
    }
  });
}
