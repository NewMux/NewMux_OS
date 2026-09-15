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
  clientCode: string;
  name: string;
  /** Bilingual directory entry (PRD Module 3) — Arabic name, optional. */
  nameArabic: string | null;
  contactPerson: string | null;
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
  projectId: string | null;
  /** Invoice created from an approved quote via "Convert to Invoice" (PRD 5.4). */
  convertedFromQuotationId: string | null;
  /** Which ProfitSplitRule governs this invoice's payout — inherited from the
   * project/venture default at creation, editable per invoice. Quotes never
   * carry one: they create no financial entry (PRD 5.4). */
  profitSplitRuleId: string | null;
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
  // Technical detail (PRD section 10.2) — access credentials live in the
  // Secrets Vault (lib/data/vault.ts), never stored here as plaintext.
  techStack: string | null;
  hostingProvider: string | null;
  controlPanelUrl: string | null;
  domain: string | null;
  domainRenewalDate: string | null;
  githubUrl: string | null;
  profitSplitRuleId: string | null;
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

// --- ERP: Finance (PRD sections 5, 6, 14) ---

/** A payout party in a profit split — Jassim, Mohammed, or a future partner/referral. Not a login user. */
export type Party = {
  id: string;
  name: string;
};

export type DeductionKind = "fixed" | "percentage";

/** Reusable deduction categories (vendor cost, marketing commission, tax/zakat reserve, referral fee). */
export type DeductionType = {
  id: string;
  name: string;
  kind: DeductionKind;
};

export type ProfitSplitScope = "project" | "venture";

export type ProfitSplitSplit = {
  partyId: string;
  percentageBps: number; // basis points, 5000 = 50.00%
};

export type ProfitSplitDeduction = {
  deductionTypeId: string;
  /** Fixed-kind: cents. Percentage-kind: basis points of the invoice total. */
  value: number;
};

/** Fully editable via Settings (PRD 5.3.1) — never hard-coded per company. */
export type ProfitSplitRule = {
  id: string;
  scopeType: ProfitSplitScope;
  scopeId: string;
  splits: ProfitSplitSplit[];
  deductions: ProfitSplitDeduction[];
  isDefault: boolean;
  updatedBy: string;
  updatedAt: string;
};

export type RecurringExpenseCycle = "monthly" | "quarterly" | "annual";
export type RecurringExpenseStatus = "active" | "paused";

export type RecurringExpense = {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  currency: string;
  cycle: RecurringExpenseCycle;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  linkedClientId: string | null;
  linkedProjectId: string | null;
  status: RecurringExpenseStatus;
};

export type PaymentMethod = "cash" | "transfer";

/** A partial or full payment against an invoice. Never changes the invoice's
 * original value (PRD 5.5) — only the payment log grows. */
export type Payment = {
  id: string;
  documentId: string;
  amountCents: number;
  date: string;
  method: PaymentMethod;
  recordedBy: string;
};

export type HostingItemType = "server" | "domain" | "other";
export type HostingSubscriptionStatus = "active" | "overdue" | "paused";

export type HostingSubscription = {
  id: string;
  clientId: string;
  item: HostingItemType;
  amountCents: number;
  currency: string;
  cycle: RecurringExpenseCycle;
  lastCollectedDate: string | null;
  nextDueDate: string | null;
  status: HostingSubscriptionStatus;
  linkedInvoiceId: string | null;
};

export type VentureLaunchStatus = "planning" | "in_development" | "launched" | "paused";

/** Ventures personally held by the founders, not company assets (PRD 14).
 * Ownership/split is intentionally empty until configured in Settings. */
export type Venture = {
  id: string;
  name: string;
  slug: string;
  brandDescription: string | null;
  websiteUrl: string | null;
  launchStatus: VentureLaunchStatus;
  profitSplitRuleId: string | null;
};

// --- Meetings (PRD 11) ---

export type Meeting = {
  id: string;
  title: string;
  startsAt: string;
  linkedProjectId: string | null;
  linkedClientId: string | null;
  notes: string | null;
  recurring: "none" | "weekly" | "monthly";
  createdBy: string;
};

export type AuditLogAction = "create" | "update" | "delete";

/** Every change to an invoice, payment, or profit-split rule (PRD 15.1). */
export type AuditLogEntry = {
  id: string;
  entityType: "document" | "payment" | "profit_split_rule" | "deduction_type" | "recurring_expense" | "deal";
  entityId: string;
  action: AuditLogAction;
  summary: string;
  changedBy: string;
  changedAt: string;
};

// --- Company Profile (PRD 12) ---

export type CertificationStatus = "active" | "pending" | "expired";

export type Certification = {
  id: string;
  name: string;
  status: CertificationStatus;
  expiryDate: string | null;
};

export type Partnership = {
  id: string;
  name: string;
  description: string | null;
};

export type CompanyProfile = {
  crNumber: string;
  crRenewalDate: string | null;
  mainDomain: string;
  mainDomainRenewalDate: string | null;
  certifications: Certification[];
  partnerships: Partnership[];
};

// --- Business development pipeline (suggested addition, PRD 15.3) ---

export type PipelineStage = "in_progress" | "complete";

export type PipelineItem = {
  id: string;
  name: string;
  stage: PipelineStage;
  notes: string | null;
};

// --- Outbound Outreach & CRM Pipeline (PRD Module 1) ---

/** Kanban stages of a deal: Lead Discovery → Proposal/Quotation Sent → Negotiation → Won/Lost. */
export type DealStage = "lead_discovery" | "proposal_sent" | "negotiation" | "won" | "lost";

export type DealCurrency = string;

export type Deal = {
  id: string;
  name: string;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: DealStage;
  /** Value quoted for this deal — becomes the deposit invoice basis on Won. */
  quotedValueCents: number;
  currency: DealCurrency;
  /** Mohammed, Jassim, or a marketer — who owns this lead (PRD "who contacted the lead"). */
  ownerId: string;
  notes: string | null;
  nextFollowUpDate: string | null;
  /** Set by one-click conversion when the deal is moved to Won. */
  convertedClientId: string | null;
  convertedProjectId: string | null;
  convertedInvoiceId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type OutreachChannel = "call" | "email" | "whatsapp";

/** PRD: log a call/email/WhatsApp result in under 10 seconds. */
export type OutreachOutcome = "no_answer" | "gatekeeper_blocked" | "not_interested" | "info_requested" | "meeting_booked";

export type OutreachActivity = {
  id: string;
  dealId: string;
  channel: OutreachChannel;
  contactedBy: string;
  outcome: OutreachOutcome;
  notes: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
};
