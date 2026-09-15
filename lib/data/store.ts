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
} from "./types";

/**
 * In-memory data layer standing in for Postgres/Supabase while the backend
 * is deferred (see db/migrations/*.sql for the real schema this mirrors).
 * Every export here is shaped so it can be swapped for a `sql` query against
 * lib/db.ts without changing callers in app/ or components/.
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
  seededAdminPassword?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __newmuxStore: Store | undefined;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function seed(): Store {
  const adminId = randomUUID();
  const leadDevId = randomUUID();

  // Randomly generated once per process start — printed to server logs only.
  // Real deployments will seed this via the app's first-run setup, never
  // hardcoded or committed. See db/migrations/seed strategy in the plan.
  const seededAdminPassword = randomBytes(9).toString("base64url");

  const users: User[] = [
    {
      id: adminId,
      email: "m4ahmed7@gmail.com",
      passwordHash: bcrypt.hashSync(seededAdminPassword, 10),
      fullName: "M. Ahmed",
      role: "partner_admin",
      isActive: true,
    },
    {
      id: leadDevId,
      email: "lead.dev@newmux.internal",
      passwordHash: bcrypt.hashSync("changeme123", 10),
      fullName: "Lead Developer",
      role: "lead_dev",
      isActive: true,
    },
  ];

  const clientA: Client = {
    id: randomUUID(),
    name: "Aurora Retail Group",
    contactEmail: "ops@aurora-retail.example",
    contactPhone: "+1 555 0100",
    billingAddress: "500 Market St, Suite 200, San Francisco, CA",
    notes: "Agency retainer client — quarterly milestone billing.",
  };
  const clientB: Client = {
    id: randomUUID(),
    name: "Internal — MTDRB",
    contactEmail: null,
    contactPhone: null,
    billingAddress: null,
    notes: "Internal SaaS product, tracked for consolidated reporting.",
  };
  const clients = [clientA, clientB];

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

  const invoiceId = randomUUID();
  const quoteId = randomUUID();
  const contractId = randomUUID();
  const documents: DocumentRecord[] = [
    {
      id: invoiceId,
      type: "invoice",
      status: "sent",
      clientId: clientA.id,
      productId: productAgency.id,
      documentNumber: "INV-2026-0001",
      currency: "USD",
      subtotalCents: 1200000,
      taxRateBps: 800,
      taxCents: 96000,
      totalCents: 1296000,
      paymentTerms: "Net 30",
      notes: "Milestone 2 of 3 — design system delivery.",
      issuedAt: daysAgo(10),
      dueAt: daysAgo(-20),
      acceptedAt: null,
      paidAt: null,
      archivedAt: null,
      createdBy: adminId,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(10),
    },
    {
      id: quoteId,
      type: "quote",
      status: "sent",
      clientId: clientA.id,
      productId: productAgency.id,
      documentNumber: "QUO-2026-0004",
      currency: "USD",
      subtotalCents: 4500000,
      taxRateBps: 0,
      taxCents: 0,
      totalCents: 4500000,
      paymentTerms: "50% upfront, 50% on delivery",
      notes: "Phase 2 platform rebuild proposal.",
      issuedAt: daysAgo(3),
      dueAt: null,
      acceptedAt: null,
      paidAt: null,
      archivedAt: null,
      createdBy: adminId,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: contractId,
      type: "contract",
      status: "paid",
      clientId: clientA.id,
      productId: productAgency.id,
      documentNumber: "CON-2025-0012",
      currency: "USD",
      subtotalCents: 800000,
      taxRateBps: 800,
      taxCents: 64000,
      totalCents: 864000,
      paymentTerms: "Net 15",
      notes: null,
      issuedAt: daysAgo(60),
      dueAt: daysAgo(45),
      acceptedAt: daysAgo(58),
      paidAt: daysAgo(40),
      archivedAt: null,
      createdBy: adminId,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(40),
    },
  ];

  const documentLineItems: DocumentLineItem[] = [
    { id: randomUUID(), documentId: invoiceId, description: "Design system implementation", quantity: 1, unitPriceCents: 900000, sortOrder: 0 },
    { id: randomUUID(), documentId: invoiceId, description: "QA & handoff", quantity: 1, unitPriceCents: 300000, sortOrder: 1 },
    { id: randomUUID(), documentId: quoteId, description: "Platform rebuild — frontend", quantity: 1, unitPriceCents: 2500000, sortOrder: 0 },
    { id: randomUUID(), documentId: quoteId, description: "Platform rebuild — backend", quantity: 1, unitPriceCents: 2000000, sortOrder: 1 },
    { id: randomUUID(), documentId: contractId, description: "Retainer — Q4 2025", quantity: 1, unitPriceCents: 800000, sortOrder: 0 },
  ];

  const documentStatusHistory: DocumentStatusHistoryEntry[] = [
    { id: randomUUID(), documentId: contractId, fromStatus: "draft", toStatus: "sent", changedBy: adminId, changedAt: daysAgo(59) },
    { id: randomUUID(), documentId: contractId, fromStatus: "sent", toStatus: "accepted", changedBy: adminId, changedAt: daysAgo(58) },
    { id: randomUUID(), documentId: contractId, fromStatus: "accepted", toStatus: "paid", changedBy: adminId, changedAt: daysAgo(40) },
  ];

  const projectA: Project = {
    id: randomUUID(),
    clientId: clientA.id,
    productId: productAgency.id,
    name: "Aurora Platform Rebuild",
    status: "active_sprint",
    startedAt: daysAgo(20),
    targetEndAt: daysAgo(-40),
    createdBy: adminId,
  };
  const projectB: Project = {
    id: randomUUID(),
    clientId: clientB.id,
    productId: productMtdrb.id,
    name: "MTDRB v2 Billing Overhaul",
    status: "active_sprint",
    startedAt: daysAgo(8),
    targetEndAt: daysAgo(-25),
    createdBy: adminId,
  };
  const projects = [projectA, projectB];

  const tasks: Task[] = [
    { id: randomUUID(), projectId: projectA.id, title: "Ship responsive nav shell", description: "Bottom nav + sidebar breakpoint switch", priority: "high", status: "in_progress", assigneeId: leadDevId, dueAt: daysAgo(-2), sortOrder: 0, createdBy: adminId },
    { id: randomUUID(), projectId: projectA.id, title: "Wire client review portal", description: null, priority: "medium", status: "todo", assigneeId: leadDevId, dueAt: daysAgo(-7), sortOrder: 1, createdBy: adminId },
    { id: randomUUID(), projectId: projectA.id, title: "Fix Safari safe-area bug", description: "Bottom nav overlaps home indicator on iOS", priority: "urgent", status: "in_review", assigneeId: leadDevId, dueAt: daysAgo(0), sortOrder: 2, createdBy: adminId },
    { id: randomUUID(), projectId: projectB.id, title: "Paddle webhook idempotency tests", description: null, priority: "high", status: "done", assigneeId: leadDevId, dueAt: daysAgo(-1), sortOrder: 0, createdBy: adminId },
    { id: randomUUID(), projectId: projectB.id, title: "MRR normalization for annual plans", description: null, priority: "medium", status: "todo", assigneeId: leadDevId, dueAt: daysAgo(-10), sortOrder: 1, createdBy: adminId },
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

  const campaignMeta: Campaign = { id: randomUUID(), name: "MTDRB — Meta Retargeting", channel: "meta_ads", productId: productMtdrb.id, startDate: daysAgo(30).slice(0, 10), endDate: null, isActive: true, createdBy: adminId };
  const campaignGoogle: Campaign = { id: randomUUID(), name: "Agency — Google Search Brand", channel: "google_search", productId: productAgency.id, startDate: daysAgo(45).slice(0, 10), endDate: null, isActive: true, createdBy: adminId };
  const campaignLinkedin: Campaign = { id: randomUUID(), name: "MTDRB — LinkedIn ABM", channel: "linkedin", productId: productMtdrb.id, startDate: daysAgo(20).slice(0, 10), endDate: null, isActive: true, createdBy: adminId };
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
    seededAdminPassword,
  };
}

function getStore(): Store {
  if (!global.__newmuxStore) {
    global.__newmuxStore = seed();
    // eslint-disable-next-line no-console
    console.log(
      `[NEWMUX OS] Seeded mock admin login → email: m4ahmed7@gmail.com password: ${global.__newmuxStore.seededAdminPassword} (mock in-memory store, resets on restart)`,
    );
    // eslint-disable-next-line no-console
    console.log("[NEWMUX OS] Seeded mock lead_dev login → email: lead.dev@newmux.internal password: changeme123");
  }
  return global.__newmuxStore;
}

export const store = getStore();
