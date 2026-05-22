export type Role = "ADMIN" | "MANAGER" | "STAFF";
export type CustomerStatus = "LEAD" | "PROSPECT" | "ACTIVE" | "INACTIVE";
export type ProjectStatus = "SURVEY" | "QUOTING" | "NEGOTIATING" | "WON" | "LOST" | "DELIVERING" | "COMPLETED";
export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export type ContractStatus = "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED";
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "ACCEPTED";
export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "SURVEY" | "DEMO" | "NOTE" | "FOLLOWUP";
export type Priority = "LOW" | "NORMAL" | "HIGH";

export interface AuthRoleInfo {
  id: string;
  name: Role;
  permissions: string[];
}

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
  role: AuthRoleInfo | Role;
  avatarUrl?: string | null;
  isActive: boolean;
}

export interface AuthSession {
  accessToken: string;
  sessionId?: string;
  user: AuthUser;
}

export interface UserSessionInfo {
  id: string;
  device?: string | null;
  deviceName: string | null;
  ip?: string | null;
  ipAddress: string | null;
  lastUsed?: string | null;
  userAgent: string | null;
  current?: boolean;
  lastActiveAt: string;
  createdAt: string;
}

export interface CompanyInfo {
  name: string;
  shortName?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountName?: string | null;
  bankBranch?: string | null;
  swiftCode?: string | null;
}

export interface Policies {
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  taxTypes?: string | null;
  warranty?: string | null;
  service?: string | null;
}

export type PolicyItemType = "PAYMENT_TERMS" | "DELIVERY_TERMS";

export interface PolicyItem {
  id: string;
  type: PolicyItemType;
  name: string;
  content: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
}

export interface PermissionGroup {
  resource: string;
  permissions: Array<Pick<Permission, "id" | "action">>;
}

export interface UserRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: Permission[];
  _count?: {
    users: number;
  };
  users?: Array<{
    id: string;
    email: string;
    name: string;
  }>;
}

export interface RelatedUserRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleUpsertInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface Logo {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

export interface LogoUploadResult extends Logo {
  size: number;
  mimeType: string;
}

export interface UploadedFileResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface ActionResponse {
  success: boolean;
  message: string;
}

export interface MailboxAddress {
  name?: string | null;
  email: string;
}

export interface EmailAttachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  filePath?: string | null;
  cid?: string | null;
}

