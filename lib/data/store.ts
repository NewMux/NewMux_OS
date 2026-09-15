import bcrypt from "bcryptjs";
import { randomUUID, randomBytes } from "crypto";
import type {
  User,
  Client,
  Product,
  DocumentRecord,
  DocumentLineItem,
  DocumentStatusHistoryEntry,
  Project,
  Task,
  SecretRecord,
  VaultAccessLogEntry,
  SaasCustomer,
  SaasSubscription,
  SaasTransaction,
  Campaign,
  CampaignMetric,
  Party,
  DeductionType,
  ProfitSplitRule,
  RecurringExpense,
  Payment,
  HostingSubscription,
  Venture,
  AuditLogEntry,
  Meeting,
  CompanyProfile,
  PipelineItem,
  Deal,
  OutreachActivity,
} from "./types";
import { majorToMinorUnits } from "@/lib/money";

/**
 * In-memory data layer standing in for Postgres/Supabase while the backend
 * is deferred (see db/migrations/*.sql for the real schema this mirrors).
 * Every export here is shaped so it can be swapped for a `sql` query against
 * lib/db.ts without changing callers in app/ or components/.
 *
 * Seed data below mirrors the real business entities from the Newmux
 * Internal ERP PRD (clients, ventures, hosting fees, profit-split rules) —
 * not placeholder demo data.
 *
 * NOTE: this resets on process restart and does not scale beyond a single
 * Node process — acceptable for frontend development, not for production.
 */

export type VaultMasterConfig = {
  kdfSalt: Buffer;
  passphraseVerifier: Buffer;
} | null;

