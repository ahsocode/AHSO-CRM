"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ActionResponse,
  ApiResponse,
  EmailAccountAdminItem,
  EmailMessage,
  MailboxFolder,
  MailboxMessageParams,
  MailboxMessagesResponse,
  MailboxThreadsResponse
} from "@/lib/types";

export interface CreateEmailAccountInput {
  userId: string;
  email: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
}

export interface SetupMailboxPasswordInput {
  password: string;
}

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  attachments?: string[];
}

export interface ReplyEmailInput {
  messageId: string;
  bodyHtml: string;
  bodyText?: string;
  replyAll?: boolean;
  attachments?: string[];
}

type MailboxPageMeta = MailboxMessagesResponse["meta"];

export interface BulkMailboxActionResult extends ActionResponse {
  affected: number;
  failed: Array<{ id: string; message: string }>;
}

const DEFAULT_MAILBOX_META: MailboxPageMeta = {
  total: 0,
  page: 1,
  limit: 50,
  totalPages: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeMailboxMeta(value: unknown, fallback: MailboxPageMeta = DEFAULT_MAILBOX_META): MailboxPageMeta {
  if (!isRecord(value)) return fallback;

  return {
    total: normalizeNumber(value.total, fallback.total),
    page: normalizeNumber(value.page, fallback.page),
    limit: normalizeNumber(value.limit, fallback.limit),
    totalPages: normalizeNumber(value.totalPages, fallback.totalPages),
  };
}

function unwrapPaginatedMailboxResponse<TItem>(
  payload: unknown,
  fallbackMeta: MailboxPageMeta = DEFAULT_MAILBOX_META
): { items: TItem[]; meta: MailboxPageMeta } {
  if (!isRecord(payload)) {
    return { items: [], meta: fallbackMeta };
  }

  if (Array.isArray(payload.items)) {
    return {
      items: payload.items as TItem[],
      meta: normalizeMailboxMeta(payload.meta, fallbackMeta),
    };
  }

  if (Array.isArray(payload.data)) {
    return {
      items: payload.data as TItem[],
      meta: normalizeMailboxMeta(payload.meta, fallbackMeta),
    };
  }

  if (isRecord(payload.data) && Array.isArray(payload.data.items)) {
    return {
      items: payload.data.items as TItem[],
      meta: normalizeMailboxMeta(payload.data.meta, fallbackMeta),
    };
  }

  return { items: [], meta: normalizeMailboxMeta(payload.meta, fallbackMeta) };
}

export function useMailboxFolders() {
  return useQuery({
    queryKey: ["mailbox", "folders"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<MailboxFolder[]>>("/mailbox/folders");
      return response.data.data;
    },
    staleTime: 60_000,  // folder list rarely changes — avoid refetch on every focus
    retry: 0
  });
}

export function useMailboxThreads(params: MailboxMessageParams) {
  return useQuery({
    queryKey: ["mailbox", "threads", params],
    queryFn: async () => {
      const response = await apiClient.get<unknown>("/mailbox/threads", { params });
      return unwrapPaginatedMailboxResponse<MailboxThreadsResponse["items"][number]>(response.data) satisfies MailboxThreadsResponse;
    },
    retry: 1,
  });
}

export function useMailboxMessages(params: MailboxMessageParams) {
  return useQuery({
    queryKey: ["mailbox", "messages", params],
    queryFn: async () => {
      const response = await apiClient.get<unknown>("/mailbox/messages", { params });
      return unwrapPaginatedMailboxResponse<EmailMessage>(response.data) satisfies MailboxMessagesResponse;
    },
    // staleTime intentionally omitted (defaults to 0) — mailbox data must always
    // refetch on folder switch; a 30s cache caused empty INBOX when emails had
    // only arrived after the first fetch.
    retry: 1            // retry once on network error before showing error state
  });
}

export function useMailboxMessage(id?: string | null) {
  return useQuery({
    queryKey: ["mailbox", "message", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<EmailMessage>>(`/mailbox/messages/${id}`);
      return response.data.data;
    },
    retry: 0
  });
}

export function useSendEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendEmailInput) => {
      const response = await apiClient.post<ApiResponse<ActionResponse>>("/mailbox/send", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useReplyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, ...payload }: ReplyEmailInput) => {
      const response = await apiClient.post<ApiResponse<ActionResponse>>(`/mailbox/messages/${messageId}/reply`, payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, isRead }: { messageId: string; isRead: boolean }) => {
      const response = await apiClient.patch<ApiResponse<ActionResponse>>(`/mailbox/messages/${messageId}/read`, { isRead });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useStarMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, isStarred }: { messageId: string; isStarred: boolean }) => {
      const response = await apiClient.patch<ApiResponse<ActionResponse>>(`/mailbox/messages/${messageId}/star`, { isStarred });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const response = await apiClient.delete<ApiResponse<ActionResponse>>(`/mailbox/messages/${messageId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useCustomerEmails(customerId: string, enabled = true) {
  return useQuery({
    queryKey: ["mailbox", "customer", customerId],
    enabled,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<EmailMessage[]>>(`/mailbox/customer/${customerId}`);
      return response.data.data;
    },
    retry: 0
  });
}

export function useSetupMailboxPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SetupMailboxPasswordInput) => {
      const response = await apiClient.post<ApiResponse<ActionResponse>>("/mailbox/account/setup", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-accounts"] });
    }
  });
}

export function useSyncMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse<ActionResponse>>("/mailbox/sync-me");
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useAdminEmailAccounts() {
  return useQuery({
    queryKey: ["admin", "email-accounts"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<EmailAccountAdminItem[]>>("/admin/email-accounts");
      return response.data.data;
    },
    retry: 0
  });
}

export function useCreateEmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateEmailAccountInput) => {
      const response = await apiClient.post<ApiResponse<EmailAccountAdminItem>>("/admin/email-accounts", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-accounts"] });
    }
  });
}

export function useDeleteEmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiClient.delete<ApiResponse<ActionResponse>>(`/admin/email-accounts/${accountId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-accounts"] });
    }
  });
}