export interface EmailAccountAdminItem {
  id: string;
  userId: string;
  email: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  isActive: boolean;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface MailboxFolder {
  name: string;
  path: string;
  delimiter: string;
  specialUse?: string | null;
  total: number;
  unread: number;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  uid: number;
  folder: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  fromName?: string | null;
  fromEmail: string;
  toAddresses: MailboxAddress[];
  ccAddresses: MailboxAddress[];
  bccAddresses: MailboxAddress[];
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  snippet?: string | null;
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  size: number;
  receivedAt: string;
  createdAt: string;
  attachments?: EmailAttachment[];
  customerId?: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

export interface MailboxMessagesResponse {
  items: EmailMessage[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MailboxMessageParams {
  folder?: string;
  search?: string;
  page?: number;
  limit?: number;
  customerId?: string;
}

export interface ForgotPasswordResponse extends ActionResponse {
  debug?: {
    resetToken: string;
    resetUrl: string;
  };
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
  role: string;
  roleId: string;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UserUpdateInput {
  name?: string;
  avatarUrl?: string | null;
  roleId?: string;
  isActive?: boolean;
}

export interface UserCreateInput {
  email: string;
  name: string;
  password: string;
  roleId: string;
  avatarUrl?: string | null;
  isActive?: boolean;
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
  assignedTo: Omit<Pick<UserListItem, "id" | "name">, never> & {
    role: string | RelatedUserRole;
  };
  primaryContact: CustomerPrimaryContact | null;
  projectCount: number;
  language?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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
  customFieldValues?: CustomFieldValues;
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
  assignedTo: Omit<Pick<UserListItem, "id" | "name">, never> & {
    role: string | RelatedUserRole;
  };
  stats: CustomerDetailStats;
  contacts: CustomerContact[];
  projects: CustomerProject[];
  activities: CustomerDetailActivity[];
  customFieldValues?: CustomFieldValues;
  language?: string | null;
}

export interface ProjectListCustomer {
  id: string;
  name: string;
  industry?: string | null;
  status: CustomerStatus;
  assignedTo: Pick<UserListItem, "id" | "name" | "role">;
  language?: string | null;
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
  deletedAt?: string | null;
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

export type ProjectViewMode = "kanban" | "list";

export interface ProjectKanbanColumn {
  key: ProjectStatus;
  label: string;
  itemCount: number;
  totalValue: number;
  items: ProjectListItem[];
}

export interface ProjectFilters {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  priority?: Priority;
  assignedToId?: string;
  customerId?: string;
}

export interface ProjectUpsertInput {
  customerId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  estimatedValue?: number;
  startDate?: string;
  expectedEndDate?: string;
  notes?: string;
  customFieldValues?: CustomFieldValues;
}

export interface ProjectStatusUpdateInput {
  status: ProjectStatus;
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
  language?: string | null;
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
  contactId?: string | null;
  projectContact?: CustomerContact | null;
  stats: ProjectDetailStats;
  customer: ProjectDetailCustomer;
  contract: ProjectDetailContract | null;
  quotes: ProjectDetailQuote[];
  milestones: ProjectDetailMilestone[];
  activities: ProjectDetailActivity[];
  customFieldValues?: CustomFieldValues;
}

export type SurveyMediaKind = "IMAGE" | "VIDEO" | "FILE";
export type SurveyNoteType =
  | "GENERAL"
  | "TECHNICAL_REQUIREMENT"
  | "COMMERCIAL_REQUIREMENT"
  | "SITE_CONSTRAINT"
  | "RISK"
  | "DECISION"
  | "OPEN_QUESTION";

export interface SurveyMedia {
  id: string;
  surveyId: string;
  kind: SurveyMediaKind;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  caption?: string | null;
  area?: string | null;
  isImportant: boolean;
  createdAt: string;
}

export interface SurveyNote {
  id: string;
  surveyId: string;
  type: SurveyNoteType;
  content: string;
  isImportant: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: Pick<UserListItem, "id" | "name">;
}

export interface Survey {
  id: string;
  title: string;
  surveyedAt?: string | null;
  location?: string | null;
  customerParticipants?: string | null;
  objectives?: string | null;
  summary?: string | null;
  nextStep?: string | null;
  customerId: string;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Pick<CustomerListItem, "id" | "name" | "shortName">;
  project?: Pick<ProjectListItem, "id" | "code" | "name"> | null;
  createdBy?: Pick<UserListItem, "id" | "name">;
  media: SurveyMedia[];
  notes: SurveyNote[];
  counts?: {
    media: number;
    notes: number;
  };
}

export interface SurveyCreateInput {
  title: string;
  surveyedAt?: string;
  location?: string;
  customerParticipants?: string;
  objectives?: string;
  summary?: string;
  nextStep?: string;
  customerId: string;
  projectId?: string;
}

export interface SurveyNoteInput {
  type: SurveyNoteType;
  content: string;
  isImportant: boolean;
}

export type BusinessDocumentType =
  | "RFQ"
  | "CUSTOMER_PO"
  | "QUOTATION"
  | "SIGNED_QUOTATION"
  | "PROPOSAL"
  | "CONTRACT"
  | "SIGNED_CONTRACT"
  | "CONTRACT_ADDENDUM"
  | "NDA"
  | "DELIVERY_NOTE"
  | "DOC_HANDOVER"
  | "INSTALLATION_REPORT"
  | "ACCEPTANCE_REPORT"
  | "PARTIAL_ACCEPTANCE"
  | "WARRANTY_CERT"
  | "MAINTENANCE_RECORD"
  | "PAYMENT_REQUEST"
  | "PAYMENT_RECEIPT"
  | "INVOICE"
  | "AR_RECONCILIATION"
  | "OTHER";

export type BusinessDocumentSource = "GENERATED" | "UPLOADED" | "RECEIVED" | "SIGNED_UPLOAD";
export type BusinessDocumentStatus =
  | "DRAFT"
  | "ISSUED"
  | "RECEIVED"
  | "SIGNED"
  | "ACCEPTED"
  | "REJECTED"
  | "SUPERSEDED"
  | "CANCELLED"
  | "ARCHIVED";

export interface BusinessDocument {
  id: string;
  type: BusinessDocumentType;
  source: BusinessDocumentSource;
  status: BusinessDocumentStatus;
  title: string;
  documentNo?: string | null;
  documentDate?: string | null;
  fileUrl?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  size?: number | null;
  notes?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  quoteId?: string | null;
  contractId?: string | null;
  paymentId?: string | null;
  generatedDocumentId?: string | null;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<UserListItem, "id" | "name">;
  customer?: Pick<CustomerListItem, "id" | "name" | "shortName"> | null;
  project?: Pick<ProjectListItem, "id" | "code" | "name"> | null;
  quote?: Pick<ProjectDetailQuote, "id" | "quoteNo" | "version"> | null;
  contract?: Pick<ProjectDetailContract, "id" | "contractNo"> | null;
  payment?: Pick<ProjectDetailPayment, "id" | "amount" | "paidAt"> | null;
}

export interface BusinessDocumentCreateInput {
  type: BusinessDocumentType;
  source: BusinessDocumentSource;
  status: BusinessDocumentStatus;
  title: string;
  documentNo?: string;
  documentDate?: string;
  notes?: string;
  customerId?: string;
  projectId?: string;
  quoteId?: string;
  contractId?: string;
  paymentId?: string;
  parentId?: string;
}

export interface GeneratedProjectDocument {
  id: string;
  type: DocumentTemplateType;
  number: string;
  version: number;
  language: string;
  entityType: string;
  entityId: string;
  customerId?: string | null;
  pdfPath?: string | null;
  renderedAt?: string | null;
  createdAt: string;
  createdBy?: Pick<UserListItem, "id" | "name">;
}

export interface ProjectDocuments360 {
  businessDocuments: BusinessDocument[];
  generatedDocuments: GeneratedProjectDocument[];
}

export interface ProjectHandover {
  id: string;
  projectId: string;
  summary?: string | null;
  customerRequirements?: string | null;
  risks?: string | null;
  decisions?: string | null;
  openTasks?: string | null;
  importantDocumentIds: string[];
  fromUserId?: string | null;
  toUserId?: string | null;
  createdById: string;
  createdAt: string;
  fromUser?: Pick<UserListItem, "id" | "name"> | null;
  toUser?: Pick<UserListItem, "id" | "name"> | null;
  createdBy?: Pick<UserListItem, "id" | "name">;
}

export interface ProjectHandoverInput {
  summary?: string;
  customerRequirements?: string;
  risks?: string;
  decisions?: string;
  openTasks?: string;
  importantDocumentIds?: string[];
  fromUserId?: string;
  toUserId?: string;
}

export interface ProjectOverview360 {
  project: ProjectDetail;
  nextActivity: Pick<ProjectDetailActivity, "id" | "title" | "type" | "scheduledAt" | "user"> | null;
  latestSurvey: (Pick<Survey, "id" | "title" | "surveyedAt" | "location" | "summary" | "nextStep"> & {
    media: Array<Pick<SurveyMedia, "id" | "kind" | "url" | "caption" | "area" | "isImportant">>;
    notes: Array<Pick<SurveyNote, "id" | "type" | "content" | "isImportant" | "createdAt">>;
  }) | null;
  importantDocuments: Array<
    Pick<
      BusinessDocument,
      "id" | "type" | "source" | "status" | "title" | "documentNo" | "documentDate" | "fileUrl" | "createdAt" | "createdBy"
    >
  >;
  openMilestones: Array<Pick<ProjectDetailMilestone, "id" | "name" | "status" | "dueDate" | "paymentAmount">>;
  paymentSnapshot: {
    contractValue: number;
    paidAmount: number;
    outstandingAmount: number;
    paymentCount: number;
  } | null;
  handovers: ProjectHandover[];
}

export interface ProjectTimelineItem {
  id: string;
  type: "activity" | "survey" | "quote" | "contract" | "document" | "milestone" | "payment" | "handover";
  title: string;
  description?: string | null;
  happenedAt: string;
  actorName?: string | null;
  link?: string | null;
  meta?: Record<string, unknown>;
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
  language?: string | null;
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
    language?: string | null;
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

export interface QuoteTableColumnWidths {
  index: number;
  name: number;
  description: number;
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
  tableColumnWidths?: QuoteTableColumnWidths | null;
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
  tableColumnWidths?: QuoteTableColumnWidths;
  terms?: string;
  deliveryTerms?: string;
  internalNote?: string;
  status: QuoteStatus;
  items: QuoteCreateItemInput[];
}

export interface QuoteUpdateInput extends QuoteCreateInput {}

export interface QuoteStatusUpdateInput {
  status: QuoteStatus;
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
  language?: string | null;
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
    language?: string | null;
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
  customFieldValues?: CustomFieldValues;
}

export interface ContractCreateInput {
  projectId: string;
  sourceQuoteId?: string;
  signDate?: string;
  startDate?: string;
  endDate?: string;
  value: number;
  status: ContractStatus;
  fileUrl?: string | null;
  notes?: string;
  customFieldValues?: CustomFieldValues;
}

export interface ContractUpdateInput {
  signDate?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  status?: ContractStatus;
  fileUrl?: string | null;
  notes?: string;
  customFieldValues?: CustomFieldValues;
}

export interface ContractMilestoneCreateInput {
  name: string;
  description?: string;
  dueDate?: string;
  status: MilestoneStatus;
  paymentAmount?: number;
  notes?: string;
}

export interface ContractMilestoneUpdateInput {
  name?: string;
  description?: string;
  dueDate?: string;
  status?: MilestoneStatus;
  completedAt?: string;
  paymentAmount?: number;
  notes?: string;
}

export interface ContractPaymentCreateInput {
  amount: number;
  paidAt: string;
  method?: string;
  reference?: string;
  notes?: string;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  content?: string | null;
  type: ActivityType;
  scheduledAt?: string | null;
  doneAt?: string | null;
  isCompleted: boolean;
  updatedAt: string;
  anchorAt: string;
  user: Pick<UserListItem, "id" | "name" | "role">;
  customer: {
    id: string;
    name: string;
    status: CustomerStatus;
  } | null;
  project: {
    id: string;
    code: string;
    name: string;
    status: ProjectStatus;
  } | null;
}

export interface CalendarSummary {
  total: number;
  openCount: number;
  completedCount: number;
  overdueCount: number;
  todayCount: number;
}

export interface CalendarListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: CalendarSummary;
}

export interface CalendarFilters {
  page: number;
  limit: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  isCompleted?: boolean;
  type?: ActivityType;
  assigneeId?: string;
  customerId?: string;
  projectId?: string;
}

export interface ReportRecentPayment {
  id: string;
  amount: number;
  paidAt: string;
  contractNo: string;
  customerName: string;
  projectName: string;
  method?: string | null;
  reference?: string | null;
}

export interface ReportsOverview {
  collectionsValue: number;
  openPipelineValue: number;
  outstandingDebt: number;
  quoteAcceptanceRate: number;
  activeContracts: number;
  activeCustomers: number;
  recentPayments: ReportRecentPayment[];
}

export interface ReportStatusBucket {
  key: string;
  label: string;
  count: number;
  totalValue: number;
}

export interface ReportStatusBreakdown {
  projects: ReportStatusBucket[];
  quotes: ReportStatusBucket[];
  contracts: ReportStatusBucket[];
}

export interface ReportTopCustomer {
  customerId: string;
  name: string;
  paidAmount: number;
  contractValue: number;
  projectCount: number;
}

export type DocumentTemplateType =
  | "QUOTATION"
  | "PROPOSAL"
  | "SURVEY_REPORT"
  | "CONTRACT"
  | "CONTRACT_ADDENDUM"
  | "NDA"
  | "DELIVERY_NOTE"
  | "DOC_HANDOVER"
  | "INSTALLATION_REPORT"
  | "ACCEPTANCE_REPORT"
  | "PARTIAL_ACCEPTANCE"
  | "WARRANTY_CERT"
  | "MAINTENANCE_RECORD"
  | "PAYMENT_REQUEST"
  | "PAYMENT_RECEIPT"
  | "AR_RECONCILIATION";

export type DocumentTemplateStyle = "modern" | "classic";
export type DocumentTemplateEntityType = "quote" | "project" | "contract" | "customer";
export type DocumentTemplateStatus = "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "ARCHIVED";
export type TemplateBoxType =
  | "text"
  | "image"
  | "key_value_table"
  | "line_items_table"
  | "signature_block";

export interface TemplateLocalizedText {
  vi: string;
  viEn?: string;
}

export interface TemplateBoxStyle {
  fontSize?: number;
  fontWeight?: 400 | 500 | 600 | 700;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "center" | "bottom";
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
}

export interface TemplateBoxBase {
  id: string;
  type: TemplateBoxType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  visible?: boolean;
  style?: TemplateBoxStyle;
}

export interface TemplateTextBox extends TemplateBoxBase {
  type: "text";
  content: {
    text: TemplateLocalizedText;
  };
}

export interface TemplateImageBox extends TemplateBoxBase {
  type: "image";
  content: {
    src: string;
    alt?: string;
    fit?: "contain" | "cover";
  };
}

export interface TemplateKeyValueRow {
  id: string;
  label: TemplateLocalizedText;
  value: string;
}

export interface TemplateKeyValueTableBox extends TemplateBoxBase {
  type: "key_value_table";
  content: {
    rows: TemplateKeyValueRow[];
    labelWidth?: number;
  };
}

export interface TemplateLineItemsColumn {
  id: string;
  label: TemplateLocalizedText;
  value: string;
  width?: number;
  align?: "left" | "center" | "right";
}

export interface TemplateLineItemsTableBox extends TemplateBoxBase {
  type: "line_items_table";
  content: {
    source: string;
    columns: TemplateLineItemsColumn[];
    emptyText?: TemplateLocalizedText;
  };
}

export interface TemplateSignatureBlockBox extends TemplateBoxBase {
  type: "signature_block";
  content: {
    leftTitle: TemplateLocalizedText;
    rightTitle: TemplateLocalizedText;
    leftCaption?: TemplateLocalizedText;
    rightCaption?: TemplateLocalizedText;
  };
}

export type TemplateBox =
  | TemplateTextBox
  | TemplateImageBox
  | TemplateKeyValueTableBox
  | TemplateLineItemsTableBox
  | TemplateSignatureBlockBox;

export interface DocumentTemplatePage {
  id: string;
  boxes: TemplateBox[];
}

export interface DocumentTemplateLayout {
  version: 1;
  page: {
    widthMm: number;
    heightMm: number;
    gridMm: number;
    marginMm: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  pages: DocumentTemplatePage[];
}

export interface TemplateValidationIssue {
  boxId?: string;
  code: "out_of_bounds" | "overlap" | "overflow" | "invalid";
  severity: "error" | "warning";
  message: string;
}

export interface TemplateToken {
  key: string;
  label: string;
  description: string;
}

export interface TemplateTokenGroup {
  id: string;
  label: string;
  tokens: TemplateToken[];
}

export interface TemplateBoxLibraryItem {
  type: TemplateBoxType;
  label: string;
  description: string;
  defaultBox: TemplateBox;
}

export interface DocumentTemplateRegistryItem {
  type: DocumentTemplateType;
  label: string;
  templateDir: string;
  prefix: string;
  style: DocumentTemplateStyle;
  entityType: DocumentTemplateEntityType;
  phase: number;
  runtimeStatus: "production" | "beta";
  endUserEnabled: boolean;
  editorEnabled: boolean;
  usesVariantRuntime: boolean;
}

export interface DocumentTemplateVariant {
  id: string;
  type: DocumentTemplateType;
  name: string;
  status: DocumentTemplateStatus;
  isActive: boolean;
  version: number;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  basedOnVariantId: string | null;
  createdAt: string;
  updatedAt: string;
  layoutJson: DocumentTemplateLayout;
  validationIssues?: TemplateValidationIssue[];
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface TemplateCatalog {
  type: DocumentTemplateType;
  label: string;
  defaultLayout: DocumentTemplateLayout;
  boxLibrary: TemplateBoxLibraryItem[];
  tokenGroups: TemplateTokenGroup[];
  sampleData: Record<string, unknown>;
}

export interface DocumentTemplateCreateInput {
  type: DocumentTemplateType;
  name: string;
  basedOnVariantId?: string;
}

export interface DocumentTemplateVariantUpdateInput {
  name?: string;
  layoutJson?: DocumentTemplateLayout;
}

export interface RealtimeEvent<TPayload = Record<string, unknown>> {
  id: string;
  event:
    | "customer.created"
    | "customer.updated"
    | "customer.deleted"
    | "customer.assigned"
    | "project.created"
    | "project.status_changed"
    | "quote.sent"
    | "quote.accepted"
    | "quote.rejected"
    | "contract.signed"
    | "contract.completed"
    | "payment.received"
    | "payment.overdue"
    | "milestone.due_soon"
    | "activity.assigned"
    | "mention.created";
  payload: TPayload;
  occurredAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationFilters {
  page: number;
  limit: number;
  isRead?: boolean;
  type?: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type CustomFieldResource = "customer" | "project" | "contract";
export type CustomFieldType = "text" | "number" | "date" | "select" | "multiselect" | "boolean";
export type CustomFieldValues = Record<string, unknown>;

export interface CustomFieldDefinition {
  id: string;
  resource: CustomFieldResource;
  name: string;
  label: string;
  type: CustomFieldType;
  options?: string[] | null;
  required: boolean;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomFieldUpsertInput {
  resource: CustomFieldResource;
  name: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
}

export type ReportDataset = "customers" | "projects" | "quotes" | "contracts" | "activities" | "payments";
export type ReportChartType = "bar" | "line" | "pie" | "area" | "table";
export type ReportFilterOperator = "eq" | "neq" | "contains" | "gte" | "lte" | "in";

export interface ReportBuilderFilter {
  field: string;
  operator: ReportFilterOperator;
  value: string | number | boolean | Array<string | number>;
}

export interface ReportBuilderMeasure {
  field: string;
  label: string;
  aggregator: "count" | "sum";
}

export interface ReportBuilderConfig {
  dataset: ReportDataset;
  dimensions: string[];
  measures: ReportBuilderMeasure[];
  filters: ReportBuilderFilter[];
  chartType: ReportChartType;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string | null;
  resource: ReportDataset;
  config: ReportBuilderConfig;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResultItem {
  id: string;
  type: "customer" | "project" | "quote" | "contract" | "activity";
  title: string;
  subtitle?: string | null;
  href: string;
}

export interface BulkActionPayload {
  action: string;
  ids: string[];
  status?: string;
  assignedToId?: string;
}

export interface ReportSankeyNode {
  id: string;
  label: string;
}

export interface ReportSankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface ReportHeatmapCell {
  day: string;
  hour: string;
  value: number;
}

export interface ReportFunnelItem {
  id: string;
  label: string;
  value: number;
  totalValue: number;
}

export interface ReportCohortRow {
  cohort: string;
  cohortSize: number;
  values: Array<{
    month: string;
    retainedCount: number;
    retainedRate: number;
  }>;
}

// ============================================================
// INVENTORY & MATERIALS TYPES
// ============================================================

export type StockDocStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

// Suppliers
export interface SupplierListItem {
  id: string;
  code: string;
  name: string;
  taxCode: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SupplierDetail extends SupplierListItem {
  address: string | null;
  notes: string | null;
  _count: { materialSuppliers: number };
}
export interface SupplierSelectItem {
  id: string;
  code: string;
  name: string;
}
export interface SupplierListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Material Categories
export interface MaterialCategoryItem {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  _count: { materials: number };
}

// Materials
export interface MaterialListItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  minStock: number | null;
  isActive: boolean;
  totalStock: number;
  isLowStock: boolean;
  category: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}
export interface MaterialDetail extends MaterialListItem {
  description: string | null;
  imageUrl: string | null;
  suppliers: Array<{
    id: string;
    supplierId: string;
    supplier: { id: string; name: string; code: string };
    supplierCode: string | null;
    costPrice: number;
    leadTimeDays: number | null;
    isPreferred: boolean;
  }>;
  stockBalances: Array<{
    warehouseId: string;
    warehouse: { id: string; name: string };
    quantity: number;
  }>;
}
export interface MaterialSelectItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  salePrice: number;
}
export interface MaterialListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Warehouses
export interface WarehouseListItem {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  manager: { id: string; name: string } | null;
  createdAt: string;
}
export interface WarehouseSelectItem {
  id: string;
  code: string;
  name: string;
}

// Stock document shared line item
export interface StockDocLineItem {
  id: string;
  materialId: string;
  material: { id: string; code: string; name: string; unit: string };
  quantity: number;
  unitPrice: number;
  total: number;
}
export interface StockTransferLineItem {
  id: string;
  materialId: string;
  material: { id: string; code: string; name: string; unit: string };
  quantity: number;
}
export interface StockCountLineItem {
  id: string;
  materialId: string;
  material: { id: string; code: string; name: string; unit: string };
  systemQuantity: number;
  actualQuantity: number;
  diff: number;
}

// Stock Receipts
export interface StockReceiptListItem {
  id: string;
  receiptNo: string;
  date: string;
  status: StockDocStatus;
  totalAmount: number;
  warehouse: { id: string; name: string };
  supplier: { id: string; name: string } | null;
  itemCount: number;
  createdAt: string;
}
export interface StockReceiptDetail extends StockReceiptListItem {
  notes: string | null;
  confirmedAt: string | null;
  createdBy: { id: string; name: string };
  items: StockDocLineItem[];
}
export interface StockReceiptListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Stock Issues
export interface StockIssueListItem {
  id: string;
  issueNo: string;
  date: string;
  status: StockDocStatus;
  totalAmount: number;
  reason: string | null;
  warehouse: { id: string; name: string };
  project: { id: string; code: string; name: string } | null;
  itemCount: number;
  createdAt: string;
}
export interface StockIssueDetail extends StockIssueListItem {
  notes: string | null;
  confirmedAt: string | null;
  createdBy: { id: string; name: string };
  items: StockDocLineItem[];
}
export interface StockIssueListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Stock Transfers
export interface StockTransferListItem {
  id: string;
  transferNo: string;
  date: string;
  status: StockDocStatus;
  fromWarehouse: { id: string; name: string };
  toWarehouse: { id: string; name: string };
  itemCount: number;
  createdAt: string;
}
export interface StockTransferDetail extends StockTransferListItem {
  notes: string | null;
  confirmedAt: string | null;
  createdBy: { id: string; name: string };
  items: StockTransferLineItem[];
}
export interface StockTransferListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Stock Counts
export interface StockCountListItem {
  id: string;
  countNo: string;
  date: string;
  status: StockDocStatus;
  warehouse: { id: string; name: string };
  itemCount: number;
  createdAt: string;
}
export interface StockCountDetail extends StockCountListItem {
  notes: string | null;
  confirmedAt: string | null;
  createdBy: { id: string; name: string };
  items: StockCountLineItem[];
}
export interface StockCountListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Inventory balance
export interface InventoryBalanceItem {
  warehouseId: string;
  warehouse: { id: string; name: string };
  materialId: string;
  material: { id: string; code: string; name: string; unit: string; minStock: number | null };
  quantity: number;
  isLowStock: boolean;
  value: number; // quantity * costPrice
}
export interface InventorySummary {
  totalValue: number;
  lowStockCount: number;
  draftDocsCount: number;
  warehouseCount: number;
}

// Survey list
export interface SurveyListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SurveyListFilter {
  page?: number;
  limit?: number;
  customerId?: string;
  projectId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
