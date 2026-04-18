export type Role = "ADMIN" | "MANAGER" | "STAFF";
export type CustomerStatus = "LEAD" | "PROSPECT" | "ACTIVE" | "INACTIVE";
export type ProjectStatus = "SURVEY" | "QUOTING" | "NEGOTIATING" | "WON" | "LOST" | "DELIVERING" | "COMPLETED";
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type ContractStatus = "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED";
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "ACCEPTED";
export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "SURVEY" | "DEMO" | "NOTE" | "FOLLOWUP";
export type Priority = "LOW" | "NORMAL" | "HIGH";

export interface ApiResponse<T> {
  data: T;
  meta: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  } | null;
}

export interface ApiErrorPayload {
  statusCode: number;
  message: string;
  errors?: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  isActive: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface DashboardKpis {
  monthlyRevenue: {
    value: number;
    changePercent: number;
  };
  activeProjects: {
    value: number;
  };
  pendingQuotes: {
    value: number;
    totalValue: number;
  };
  outstandingDebt: {
    value: number;
    overdueCustomers: number;
  };
}

export interface RevenueChartPoint {
  month: string;
  revenue: number;
  target: number;
}

export interface PipelineItem {
  id: string;
  code: string;
  name: string;
  customerName: string;
  estimatedValue: number;
  priority: Priority;
}

export interface PipelineStage {
  status: ProjectStatus;
  label: string;
  color: string;
  count: number;
  totalValue: number;
  items: PipelineItem[];
}

export interface DashboardTask {
  id: string;
  title: string;
  type: ActivityType;
  scheduledAt: string;
  customerName: string;
  assigneeName: string;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  content?: string | null;
  type: ActivityType;
  createdAt: string;
  customerName?: string | null;
  projectName?: string | null;
  userName: string;
  isCompleted: boolean;
}

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerPrimaryContact {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerListItem {
  id: string;
  name: string;
  shortName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  address?: string | null;
  status: CustomerStatus;
  isVip: boolean;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
  primaryContact: CustomerPrimaryContact | null;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomersSummary {
  quarterlyRevenue: number;
  newCustomersLast30Days: number;
  retentionRate: number;
}

export interface CustomerListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: CustomersSummary;
}

export interface CustomerFilters {
  page: number;
  limit: number;
  search?: string;
  status?: CustomerStatus;
  industry?: string;
  assignedToId?: string;
  isVip?: boolean;
}

export interface CustomerUpsertInput {
  name: string;
  shortName?: string;
  taxCode?: string;
  industry?: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  source?: string;
  notes?: string;
  status: CustomerStatus;
  isVip: boolean;
  assignedToId: string;
}

export interface ContactUpsertInput {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  notes?: string;
}

export interface CustomerContact {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
}

export interface CustomerContractSummary {
  id: string;
  contractNo: string;
  value: number;
  status: ContractStatus;
}

export interface CustomerProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  priority: Priority;
  estimatedValue: number;
  expectedEndDate?: string | null;
  progressPercent: number;
  quoteCount: number;
  milestoneCount: number;
  contract: CustomerContractSummary | null;
}

export interface CustomerDetailActivity {
  id: string;
  title: string;
  content?: string | null;
  type: ActivityType;
  scheduledAt?: string | null;
  doneAt?: string | null;
  isCompleted: boolean;
  attachmentUrl?: string | null;
  updatedAt: string;
  user: Pick<UserListItem, "id" | "name">;
}

export interface CustomerDetailStats {
  totalContractValue: number;
  activeProjects: number;
  projectCount: number;
  recentQuoteCount: number;
  customerSince: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  shortName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  notes?: string | null;
  status: CustomerStatus;
  isVip: boolean;
  createdAt: string;
  updatedAt: string;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
  stats: CustomerDetailStats;
  contacts: CustomerContact[];
  projects: CustomerProject[];
  activities: CustomerDetailActivity[];
}

export interface ProjectListCustomer {
  id: string;
  name: string;
  industry?: string | null;
  status: CustomerStatus;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
}

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: Priority;
  estimatedValue: number;
  progressPercent: number;
  startDate?: string | null;
  expectedEndDate?: string | null;
  updatedAt: string;
  lastActivityAt?: string | null;
  isOverdue: boolean;
  customer: ProjectListCustomer;
  contract: CustomerContractSummary | null;
  quoteCount: number;
  milestoneCount: number;
  activityCount: number;
}

export interface ProjectsSummary {
  pipelineValue: number;
  activeProjects: number;
  deliveringProjects: number;
  dueSoonProjects: number;
}

export interface ProjectListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: ProjectsSummary;
}

export interface ProjectFilters {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  priority?: Priority;
  assignedToId?: string;
}

export interface ProjectDetailCustomer {
  id: string;
  name: string;
  shortName?: string | null;
  industry?: string | null;
  status: CustomerStatus;
  address?: string | null;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
  primaryContact: CustomerPrimaryContact | null;
}

