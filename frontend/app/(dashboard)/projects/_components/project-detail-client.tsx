"use client";

import { type ComponentProps, type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AppIcon } from "@/components/shared/app-icon";
import { CustomFieldRenderer } from "@/components/shared/custom-field-renderer";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useArchiveBusinessDocument,
  useCreateBusinessDocument,
  useMarkBusinessDocumentSigned,
  useUpdateBusinessDocument,
  useUploadBusinessDocumentFile
} from "@/hooks/use-business-documents";
import { useCustomFields } from "@/hooks/use-custom-fields";
import {
  useCreateProjectHandover,
  useProject,
  useProjectDocuments,
  useProjectOverview360,
  useProjectTimeline
} from "@/hooks/use-projects";
import { useAddSurveyNote, useCreateSurvey, useProjectSurveys, useUploadSurveyMedia } from "@/hooks/use-surveys";
import { toast } from "@/hooks/use-toast";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  BusinessDocument,
  BusinessDocumentSource,
  BusinessDocumentStatus,
  BusinessDocumentType,
  ContractStatus,
  GeneratedProjectDocument,
  MilestoneStatus,
  Priority,
  ProjectStatus,
  SurveyMedia,
  SurveyNoteType
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Project360Tab =
  | "overview"
  | "timeline"
  | "surveys"
  | "documents"
  | "quotes"
  | "contracts"
  | "delivery"
  | "payments"
  | "handover";

type AppIconName = ComponentProps<typeof AppIcon>["name"];

const TABS: Array<{ key: Project360Tab; label: string; icon: AppIconName }> = [
  { key: "overview", label: "Tổng quan", icon: "dashboard" },
  { key: "timeline", label: "Timeline", icon: "activity" },
  { key: "surveys", label: "Khảo sát", icon: "calendar" },
  { key: "documents", label: "Tài liệu", icon: "description" },
  { key: "quotes", label: "Báo giá", icon: "description" },
  { key: "contracts", label: "Hợp đồng", icon: "contract" },
  { key: "delivery", label: "Triển khai", icon: "briefcase" },
  { key: "payments", label: "Thanh toán", icon: "analytics" },
  { key: "handover", label: "Ghi chú / Quyết định", icon: "history" }
];
const TAB_KEYS = TABS.map((tab) => tab.key);

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "neutral" | "info" | "warning" }> = {
  LOW: { label: "Ưu tiên thấp", variant: "neutral" },
  NORMAL: { label: "Ưu tiên chuẩn", variant: "info" },
  HIGH: { label: "Ưu tiên cao", variant: "warning" }
};

const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  {
    label: string;
    variant: "info" | "warning" | "success" | "danger";
  }
> = {
  ACTIVE: { label: "Hiệu lực", variant: "info" },
  SUSPENDED: { label: "Tạm dừng", variant: "warning" },
  COMPLETED: { label: "Hoàn tất", variant: "success" },
  CANCELLED: { label: "Hủy", variant: "danger" }
};

const MILESTONE_STATUS_CONFIG: Record<
  MilestoneStatus,
  {
    label: string;
    variant: "neutral" | "info" | "success" | "warning";
  }
> = {
  PENDING: { label: "Chờ xử lý", variant: "neutral" },
  IN_PROGRESS: { label: "Đang làm", variant: "info" },
  DONE: { label: "Đã xong", variant: "success" },
  ACCEPTED: { label: "Đã nghiệm thu", variant: "warning" }
};

const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  RFQ: "Yêu cầu báo giá",
  CUSTOMER_PO: "PO khách hàng",
  QUOTATION: "Báo giá",
  SIGNED_QUOTATION: "Báo giá đã ký",
  PROPOSAL: "Đề xuất",
  CONTRACT: "Hợp đồng",
  SIGNED_CONTRACT: "Hợp đồng đã ký",
  CONTRACT_ADDENDUM: "Phụ lục hợp đồng",
  NDA: "NDA",
  DELIVERY_NOTE: "Phiếu giao hàng",
  DOC_HANDOVER: "Bàn giao hồ sơ",
  INSTALLATION_REPORT: "Biên bản lắp đặt",
  ACCEPTANCE_REPORT: "Biên bản nghiệm thu",
  PARTIAL_ACCEPTANCE: "Nghiệm thu từng phần",
  WARRANTY_CERT: "Chứng nhận bảo hành",
  MAINTENANCE_RECORD: "Biên bản bảo trì",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_RECEIPT: "Phiếu thu",
  INVOICE: "Hóa đơn",
  AR_RECONCILIATION: "Đối soát công nợ",
  OTHER: "Tài liệu khác"
};

const DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: "Bản nháp",
  ISSUED: "Đã phát hành",
  RECEIVED: "Đã nhận",
  SIGNED: "Đã ký",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Bị từ chối",
  SUPERSEDED: "Đã thay thế",
  CANCELLED: "Đã hủy",
  ARCHIVED: "Lưu trữ"
};

const DOCUMENT_SOURCE_LABELS: Record<BusinessDocumentSource, string> = {
  GENERATED: "Hệ thống sinh",
  UPLOADED: "Upload nội bộ",
  RECEIVED: "Khách gửi",
  SIGNED_UPLOAD: "Bản ký upload"
};

const SURVEY_NOTE_LABELS: Record<SurveyNoteType, string> = {
  GENERAL: "Ghi chú chung",
  TECHNICAL_REQUIREMENT: "Yêu cầu kỹ thuật",
  COMMERCIAL_REQUIREMENT: "Yêu cầu thương mại",
  SITE_CONSTRAINT: "Ràng buộc hiện trường",
  RISK: "Rủi ro",
  DECISION: "Quyết định",
  OPEN_QUESTION: "Câu hỏi mở"
};

const TIMELINE_TYPE_LABELS: Record<string, string> = {
  activity: "Hoạt động",
  survey: "Khảo sát",
  quote: "Báo giá",
  contract: "Hợp đồng",
  document: "Tài liệu",
  milestone: "Milestone",
  payment: "Thanh toán",
  handover: "Bàn giao"
};

const BUSINESS_DOCUMENT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const SURVEY_MEDIA_MAX_FILE_SIZE = 50 * 1024 * 1024;
const BUSINESS_DOCUMENT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".docx"];
const SURVEY_MEDIA_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
  ".webm",
  ".pdf",
  ".docx",
  ".xlsx"
];
const PROJECT_STAGE_ORDER = ["SURVEY", "QUOTING", "NEGOTIATING", "WON", "DELIVERING", "COMPLETED"] as const;

function getPriorityConfig(priority: Priority) {
  return PRIORITY_CONFIG[priority] ?? { label: String(priority), variant: "neutral" as const };
}

function getMilestoneStatusConfig(status: MilestoneStatus) {
  return MILESTONE_STATUS_CONFIG[status] ?? { label: String(status), variant: "neutral" as const };
}

function getContractStatusConfig(status: ContractStatus) {
  return CONTRACT_STATUS_CONFIG[status] ?? { label: String(status), variant: "neutral" as const };
}