export function useBulkCreateEmailAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ imapHost, smtpHost }: { imapHost: string; smtpHost: string }) => {
      const response = await apiClient.post<ApiResponse<{ created: number; message: string }>>(
        "/admin/email-accounts/bulk-create",
        null,
        { params: { imapHost, smtpHost } }
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-accounts"] });
    }
  });
}

export function useTestEmailConnection() {
  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiClient.post<ApiResponse<{ success: boolean; message: string }>>(
        `/admin/email-accounts/${accountId}/test-connection`
      );
      return response.data.data;
    },
  });
}

export function useSyncEmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiClient.post<ApiResponse<{ message: string }>>(
        `/admin/email-accounts/${accountId}/sync`
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "email-accounts"] });
    },
  });
}

export function useMailboxSignature() {
  return useQuery({
    queryKey: ["mailbox", "signature"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ signature: string }>>("/mailbox/signature");
      return response.data.data?.signature ?? "";
    },
    retry: 0
  });
}

export function useUpdateSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (signature: string) => {
      const response = await apiClient.patch<ApiResponse<ActionResponse>>("/mailbox/signature", { signature });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox", "signature"] });
    }
  });
}

export function useSaveDraft() {
  return useMutation({
    mutationFn: async (payload: { draftId?: string; to: string[]; cc: string[]; bcc: string[]; subject: string; bodyHtml: string }) => {
      const response = await apiClient.post<ApiResponse<{ draftId: string }>>("/mailbox/draft", payload);
      return response.data.data;
    }
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const response = await apiClient.delete<ApiResponse<ActionResponse>>(`/mailbox/draft/${draftId}`);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useContactsAutocomplete(query: string) {
  return useQuery({
    queryKey: ["mailbox", "contacts-autocomplete", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<{ name: string; email: string }[]>>(
        "/mailbox/contacts/autocomplete",
        { params: { q: query } }
      );
      return response.data.data ?? [];
    },
    staleTime: 30_000
  });
}

export function useBulkMailboxAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { ids: string[]; action: "markRead" | "markUnread" | "star" | "unstar" | "delete" }) => {
      const response = await apiClient.post<ApiResponse<BulkMailboxActionResult>>("/mailbox/messages/bulk", payload);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mailbox"] });
    }
  });
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post<ApiResponse<{ path: string; filename: string; size: number; mimeType: string }>>(
        "/mailbox/upload-attachment",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data.data;
    }
  });
}
