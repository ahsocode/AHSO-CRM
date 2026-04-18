"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ApiResponse,
  ContractDetail,
  ContractFilters,
  ContractListItem,
  ContractListMeta
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
