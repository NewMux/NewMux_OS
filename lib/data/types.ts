export type UserRole = "partner_admin" | "lead_dev";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};

export type Client = {
  id: string;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  billingAddress: string | null;
  notes: string | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  isSaas: boolean;
  paddleProductId: string | null;
};

export type DocumentType = "quote" | "contract" | "invoice";
export type DocumentStatus = "draft" | "sent" | "accepted" | "signed" | "paid" | "archived";

export type DocumentLineItem = {
  id: string;
  documentId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  sortOrder: number;
};

export type DocumentRecord = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  clientId: string;
  productId: string | null;
  documentNumber: string;
  currency: string;
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  paymentTerms: string | null;
  notes: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentStatusHistoryEntry = {
  id: string;
  documentId: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
  changedBy: string | null;
  changedAt: string;
};

export type ProjectStatus = "planning" | "active_sprint" | "paused" | "completed" | "archived";

export type Project = {
  id: string;
  clientId: string | null;
  productId: string | null;
  name: string;
  status: ProjectStatus;
  startedAt: string | null;
  targetEndAt: string | null;
  createdBy: string;
};

export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string | null;
  dueAt: string | null;
  sortOrder: number;
  createdBy: string;
};

export type SecretType = "api_token" | "db_connection" | "deploy_key" | "ssh_login" | "other";

export type SecretRecord = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  label: string;
  secretType: SecretType;
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  maskedPreview: string;
  createdBy: string;
  createdAt: string;
};

export type VaultAccessLogEntry = {
  id: string;
  secretId: string;
  accessedBy: string;
  action: "reveal" | "unlock_attempt" | "create" | "update" | "delete";
  accessedAt: string;
};

export type SaasSubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";

export type SaasCustomer = {
  id: string;
  paddleCustomerId: string;
  clientId: string | null;
  email: string | null;
};

export type SaasSubscription = {
  id: string;
  paddleSubscriptionId: string;
  saasCustomerId: string;
  productId: string | null;
  status: SaasSubscriptionStatus;
  currency: string;
  recurringAmountCents: number;
  billingInterval: "month" | "year";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  canceledAt: string | null;
};

export type SaasTransaction = {
  id: string;
  paddleTransactionId: string;
  saasSubscriptionId: string | null;
  saasCustomerId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  billedAt: string | null;
};

export type CampaignChannel = "meta_ads" | "linkedin" | "google_search" | "outbound_email";

export type Campaign = {
  id: string;
  name: string;
  channel: CampaignChannel;
  productId: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdBy: string;
};

export type CampaignMetric = {
  id: string;
  campaignId: string;
  metricDate: string;
  spendCents: number;
  leadsCaptured: number;
  conversions: number;
  revenueCents: number;
};