function getProjectStatusLabel(status: ProjectStatus) {
  return PROJECT_STATUS_LABELS[status] ?? String(status);
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Project360Tab>("overview");
  const projectQuery = useProject(projectId);
  const overviewQuery = useProjectOverview360(projectId);
  const customFieldsQuery = useCustomFields("project");

  useEffect(() => {
    const tabFromUrl = resolveProject360Tab(searchParams.get("tab"));
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  const handleTabChange = (tab: Project360Tab) => {
    setActiveTab(tab);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    const queryString = nextParams.toString();
    const nextHref = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(nextHref as Route, { scroll: false });
  };

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-8">
        <LoadingSkeleton className="h-16 w-full" />
        <LoadingSkeleton className="h-72 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chi tiết dự án"
          description="Không thể tải dữ liệu của dự án này."
          action={
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-danger/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
              {getApiErrorMessage(projectQuery.error, "Không thể tải dữ liệu dự án.")}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = projectQuery.data;
  const overview = overviewQuery.data;
  const customer = project.customer;
  const projectStats = project.stats ?? {
    quoteCount: project.quotes?.length ?? 0,
    milestoneCount: project.milestones?.length ?? 0,
    activityCount: project.activities?.length ?? 0,
    paidAmount: project.contract?.paidAmount ?? 0,
    outstandingAmount: project.contract?.outstandingAmount ?? 0,
    progressPercent: project.progressPercent ?? 0
  };
  const projectQuotes = project.quotes ?? [];
  const projectMilestones = project.milestones ?? [];
  const projectPayments = project.contract?.payments ?? [];
  const priorityConfig = getPriorityConfig(project.priority);
  const tabCounts: Partial<Record<Project360Tab, number>> = {
    surveys: overview?.latestSurvey ? 1 : 0,
    documents: overview?.importantDocuments?.length ?? 0,
    quotes: projectQuotes.length,
    contracts: project.contract ? 1 : 0,
    delivery: projectMilestones.length,
    payments: projectPayments.length,
    handover: overview?.handovers?.length ?? 0
  };

  if (!customer?.id) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Hồ sơ dự án 360"
          description="Dự án này đang thiếu liên kết khách hàng nên chưa thể mở đầy đủ hồ sơ."
          action={
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
          }
        />
        <Card className="border border-warning/20">
          <CardContent className="p-6">
            <div className="rounded-xl bg-warning-bg/70 p-4 text-sm text-warning">
              Dữ liệu dự án không đầy đủ: thiếu customerId/customer. Hãy kiểm tra seed hoặc bản ghi dự án trước khi mở Project 360.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hồ sơ dự án 360"
        description="Một nơi đọc lại toàn bộ hành trình từ tiếp cận, khảo sát, báo giá, hợp đồng, triển khai đến bàn giao."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/projects" className={cn(buttonVariants({ variant: "outline" }))}>
              Quay lại danh sách
            </Link>
            <Link href={`/projects/${projectId}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
              Sửa dự án
            </Link>
            {project.contract ? (
              <Link href={`/contracts/${project.contract.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Mở hợp đồng
              </Link>
            ) : (
              <Link href={`/contracts/new?projectId=${projectId}`} className={cn(buttonVariants({ variant: "outline" }))}>
                Tạo hợp đồng
              </Link>
            )}
            <Link href={`/quotes/new?projectId=${projectId}`} className={cn(buttonVariants({ variant: "primary" }))}>
              Tạo báo giá
            </Link>
          </div>
        }
      />

      <section className="surface-card noise-edge overflow-hidden border border-white/70">
        <div className="grid gap-0 xl:grid-cols-[1.5fr_0.85fr]">
          <div className="p-6 md:p-8">
            <p className="industrial-chip bg-primary/10 text-primary">Project Knowledge Hub</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-3xl font-extrabold text-text-primary">{project.name}</h2>
              <StatusBadge kind="project" status={project.status} />
              <Badge variant={priorityConfig.variant}>
                {priorityConfig.label}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-text-secondary">
              <Badge variant="neutral">{project.code}</Badge>
              <Link href={`/customers/${customer.id}`} className="inline-flex">
                <Badge variant="info">{customer.name}</Badge>
              </Link>
            </div>
            <p className="mt-5 max-w-3xl text-sm text-text-secondary">
              {project.description ?? project.notes ?? "Dự án chưa có mô tả kỹ thuật chi tiết."}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MiniPanel label="Bắt đầu" value={project.startDate ? formatDate(project.startDate) : "Chưa xác định"} />
              <MiniPanel label="Đích dự kiến" value={project.expectedEndDate ? formatDate(project.expectedEndDate) : "Chưa xác định"} />
              <MiniPanel label="Cập nhật cuối" value={formatRelativeTime(project.updatedAt)} />
            </div>
            <ProjectStageStepper currentStatus={project.status} />
          </div>
          <aside className="border-t border-white/70 bg-primary/5 p-6 md:p-8 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Customer Owner</p>
            <div className="mt-4 space-y-2">
              <Link href={`/customers/${customer.id}`} className="font-heading text-xl font-bold text-text-primary hover:text-primary">
                {customer.name}
              </Link>
              <p className="text-sm text-text-secondary">{customer.industry ?? "Chưa phân ngành"}</p>
              <StatusBadge status={customer.status} />
            </div>
            <div className="mt-6 rounded-2xl border border-white/70 bg-white/85 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">Liên hệ chính</p>
              <p className="mt-2 font-semibold text-text-primary">{customer.primaryContact?.name ?? "Chưa thiết lập"}</p>
              <p className="text-text-secondary">{customer.primaryContact?.title ?? "Chưa có chức danh"}</p>
              {customer.primaryContact?.phone ? <p className="text-text-secondary">{customer.primaryContact.phone}</p> : null}
            </div>
          </aside>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Giá trị dự kiến" value={<CurrencyDisplay amount={project.estimatedValue} short />} />
        <MetricCard label="Đã thu" value={<CurrencyDisplay amount={projectStats.paidAmount} short />} />
        <MetricCard label="Còn lại" value={<CurrencyDisplay amount={projectStats.outstandingAmount} short />} />
        <MetricCard label="Tiến độ" value={`${projectStats.progressPercent}%`} />
      </div>

      <Project360Brief project={project} overview={overview} onNavigate={handleTabChange} />

      <div className="sticky top-3 z-20 rounded-[28px] border border-white/70 bg-white/90 p-2 shadow-sm backdrop-blur-xl">
        <div role="tablist" aria-label="Project 360 sections" className="flex gap-2 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                activeTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-secondary hover:bg-white hover:text-text-primary"
              )}
            >
              <AppIcon name={tab.icon} className="h-4 w-4" />
              {tab.label}
              {typeof tabCounts[tab.key] === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px]",
                    activeTab === tab.key ? "bg-white/20 text-white" : "bg-bg-hover text-text-secondary"
                  )}
                >
                  {tabCounts[tab.key]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <OverviewPanel project={project} overview={overview} customFields={customFieldsQuery.data ?? []} />
      ) : null}
      {activeTab === "timeline" ? <TimelinePanel projectId={projectId} /> : null}
      {activeTab === "surveys" ? <SurveysPanel projectId={projectId} customerId={customer.id} /> : null}
      {activeTab === "documents" ? <DocumentsPanel projectId={projectId} customerId={customer.id} /> : null}
      {activeTab === "quotes" ? <QuotesPanel project={project} /> : null}
      {activeTab === "contracts" ? <ContractsPanel project={project} /> : null}
      {activeTab === "delivery" ? <DeliveryPanel project={project} /> : null}
      {activeTab === "payments" ? <PaymentsPanel project={project} /> : null}
      {activeTab === "handover" ? <HandoverPanel project={project} overview={overview} /> : null}
    </div>
  );
}

