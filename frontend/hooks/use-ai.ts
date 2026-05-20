"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export type AiProviderName = "anthropic" | "openai" | "gemini";
export type AiAuthMode = "api_key" | "oauth";

export interface AiProviderStatus {
  provider: AiProviderName;
  configured: boolean;
  model: string;
  authMode: AiAuthMode;
  status: "ACTIVE" | "ERROR" | "DISABLED" | "UNCONFIGURED";
  lastError: string | null;
  expiresAt: string | null;
  hasRefreshToken: boolean;
  source: "database" | "env" | "none";
}

export interface AiProviderStatusResponse {
  activeProvider: AiProviderName | null;
  providers: AiProviderStatus[];
}

export interface AiUsageSummary {
  days: number;
  totalRequests: number;
  totalErrors: number;
  byProvider: Array<{
    provider: string;
    requestCount: number;
    errorCount: number;
    totalTokens: number;
    totalDurationMs: number;
    averageDurationMs: number;
  }>;
}

export interface UpsertAiApiKeyInput {
  provider: AiProviderName;
  apiKey: string;
}

export interface TestAiProviderInput {
  provider: AiProviderName;
  prompt?: string;
}

export interface TestAiProviderResult {
  success: boolean;
  provider: AiProviderName;
  model: string;
  durationMs: number;
  message: string;
}

export interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  provider: AiProviderName | null;
  model: string | null;
  enabledTools: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt: string;
  provider?: AiProviderName;
  model?: string;
  enabledTools: string[];
  isActive: boolean;
}

export interface AgentRunResult {
  runId: string;
  status: "SUCCESS" | "ERROR";
  output: string;
  toolCalls: Array<{
    toolName: string;
    inputJson: unknown;
    outputJson: unknown;
    status: string;
    durationMs: number;
  }>;
}

export function useAiProviders() {
  return useQuery({
    queryKey: ["ai", "providers"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AiProviderStatusResponse>>("/ai/providers");
      return response.data.data;
    },
    retry: 0
  });
}

export function useAiUsage(days = 7) {
  return useQuery({
    queryKey: ["ai", "usage", days],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AiUsageSummary>>("/ai/usage", { params: { days } });
      return response.data.data;
    },
    retry: 0
  });
}

export function useUpsertAiApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, apiKey }: UpsertAiApiKeyInput) => {
      const response = await apiClient.post<ApiResponse<AiProviderStatus>>(`/ai-credentials/${provider}/api-key`, {
        apiKey,
        scopes: []
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-credentials"] });
    }
  });
}

export function useDisconnectAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (provider: AiProviderName) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/ai-credentials/${provider}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai"] });
      await queryClient.invalidateQueries({ queryKey: ["ai-credentials"] });
    }
  });
}

export function useTestAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, prompt }: TestAiProviderInput) => {
      const response = await apiClient.post<ApiResponse<TestAiProviderResult>>(`/ai-credentials/${provider}/test`, {
        prompt
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai"] });
    }
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<AgentItem[]>>("/agents");
      return response.data.data;
    },
    retry: 0
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAgentInput) => {
      const response = await apiClient.post<ApiResponse<AgentItem>>("/agents", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    }
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agentId: string) => {
      const response = await apiClient.delete<ApiResponse<{ success: boolean }>>(`/agents/${agentId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
    }
  });
}

export function useRunAgent() {
  return useMutation({
    mutationFn: async ({ agentId, input }: { agentId: string; input: string }) => {
      const response = await apiClient.post<ApiResponse<AgentRunResult>>(`/agents/${agentId}/run`, { input });
      return response.data.data;
    }
  });
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
