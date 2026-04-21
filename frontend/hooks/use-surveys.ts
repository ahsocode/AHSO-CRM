"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { ApiResponse, Survey, SurveyCreateInput, SurveyMedia, SurveyNote, SurveyNoteInput } from "@/lib/types";

export function useProjectSurveys(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "surveys"],
    enabled: Boolean(projectId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Survey[]>>(`/projects/${projectId}/surveys`);
      return response.data.data;
    }
  });
}

export function useCreateSurvey(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SurveyCreateInput) => {
      const response = await apiClient.post<ApiResponse<Survey>>("/surveys", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "surveys"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "overview-360"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] });
      toast("Đã tạo lần khảo sát mới.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tạo khảo sát.",
        variant: "destructive"
      });
    }
  });
}

export function useAddSurveyNote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ surveyId, payload }: { surveyId: string; payload: SurveyNoteInput }) => {
      const response = await apiClient.post<ApiResponse<SurveyNote>>(`/surveys/${surveyId}/notes`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "surveys"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "overview-360"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] });
      toast("Đã thêm ghi chú khảo sát.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể thêm ghi chú khảo sát.",
        variant: "destructive"
      });
    }
  });
}

export function useUploadSurveyMedia(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      surveyId,
      file,
      caption,
      area,
      isImportant
    }: {
      surveyId: string;
      file: File;
      caption?: string;
      area?: string;
      isImportant?: boolean;
    }) => {
      const formData = new FormData();
      formData.append("file", file);

      if (caption) {
        formData.append("caption", caption);
      }

      if (area) {
        formData.append("area", area);
      }

      formData.append("isImportant", String(Boolean(isImportant)));

      const response = await apiClient.post<ApiResponse<SurveyMedia>>(`/surveys/${surveyId}/media`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "surveys"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "overview-360"] });
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] });
      toast("Đã tải media khảo sát.");
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể tải media khảo sát.",
        variant: "destructive"
      });
    }
  });
}