function OverviewPanel({
  project,
  overview,
  customFields
}: {
  project: NonNullable<ReturnType<typeof useProject>["data"]>;
  overview?: NonNullable<ReturnType<typeof useProjectOverview360>["data"]>;
  customFields: NonNullable<ReturnType<typeof useCustomFields>["data"]>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Next Best Action</p>
            <CardTitle>Việc cần làm tiếp theo</CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.nextActivity ? (
              <article className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <p className="font-semibold text-text-primary">{overview.nextActivity.title}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  {overview.nextActivity.scheduledAt ? formatDateTime(overview.nextActivity.scheduledAt) : "Chưa có lịch cụ thể"} ·{" "}
                  {overview.nextActivity.user?.name ?? "Chưa gán người phụ trách"}
                </p>
              </article>
            ) : (
              <EmptyState title="Chưa có việc đang mở" description="Khi có activity chưa hoàn tất, hệ thống sẽ ưu tiên hiển thị ở đây." />
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Latest Site Knowledge</p>
            <CardTitle>Khảo sát mới nhất</CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.latestSurvey ? (
              <article className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">{overview.latestSurvey.title}</p>
                    <p className="text-sm text-text-secondary">
                      {overview.latestSurvey.location ?? "Chưa có địa điểm"} ·{" "}
                      {overview.latestSurvey.surveyedAt ? formatDate(overview.latestSurvey.surveyedAt) : "Chưa có ngày khảo sát"}
                    </p>
                  </div>
                  <Badge variant="info">{overview.latestSurvey.media?.length ?? 0} media</Badge>
                </div>
                {overview.latestSurvey.summary ? <p className="mt-3 text-sm text-text-secondary">{overview.latestSurvey.summary}</p> : null}
                {overview.latestSurvey.nextStep ? (
                  <p className="mt-3 rounded-xl bg-primary/5 p-3 text-sm text-primary">Next step: {overview.latestSurvey.nextStep}</p>
                ) : null}
              </article>
            ) : (
              <EmptyState title="Chưa có khảo sát" description="Tạo khảo sát đầu tiên ở tab Khảo sát để lưu ảnh, video và trao đổi hiện trường." />
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Dynamic Schema</p>
            <CardTitle>Custom fields</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomFieldRenderer
              fields={customFields}
              values={project.customFieldValues ?? {}}
              emptyTitle="Chưa có custom field cho dự án"
              emptyDescription="Khi admin tạo field động cho resource dự án, dữ liệu sẽ hiện ở đây."
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Critical Docs</p>
            <CardTitle>Tài liệu quan trọng mới nhất</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.importantDocuments?.length ? (
              overview.importantDocuments.map((document) => (
                <DocumentRow key={document.id} document={document} compact />
              ))
            ) : (
              <EmptyState title="Chưa có tài liệu" description="PO, hợp đồng ký, biên bản và hóa đơn sẽ được gom tại đây." />
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Open Items</p>
            <CardTitle>Mốc triển khai còn mở</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.openMilestones?.length ? (
              overview.openMilestones.map((milestone) => (
                <MiniInfo
                  key={milestone.id}
                  label={milestone.name}
                  value={`${getMilestoneStatusConfig(milestone.status).label} · ${
                    milestone.dueDate ? formatDate(milestone.dueDate) : "Chưa đặt hạn"
                  }`}
                />
              ))
            ) : (
              <EmptyState title="Không có milestone mở" description="Các mốc triển khai đang không có việc cần chú ý." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Project360Brief({
  project,
  overview,
  onNavigate
}: {
  project: NonNullable<ReturnType<typeof useProject>["data"]>;
  overview?: NonNullable<ReturnType<typeof useProjectOverview360>["data"]>;
  onNavigate: (tab: Project360Tab) => void;
}) {
  const openMilestoneCount = overview?.openMilestones?.length ?? 0;
  const importantDocumentCount = overview?.importantDocuments?.length ?? 0;
  const handoverCount = overview?.handovers?.length ?? 0;

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      <ActionSignal
        icon="activity"
        label="Việc tiếp theo"
        title={overview?.nextActivity?.title ?? "Chưa có activity mở"}
        description={
          overview?.nextActivity?.scheduledAt
            ? formatDateTime(overview.nextActivity.scheduledAt)
            : "Tạo activity để đội nhận bàn giao biết bước kế tiếp."
        }
        onClick={() => onNavigate("timeline")}
      />
      <ActionSignal
        icon="calendar"
        label="Khảo sát"
        title={overview?.latestSurvey?.title ?? "Chưa có khảo sát"}
        description={overview?.latestSurvey?.summary ?? "Lưu ảnh, video và trao đổi hiện trường vào tab Khảo sát."}
        onClick={() => onNavigate("surveys")}
      />
      <ActionSignal
        icon="description"
        label="Tài liệu quan trọng"
        title={`${importantDocumentCount} tài liệu`}
        description="PO, bản ký, biên bản và hóa đơn được gom trong tab Tài liệu."
        onClick={() => onNavigate("documents")}
      />
      <ActionSignal
        icon="history"
        label="Bàn giao"
        title={`${handoverCount} ghi chú`}
        description={
          openMilestoneCount > 0
            ? `${openMilestoneCount} milestone còn mở cần theo dõi.`
            : project.contract
              ? "Không có milestone mở trong snapshot hiện tại."
              : "Chưa có hợp đồng để sinh milestone triển khai."
        }
        onClick={() => onNavigate("handover")}
      />
    </section>
  );
}

function ActionSignal({
  icon,
  label,
  title,
  description,
  onClick
}: {
  icon: AppIconName;
  label: string;
  title: ReactNode;
  description: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AppIcon name={icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
          <p className="mt-1 line-clamp-1 font-heading text-lg font-bold text-text-primary">{title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{description}</p>
        </div>
      </div>
      {onClick ? (
        <span className="mt-3 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          Mở tab
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-3xl border border-white/70 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-sm">
      {content}
    </div>
  );
}

function resolveProject360Tab(value: string | null): Project360Tab {
  return TAB_KEYS.includes(value as Project360Tab) ? (value as Project360Tab) : "overview";
}

function ProjectStageStepper({ currentStatus }: { currentStatus: ProjectStatus }) {
  const activeIndex = PROJECT_STAGE_ORDER.indexOf(currentStatus as (typeof PROJECT_STAGE_ORDER)[number]);

  return (
    <div className="mt-6 rounded-3xl border border-white/70 bg-white/75 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Lifecycle</p>
        <p className="text-sm font-semibold text-text-primary">{getProjectStatusLabel(currentStatus)}</p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-6">
        {PROJECT_STAGE_ORDER.map((status, index) => {
          const isDone = activeIndex >= 0 && index < activeIndex;
          const isActive = status === currentStatus;

          return (
            <div
              key={status}
              className={cn(
                "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                isActive
                  ? "border-primary bg-primary text-white shadow-sm"
                  : isDone
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border/70 bg-white/70 text-text-secondary"
              )}
            >
              {getProjectStatusLabel(status)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelinePanel({ projectId }: { projectId: string }) {
  const timelineQuery = useProjectTimeline(projectId);

  if (timelineQuery.isLoading) {
    return <LoadingSkeleton className="h-96 w-full" />;
  }

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Unified Timeline</p>
        <CardTitle>Dòng thời gian dự án</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!timelineQuery.data?.length ? (
          <EmptyState title="Chưa có sự kiện" description="Timeline sẽ gom activity, khảo sát, báo giá, tài liệu, milestone và thanh toán." />
        ) : (
          timelineQuery.data.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <AppIcon name={timelineIcon(item.type)} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-text-primary">{item.title}</p>
                    <p className="text-sm text-text-secondary">
                      {formatDateTime(item.happenedAt)}
                      {item.actorName ? ` · ${item.actorName}` : ""}
                    </p>
                  </div>
                  <Badge variant="neutral">{TIMELINE_TYPE_LABELS[item.type] ?? item.type}</Badge>
                </div>
                {item.description ? <p className="mt-3 text-sm text-text-secondary">{item.description}</p> : null}
                {item.link ? <TimelineItemLink href={item.link} /> : null}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function TimelineItemLink({ href }: { href: string }) {
  const className = "mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary-hover";

  if (href.startsWith("/")) {
    return (
      <Link href={href as Route} className={className}>
        Mở liên kết
      </Link>
    );
  }

  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      Mở liên kết
    </a>
  );
}

function SurveysPanel({ projectId, customerId }: { projectId: string; customerId: string }) {
  const surveysQuery = useProjectSurveys(projectId);
  const createSurvey = useCreateSurvey(projectId);
  const uploadMedia = useUploadSurveyMedia(projectId);
  const addNote = useAddSurveyNote(projectId);
  const [surveyForm, setSurveyForm] = useState({
    title: "",
    surveyedAt: "",
    location: "",
    customerParticipants: "",
    objectives: "",
    summary: "",
    nextStep: ""
  });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteTypeDrafts, setNoteTypeDrafts] = useState<Record<string, SurveyNoteType>>({});
  const [noteImportantDrafts, setNoteImportantDrafts] = useState<Record<string, boolean>>({});
  const [mediaDrafts, setMediaDrafts] = useState<Record<string, { caption: string; area: string; isImportant: boolean }>>({});

  async function handleCreateSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createSurvey.mutateAsync({
      ...surveyForm,
      customerId,
      projectId,
      surveyedAt: surveyForm.surveyedAt ? new Date(surveyForm.surveyedAt).toISOString() : undefined
    });
    setSurveyForm({
      title: "",
      surveyedAt: "",
      location: "",
      customerParticipants: "",
      objectives: "",
      summary: "",
      nextStep: ""
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Site Visit</p>
          <CardTitle>Tạo khảo sát mới</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateSurvey}>
            <Input required placeholder="Tiêu đề khảo sát" value={surveyForm.title} onChange={(event) => setSurveyForm((prev) => ({ ...prev, title: event.target.value }))} />
            <Input type="datetime-local" value={surveyForm.surveyedAt} onChange={(event) => setSurveyForm((prev) => ({ ...prev, surveyedAt: event.target.value }))} />
            <Input placeholder="Địa điểm / khu vực khảo sát" value={surveyForm.location} onChange={(event) => setSurveyForm((prev) => ({ ...prev, location: event.target.value }))} />
            <Textarea placeholder="Khách tham gia / người trao đổi" value={surveyForm.customerParticipants} onChange={(event) => setSurveyForm((prev) => ({ ...prev, customerParticipants: event.target.value }))} />
            <Textarea placeholder="Mục tiêu khảo sát" value={surveyForm.objectives} onChange={(event) => setSurveyForm((prev) => ({ ...prev, objectives: event.target.value }))} />
            <Textarea placeholder="Tổng kết hiện trường" value={surveyForm.summary} onChange={(event) => setSurveyForm((prev) => ({ ...prev, summary: event.target.value }))} />
            <Textarea placeholder="Next step sau khảo sát" value={surveyForm.nextStep} onChange={(event) => setSurveyForm((prev) => ({ ...prev, nextStep: event.target.value }))} />
            <Button type="submit" disabled={createSurvey.isPending}>
              {createSurvey.isPending ? "Đang lưu..." : "Tạo khảo sát"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {surveysQuery.isLoading ? (
          <LoadingSkeleton className="h-96 w-full" />
        ) : surveysQuery.isError ? (
          <Card className="border border-danger/20">
            <CardContent className="p-6">
              <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
                {getApiErrorMessage(surveysQuery.error, "Không thể tải dữ liệu khảo sát.")}
              </div>
            </CardContent>
          </Card>
        ) : !surveysQuery.data?.length ? (
          <Card className="border border-white/70">
            <CardContent className="p-6">
              <EmptyState title="Chưa có khảo sát" description="Lưu lần khảo sát đầu tiên để người nhận bàn giao xem lại bối cảnh thực tế." />
            </CardContent>
          </Card>
        ) : (
          surveysQuery.data.map((survey) => (
            <Card key={survey.id} className="border border-white/70">
              <CardHeader className="mb-0 gap-2">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle>{survey.title}</CardTitle>
                    <p className="text-sm text-text-secondary">
                      {survey.location ?? "Chưa có địa điểm"} · {survey.surveyedAt ? formatDateTime(survey.surveyedAt) : "Chưa có ngày"}
                    </p>
                  </div>
                  <Badge variant="info">{survey.media?.length ?? 0} media</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {survey.summary ? <p className="text-sm text-text-secondary">{survey.summary}</p> : null}
                {survey.media?.length ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {survey.media.map((media) => (
                      <SurveyMediaCard key={media.id} media={media} />
                    ))}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {(survey.notes ?? []).map((note) => (
                    <div key={note.id} className="rounded-xl bg-bg-hover/60 p-3 text-sm">
                      <Badge variant={note.isImportant ? "warning" : "neutral"}>{SURVEY_NOTE_LABELS[note.type]}</Badge>
                      <p className="mt-2 text-text-secondary">{note.content}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-border/60 bg-bg-hover/40 p-4">
                    <div className="grid gap-2 md:grid-cols-2">
                      <select
                        className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm"
                        value={noteTypeDrafts[survey.id] ?? "GENERAL"}
                        onChange={(event) =>
                          setNoteTypeDrafts((prev) => ({ ...prev, [survey.id]: event.target.value as SurveyNoteType }))
                        }
                      >
                        {Object.entries(SURVEY_NOTE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-bg-input px-3 text-sm text-text-secondary">
                        <input
                          type="checkbox"
                          checked={Boolean(noteImportantDrafts[survey.id])}
                          onChange={(event) =>
                            setNoteImportantDrafts((prev) => ({ ...prev, [survey.id]: event.target.checked }))
                          }
                        />
                        Quan trọng
                      </label>
                    </div>
                    <Input
                      placeholder="Thêm ghi chú nhanh"
                      value={noteDrafts[survey.id] ?? ""}
                      onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [survey.id]: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!noteDrafts[survey.id]?.trim() || addNote.isPending}
                      onClick={async () => {
                        await addNote.mutateAsync({
                          surveyId: survey.id,
                          payload: {
                            type: noteTypeDrafts[survey.id] ?? "GENERAL",
                            content: noteDrafts[survey.id],
                            isImportant: Boolean(noteImportantDrafts[survey.id])
                          }
                        });
                        setNoteDrafts((prev) => ({ ...prev, [survey.id]: "" }));
                        setNoteImportantDrafts((prev) => ({ ...prev, [survey.id]: false }));
                      }}
                    >
                      Thêm ghi chú
                    </Button>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-dashed border-border bg-bg-hover/60 p-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-2 font-semibold text-text-primary">
                      <AppIcon name="description" className="h-5 w-5 text-primary" />
                      Media khảo sát
                    </div>
                    <Input
                      placeholder="Mô tả file / ảnh"
                      value={mediaDrafts[survey.id]?.caption ?? ""}
                      onChange={(event) =>
                        setMediaDrafts((prev) => ({
                          ...prev,
                          [survey.id]: {
                            caption: event.target.value,
                            area: prev[survey.id]?.area ?? "",
                            isImportant: Boolean(prev[survey.id]?.isImportant)
                          }
                        }))
                      }
                    />
                    <Input
                      placeholder="Khu vực / hạng mục"
                      value={mediaDrafts[survey.id]?.area ?? ""}
                      onChange={(event) =>
                        setMediaDrafts((prev) => ({
                          ...prev,
                          [survey.id]: {
                            caption: prev[survey.id]?.caption ?? "",
                            area: event.target.value,
                            isImportant: Boolean(prev[survey.id]?.isImportant)
                          }
                        }))
                      }
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(mediaDrafts[survey.id]?.isImportant)}
                        onChange={(event) =>
                          setMediaDrafts((prev) => ({
                            ...prev,
                            [survey.id]: {
                              caption: prev[survey.id]?.caption ?? "",
                              area: prev[survey.id]?.area ?? "",
                              isImportant: event.target.checked
                            }
                          }))
                        }
                      />
                      Đánh dấu quan trọng
                    </label>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-border bg-white/70 p-4 text-center hover:border-primary/40">
                      Tải ảnh / video / file khảo sát
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,.pdf,.docx,.xlsx"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) {
                            return;
                          }
                          const validationError = validateSurveyMediaFile(file);
                          if (validationError) {
                            toast({
                              title: "File khảo sát chưa hợp lệ",
                              description: validationError,
                              variant: "destructive"
                            });
                            event.target.value = "";
                            return;
                          }
                          const draft = mediaDrafts[survey.id];
                          await uploadMedia.mutateAsync({
                            surveyId: survey.id,
                            file,
                            caption: draft?.caption,
                            area: draft?.area,
                            isImportant: draft?.isImportant
                          });
                          setMediaDrafts((prev) => ({ ...prev, [survey.id]: { caption: "", area: "", isImportant: false } }));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function DocumentsPanel({ projectId, customerId }: { projectId: string; customerId: string }) {
  const documentsQuery = useProjectDocuments(projectId);
  const createDocument = useCreateBusinessDocument(projectId);
  const uploadDocument = useUploadBusinessDocumentFile(projectId);
  const markSigned = useMarkBusinessDocumentSigned(projectId);
  const updateDocument = useUpdateBusinessDocument(projectId);
  const archiveDocument = useArchiveBusinessDocument(projectId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    type: "CUSTOMER_PO" as BusinessDocumentType,
    source: "RECEIVED" as BusinessDocumentSource,
    status: "RECEIVED" as BusinessDocumentStatus,
    title: "",
    documentNo: "",
    documentDate: "",
    notes: ""
  });
  const [file, setFile] = useState<File | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentEditForm, setDocumentEditForm] = useState({
    type: "CUSTOMER_PO" as BusinessDocumentType,
    source: "RECEIVED" as BusinessDocumentSource,
    status: "RECEIVED" as BusinessDocumentStatus,
    title: "",
    documentNo: "",
    documentDate: "",
    notes: ""
  });
  const [documentFilters, setDocumentFilters] = useState<{
    search: string;
    type: "ALL" | BusinessDocumentType;
    status: "ALL" | BusinessDocumentStatus;
    source: "ALL" | BusinessDocumentSource;
    fileState: "ALL" | "WITH_FILE" | "WITHOUT_FILE";
  }>({
    search: "",
    type: "ALL",
    status: "ALL",
    source: "ALL",
    fileState: "ALL"
  });

  const businessDocuments = documentsQuery.data?.businessDocuments ?? [];
  const generatedDocuments = documentsQuery.data?.generatedDocuments ?? [];
  const filteredBusinessDocuments = businessDocuments.filter((document) => {
    const search = documentFilters.search.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [document.title, document.documentNo, document.notes, document.filename]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    const matchesType = documentFilters.type === "ALL" || document.type === documentFilters.type;
    const matchesStatus = documentFilters.status === "ALL" || document.status === documentFilters.status;
    const matchesSource = documentFilters.source === "ALL" || document.source === documentFilters.source;
    const matchesFileState =
      documentFilters.fileState === "ALL" ||
      (documentFilters.fileState === "WITH_FILE" ? Boolean(document.fileUrl) : !document.fileUrl);

    return matchesSearch && matchesType && matchesStatus && matchesSource && matchesFileState;
  });
  const hasActiveDocumentFilters =
    documentFilters.search.trim() !== "" ||
    documentFilters.type !== "ALL" ||
    documentFilters.status !== "ALL" ||
    documentFilters.source !== "ALL" ||
    documentFilters.fileState !== "ALL";

  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file) {
      const validationError = validateBusinessDocumentFile(file);
      if (validationError) {
        toast({
          title: "File tài liệu chưa hợp lệ",
          description: validationError,
          variant: "destructive"
        });
        return;
      }
    }

    const created = await createDocument.mutateAsync({
      ...documentForm,
      customerId,
      projectId,
      documentDate: documentForm.documentDate ? new Date(documentForm.documentDate).toISOString() : undefined
    });

    if (file) {
      await uploadDocument.mutateAsync({ documentId: created.id, file });
    }

    setDocumentForm({
      type: "CUSTOMER_PO",
      source: "RECEIVED",
      status: "RECEIVED",
      title: "",
      documentNo: "",
      documentDate: "",
      notes: ""
    });
    setFile(null);
    setShowCreateForm(false);
  }

  async function handleUpdateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDocumentId) {
      return;
    }

    await updateDocument.mutateAsync({
      documentId: editingDocumentId,
      payload: {
        ...documentEditForm,
        documentDate: documentEditForm.documentDate ? new Date(documentEditForm.documentDate).toISOString() : undefined
      }
    });
    setEditingDocumentId(null);
  }

  function startEditingDocument(document: BusinessDocument) {
    setEditingDocumentId(document.id);
    setDocumentEditForm({
      type: document.type,
      source: document.source,
      status: document.status,
      title: document.title,
      documentNo: document.documentNo ?? "",
      documentDate: document.documentDate ? document.documentDate.slice(0, 10) : "",
      notes: document.notes ?? ""
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Document Registry</p>
            <h3 className="mt-1 font-heading text-2xl font-extrabold text-text-primary">Tài liệu dự án</h3>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              Gom PO, bản đã ký, biên bản, hóa đơn và file khách gửi vào cùng một registry để bàn giao dự án không bị đứt mạch.
            </p>
          </div>
          <Button type="button" onClick={() => setShowCreateForm((current) => !current)}>
            {showCreateForm ? "Ẩn form thêm tài liệu" : "Thêm tài liệu"}
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <DocumentStat label="Tổng tài liệu" value={businessDocuments.length} />
          <DocumentStat label="Có file" value={businessDocuments.filter((document) => document.fileUrl).length} />
          <DocumentStat label="Đã ký / chấp nhận" value={businessDocuments.filter((document) => ["SIGNED", "ACCEPTED"].includes(document.status)).length} />
          <DocumentStat label="PDF hệ thống" value={generatedDocuments.length} />
        </div>
      </section>

      {showCreateForm ? (
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Business Registry</p>
              <CardTitle>Thêm tài liệu nghiệp vụ</CardTitle>
            </div>
            <Button type="button" variant="ghost" onClick={() => setShowCreateForm(false)}>
              Hủy
            </Button>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 xl:grid-cols-2" onSubmit={handleCreateDocument}>
              <select
                className="h-11 w-full rounded-md border border-border bg-bg-input px-4 text-sm"
                value={documentForm.type}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, type: event.target.value as BusinessDocumentType }))}
              >
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input required placeholder="Tên tài liệu" value={documentForm.title} onChange={(event) => setDocumentForm((prev) => ({ ...prev, title: event.target.value }))} />
              <Input placeholder="Số chứng từ" value={documentForm.documentNo} onChange={(event) => setDocumentForm((prev) => ({ ...prev, documentNo: event.target.value }))} />
              <Input type="date" value={documentForm.documentDate} onChange={(event) => setDocumentForm((prev) => ({ ...prev, documentDate: event.target.value }))} />
              <select
                className="h-11 w-full rounded-md border border-border bg-bg-input px-4 text-sm"
                value={documentForm.source}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, source: event.target.value as BusinessDocumentSource }))}
              >
                {Object.entries(DOCUMENT_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-md border border-border bg-bg-input px-4 text-sm"
                value={documentForm.status}
                onChange={(event) => setDocumentForm((prev) => ({ ...prev, status: event.target.value as BusinessDocumentStatus }))}
              >
                {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <label className="block rounded-2xl border border-dashed border-border bg-bg-hover/60 p-4 text-sm text-text-secondary">
                <span className="font-semibold text-text-primary">File đính kèm</span>
                <span className="mt-1 block">{file ? file.name : "PDF, PNG, JPG, XLSX hoặc DOCX, tối đa 10MB"}</span>
                {file ? <span className="mt-1 block text-xs text-text-muted">{formatFileSize(file.size)}</span> : null}
                <input
                  type="file"
                  className="mt-3 block w-full text-sm"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    if (!selectedFile) {
                      setFile(null);
                      return;
                    }

                    const validationError = validateBusinessDocumentFile(selectedFile);
                    if (validationError) {
                      toast({
                        title: "File tài liệu chưa hợp lệ",
                        description: validationError,
                        variant: "destructive"
                      });
                      event.target.value = "";
                      setFile(null);
                      return;
                    }

                    setFile(selectedFile);
                  }}
                />
              </label>
              <Textarea className="xl:col-span-2" placeholder="Ghi chú tài liệu" value={documentForm.notes} onChange={(event) => setDocumentForm((prev) => ({ ...prev, notes: event.target.value }))} />
              <div className="flex flex-wrap gap-2 xl:col-span-2">
                <Button type="submit" disabled={createDocument.isPending || uploadDocument.isPending}>
                  {createDocument.isPending || uploadDocument.isPending ? "Đang lưu..." : "Lưu tài liệu"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Đóng
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Uploaded / Received</p>
            <CardTitle>Tài liệu dự án</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-bg-hover/50 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <Input
                  className="xl:col-span-2"
                  placeholder="Tìm theo tên, số chứng từ, ghi chú..."
                  value={documentFilters.search}
                  onChange={(event) => setDocumentFilters((prev) => ({ ...prev, search: event.target.value }))}
                />
                <select
                  className="h-11 rounded-md border border-border bg-bg-input px-3 text-sm"
                  value={documentFilters.type}
                  onChange={(event) => setDocumentFilters((prev) => ({ ...prev, type: event.target.value as "ALL" | BusinessDocumentType }))}
                >
                  <option value="ALL">Tất cả loại</option>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-md border border-border bg-bg-input px-3 text-sm"
                  value={documentFilters.status}
                  onChange={(event) => setDocumentFilters((prev) => ({ ...prev, status: event.target.value as "ALL" | BusinessDocumentStatus }))}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-md border border-border bg-bg-input px-3 text-sm"
                  value={documentFilters.source}
                  onChange={(event) => setDocumentFilters((prev) => ({ ...prev, source: event.target.value as "ALL" | BusinessDocumentSource }))}
                >
                  <option value="ALL">Tất cả nguồn</option>
                  {Object.entries(DOCUMENT_SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm"
                    value={documentFilters.fileState}
                    onChange={(event) =>
                      setDocumentFilters((prev) => ({ ...prev, fileState: event.target.value as "ALL" | "WITH_FILE" | "WITHOUT_FILE" }))
                    }
                  >
                    <option value="ALL">Tất cả file</option>
                    <option value="WITH_FILE">Có file</option>
                    <option value="WITHOUT_FILE">Chưa có file</option>
                  </select>
                  <span className="text-sm text-text-secondary">
                    Hiển thị {filteredBusinessDocuments.length}/{businessDocuments.length} tài liệu
                  </span>
                </div>
                {hasActiveDocumentFilters ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDocumentFilters({
                        search: "",
                        type: "ALL",
                        status: "ALL",
                        source: "ALL",
                        fileState: "ALL"
                      })
                    }
                  >
                    Xóa bộ lọc
                  </Button>
                ) : null}
              </div>
            </div>
            {documentsQuery.isLoading ? (
              <LoadingSkeleton className="h-72 w-full" />
            ) : documentsQuery.isError ? (
              <div className="rounded-xl bg-danger-bg/70 p-4 text-sm text-danger">
                {getApiErrorMessage(documentsQuery.error, "Không thể tải tài liệu dự án.")}
              </div>
            ) : !businessDocuments.length ? (
              <EmptyState title="Chưa có tài liệu nghiệp vụ" description="Upload PO, báo giá đã ký, hợp đồng đã ký, biên bản hoặc hóa đơn vào đây." />
            ) : !filteredBusinessDocuments.length ? (
              <EmptyState title="Không có tài liệu khớp bộ lọc" description="Thử xóa bớt điều kiện lọc hoặc tìm bằng từ khóa khác." />
            ) : (
              filteredBusinessDocuments.map((document) => (
                <div key={document.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                  <DocumentRow document={document} />
                  {editingDocumentId === document.id ? (
                    <form className="mt-4 grid gap-3 rounded-2xl bg-bg-hover/60 p-4 md:grid-cols-2" onSubmit={handleUpdateDocument}>
                      <select
                        className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm"
                        value={documentEditForm.type}
                        onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, type: event.target.value as BusinessDocumentType }))}
                      >
                        {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Input required value={documentEditForm.title} onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, title: event.target.value }))} />
                      <Input placeholder="Số chứng từ" value={documentEditForm.documentNo} onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, documentNo: event.target.value }))} />
                      <Input type="date" value={documentEditForm.documentDate} onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, documentDate: event.target.value }))} />
                      <select
                        className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm"
                        value={documentEditForm.source}
                        onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, source: event.target.value as BusinessDocumentSource }))}
                      >
                        {Object.entries(DOCUMENT_SOURCE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 rounded-md border border-border bg-bg-input px-3 text-sm"
                        value={documentEditForm.status}
                        onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, status: event.target.value as BusinessDocumentStatus }))}
                      >
                        {Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <Textarea className="md:col-span-2" placeholder="Ghi chú tài liệu" value={documentEditForm.notes} onChange={(event) => setDocumentEditForm((prev) => ({ ...prev, notes: event.target.value }))} />
                      <div className="flex flex-wrap gap-2 md:col-span-2">
                        <Button type="submit" size="sm" disabled={updateDocument.isPending}>
                          {updateDocument.isPending ? "Đang lưu..." : "Lưu metadata"}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingDocumentId(null)}>
                          Hủy
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <FileActionButtons documentId={document.id} fileUrl={document.fileUrl} filename={document.filename} mimeType={document.mimeType} size={document.size} />
                      <Button type="button" size="sm" variant="outline" onClick={() => startEditingDocument(document)}>
                        Sửa metadata
                      </Button>
                      {document.status !== "SIGNED" ? (
                        <Button type="button" size="sm" variant="outline" disabled={markSigned.isPending} onClick={() => markSigned.mutate(document.id)}>
                          Đánh dấu đã ký
                        </Button>
                      ) : null}
                      {document.status !== "ARCHIVED" ? (
                        <Button type="button" size="sm" variant="ghost" disabled={archiveDocument.isPending} onClick={() => archiveDocument.mutate(document.id)}>
                          Lưu trữ
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/70">
          <CardHeader className="mb-0 gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Generated PDFs</p>
            <CardTitle>Tài liệu hệ thống sinh ra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!generatedDocuments.length ? (
              <EmptyState title="Chưa có PDF được render" description="PDF sinh từ báo giá hoặc hợp đồng liên quan sẽ hiển thị ở đây sau khi render." />
            ) : (
              generatedDocuments.map((document) => (
                <GeneratedDocumentRow key={document.id} document={document} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuotesPanel({ project }: { project: NonNullable<ReturnType<typeof useProject>["data"]> }) {
  const quotes = project.quotes ?? [];

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quote Stack</p>
        <CardTitle>Báo giá liên quan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {quotes.length === 0 ? (
          <EmptyState title="Chưa có báo giá" description="Dự án này chưa có quote gắn vào." />
        ) : (
          quotes.map((quote) => (
            <article key={quote.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/quotes/${quote.id}`} className="font-semibold text-text-primary hover:text-primary">
                      {quote.quoteNo}
                    </Link>
                    <Badge variant="neutral">v{quote.version}</Badge>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="mt-2 text-sm text-text-secondary">Tạo bởi {quote.createdBy?.name ?? "Chưa rõ người tạo"}</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl font-extrabold text-text-primary">
                    <CurrencyDisplay amount={quote.total} short />
                  </p>
                  <p className="text-sm text-text-secondary">
                    {quote.validUntil ? `Hiệu lực đến ${formatDate(quote.validUntil)}` : "Chưa đặt hạn"}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ContractsPanel({ project }: { project: NonNullable<ReturnType<typeof useProject>["data"]> }) {
  const contractStatusConfig = project.contract ? getContractStatusConfig(project.contract.status) : null;

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Contract Desk</p>
        <CardTitle>Thông tin hợp đồng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {project.contract ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/contracts/${project.contract.id}`} className="font-heading text-2xl font-extrabold text-text-primary hover:text-primary">
                {project.contract.contractNo}
              </Link>
              <Badge variant={contractStatusConfig?.variant ?? "neutral"}>
                {contractStatusConfig?.label ?? project.contract.status}
              </Badge>
            </div>
            <div className="grid gap-3 text-sm text-text-secondary md:grid-cols-2 xl:grid-cols-3">
              <MiniInfo label="Giá trị hợp đồng" value={<CurrencyDisplay amount={project.contract.value} short />} />
              <MiniInfo label="Đã thu" value={<CurrencyDisplay amount={project.contract.paidAmount} short />} />
              <MiniInfo label="Còn lại" value={<CurrencyDisplay amount={project.contract.outstandingAmount} short />} />
              <MiniInfo label="Ký ngày" value={project.contract.signDate ? formatDate(project.contract.signDate) : "Chưa cập nhật"} />
              <MiniInfo label="Bắt đầu" value={project.contract.startDate ? formatDate(project.contract.startDate) : "Chưa cập nhật"} />
              <MiniInfo label="Kết thúc" value={project.contract.endDate ? formatDate(project.contract.endDate) : "Chưa cập nhật"} />
            </div>
          </>
        ) : (
          <EmptyState title="Chưa có hợp đồng" description="Dự án này chưa được gắn contract." />
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryPanel({ project }: { project: NonNullable<ReturnType<typeof useProject>["data"]> }) {
  const milestones = project.milestones ?? [];

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Milestone Map</p>
        <CardTitle>Các mốc triển khai</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {milestones.length === 0 ? (
          <EmptyState title="Chưa có milestone" description="Dự án này chưa được lập mốc triển khai." />
        ) : (
          milestones.map((milestone) => {
            const statusConfig = getMilestoneStatusConfig(milestone.status);

            return (
              <article key={milestone.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-text-primary">{milestone.name}</p>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>
                    {milestone.description ? <p className="mt-2 text-sm text-text-secondary">{milestone.description}</p> : null}
                  </div>
                  <div className="text-right text-sm text-text-secondary">
                    <p>{milestone.dueDate ? `Hạn ${formatDate(milestone.dueDate)}` : "Chưa đặt hạn"}</p>
                    <p>{milestone.completedAt ? `Xong ${formatDate(milestone.completedAt)}` : "Chưa hoàn tất"}</p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsPanel({ project }: { project: NonNullable<ReturnType<typeof useProject>["data"]> }) {
  const payments = project.contract?.payments ?? [];

  return (
    <Card className="border border-white/70">
      <CardHeader className="mb-0 gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Cash Collection</p>
        <CardTitle>Lịch sử thanh toán</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!project.contract ? (
          <EmptyState title="Chưa có hợp đồng" description="Thanh toán sẽ xuất hiện khi dự án có hợp đồng." />
        ) : payments.length === 0 ? (
          <EmptyState title="Chưa có thanh toán" description="Chưa ghi nhận thanh toán nào cho hợp đồng này." />
        ) : (
          payments.map((payment) => (
            <div key={payment.id} className="rounded-xl bg-bg-hover/60 p-3 text-sm text-text-secondary">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-text-primary">
                  <CurrencyDisplay amount={payment.amount} short />
                </span>
                <span>{formatDate(payment.paidAt)}</span>
              </div>
              <p className="mt-1">
                {payment.method ?? "Chưa rõ phương thức"} · {payment.reference ?? "Chưa có mã tham chiếu"}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HandoverPanel({
  project,
  overview
}: {
  project: NonNullable<ReturnType<typeof useProject>["data"]>;
  overview?: NonNullable<ReturnType<typeof useProjectOverview360>["data"]>;
}) {
  const createHandover = useCreateProjectHandover(project.id);
  const [form, setForm] = useState({
    summary: "",
    customerRequirements: "",
    risks: "",
    decisions: "",
    openTasks: ""
  });

  async function handleCreateHandover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasContent = Object.values(form).some((value) => value.trim().length > 0);
    if (!hasContent) {
      toast({
        title: "Chưa có nội dung bàn giao",
        description: "Nhập ít nhất một nội dung như bối cảnh, rủi ro, quyết định hoặc việc đang mở.",
        variant: "destructive"
      });
      return;
    }

    await createHandover.mutateAsync(form);
    setForm({
      summary: "",
      customerRequirements: "",
      risks: "",
      decisions: "",
      openTasks: ""
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Knowledge Continuity</p>
          <CardTitle>Tạo ghi chú bàn giao</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateHandover}>
            <Textarea placeholder="Tóm tắt bối cảnh dự án" value={form.summary} onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))} />
            <Textarea placeholder="Yêu cầu khách hàng quan trọng" value={form.customerRequirements} onChange={(event) => setForm((prev) => ({ ...prev, customerRequirements: event.target.value }))} />
            <Textarea placeholder="Rủi ro / điểm cần chú ý" value={form.risks} onChange={(event) => setForm((prev) => ({ ...prev, risks: event.target.value }))} />
            <Textarea placeholder="Quyết định đã thống nhất" value={form.decisions} onChange={(event) => setForm((prev) => ({ ...prev, decisions: event.target.value }))} />
            <Textarea placeholder="Việc đang mở" value={form.openTasks} onChange={(event) => setForm((prev) => ({ ...prev, openTasks: event.target.value }))} />
            <Button type="submit" disabled={createHandover.isPending}>
              {createHandover.isPending ? "Đang lưu..." : "Lưu bàn giao"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-white/70">
        <CardHeader className="mb-0 gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Handover History</p>
          <CardTitle>Lịch sử ghi chú / quyết định</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!overview?.handovers?.length ? (
            <EmptyState title="Chưa có bản bàn giao" description="Lưu những điểm cần đọc trước để người phụ trách mới tiếp nhận nhanh hơn." />
          ) : (
            overview.handovers.map((handover) => (
              <article key={handover.id} className="rounded-2xl border border-border/60 bg-white/80 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <p className="font-semibold text-text-primary">Bàn giao ngày {formatDate(handover.createdAt)}</p>
                  <p className="text-sm text-text-secondary">{handover.createdBy?.name}</p>
                </div>
                {handover.summary ? <p className="mt-3 text-sm text-text-secondary">{handover.summary}</p> : null}
                {handover.decisions ? <MiniInfo label="Quyết định" value={handover.decisions} /> : null}
                {handover.risks ? <MiniInfo label="Rủi ro" value={handover.risks} /> : null}
                {handover.openTasks ? <MiniInfo label="Việc mở" value={handover.openTasks} /> : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-bg-hover/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 font-heading text-2xl font-extrabold text-text-primary">{value}</p>
    </div>
  );
}

function SurveyMediaCard({ media }: { media: SurveyMedia }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (media.kind !== "IMAGE") {
      return undefined;
    }

    let objectUrl: string | null = null;
    let isMounted = true;

    apiClient
      .get(`/surveys/media/${media.id}/file`, { responseType: "blob" })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
        objectUrl = window.URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (isMounted) {
          setPreviewError(true);
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [media.id, media.kind]);

  const filePath = `/surveys/media/${media.id}/file`;
  const filename = media.filename ?? "survey-media";

  return (
    <div className="group overflow-hidden rounded-2xl border border-border/60 bg-bg-hover/60 text-sm transition hover:border-primary/40 hover:bg-white">
      {media.kind === "IMAGE" ? (
        <button
          type="button"
          className="block aspect-[4/3] w-full overflow-hidden bg-slate-100 text-left"
          onClick={() => {
            if (previewUrl) {
              window.open(previewUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={media.caption ?? media.filename ?? "Ảnh khảo sát"}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-muted">
              {previewError ? "Không tải được ảnh" : "Đang tải ảnh..."}
            </div>
          )}
        </button>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-primary/5 text-primary">
          <AppIcon name={media.kind === "VIDEO" ? "activity" : "description"} className="h-8 w-8" />
        </div>
      )}
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={media.kind === "IMAGE" ? "success" : media.kind === "VIDEO" ? "warning" : "neutral"}>
            {media.kind === "IMAGE" ? "Ảnh" : media.kind === "VIDEO" ? "Video" : "File"}
          </Badge>
          {media.isImportant ? <Badge variant="warning">Quan trọng</Badge> : null}
        </div>
        <p className="line-clamp-2 font-semibold text-text-primary">{media.caption ?? filename}</p>
        <p className="text-text-secondary">{media.area ?? "Chưa gắn khu vực"}</p>
        {media.size ? <p className="text-xs text-text-muted">{formatFileSize(media.size)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openSecureFile(filePath, filename).catch((error) => {
              toast({
                title: "Không mở được media",
                description: getApiErrorMessage(error, "Vui lòng thử lại."),
                variant: "destructive"
              });
            })}
          >
            Mở file
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => downloadSecureFile(filePath, filename).catch((error) => {
              toast({
                title: "Không tải được media",
                description: getApiErrorMessage(error, "Vui lòng thử lại."),
                variant: "destructive"
              });
            })}
          >
            Tải file
          </Button>
        </div>
      </div>
    </div>
  );
}

function FileActionButtons({
  documentId,
  fileUrl,
  filename,
  mimeType,
  size
}: {
  documentId: string;
  fileUrl?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  size?: number | null;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!fileUrl) {
    return <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">Chưa có file</span>;
  }

  const mightBeBrokenPdf = mimeType === "application/pdf" && typeof size === "number" && size > 0 && size < 1024;
  const safeFilename = filename ?? "business-document";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isOpening}
        onClick={async () => {
          setIsOpening(true);
          try {
            await openSecureFile(`/business-documents/${documentId}/file`, safeFilename);
          } catch (error) {
            toast({
              title: "Không mở được file",
              description: getApiErrorMessage(error, "Vui lòng thử tải lại tài liệu."),
              variant: "destructive"
            });
          } finally {
            setIsOpening(false);
          }
        }}
      >
        {isOpening ? "Đang mở..." : "Xem file"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isDownloading}
        onClick={async () => {
          setIsDownloading(true);
          try {
            await downloadSecureFile(`/business-documents/${documentId}/file`, safeFilename);
          } catch (error) {
            toast({
              title: "Không tải được file",
              description: getApiErrorMessage(error, "Vui lòng thử lại."),
              variant: "destructive"
            });
          } finally {
            setIsDownloading(false);
          }
        }}
      >
        {isDownloading ? "Đang tải..." : "Tải file"}
      </Button>
      {mightBeBrokenPdf ? (
        <span className="rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-warning">
          PDF rất nhỏ, có thể là file test hoặc file lỗi
        </span>
      ) : null}
    </>
  );
}

function GeneratedDocumentRow({ document }: { document: GeneratedProjectDocument }) {
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadPath = `/documents/${document.id}/download`;
  const documentNumber = document.number || document.id;
  const filename = `${documentNumber}.pdf`;

  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4 text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{documentNumber}</p>
          <p className="text-text-secondary">
            {document.type} · {document.renderedAt ? formatDateTime(document.renderedAt) : formatDateTime(document.createdAt)}
          </p>
          <p className="mt-1 text-xs text-text-muted">Nguồn chuẩn: endpoint tải lại document đã render, không sinh version mới.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isOpening}
            onClick={async () => {
              setIsOpening(true);
              try {
                await openSecureFile(downloadPath, filename);
              } catch (error) {
                toast({
                  title: "Không mở được PDF",
                  description: getApiErrorMessage(error, "Vui lòng render lại tài liệu hoặc thử tải lại."),
                  variant: "destructive"
                });
              } finally {
                setIsOpening(false);
              }
            }}
          >
            {isOpening ? "Đang mở..." : "Xem PDF"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isDownloading}
            onClick={async () => {
              setIsDownloading(true);
              try {
                await downloadSecureFile(downloadPath, filename);
              } catch (error) {
                toast({
                  title: "Không tải được PDF",
                  description: getApiErrorMessage(error, "Vui lòng thử lại."),
                  variant: "destructive"
                });
              } finally {
                setIsDownloading(false);
              }
            }}
          >
            {isDownloading ? "Đang tải..." : "Tải PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  document,
  compact = false
}: {
  document: Pick<
    BusinessDocument,
    "id" | "type" | "source" | "status" | "title" | "documentNo" | "documentDate" | "fileUrl" | "filename" | "size"
  >;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-white/80 p-4", compact && "p-3")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold text-text-primary">{document.title || "Tài liệu chưa đặt tên"}</p>
          <p className="text-sm text-text-secondary">
            {DOCUMENT_TYPE_LABELS[document.type as BusinessDocumentType] ?? document.type}
            {document.documentNo ? ` · ${document.documentNo}` : ""}
            {document.documentDate ? ` · ${formatDate(document.documentDate)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-full bg-bg-hover px-2 py-1">
              {DOCUMENT_SOURCE_LABELS[document.source as BusinessDocumentSource] ?? document.source}
            </span>
            {document.filename ? <span className="rounded-full bg-bg-hover px-2 py-1">{document.filename}</span> : null}
            {document.size ? <span className="rounded-full bg-bg-hover px-2 py-1">{formatFileSize(document.size)}</span> : null}
          </div>
        </div>
        <Badge variant={document.status === "SIGNED" || document.status === "ACCEPTED" ? "success" : "neutral"}>
          {DOCUMENT_STATUS_LABELS[document.status as BusinessDocumentStatus] ?? document.status}
        </Badge>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="metric-sheen noise-edge border border-white/70">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
        <p className="mt-3 font-heading text-3xl font-extrabold text-text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function MiniPanel({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function timelineIcon(type: string): AppIconName {
  switch (type) {
    case "survey":
      return "calendar";
    case "quote":
      return "description";
    case "contract":
      return "contract";
    case "document":
      return "description";
    case "payment":
      return "analytics";
    case "handover":
      return "history";
    default:
      return "activity";
  }
}

function validateBusinessDocumentFile(file: File) {
  return validateFileExtensionAndSize(file, BUSINESS_DOCUMENT_EXTENSIONS, BUSINESS_DOCUMENT_MAX_FILE_SIZE, "PDF, PNG, JPG, XLSX hoặc DOCX");
}

function validateSurveyMediaFile(file: File) {
  return validateFileExtensionAndSize(
    file,
    SURVEY_MEDIA_EXTENSIONS,
    SURVEY_MEDIA_MAX_FILE_SIZE,
    "ảnh, video, PDF, DOCX hoặc XLSX"
  );
}

function validateFileExtensionAndSize(file: File, allowedExtensions: string[], maxSize: number, allowedText: string) {
  if (file.size > maxSize) {
    return `Dung lượng tối đa là ${formatFileSize(maxSize)}. File hiện tại ${formatFileSize(file.size)}.`;
  }

  const extension = getFileExtension(file.name);
  if (!extension || !allowedExtensions.includes(extension)) {
    return `Chỉ hỗ trợ ${allowedText}.`;
  }

  return null;
}

function getFileExtension(filename: string) {
  const normalized = filename.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");

  if (dotIndex < 0) {
    return "";
  }

  return normalized.slice(dotIndex);
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const sizeInKb = size / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(sizeInKb >= 100 ? 0 : 1)} KB`;
  }

  const sizeInMb = sizeInKb / 1024;
  return `${sizeInMb.toFixed(sizeInMb >= 100 ? 0 : 1)} MB`;
}

async function openSecureFile(path: string, filename: string) {
  const blobUrl = await createSecureBlobUrl(path);
  const openedWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    downloadBlobUrl(blobUrl, filename);
  }

  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
}

async function downloadSecureFile(path: string, filename: string) {
  const blobUrl = await createSecureBlobUrl(path);
  downloadBlobUrl(blobUrl, filename);
  window.URL.revokeObjectURL(blobUrl);
}

async function createSecureBlobUrl(path: string) {
  const response = await apiClient.get(path, { responseType: "blob" });
  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  return window.URL.createObjectURL(blob);
}

function downloadBlobUrl(blobUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
}
