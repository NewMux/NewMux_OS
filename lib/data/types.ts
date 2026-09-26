export type UserRole = "partner_admin" | "lead_dev";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
};

export type Currency = "BHD" | "USD";
export const CURRENCIES: Currency[] = ["BHD", "USD"];

/** A company the business works with (CRM "company"). People live in Contact. */
export type Client = {
  id: string;
  clientCode: string;
  name: string;
  /** Shown in lists instead of a long legal name. */
  shortName: string | null;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  notes: string | null;
  createdAt: string;
};

export type Contact = {
  id: string;
  clientId: string | null;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
};

// --- CRM ---

export type DealStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
export const DEAL_STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
export const OPEN_DEAL_STAGES: DealStage[] = ["lead", "qualified", "proposal", "negotiation"];

export type Deal = {
  id: string;
  title: string;
  clientId: string | null;
  contactId: string | null;
  stage: DealStage;
  valueCents: number;
  currency: Currency;
  probability: number;
  expectedClose: string | null;
  ownerId: string | null;
  source: string | null;
  notes: string | null;
  lostReason: string | null;
  sortOrder: number;
  projectId: string | null;
  wonAt: string | null;
  closedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityKind = "call" | "email" | "meeting" | "note" | "whatsapp" | "follow_up";

export type Activity = {
  id: string;
  kind: ActivityKind;
  subject: string;
  body: string | null;
  clientId: string | null;
  contactId: string | null;
  dealId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  isSaas: boolean;
  paddleProductId: string | null;
};

export type DocumentType = "quote" | "contract" | "invoice" | "credit_note";
/** Invoices: draft → sent → paid (derived from payments) → archived; void.
 * Quotes: draft → sent → accepted | declined. Contracts: draft → sent → signed.
 * Credit notes: draft → sent (issued). See lib/validators/document.ts. */
export type DocumentStatus = "draft" | "sent" | "accepted" | "declined" | "signed" | "paid" | "archived" | "void";

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
  dealId: string | null;
  documentNumber: string;
  /** The number it had before NEWMUX OS, e.g. "#00267" (item 8). */
  externalRef: string | null;
  /** Credit notes: the invoice they reduce. */
  creditForId: string | null;
  /** Invoices billed for a hosting fee (item 12). */
  hostingSubscriptionId: string | null;
  voidReason: string | null;
  voidedAt: string | null;
  currency: Currency;
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
  createdBy: string | null;
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
  description: string | null;
  color: string;
  status: ProjectStatus;
  startedAt: string | null;
  targetEndAt: string | null;
  createdBy: string | null;
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
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** Task with roll-up counts, as returned by list queries. */
export type TaskWithMeta = Task & {
  projectName: string;
  projectColor: string;
  assigneeName: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  commentCount: number;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
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
  createdBy: string | null;
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
  createdBy: string | null;
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

export type PartyKind = "partner" | "fund";

/** A payout party in a profit split — Jassim, Mohammed, or a future
 * partner/referral — or a fund such as the Newmux reserve. Not a login user. */
export type Party = {
  id: string;
  name: string;
  kind: PartyKind;
};

export type DeductionKind = "fixed" | "percentage";

/** Reusable deduction categories (vendor cost, marketing commission, tax/zakat reserve, referral fee). */
export type DeductionType = {
  id: string;
  name: string;
  kind: DeductionKind;
  /** When set, the amount deducted is not a cost: it accrues to this fund (e.g. the Newmux reserve). */
  fundPartyId: string | null;
};

/** "document" = an override for a single invoice (defaults to its project's rule). */
export type ProfitSplitScope = "project" | "venture" | "document";

export type ProfitSplitSplit = {
  partyId: string;
  percentageBps: number; // basis points, 5000 = 50.00%
};

/** What a percentage deduction is taken from: the invoice total, or what is
 * left after pass-through costs and the deductions listed before it. */
export type DeductionBase = "total" | "remaining";

/** Applied in array order. */
export type ProfitSplitDeduction = {
  deductionTypeId: string;
  /** Fixed-kind: BHD fils. Percentage-kind: basis points of the base. */
  value: number;
  /** Rules saved before bases existed have none, which means "total". */
  base?: DeductionBase;
};

/** Fully editable via Settings (PRD 5.3.1) — never hard-coded per company. */
export type ProfitSplitRule = {
  id: string;
  scopeType: ProfitSplitScope;
  scopeId: string;
  splits: ProfitSplitSplit[];
  deductions: ProfitSplitDeduction[];
  isDefault: boolean;
  updatedBy: string | null;
  updatedAt: string;
};

export type RecurringExpenseCycle = "monthly" | "quarterly" | "annual";
export type RecurringExpenseStatus = "active" | "paused";

export type RecurringExpense = {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  currency: Currency;
  cycle: RecurringExpenseCycle;
  lastPaymentDate: string | null;
  nextDueDate: string | null;
  linkedClientId: string | null;
  linkedProjectId: string | null;
  linkedVentureId: string | null;
  /** Charged to a partner's personal card rather than the company account. */
  paidByPartyId: string | null;
  status: RecurringExpenseStatus;
};

/** Money actually spent — one-off, or a logged payment of a recurring expense. */
export type Expense = {
  id: string;
  description: string;
  category: string;
  vendor: string | null;
  amountCents: number;
  currency: Currency;
  spentOn: string;
  linkedClientId: string | null;
  linkedProjectId: string | null;
  recurringExpenseId: string | null;
  /** Pass-through cost of one invoice: deducted from that invoice before the split. */
  documentId: string | null;
  /** Bank account it was paid from (null → the default account). */
  accountId: string | null;
  /** Fund it is charged to (spends the reserve), if any. */
  fundPartyId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export const EXPENSE_CATEGORIES = [
  "hosting",
  "software subscription",
  "contractor",
  "marketing",
  "admin",
  "travel",
  "equipment",
  "government fees",
  "other",
] as const;

export type PaymentMethod = "transfer" | "benefitpay" | "cash" | "card" | "paypal" | "upwork" | "cheque" | "other";

/** A partial or full payment against an invoice. Never changes the invoice's
 * original value (PRD 5.5) — only the payment log grows. */
export type Payment = {
  id: string;
  documentId: string;
  amountCents: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string | null;
  /** Bank account it landed in (null → the default account). */
  accountId: string | null;
  recordedBy: string | null;
};

/** A company bank account. Balance = opening balance + movements on/after the opening date. */
export type BankAccount = {
  id: string;
  name: string;
  currency: Currency;
  openingBalanceCents: number;
  openingBalanceDate: string;
  isDefault: boolean;
  isActive: boolean;
};

export type BankReconciliation = {
  id: string;
  accountId: string;
  statementDate: string;
  statementBalanceCents: number;
  computedBalanceCents: number;
  adjustmentCents: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type PayoutType = "share" | "advance" | "withdrawal" | "reimbursement";

/** Money actually paid to a party. Reduces the company balance. */
export type Payout = {
  id: string;
  partyId: string;
  type: PayoutType;
  amountCents: number;
  currency: Currency;
  paidOn: string;
  documentId: string | null;
  accountId: string | null;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type HostingItemType = "server" | "domain" | "other";
export type HostingSubscriptionStatus = "active" | "overdue" | "paused" | "not_started";

export type HostingSubscription = {
  id: string;
  clientId: string;
  projectId: string | null;
  item: HostingItemType;
  label: string | null;
  /** Null while the client price is to be decided ("amount TBD"). */
  amountCents: number | null;
  currency: Currency;
  cycle: RecurringExpenseCycle;
  lastCollectedDate: string | null;
  nextDueDate: string | null;
  status: HostingSubscriptionStatus;
  /** The latest invoice; every invoice carries documents.hosting_subscription_id. */
  linkedInvoiceId: string | null;
  /** What it costs NEWMUX: a linked recurring expense, or a typed yearly cost (item 14). */
  recurringExpenseId: string | null;
  costPerYearCents: number | null;
  costCurrency: Currency | null;
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
  durationMinutes: number;
  location: string | null;
  linkedProjectId: string | null;
  linkedClientId: string | null;
  linkedDealId: string | null;
  kbPageId: string | null;
  notes: string | null;
  recurring: "none" | "weekly" | "monthly";
  createdBy: string | null;
};

export type AuditLogAction = "create" | "update" | "delete";

/** Every change to an invoice, payment, or profit-split rule (PRD 15.1). */
export type AuditEntityType =
  | "document"
  | "payment"
  | "profit_split_rule"
  | "deduction_type"
  | "recurring_expense"
  | "expense"
  | "hosting_subscription"
  | "deal"
  | "bank_account"
  | "payout"
  | "file";

export type AuditLogEntry = {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditLogAction;
  summary: string;
  changedBy: string | null;
  changedByName?: string | null;
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
  legalName: string;
  vatNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
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

// --- Knowledge base ---

export type KbSpace = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  pageCount?: number;
};

/** TipTap/ProseMirror JSON document. */
export type KbContent = { type: "doc"; content?: unknown[] };

export type KbPage = {
  id: string;
  spaceId: string;
  parentId: string | null;
  title: string;
  emoji: string | null;
  content: KbContent;
  contentText: string;
  clientId: string | null;
  projectId: string | null;
  dealId: string | null;
  isTemplate: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Lightweight page row for lists/trees (no content). */
export type KbPageSummary = Pick<
  KbPage,
  "id" | "spaceId" | "parentId" | "title" | "emoji" | "isTemplate" | "sortOrder" | "updatedAt"
> & { spaceName?: string; snippet?: string };
