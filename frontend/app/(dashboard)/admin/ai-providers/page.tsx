"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AiProviderName,
  useAiProviders,
  useAiUsage,
  useDisconnectAiProvider,
  useInitiateOAuth,
  useTestAiProvider,
  useUpsertAiApiKey
} from "@/hooks/use-ai";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini"
};

export default function AdminAiProvidersPage() {
  const queryClient = useQueryClient();
  const providersQuery = useAiProviders();
  const usageQuery = useAiUsage(7);
  const saveMutation = useUpsertAiApiKey();
  const testMutation = useTestAiProvider();
  const disconnectMutation = useDisconnectAiProvider();
  const oauthMutation = useInitiateOAuth();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !isOAuthSuccessMessage(event.data)) {
        return;
      }

      toast({
        title: "Đã kết nối OAuth thành công",
        description: `Provider ${PROVIDER_LABELS[event.data.provider] ?? event.data.provider} đã sẵn sàng.`
      });
      void queryClient.invalidateQueries({ queryKey: ["ai"] });
    };

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient]);

  const saveApiKey = async (provider: AiProviderName) => {
    try {
      await saveMutation.mutateAsync({ provider, apiKey: apiKeys[provider] ?? "" });
      setApiKeys((current) => ({ ...current, [provider]: "" }));
      toast({ title: "Đã lưu khóa API" });
    } catch (error) {
      toast({ title: "Không lưu được khóa API", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const testProvider = async (provider: AiProviderName) => {
    try {
      const result = await testMutation.mutateAsync({ provider });
      toast({ title: "Kết nối AI hoạt động", description: result.message });
    } catch (error) {
      toast({ title: "Kiểm tra provider thất bại", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const disconnectProvider = async (provider: AiProviderName) => {
    try {
      await disconnectMutation.mutateAsync(provider);
      toast({ title: "Đã ngắt kết nối provider" });
    } catch (error) {
      toast({ title: "Không ngắt được provider", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const connectOAuth = async (provider: AiProviderName) => {
    const popup = window.open("", "oauth_popup", "width=600,height=700");
    if (!popup) {
      toast({
        title: "Không mở được cửa sổ OAuth",
        description: "Trình duyệt đang chặn popup. Hãy cho phép popup rồi thử lại.",
        variant: "destructive"
      });
      return;
    }

    try {
      popup.document.title = "Đang kết nối OAuth";
      popup.document.body.innerHTML = "<p>Đang chuẩn bị kết nối OAuth...</p>";
      const redirectUri = `${window.location.origin}/admin/ai-providers/callback`;
      const result = await oauthMutation.mutateAsync({ provider, redirectUri });
      popup.location.href = result.authorizeUrl;
    } catch (error) {
      popup.close();
      toast({ title: "Không khởi tạo được OAuth", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="AI Providers"
        description="Cấu hình GPT, Anthropic và Gemini cho các tính năng AI/Agent trong CRM."
      />

      {providersQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(providersQuery.data?.providers ?? []).map((provider) => (
            <Card key={provider.provider} className="border border-white/70">
              <CardHeader className="mb-0 gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  {provider.source === "database" ? "Credential DB" : provider.source === "env" ? "ENV fallback" : "Chưa cấu hình"}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{PROVIDER_LABELS[provider.provider]}</CardTitle>
                  <Badge variant={provider.configured ? "success" : provider.status === "ERROR" ? "danger" : "warning"}>
                    {provider.configured ? "Đã kết nối" : provider.status === "ERROR" ? "Lỗi" : "Chưa cấu hình"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <InfoRow label="Model" value={provider.model} />
                  <InfoRow label="Auth" value={provider.authMode === "oauth" ? "OAuth" : "API key"} />
                  <InfoRow label="Hết hạn" value={provider.expiresAt ? formatDateTime(provider.expiresAt) : "Không áp dụng"} />
                  {provider.lastError ? (
                    <p className="rounded-xl bg-danger-bg px-3 py-2 text-xs text-danger">{provider.lastError}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Input
                    type="password"
                    value={apiKeys[provider.provider] ?? ""}
                    onChange={(event) => setApiKeys((current) => ({
                      ...current,
                      [provider.provider]: event.target.value
                    }))}
                    placeholder="Nhập API key mới"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveApiKey(provider.provider)}
                      disabled={!apiKeys[provider.provider] || saveMutation.isPending}
                    >
                      Lưu khóa API
                    </Button>
                    {supportsOAuth(provider.provider, provider.authMode) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => connectOAuth(provider.provider)}
                        disabled={oauthMutation.isPending}
                      >
                        <AppIcon name="refresh" className="mr-1.5 h-3.5 w-3.5" />
                        Kết nối OAuth
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => testProvider(provider.provider)}
                      disabled={!provider.configured || testMutation.isPending}
                    >
                      Kiểm tra
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectProvider(provider.provider)}
                      disabled={provider.source !== "database" || disconnectMutation.isPending}
                    >
                      Ngắt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Usage 7 ngày</p>
          <CardTitle>Lưu lượng AI</CardTitle>
        </CardHeader>
        <CardContent>
          {usageQuery.isLoading ? (
            <LoadingSkeleton className="h-24 w-full" />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {(usageQuery.data?.byProvider ?? []).map((row) => (
                <div key={row.provider} className="rounded-2xl border border-border/50 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">{PROVIDER_LABELS[row.provider as AiProviderName] ?? row.provider}</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{row.requestCount}</p>
                  <p className="text-xs text-text-muted">
                    {row.errorCount} lỗi · {row.averageDurationMs}ms trung bình
                  </p>
                </div>
              ))}
              {(usageQuery.data?.byProvider.length ?? 0) === 0 ? (
                <p className="text-sm text-text-muted">Chưa có request AI nào trong 7 ngày gần đây.</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function supportsOAuth(provider: AiProviderName, authMode: string) {
  return provider === "gemini" || authMode === "oauth";
}

function isOAuthSuccessMessage(data: unknown): data is { type: "OAUTH_SUCCESS"; provider: AiProviderName } {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as { type?: unknown; provider?: unknown };
  return (
    candidate.type === "OAUTH_SUCCESS" &&
    (candidate.provider === "anthropic" || candidate.provider === "openai" || candidate.provider === "gemini")
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="truncate font-medium text-text-primary">{value}</span>
    </div>
  );
}
