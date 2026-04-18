"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ContractDetail,
  ContractFilters,
  ContractListItem,
  ContractListMeta,
  ContractMilestoneCreateInput,
  ContractMilestoneUpdateInput,
  ContractPaymentCreateInput
} from "@/lib/types";

export function useContracts(filters: ContractFilters) {
  return useQuery({
    queryKey: ["contracts", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ContractListItem[]>>("/contracts", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as ContractListMeta
      };
    }
  });
}

export function useContract(contractId: string) {
  return useQuery({
    queryKey: ["contracts", contractId],
    enabled: Boolean(contractId),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<ContractDetail>>(`/contracts/${contractId}`);
      return response.data.data;
    }
  });
}

export function useCreateContractMilestone(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ContractMilestoneCreateInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string }>>(
        `/contracts/${contractId}/milestones`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
}

export function useUpdateContractMilestone(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      milestoneId,
      payload
    }: {
      milestoneId: string;
      payload: ContractMilestoneUpdateInput;
    }) => {
      const response = await apiClient.patch<ApiResponse<{ id: string }>>(
        `/contracts/milestones/${milestoneId}`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  });
}

export function useCreateContractPayment(contractId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ContractPaymentCreateInput) => {
      const response = await apiClient.post<ApiResponse<{ id: string }>>(`/contracts/${contractId}/payments`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    }
  });
}
