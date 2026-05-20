"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AiProviderName, CreateAgentInput, useAgents, useCreateAgent, useDeleteAgent } from "@/hooks/use-ai";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";

const TOOL_OPTIONS = [
  { value: "search_customers", label: "Tìm khách hàng" },
  { value: "get_customer_summary_context", label: "Lấy context khách hàng" },
  { value: "search_projects", label: "Tìm dự án" },
  { value: "draft_sales_email", label: "Soạn email bán hàng" }
];

const DEFAULT_FORM: CreateAgentInput = {
  name: "",
  description: "",
  systemPrompt: "Bạn là trợ lý AI cho đội sales AHSO CRM. Trả lời bằng tiếng Việt, chính xác, ngắn gọn và chỉ dùng tool được cấp quyền.",
  provider: undefined,
  model: "",
  enabledTools: ["search_customers", "search_projects"],
  isActive: true
};

export default function AdminAgentsPage() {
  const agentsQuery = useAgents();
  const createMutation = useCreateAgent();
  const deleteMutation = useDeleteAgent();
  const [form, setForm] = useState<CreateAgentInput>(DEFAULT_FORM);

  const createAgent = async () => {
    try {
      await createMutation.mutateAsync({
        ...form,
        provider: form.provider || undefined,
        model: form.model?.trim() || undefined
      });
      setForm(DEFAULT_FORM);
      toast({ title: "Đã tạo agent" });
    } catch (error) {
      toast({ title: "Không tạo được agent", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const toggleTool = (tool: string) => {
    setForm((current) => ({
      ...current,
      enabledTools: current.enabledTools.includes(tool)
        ? current.enabledTools.filter((item) => item !== tool)
        : [...current.enabledTools, tool]
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="AI Agents" description="Tạo và quản trị agent có tool whitelist cho dữ liệu CRM." />

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Agent mới</p>
          <CardTitle>Cấu hình agent</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Tên agent" />
          <Select
            value={form.provider ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as AiProviderName || undefined }))}
          >
            <option value="">Provider mặc định</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </Select>
          <Input value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả ngắn" />
          <Input value={form.model ?? ""} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="Model override tùy chọn" />
          <Textarea className="lg:col-span-2" value={form.systemPrompt} onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))} />
          <div className="space-y-2 lg:col-span-2">
            <p className="text-sm font-semibold text-text-primary">Tool được phép</p>
            <div className="grid gap-2 md:grid-cols-2">
              {TOOL_OPTIONS.map((tool) => (
                <label key={tool.value} className="flex items-center gap-2 rounded-xl border border-border/50 bg-white px-3 py-2 text-sm">
                  <Checkbox checked={form.enabledTools.includes(tool.value)} onCheckedChange={() => toggleTool(tool.value)} />
                  <span>{tool.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="button" className="lg:col-span-2" onClick={createAgent} disabled={!form.name || createMutation.isPending}>
            {createMutation.isPending ? "Đang tạo..." : "Tạo agent"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Registry</p>
          <CardTitle>Agent đang bật</CardTitle>
        </CardHeader>
        <CardContent>
          {agentsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <LoadingSkeleton key={index} className="h-12 w-full" />)}</div>
          ) : (
            <div className="space-y-2">
              {(agentsQuery.data ?? []).map((agent) => (
                <div key={agent.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-white px-4 py-3">
                  <div>
                    <p className="font-semibold text-text-primary">{agent.name}</p>
                    <p className="text-sm text-text-muted">{agent.description ?? "Không có mô tả"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{agent.provider ?? "default"}</Badge>
                    <Button type="button" size="sm" variant="outline" onClick={() => deleteMutation.mutate(agent.id)}>
                      Tắt
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
