"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/types";

export interface AiCustomerSummaryResult {
  customerId: string;
  summary: string;
}

export interface AiProjectForecastResult {
  projectId: string;
  probabilityPercent: number;
  forecastedRevenue: number;
  reasoning: string;
}

export interface AiDraftEmailInput {
  customerId?: string;
  projectId?: string;
  quoteId?: string;
  instruction: string;
}

export interface AiDraftEmailResult {
  subject: string;
  body: string;
}

export function useAiCustomerSummary(customerId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<AiCustomerSummaryResult>>(
        `/ai/customers/${customerId}/summarize`
      );
      return response.data.data;
    }
  });
}

export function useAiProjectForecast(projectId: string) {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<AiProjectForecastResult>>(
        `/ai/projects/${projectId}/forecast`
      );
      return response.data.data;
    }
  });
}

export function useAiDraftEmail() {
  return useMutation({
    mutationFn: async (payload: AiDraftEmailInput) => {
      const response = await apiClient.post<ApiResponse<AiDraftEmailResult>>("/ai/draft-email", payload);
      return response.data.data;
    }
  });
}