export interface ProjectDetailPayment {
  id: string;
  amount: number;
  paidAt: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface ProjectDetailContract {
  id: string;
  contractNo: string;
  status: ContractStatus;
  value: number;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  paidAmount: number;
  outstandingAmount: number;
  paymentCount: number;
  payments: ProjectDetailPayment[];
}

export interface ProjectDetailQuote {
  id: string;
  quoteNo: string;
  version: number;
  status: QuoteStatus;
  total: number;
  validUntil?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  createdBy: Pick<UserListItem, "id" | "name">;
}

export interface ProjectDetailMilestone {
  id: string;
  name: string;
  description?: string | null;
  status: MilestoneStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  paymentAmount: number;
  notes?: string | null;
}

export type ProjectDetailActivity = CustomerDetailActivity;

export interface ProjectDetailStats {
  quoteCount: number;
  milestoneCount: number;
  activityCount: number;
  paidAmount: number;
  outstandingAmount: number;
  progressPercent: number;
}

export interface ProjectDetail {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: Priority;
  estimatedValue: number;
  progressPercent: number;
  startDate?: string | null;
  expectedEndDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  stats: ProjectDetailStats;
  customer: ProjectDetailCustomer;
  contract: ProjectDetailContract | null;
  quotes: ProjectDetailQuote[];
  milestones: ProjectDetailMilestone[];
  activities: ProjectDetailActivity[];
}

export interface QuoteListProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
}

export interface QuoteListCustomer {
  id: string;
  name: string;
  shortName?: string | null;
  status: CustomerStatus;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
}

export interface QuoteListItem {
  id: string;
  quoteNo: string;
  version: number;
  status: QuoteStatus;
  validUntil?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  acceptedAt?: string | null;
  isExpiringSoon: boolean;
  itemCount: number;
  createdBy: Pick<UserListItem, "id" | "name">;
  project: QuoteListProject;
  customer: QuoteListCustomer;
}

export interface QuotesSummary {
  totalValue: number;
  draftCount: number;
  sentCount: number;
  acceptedCount: number;
  expiringSoonCount: number;
}

export interface QuoteListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: QuotesSummary;
}

export interface QuoteFilters {
  page: number;
  limit: number;
  search?: string;
  status?: QuoteStatus;
  projectId?: string;
  customerId?: string;
  createdById?: string;
}

export interface QuoteDetailProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  estimatedValue: number;
  customer: {
    id: string;
    name: string;
    shortName?: string | null;
    taxCode?: string | null;
    address?: string | null;
    status: CustomerStatus;
    assignedTo: Pick<UserListItem, "id" | "name" | "role">;
    primaryContact: CustomerPrimaryContact | null;
  };
  contract: CustomerContractSummary | null;
}

export interface QuoteDetailItem {
  id: string;
  order: number;
  name: string;
  description?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteDetail {
  id: string;
  quoteNo: string;
  version: number;
  status: QuoteStatus;
  validUntil?: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  terms?: string | null;
  deliveryTerms?: string | null;
  internalNote?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  createdBy: Pick<UserListItem, "id" | "name" | "role"> & { email?: string };
  project: QuoteDetailProject;
  items: QuoteDetailItem[];
}

export interface QuoteCreateItemInput {
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteCreateInput {
  projectId: string;
  validUntil?: string;
  taxRate: number;
  terms?: string;
  deliveryTerms?: string;
  internalNote?: string;
  status: QuoteStatus;
  items: QuoteCreateItemInput[];
}

export interface ContractListProject {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
}

export interface ContractListCustomer {
  id: string;
  name: string;
  shortName?: string | null;
  status: CustomerStatus;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
}

export interface ContractListItem {
  id: string;
  contractNo: string;
  status: ContractStatus;
  value: number;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  paidAmount: number;
  outstandingAmount: number;
  paymentCount: number;
  milestoneCount: number;
  isOverdue: boolean;
  project: ContractListProject;
  customer: ContractListCustomer;
}

export interface ContractsSummary {
  totalValue: number;
  activeCount: number;
  completedCount: number;
  outstandingAmount: number;
}

export interface ContractListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: ContractsSummary;
}

export interface ContractFilters {
  page: number;
  limit: number;
  search?: string;
  status?: ContractStatus;
  projectId?: string;
  customerId?: string;
}

export interface ContractDetailStats {
  paidAmount: number;
  outstandingAmount: number;
  paymentCount: number;
  milestoneCount: number;
  completedMilestones: number;
  completionRate: number;
}

export interface ContractDetailMilestone {
  id: string;
  name: string;
  description?: string | null;
  status: MilestoneStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  paymentAmount: number;
  notes?: string | null;
}

export interface ContractDetailProject {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  estimatedValue: number;
  startDate?: string | null;
  expectedEndDate?: string | null;
  customer: {
    id: string;
    name: string;
    shortName?: string | null;
    taxCode?: string | null;
    address?: string | null;
    status: CustomerStatus;
    assignedTo: Pick<UserListItem, "id" | "name" | "role">;
    primaryContact: CustomerPrimaryContact | null;
  };
  quotes: ProjectDetailQuote[];
  activities: ProjectDetailActivity[];
}

export interface ContractDetail {
  id: string;
  contractNo: string;
  status: ContractStatus;
  value: number;
  signDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  stats: ContractDetailStats;
  project: ContractDetailProject;
  milestones: ContractDetailMilestone[];
  payments: ProjectDetailPayment[];
}
