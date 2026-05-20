"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AgentItem, AgentRunResult, ChatMessage } from "@/hooks/use-ai";
import { useAgents, useRunAgent } from "@/hooks/use-ai";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const agentsQuery = useAgents();
  const runMutation = useRunAgent();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const agents = useMemo(() => agentsQuery.data ?? [], [agentsQuery.data]);
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, runMutation.isPending]);

  const runAgent = async () => {
    const trimmedInput = input.trim();
    if (!selectedAgent || !trimmedInput || runMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedInput,
      timestamp: new Date()
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");

    try {
      const result = await runMutation.mutateAsync({ agentId: selectedAgent.id, input: trimmedInput });
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: result.output || "Agent đã hoàn tất nhưng không có nội dung phản hồi.",
        toolCalls: result.toolCalls,
        status: result.status,
        timestamp: new Date()
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: getApiErrorMessage(error, "Agent chạy thất bại."),
        status: "ERROR",
        timestamp: new Date()
      };
      setMessages((current) => [...current, assistantMessage]);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runAgent();
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Agent Chat</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{selectedAgent?.name ?? "Chọn agent"}</CardTitle>
                {selectedAgent?.description ? (
                  <p className="mt-1 line-clamp-1 text-sm text-text-muted">{selectedAgent.description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedAgent ? <AgentBadges agent={selectedAgent} /> : null}
                <Button type="button" size="sm" variant="ghost" onClick={() => setMessages([])} disabled={messages.length === 0}>
                  <AppIcon name="delete" className="h-4 w-4" />
                  Xóa lịch sử
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[calc(100vh-300px)] min-h-[400px] overflow-y-auto rounded-2xl border border-border/50 bg-bg-subtle px-4 py-4">
              {messages.length === 0 && !runMutation.isPending ? (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="text-sm text-text-muted">Chọn agent và bắt đầu hội thoại</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((message) => (
                    <ChatMessageBubble key={message.id} message={message} />
                  ))}
                  {runMutation.isPending ? <LoadingBubble /> : null}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="sticky bottom-0 rounded-2xl border border-border/50 bg-white p-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Ví dụ: Tìm khách hàng Vinamilk và đề xuất email follow-up tuần này."
                className="min-h-[80px]"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-text-muted">Nhấn Ctrl+Enter hoặc Cmd+Enter để gửi nhanh.</p>
                <Button type="button" onClick={() => void runAgent()} disabled={!selectedAgent || !input.trim() || runMutation.isPending}>
                  {runMutation.isPending ? "Đang gửi..." : "Gửi"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("space-y-2", isUser ? "max-w-[75%]" : "max-w-[85%]")}>
        <div
          className={cn(
            "px-4 py-2.5 text-sm leading-6 shadow-sm",
            isUser
              ? "rounded-2xl rounded-tr-sm bg-primary text-white"
              : "rounded-2xl rounded-tl-sm border border-border/50 bg-white text-text-primary"
          )}
        >
          <p className={cn("whitespace-pre-wrap", message.status === "ERROR" ? "text-danger" : "")}>{message.content}</p>
        </div>
        {!isUser && message.toolCalls?.length ? <ToolCallList toolCalls={message.toolCalls} /> : null}
        <p className={cn("px-1 text-[11px] text-text-muted", isUser ? "text-right" : "text-left")}>
          {message.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

function ToolCallList({ toolCalls }: { toolCalls: AgentRunResult["toolCalls"] }) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleTool = (index: number) => {
    setExpandedTools((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {toolCalls.map((tool, index) => {
        const isExpanded = expandedTools.has(index);
        const isSuccess = tool.status === "SUCCESS";

        return (
          <div key={`${tool.toolName}-${index}`} className="rounded-xl border border-border/50 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              onClick={() => toggleTool(index)}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true">⚙️</span>
                <span className="truncate text-xs font-semibold text-text-primary">{tool.toolName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge variant={isSuccess ? "success" : tool.status === "ERROR" ? "danger" : "warning"}>
                  {tool.status}
                </Badge>
                <span className="text-xs text-text-muted">{tool.durationMs}ms</span>
              </span>
            </button>
            {isExpanded ? (
              <div className="grid gap-2 border-t border-border/40 p-3 md:grid-cols-2">
                <JsonPanel label="Input" value={tool.inputJson} />
                <JsonPanel label="Output" value={tool.outputJson} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-xl bg-bg-hover p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-text-primary">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:120ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}

function AgentBadges({ agent }: { agent: AgentItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="info">{agent.provider ?? "provider mặc định"}</Badge>
      {agent.model ? <Badge>{agent.model}</Badge> : null}
      <Badge variant={agent.isActive ? "success" : "warning"}>{agent.isActive ? "Đang bật" : "Tạm tắt"}</Badge>
    </div>
  );
}

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}
