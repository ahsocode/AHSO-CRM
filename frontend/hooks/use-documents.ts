"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ApiResponse } from "@/lib/types";

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

/**
 * List generated documents with pagination and filters.
 */
export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ["documents", filters],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<DocumentListItem[]>>("/documents", {
        params: filters,
      });

      return {
        items: response.data.data,
        meta: response.data.meta as DocumentListMeta,
      };
    },
  });
}

/**
 * Fetch HTML preview for a document type and entity.
 */
export function usePreviewDocument() {
  return useMutation({
    mutationFn: async ({
      type,
      entityId,
      lang,
    }: {
      type: string;
      entityId: string;
      lang: string;
    }) => {
      const response = await apiClient.get<string>(`/documents/${type}/${entityId}/preview`, {
        params: { lang },
        // NestJS returns plain string for preview, but apiClient wrap might expect JSON 
        // depending on how global interceptors are set up.
      });
      return response.data;
    },
  });
}

/**
 * Trigger server-side PDF generation and record creation.
 */
export function useRenderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      entityId,
      payload,
    }: {
      type: string;
      entityId: string;
      payload: RenderDocumentPayload;
    }) => {
      const response = await apiClient.post<ApiResponse<{ id: string; number: string; pdfUrl: string }>>(
        `/documents/${type}/${entityId}/render`,
        payload
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/**
 * Trigger live render and browser download of a PDF.
 */
export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({
      type,
      entityId,
      lang,
      filename,
    }: {
      type: string;
      entityId: string;
      lang: string;
      filename: string;
    }) => {
      const response = await apiClient.get(`/documents/${type}/${entityId}/download`, {
        params: { lang },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}
