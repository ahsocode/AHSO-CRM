"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface BackupFile {
  name: string;
  size: number;
  modTime: string;
  sizeHuman: string;
}

export function useBackups() {
  return useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: BackupFile[] }>("/admin/backup");
      return res.data.data;
    },
    refetchInterval: false
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post("/admin/backup"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] })
  });
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: (filename: string) => apiClient.post(`/admin/backup/${encodeURIComponent(filename)}/restore`)
  });
}

export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => apiClient.delete(`/admin/backup/${encodeURIComponent(filename)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["backups"] })
  });
}
