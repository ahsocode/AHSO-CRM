"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, LogoUploadResult } from "@/lib/types";

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
        headers: {
          "Content-Type": "multipart/form-data"
        },
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
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "logo"] }),
        queryClient.invalidateQueries({ queryKey: ["settings", "company"] })
      ]);
    }
  });
}
