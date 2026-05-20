"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AgentItem, useAgents, useRunAgent } from "@/hooks/use-ai";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const agentsQuery = useAgents();
  const runMutation = useRunAgent();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [lastOutput, setLastOutput] = useState("");
  const [toolCalls, setToolCalls] = useState<Array<{ toolName: string; status: string; durationMs: number }>>([]);

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId]
  );

  const runAgent = async () => {
    if (!selectedAgent || !input.trim()) return;
    try {
      const result = await runMutation.mutateAsync({ agentId: selectedAgent.id, input });
      setLastOutput(result.output);
      setToolCalls(result.toolCalls.map((tool) => ({
        toolName: tool.toolName,
        status: tool.status,
        durationMs: tool.durationMs
      })));
      setInput("");
    } catch (error) {
      toast({ title: "Agent chạy thất bại", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="AI" title="Agents" description="Chạy trợ lý AI có quyền truy cập giới hạn vào dữ liệu CRM." />

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Danh sách</p>
            <CardTitle>Agent khả dụng</CardTitle>
          </CardHeader>
          <CardContent>
            {agentsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => <LoadingSkeleton key={index} className="h-14 w-full" />)}
              </div>
            ) : agents.length > 0 ? (
              <div className="space-y-2">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={cn(
                      "w-full rounded-2xl border px-3 py-2.5 text-left transition",
                      selectedAgent?.id === agent.id ? "border-primary bg-primary-bg" : "border-border bg-white hover:bg-bg-hover"
                    )}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <p className="truncate text-sm font-semibold text-text-primary">{agent.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-text-muted">{agent.description ?? "Agent CRM"}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Chưa có agent nào được bật.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Agent Console</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>{selectedAgent?.name ?? "Chọn agent"}</CardTitle>
              {selectedAgent ? <AgentBadges agent={selectedAgent} /> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastOutput ? (
              <div className="rounded-2xl border border-border/50 bg-white px-4 py-3">
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary">{lastOutput}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-bg-subtle px-4 py-10 text-center text-sm text-text-muted">
                Nhập yêu cầu để chạy agent. Kết quả và tool call sẽ hiển thị tại đây.
              </div>
            )}

            {toolCalls.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Tool calls</p>
                {toolCalls.map((tool, index) => (
                  <div key={`${tool.toolName}-${index}`} className="flex items-center justify-between rounded-xl bg-bg-hover px-3 py-2 text-sm">
                    <span className="font-medium text-text-primary">{tool.toolName}</span>
                    <span className="text-xs text-text-muted">{tool.status} · {tool.durationMs}ms</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ví dụ: Tìm khách hàng Vinamilk và đề xuất email follow-up tuần này."
                className="min-h-[120px]"
              />
              <Button type="button" onClick={runAgent} disabled={!selectedAgent || !input.trim() || runMutation.isPending}>
                {runMutation.isPending ? "Đang chạy..." : "Chạy agent"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AgentBadges({ agent }: { agent: AgentItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="info">{agent.provider ?? "provider mặc định"}</Badge>
      <Badge variant={agent.isActive ? "success" : "warning"}>{agent.isActive ? "Đang bật" : "Tạm tắt"}</Badge>
    </div>
  );
}
