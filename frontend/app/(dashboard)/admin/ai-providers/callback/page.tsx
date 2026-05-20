"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppIcon } from "@/components/shared/app-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiProviderName } from "@/hooks/use-ai";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/types";

interface OAuthCallbackResult {
  provider: AiProviderName;
  authMode: string;
  status: string;
}

type CallbackState =
  | { status: "loading" }
  | { status: "success"; provider: AiProviderName }
  | { status: "error"; message: string };

export default function AiProviderOAuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell state={{ status: "loading" }} />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const [callbackState, setCallbackState] = useState<CallbackState>({ status: "loading" });
  const queryKey = useMemo(() => `${state ?? ""}:${code ?? ""}`, [state, code]);

  useEffect(() => {
    let cancelled = false;

    const finishOAuth = async () => {
      if (!state || !code) {
        setCallbackState({ status: "error", message: "Thiếu state hoặc code từ OAuth provider." });
        return;
      }

      try {
        const response = await apiClient.get<ApiResponse<OAuthCallbackResult>>("/ai-credentials/oauth/callback", {
          params: { state, code }
        });

        if (cancelled) return;

        const provider = response.data.data.provider;
        setCallbackState({ status: "success", provider });

        if (window.opener) {
          window.opener.postMessage({ type: "OAUTH_SUCCESS", provider }, window.location.origin);
          window.setTimeout(() => window.close(), 800);
        }
      } catch (error) {
        if (cancelled) return;
        setCallbackState({ status: "error", message: getApiErrorMessage(error, "Không hoàn tất được OAuth.") });
      }
    };

    void finishOAuth();

    return () => {
      cancelled = true;
    };
  }, [code, queryKey, state]);

  return <CallbackShell state={callbackState} />;
}

function CallbackShell({ state }: { state: CallbackState }) {
  return (
    <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
      <Card className="w-full max-w-lg border border-white/70">
        <CardHeader className="mb-0 gap-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">OAuth</p>
          <CardTitle>Kết nối AI Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          {state.status === "loading" ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-bg text-primary">
                <AppIcon name="spinner" className="h-6 w-6 animate-spin" />
              </div>
              <p className="text-sm text-text-secondary">Đang xác thực OAuth, vui lòng chờ trong giây lát.</p>
            </>
          ) : null}

          {state.status === "success" ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
                <AppIcon name="check-circle" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Kết nối thành công!</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Provider {state.provider} đã được lưu vào hệ thống.
                </p>
              </div>
              <Button type="button" onClick={goToAiProviders}>
                Về trang AI Providers
              </Button>
            </>
          ) : null}

          {state.status === "error" ? (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
                <AppIcon name="warning" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold text-text-primary">Không kết nối được OAuth</p>
                <p className="mt-1 text-sm text-danger">{state.message}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                  Thử lại
                </Button>
                <Button type="button" onClick={goToAiProviders}>
                  Về trang AI Providers
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function goToAiProviders() {
  window.location.href = "/admin/ai-providers";
}
