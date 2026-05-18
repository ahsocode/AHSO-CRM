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
  MailboxMessagesResponse
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
}

export function useMailboxFolders() {
  return useQuery({
    queryKey: ["mailbox", "folders"],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<MailboxFolder[]>>("/mailbox/folders");
      return response.data.data;
    },
    retry: 0
  });
}

export function useMailboxMessages(params: MailboxMessageParams) {
  return useQuery({
    queryKey: ["mailbox", "messages", params],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<MailboxMessagesResponse>>("/mailbox/messages", { params });
      return response.data.data;
    },
    retry: 0
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