type Store = {
  users: User[];
  clients: Client[];
  products: Product[];
  documents: DocumentRecord[];
  documentLineItems: DocumentLineItem[];
  documentStatusHistory: DocumentStatusHistoryEntry[];
  projects: Project[];
  tasks: Task[];
  secrets: SecretRecord[];
  vaultAccessLog: VaultAccessLogEntry[];
  vaultMasterConfig: VaultMasterConfig;
  saasCustomers: SaasCustomer[];
  saasSubscriptions: SaasSubscription[];
  saasTransactions: SaasTransaction[];
  paddleWebhookEventIds: Set<string>;
  campaigns: Campaign[];
  campaignMetrics: CampaignMetric[];
  parties: Party[];
  deductionTypes: DeductionType[];
  profitSplitRules: ProfitSplitRule[];
  recurringExpenses: RecurringExpense[];
  payments: Payment[];
  hostingSubscriptions: HostingSubscription[];
  ventures: Venture[];
  auditLog: AuditLogEntry[];
  meetings: Meeting[];
  companyProfile: CompanyProfile;
  pipelineItems: PipelineItem[];
  deals: Deal[];
  outreachActivities: OutreachActivity[];
  seededAdminPassword?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __newmuxStore: Store | undefined;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function bhd(amount: number): number {
  return majorToMinorUnits(amount, "BHD");
}

function usd(amount: number): number {
  return majorToMinorUnits(amount, "USD");
}

function seed(): Store {
  const mohammedId = randomUUID();
  const jassimId = randomUUID();
  const leadDevId = randomUUID();

  // Randomly generated once per process start — printed to server logs only.
  // Real deployments will seed this via the app's first-run setup, never
  // hardcoded or committed. See db/migrations/seed strategy in the plan.
  const seededAdminPassword = randomBytes(9).toString("base64url");

  const users: User[] = [
    {
      id: mohammedId,
      email: "m4ahmed7@gmail.com",
      passwordHash: bcrypt.hashSync(seededAdminPassword, 10),
      fullName: "Mohammed",
      role: "partner_admin",
      isActive: true,
    },
    {
      id: jassimId,
      // Placeholder — replace with Jassim's real login email before real use.
      email: "jassim@newmux.com",
      passwordHash: bcrypt.hashSync("changeme123", 10),
      fullName: "Jassim Baqer",
      role: "partner_admin",
      isActive: true,
    },
    {
      id: leadDevId,
      email: "lead.dev@newmux.internal",
      passwordHash: bcrypt.hashSync("changeme123", 10),
      fullName: "Demo Limited-Access User",
      role: "lead_dev",
      isActive: true,
    },
  ];

  // Payout parties (PRD 5.3) — distinct from login Users so a referral
  // partner or vendor can be added to a split without being a system user.
  const partyJassim: Party = { id: randomUUID(), name: "Jassim" };
  const partyMohammed: Party = { id: randomUUID(), name: "Mohammed" };
  const parties = [partyJassim, partyMohammed];

  // --- Clients (PRD section 6 hosting table + section 5.3 examples) ---
  const clientMarasi: Client = {
    id: randomUUID(),
    clientCode: "CL-001",
    name: "Marasi Alsawadi",
    nameArabic: "مراسي الصواديّ",
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    billingAddress: null,
    notes: "Billed annually for hosting; petty-cash-staff role precedent used as the RBAC reference example.",
  };
  const clientAlHussam: Client = {
    id: randomUUID(),
    clientCode: "CL-002",
    name: "Al Hussam Tailor",
    nameArabic: "الحسام للخياطة",
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    billingAddress: null,
    notes: "Distinct from the productized Tailor System (Tafsell) venture — this is a specific client of that system.",
  };
  const clientOxRoastery: Client = {
    id: randomUUID(),
    clientCode: "CL-003",
    name: "Ox Roastery",
    nameArabic: "أوكس روستري",
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    billingAddress: null,
    notes: "Hosting cost paid to an Indian vendor is linked to this client to show true margin, not gross revenue.",
  };
  const clientVoya: Client = {
    id: randomUUID(),
    clientCode: "CL-004",
    name: "Voya Travel & Tourism",
    nameArabic: "فويا للسفر والسياحة",
    contactPerson: null,
    contactEmail: null,
    contactPhone: null,
    billingAddress: null,
    notes: "50% non-refundable deposit + 50% on delivery payment pattern.",
  };
  const clients = [clientMarasi, clientAlHussam, clientOxRoastery, clientVoya];

  const productAgency: Product = {
    id: randomUUID(),
    name: "Agency Services",
    slug: "agency",
    isSaas: false,
    paddleProductId: null,
  };
  const productMtdrb: Product = {
    id: randomUUID(),
    name: "MTDRB",
    slug: "mtdrb",
    isSaas: true,
    paddleProductId: "pro_mtdrb_001",
  };
  const products = [productAgency, productMtdrb];

  // --- Deduction types (PRD 5.3.1) ---
  const deductionVendorCost: DeductionType = { id: randomUUID(), name: "Vendor / Hosting Cost", kind: "fixed" };
  const deductionMarketingCommission: DeductionType = {
    id: randomUUID(),
    name: "Marketing Commission",
    kind: "percentage",
  };
  const deductionTaxReserve: DeductionType = { id: randomUUID(), name: "Tax / Zakat Reserve", kind: "percentage" };
  const deductionReferralFee: DeductionType = { id: randomUUID(), name: "Referral Fee", kind: "percentage" };
  const deductionTypes = [deductionVendorCost, deductionMarketingCommission, deductionTaxReserve, deductionReferralFee];

  // --- Projects (client-facing work; technical detail per PRD 10.2) ---
  const projectOxRoastery: Project = {
    id: randomUUID(),
    clientId: clientOxRoastery.id,
    productId: productAgency.id,
    name: "Ox Roastery Hosting",
    status: "active_sprint",
    startedAt: daysAgo(400),
    targetEndAt: null,
    createdBy: mohammedId,
    techStack: "Node.js / PostgreSQL",
    hostingProvider: "Coolify on Hetzner",
    controlPanelUrl: null,
    domain: "oxroastery.example",
    domainRenewalDate: null,
    githubUrl: null,
    profitSplitRuleId: null, // set below once the rule exists
  };
  const projectAlHussam: Project = {
    id: randomUUID(),
    clientId: clientAlHussam.id,
    productId: productAgency.id,
    name: "Al Hussam Tailor System",
    status: "active_sprint",
    startedAt: daysAgo(200),
    targetEndAt: null,
    createdBy: mohammedId,
    techStack: "Node.js / PostgreSQL",
    hostingProvider: "Coolify on Hetzner",
    controlPanelUrl: null,
    domain: "alhussamtailor.example",
    domainRenewalDate: daysAgo(-433), // Nov 21, 2027-ish placeholder
    githubUrl: null,
    profitSplitRuleId: null,
  };
  const projectMarasi: Project = {
    id: randomUUID(),
    clientId: clientMarasi.id,
    productId: productAgency.id,
    name: "Marasi Alsawadi System",
    status: "completed",
    startedAt: daysAgo(500),
    targetEndAt: daysAgo(100),
    createdBy: mohammedId,
    techStack: "MySQL 8",
    hostingProvider: "Coolify on Hetzner",
    controlPanelUrl: null,
    domain: "marasialsawadi.example",
    domainRenewalDate: null,
    githubUrl: null,
    profitSplitRuleId: null,
  };
  const projectVoya: Project = {
    id: randomUUID(),
    clientId: clientVoya.id,
    productId: productAgency.id,
    name: "Voya Travel Platform",
    status: "active_sprint",
    startedAt: daysAgo(90),
    targetEndAt: null,
    createdBy: mohammedId,
    techStack: "React PWA",
    hostingProvider: "Coolify on Hetzner",
    controlPanelUrl: null,
    domain: "voya.example",
    domainRenewalDate: null,
    githubUrl: null,
    profitSplitRuleId: null,
  };
  const projects = [projectOxRoastery, projectAlHussam, projectMarasi, projectVoya];

  // --- Profit-split rules (PRD 5.3, 5.3.1) ---
  const now = new Date().toISOString();
  const splitOxRoastery: ProfitSplitRule = {
    id: randomUUID(),
    scopeType: "project",
    scopeId: projectOxRoastery.id,
    splits: [
      { partyId: partyJassim.id, percentageBps: 5000 },
      { partyId: partyMohammed.id, percentageBps: 5000 },
    ],
    // No static deduction here — the Ox Roastery hosting cost below is
    // linked to this project and applied dynamically at calculation time
    // (prorated + FX-converted), so it stays correct if the expense changes.
    deductions: [],
    isDefault: false,
    updatedBy: mohammedId,
    updatedAt: now,
  };
  projectOxRoastery.profitSplitRuleId = splitOxRoastery.id;
  const profitSplitRules = [splitOxRoastery];

  // --- Recurring expenses (PRD 5.1) ---
  const recurringExpenses: RecurringExpense[] = [
    {
      id: randomUUID(),
      name: "Ox Roastery hosting (Indian vendor)",
      category: "hosting",
      amountCents: usd(50),
      currency: "USD",
      cycle: "annual",
      lastPaymentDate: daysAgo(330),
      nextDueDate: "2027-04-01",
      linkedClientId: clientOxRoastery.id,
      linkedProjectId: projectOxRoastery.id,
      status: "active",
    },
    {
      id: randomUUID(),
      name: "Coolify / Hetzner infrastructure",
      category: "software subscription",
      amountCents: usd(45),
      currency: "USD",
      cycle: "monthly",
      lastPaymentDate: daysAgo(5),
      nextDueDate: daysAgo(-25),
      linkedClientId: null,
      linkedProjectId: null,
      status: "active",
    },
    {
      id: randomUUID(),
      name: "Microsoft 365 email",
      category: "admin",
      amountCents: usd(12),
      currency: "USD",
      cycle: "monthly",
      lastPaymentDate: daysAgo(5),
      nextDueDate: daysAgo(-25),
      linkedClientId: null,
      linkedProjectId: null,
      status: "active",
    },
  ];

  // --- Hosting subscriptions collected FROM clients (PRD section 6 table) ---
  const hostingSubscriptions: HostingSubscription[] = [
    {
      id: randomUUID(),
      clientId: clientMarasi.id,
      item: "server",
      amountCents: bhd(120),
      currency: "BHD",
      cycle: "annual",
      lastCollectedDate: daysAgo(60),
      nextDueDate: daysAgo(-305),
      status: "active",
      linkedInvoiceId: null,
    },
    {
      id: randomUUID(),
      clientId: clientAlHussam.id,
      item: "server",
      amountCents: bhd(18),
      currency: "BHD",
      cycle: "quarterly",
      lastCollectedDate: daysAgo(30),
      nextDueDate: "2026-11-21",
      status: "active",
      linkedInvoiceId: null,
    },
    {
      id: randomUUID(),
      clientId: clientAlHussam.id,
      item: "domain",
      amountCents: bhd(15),
      currency: "BHD",
      cycle: "annual",
      lastCollectedDate: daysAgo(344),
      nextDueDate: "2027-11-21",
      status: "active",
      linkedInvoiceId: null,
    },
    {
      id: randomUUID(),
      clientId: clientOxRoastery.id,
      item: "server",
      amountCents: bhd(15),
      currency: "BHD",
      cycle: "quarterly",
      lastCollectedDate: null,
      nextDueDate: daysAgo(-2),
      status: "overdue",
      linkedInvoiceId: null,
    },
    {
      id: randomUUID(),
      clientId: clientVoya.id,
      item: "server",
      amountCents: bhd(45),
      currency: "BHD",
      cycle: "quarterly",
      lastCollectedDate: daysAgo(10),
      nextDueDate: daysAgo(-80),
      status: "active",
      linkedInvoiceId: null,
    },
  ];

  // --- Documents: the Ox Roastery worked example (PRD section 17) ---
  const oxInvoiceId = randomUUID();
  const alHussamQuoteId = randomUUID();
  const documents: DocumentRecord[] = [
    {
      id: oxInvoiceId,
      type: "invoice",
      status: "sent",
      clientId: clientOxRoastery.id,
      productId: productAgency.id,
      projectId: projectOxRoastery.id,
      convertedFromQuotationId: null,
      profitSplitRuleId: splitOxRoastery.id,
      documentNumber: "INV-2026-0265",
      currency: "BHD",
      subtotalCents: bhd(15),
      taxRateBps: 0,
      taxCents: 0,
      totalCents: bhd(15),
      paymentTerms: "Due on receipt",
      notes: "Quarterly hosting fee.",
      issuedAt: daysAgo(2),
      dueAt: daysAgo(-13),
      acceptedAt: null,
      paidAt: null,
      archivedAt: null,
      createdBy: mohammedId,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: alHussamQuoteId,
      type: "quote",
      status: "sent",
      clientId: clientAlHussam.id,
      productId: productAgency.id,
      projectId: projectAlHussam.id,
      convertedFromQuotationId: null,
      profitSplitRuleId: null,
      documentNumber: "QUO-2026-2606",
      currency: "BHD",
      subtotalCents: bhd(250),
      taxRateBps: 0,
      taxCents: 0,
      totalCents: bhd(250),
      paymentTerms: "50% upfront, 50% on delivery",
      notes: "Additional reporting module.",
      issuedAt: daysAgo(5),
      dueAt: null,
      acceptedAt: null,
      paidAt: null,
      archivedAt: null,
      createdBy: mohammedId,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];

  const documentLineItems: DocumentLineItem[] = [
    { id: randomUUID(), documentId: oxInvoiceId, description: "Quarterly hosting fee", quantity: 1, unitPriceCents: bhd(15), sortOrder: 0 },
    { id: randomUUID(), documentId: alHussamQuoteId, description: "Custom reporting module", quantity: 1, unitPriceCents: bhd(250), sortOrder: 0 },
  ];

  const documentStatusHistory: DocumentStatusHistoryEntry[] = [
    { id: randomUUID(), documentId: oxInvoiceId, fromStatus: null, toStatus: "draft", changedBy: mohammedId, changedAt: daysAgo(2) },
    { id: randomUUID(), documentId: oxInvoiceId, fromStatus: "draft", toStatus: "sent", changedBy: mohammedId, changedAt: daysAgo(2) },
    { id: randomUUID(), documentId: alHussamQuoteId, fromStatus: null, toStatus: "draft", changedBy: mohammedId, changedAt: daysAgo(5) },
    { id: randomUUID(), documentId: alHussamQuoteId, fromStatus: "draft", toStatus: "sent", changedBy: mohammedId, changedAt: daysAgo(5) },
  ];

  const payments: Payment[] = [];

  const tasks: Task[] = [
    { id: randomUUID(), projectId: projectAlHussam.id, title: "Build custom reporting module", description: "Per pending quote QUO-2026-2606", priority: "high", status: "in_progress", assigneeId: mohammedId, dueAt: daysAgo(-10), sortOrder: 0, createdBy: mohammedId },
    { id: randomUUID(), projectId: projectVoya.id, title: "Wire phase-2 WhatsApp notifications", description: null, priority: "medium", status: "todo", assigneeId: mohammedId, dueAt: daysAgo(-20), sortOrder: 0, createdBy: mohammedId },
    { id: randomUUID(), projectId: projectOxRoastery.id, title: "Collect overdue quarterly hosting fee", description: null, priority: "urgent", status: "todo", assigneeId: mohammedId, dueAt: daysAgo(0), sortOrder: 0, createdBy: mohammedId },
  ];

  // --- Meetings (PRD 11) ---
  const meetings: Meeting[] = [
    {
      id: randomUUID(),
      title: "Marasi Alsawadi weekly follow-up",
      startsAt: daysAgo(-1),
      linkedProjectId: projectMarasi.id,
      linkedClientId: clientMarasi.id,
      notes: null,
      recurring: "weekly",
      createdBy: mohammedId,
    },
    {
      id: randomUUID(),
      title: "Al Hussam Tailor — reporting module scope review",
      startsAt: daysAgo(-3),
      linkedProjectId: projectAlHussam.id,
      linkedClientId: clientAlHussam.id,
      notes: "Walk through QUO-2026-2606 before conversion.",
      recurring: "none",
      createdBy: mohammedId,
    },
  ];

  // --- Company Profile (PRD 12) ---
  const companyProfile: CompanyProfile = {
    crNumber: "182684-1",
    crRenewalDate: daysAgo(-20),
    mainDomain: "newmux.com",
    mainDomainRenewalDate: daysAgo(-200),
    certifications: [
      { id: randomUUID(), name: "Tamkeen", status: "active", expiryDate: null },
      { id: randomUUID(), name: "SME Certificate (MOIC)", status: "pending", expiryDate: null },
      { id: randomUUID(), name: "Tenderboard Registration", status: "pending", expiryDate: null },
    ],
    partnerships: [
      { id: randomUUID(), name: "ONE App / Bank AlSalam", description: null },
      { id: randomUUID(), name: "Hatom LLC (Switzerland)", description: null },
      { id: randomUUID(), name: "Indian software company", description: "Ox Roastery hosting vendor." },
    ],
  };

  // --- Business dev pipeline (suggested addition, PRD 15.3) ---
  const pipelineItems: PipelineItem[] = [
    { id: randomUUID(), name: "Tenderboard registration", stage: "in_progress", notes: null },
    { id: randomUUID(), name: "SME certificate (MOIC)", stage: "in_progress", notes: "Pending issuance." },
    { id: randomUUID(), name: "Commission-based marketer agreements", stage: "in_progress", notes: null },
  ];

  // --- Outbound Outreach & CRM Pipeline (PRD Module 1) ---
  const dealNewBakery: Deal = {
    id: randomUUID(),
    name: "Sundus Bakery — POS & online ordering",
    contactPerson: "Fatima Al-Sindi",
    contactEmail: "fatima@sundusbakery.example",
    contactPhone: "+973 3300 1122",
    stage: "lead_discovery",
    quotedValueCents: bhd(1200),
    currency: "BHD",
    ownerId: mohammedId,
    notes: "Cold-called from Instagram DM list.",
    nextFollowUpDate: daysAgo(-2),
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: mohammedId,
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
  };
  const dealGymApp: Deal = {
    id: randomUUID(),
    name: "PowerHouse Gym — membership app",
    contactPerson: "Khalid Marzooq",
    contactEmail: "khalid@powerhousegym.example",
    contactPhone: "+973 3300 5566",
    stage: "proposal_sent",
    quotedValueCents: bhd(3500),
    currency: "BHD",
    ownerId: jassimId,
    notes: "Quotation QUO draft sent, awaiting decision.",
    nextFollowUpDate: daysAgo(-4),
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: jassimId,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(3),
  };
  const dealClinic: Deal = {
    id: randomUUID(),
    name: "Al Waha Clinic — booking system",
    contactPerson: "Dr. Noor Isa",
    contactEmail: "noor@alwahaclinic.example",
    contactPhone: "+973 3300 7788",
    stage: "negotiation",
    quotedValueCents: bhd(2800),
    currency: "BHD",
    ownerId: mohammedId,
    notes: "Negotiating payment schedule — 50/50 vs. 3 installments.",
    nextFollowUpDate: daysAgo(-1),
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: mohammedId,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(0),
  };
  const dealRestaurant: Deal = {
    id: randomUUID(),
    name: "Firas Grill — delivery integration",
    contactPerson: "Firas Yousif",
    contactEmail: null,
    contactPhone: "+973 3300 9900",
    stage: "lost",
    quotedValueCents: bhd(900),
    currency: "BHD",
    ownerId: jassimId,
    notes: "Went with a cheaper local freelancer.",
    nextFollowUpDate: null,
    convertedClientId: null,
    convertedProjectId: null,
    convertedInvoiceId: null,
    createdBy: jassimId,
    createdAt: daysAgo(40),
    updatedAt: daysAgo(30),
  };
  const deals: Deal[] = [dealNewBakery, dealGymApp, dealClinic, dealRestaurant];

  const outreachActivities: OutreachActivity[] = [
    { id: randomUUID(), dealId: dealNewBakery.id, channel: "call", contactedBy: mohammedId, outcome: "no_answer", notes: null, nextFollowUpDate: daysAgo(-2), createdAt: daysAgo(6) },
    { id: randomUUID(), dealId: dealNewBakery.id, channel: "whatsapp", contactedBy: mohammedId, outcome: "info_requested", notes: "Sent portfolio link.", nextFollowUpDate: daysAgo(-2), createdAt: daysAgo(1) },
    { id: randomUUID(), dealId: dealGymApp.id, channel: "call", contactedBy: jassimId, outcome: "meeting_booked", notes: "Demo scheduled next week.", nextFollowUpDate: daysAgo(-4), createdAt: daysAgo(14) },
    { id: randomUUID(), dealId: dealGymApp.id, channel: "email", contactedBy: jassimId, outcome: "info_requested", notes: "Quotation sent by email.", nextFollowUpDate: daysAgo(-4), createdAt: daysAgo(3) },
    { id: randomUUID(), dealId: dealClinic.id, channel: "call", contactedBy: mohammedId, outcome: "meeting_booked", notes: "Discussed scope in person.", nextFollowUpDate: daysAgo(-1), createdAt: daysAgo(0) },
    { id: randomUUID(), dealId: dealRestaurant.id, channel: "call", contactedBy: jassimId, outcome: "not_interested", notes: "Chose a cheaper freelancer.", nextFollowUpDate: null, createdAt: daysAgo(30) },
  ];

  // --- Newmux's own ventures (PRD section 14) — profit split left empty ---
  const ventureTbadel: Venture = {
    id: randomUUID(),
    name: "Tbadel",
    slug: "tbadel",
    brandDescription: "Barter/exchange app.",
    websiteUrl: null,
    launchStatus: "planning",
    profitSplitRuleId: null,
  };
  const ventureMtdrb: Venture = {
    id: randomUUID(),
    name: "Al-Mutadarrib (MTDRB)",
    slug: "mtdrb-venture",
    brandDescription: "ERP system for a sports club.",
    websiteUrl: null,
    launchStatus: "in_development",
    profitSplitRuleId: null,
  };
  const ventureTailorSystem: Venture = {
    id: randomUUID(),
    name: "The Tailor System (Tafsell)",
    slug: "tailor-system",
    brandDescription: "Productized SaaS for tailoring shops generally, 20 BHD/month — distinct from the Al Hussam Tailor client project.",
    websiteUrl: null,
    launchStatus: "launched",
    profitSplitRuleId: null,
  };
  const ventures = [ventureTbadel, ventureMtdrb, ventureTailorSystem];

  const auditLog: AuditLogEntry[] = [
    {
      id: randomUUID(),
      entityType: "profit_split_rule",
      entityId: splitOxRoastery.id,
      action: "create",
      summary: "Set Ox Roastery project split to 50/50 Jassim/Mohammed with Indian vendor cost deduction.",
      changedBy: mohammedId,
      changedAt: now,
    },
  ];

  const custA: SaasCustomer = { id: randomUUID(), paddleCustomerId: "ctm_001", clientId: null, email: "buyer1@example.com" };
  const custB: SaasCustomer = { id: randomUUID(), paddleCustomerId: "ctm_002", clientId: null, email: "buyer2@example.com" };
  const custC: SaasCustomer = { id: randomUUID(), paddleCustomerId: "ctm_003", clientId: null, email: "buyer3@example.com" };
  const saasCustomers = [custA, custB, custC];

  const saasSubscriptions: SaasSubscription[] = [
    { id: randomUUID(), paddleSubscriptionId: "sub_001", saasCustomerId: custA.id, productId: productMtdrb.id, status: "active", currency: "USD", recurringAmountCents: 9900, billingInterval: "month", currentPeriodStart: daysAgo(10), currentPeriodEnd: daysAgo(-20), trialEndsAt: null, canceledAt: null },
    { id: randomUUID(), paddleSubscriptionId: "sub_002", saasCustomerId: custB.id, productId: productMtdrb.id, status: "active", currency: "USD", recurringAmountCents: 118800, billingInterval: "year", currentPeriodStart: daysAgo(5), currentPeriodEnd: daysAgo(-360), trialEndsAt: null, canceledAt: null },
    { id: randomUUID(), paddleSubscriptionId: "sub_003", saasCustomerId: custC.id, productId: productMtdrb.id, status: "past_due", currency: "USD", recurringAmountCents: 4900, billingInterval: "month", currentPeriodStart: daysAgo(35), currentPeriodEnd: daysAgo(5), trialEndsAt: null, canceledAt: null },
  ];

  const saasTransactions: SaasTransaction[] = [
    { id: randomUUID(), paddleTransactionId: "txn_001", saasSubscriptionId: saasSubscriptions[0]!.id, saasCustomerId: custA.id, amountCents: 9900, currency: "USD", status: "completed", billedAt: daysAgo(10) },
    { id: randomUUID(), paddleTransactionId: "txn_002", saasSubscriptionId: saasSubscriptions[1]!.id, saasCustomerId: custB.id, amountCents: 118800, currency: "USD", status: "completed", billedAt: daysAgo(5) },
  ];

  const campaignMeta: Campaign = { id: randomUUID(), name: "MTDRB — Meta Retargeting", channel: "meta_ads", productId: productMtdrb.id, startDate: daysAgo(30).slice(0, 10), endDate: null, isActive: true, createdBy: mohammedId };
  const campaignGoogle: Campaign = { id: randomUUID(), name: "Agency — Google Search Brand", channel: "google_search", productId: productAgency.id, startDate: daysAgo(45).slice(0, 10), endDate: null, isActive: true, createdBy: mohammedId };
  const campaignLinkedin: Campaign = { id: randomUUID(), name: "MTDRB — LinkedIn ABM", channel: "linkedin", productId: productMtdrb.id, startDate: daysAgo(20).slice(0, 10), endDate: null, isActive: true, createdBy: mohammedId };
  const campaigns = [campaignMeta, campaignGoogle, campaignLinkedin];

  const campaignMetrics: CampaignMetric[] = [
    { id: randomUUID(), campaignId: campaignMeta.id, metricDate: daysAgo(1).slice(0, 10), spendCents: 45000, leadsCaptured: 32, conversions: 4, revenueCents: 39600 },
    { id: randomUUID(), campaignId: campaignMeta.id, metricDate: daysAgo(2).slice(0, 10), spendCents: 42000, leadsCaptured: 28, conversions: 3, revenueCents: 29700 },
    { id: randomUUID(), campaignId: campaignGoogle.id, metricDate: daysAgo(1).slice(0, 10), spendCents: 60000, leadsCaptured: 15, conversions: 2, revenueCents: 900000 },
    { id: randomUUID(), campaignId: campaignLinkedin.id, metricDate: daysAgo(1).slice(0, 10), spendCents: 30000, leadsCaptured: 9, conversions: 1, revenueCents: 11880 },
  ];

  return {
    users,
    clients,
    products,
    documents,
    documentLineItems,
    documentStatusHistory,
    projects,
    tasks,
    secrets: [],
    vaultAccessLog: [],
    vaultMasterConfig: null,
    saasCustomers,
    saasSubscriptions,
    saasTransactions,
    paddleWebhookEventIds: new Set(),
    campaigns,
    campaignMetrics,
    parties,
    deductionTypes,
    profitSplitRules,
    recurringExpenses,
    payments,
    hostingSubscriptions,
    ventures,
    auditLog,
    meetings,
    companyProfile,
    pipelineItems,
    deals,
    outreachActivities,
    seededAdminPassword,
  };
}

function getStore(): Store {
  if (!global.__newmuxStore) {
    global.__newmuxStore = seed();
    // eslint-disable-next-line no-console
    console.log(
      `[NEWMUX ERP] Seeded Mohammed's login → email: m4ahmed7@gmail.com password: ${global.__newmuxStore.seededAdminPassword} (mock in-memory store, resets on restart)`,
    );
    // eslint-disable-next-line no-console
    console.log("[NEWMUX ERP] Seeded Jassim's login → email: jassim@newmux.com password: changeme123 (placeholder email — update to his real one)");
    // eslint-disable-next-line no-console
    console.log("[NEWMUX ERP] Seeded demo limited-access login → email: lead.dev@newmux.internal password: changeme123");
  }
  return global.__newmuxStore;
}

export const store = getStore();
