"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ApiResponse,
  DocumentTemplateCreateInput,
  DocumentTemplateRegistryItem,
  DocumentTemplateType,
  DocumentTemplateVariant,
  DocumentTemplateVariantUpdateInput,
  TemplateCatalog
} from "@/lib/types";

export interface DocumentListItem {
  id: string;
  type: string;
  number: string;
  version: number;
  language: string;
  entityType: string;
  entityId: string;
  pdfPath?: string | null;
  renderedAt?: string | null;
  createdAt: string;
  customer?: { id: string; name: string; code?: string | null } | null;
  createdBy: { id: string; name: string; email: string };
}

export interface DocumentListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentFilters {
  page?: number;
  limit?: number;
  type?: string;
  entityType?: string;
  entityId?: string;
  customerId?: string;
}

export interface RenderDocumentPayload {
  language: "vi" | "vi-en";
  extra?: Record<string, unknown>;
}

export interface RenderDocumentResult {
  documentId: string;
  number: string;
  downloadUrl: string;
  renderedAt: string;
}

function normalizeApiPath(url: string) {
  if (url.startsWith("/api/")) {
    return url.replace(/^\/api/, "");
  }

  return url;
}

function variantListKey(type?: DocumentTemplateType) {
  return type ? ["documents", "template-variants", type] : ["documents", "template-variants"];
}

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ["documents", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DocumentListItem[]>>("/documents", {
        params: filters
      });

      return {
        items: response.data.data,
        meta: response.data.meta as DocumentListMeta
      };
    }
  });
}

export function usePreviewDocument() {
  return useMutation({
    mutationFn: async ({
      type,
      entityId,
      lang
    }: {
      type: string;
      entityId: string;
      lang: string;
    }) => {
      const response = await apiClient.get<string>(`/documents/${type}/${entityId}/preview`, {
        params: { lang }
      });
      return response.data;
    }
  });
}

export function useRenderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      entityId,
      payload
    }: {
      type: string;
      entityId: string;
      payload: RenderDocumentPayload;
    }) => {
      const response = await apiClient.post<ApiResponse<RenderDocumentResult>>(
        `/documents/${type}/${entityId}/render`,
        payload
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    }
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({
      downloadUrl,
      filename
    }: {
      downloadUrl: string;
      filename: string;
    }) => {
      const response = await apiClient.get(normalizeApiPath(downloadUrl), {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  });
}

export function useDocumentTemplateRegistry() {
  return useQuery({
    queryKey: ["documents", "template-registry"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DocumentTemplateRegistryItem[]>>(
        "/documents/template-registry"
      );
      return response.data.data;
    }
  });
}

export function useDocumentTemplateVariants(type?: DocumentTemplateType) {
  return useQuery({
    queryKey: variantListKey(type),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DocumentTemplateVariant[]>>(
        "/documents/templates",
        {
          params: type ? { type } : undefined
        }
      );
      return response.data.data;
    }
  });
}

export function useDocumentTemplateVariant(id?: string) {
  return useQuery({
    queryKey: ["documents", "template-variant", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}`
      );
      return response.data.data;
    }
  });
}

export function useDocumentTemplateCatalog(type?: DocumentTemplateType) {
  return useQuery({
    queryKey: ["documents", "template-catalog", type],
    enabled: Boolean(type),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<TemplateCatalog>>(
        `/documents/template-catalog/${type}`
      );
      return response.data.data;
    }
  });
}

export function useCreateDocumentTemplateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DocumentTemplateCreateInput) => {
      const response = await apiClient.post<ApiResponse<DocumentTemplateVariant>>(
        "/documents/templates",
        payload
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useUpdateDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DocumentTemplateVariantUpdateInput) => {
      const response = await apiClient.patch<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}`,
        payload
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "template-variant", variant.id] }),
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useSubmitDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}/submit-review`
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "template-variant", variant.id] }),
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useApproveDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}/approve`
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "template-variant", variant.id] }),
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useSetActiveDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}/set-active`
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", "template-variant", variant.id] }),
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useDuplicateDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { name?: string }) => {
      const response = await apiClient.post<ApiResponse<DocumentTemplateVariant>>(
        `/documents/templates/${id}/duplicate`,
        payload ?? {}
      );
      return response.data.data;
    },
    onSuccess: async (variant) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: variantListKey(variant.type) }),
        queryClient.invalidateQueries({ queryKey: variantListKey() })
      ]);
    }
  });
}

export function useDeleteDocumentTemplateVariant(id?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<ApiResponse<{ id: string; deleted: boolean }>>(
        `/documents/templates/${id}`
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: variantListKey() }),
        queryClient.invalidateQueries({ queryKey: ["documents", "template-variant"] })
      ]);
    }
  });
}
