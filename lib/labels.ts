import type { SysColor } from "./colors";
import type { CampaignStatus, PostChannel, PostStatus } from "./marketing";
import type { ActivityKind, CampaignChannel, DealStage, DocumentStatus, DocumentType, PaymentMethod, ProjectStatus, TaskPriority, TaskStatus } from "./data/types";

type Meta = { label: string; color: SysColor };

export const DOC_TYPE: Record<DocumentType, string> = { quote: "Quote", proposal: "Proposal", contract: "Contract", invoice: "Invoice", credit_note: "Credit Note", letter: "Letter" };

/** Document types that are signed by a NewMux signatory to be issued (PRD addendum 1.2, section 5). Invoices and credit notes can be signed too, but don't have to be. */
export const MUST_SIGN: DocumentType[] = ["quote", "proposal", "contract", "letter"];

/** Drafts carry a placeholder until they're issued and numbered (lib/data/documents.ts). */
export const isDraftNumber = (n: string) => n.startsWith("Draft-");
/** The number as people should read it: "Draft" until it has one. */
export const docNumber = (d: { documentNumber: string }) => (isDraftNumber(d.documentNumber) ? "Draft" : d.documentNumber);

/** Types that carry no money: no line items, nothing in totals or the pipeline. */
export const NO_MONEY: DocumentType[] = ["letter"];

export const DOC_STATUS: Record<DocumentStatus, Meta> = {
  draft: { label: "Draft", color: "gray" },
  sent: { label: "Issued", color: "blue" },
  accepted: { label: "Accepted", color: "indigo" },
  signed: { label: "Signed", color: "purple" },
  paid: { label: "Paid", color: "green" },
  archived: { label: "Archived", color: "gray" },
  declined: { label: "Declined", color: "red" },
  void: { label: "Void", color: "gray" },
};

/**
 * Status label for a document. "sent" is the issued, locked state; it reads
 * Sent once it has been delivered, and an offer past its validity reads
 * Expired (PRD addendum 1.2, section 8.1).
 */
export function docStatusLabel(type: DocumentType, status: DocumentStatus, extra: { sentAt?: string | null; validUntil?: string | null; today?: string } = {}): string {
  if (status === "sent" && (type === "quote" || type === "proposal") && extra.validUntil && extra.today && extra.validUntil < extra.today) return "Expired";
  if (status === "sent" && extra.sentAt) return "Sent";
  return DOC_STATUS[status].label;
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  transfer: "Bank transfer",
  benefitpay: "BenefitPay",
  cash: "Cash",
  card: "Card",
  paypal: "PayPal",
  upwork: "Upwork",
  cheque: "Cheque",
  other: "Other",
};

export const DEAL_STAGE: Record<DealStage, Meta> = {
  lead: { label: "Lead", color: "gray" },
  qualified: { label: "Qualified", color: "blue" },
  proposal: { label: "Proposal", color: "indigo" },
  negotiation: { label: "Negotiation", color: "orange" },
  won: { label: "Won", color: "green" },
  lost: { label: "Lost", color: "red" },
};

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  todo: { label: "To Do", color: "gray" },
  in_progress: { label: "In Progress", color: "blue" },
  in_review: { label: "In Review", color: "purple" },
  done: { label: "Done", color: "green" },
};

export const TASK_PRIORITY: Record<TaskPriority, Meta & { marks: string }> = {
  urgent: { label: "Urgent", color: "red", marks: "!!!" },
  high: { label: "High", color: "orange", marks: "!!" },
  // Medium is the default, so it carries no mark (a "!" on every task is noise).
  medium: { label: "Medium", color: "blue", marks: "" },
  low: { label: "Low", color: "gray", marks: "" },
};

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  planning: { label: "Planning", color: "gray" },
  active_sprint: { label: "Active", color: "green" },
  paused: { label: "Paused", color: "yellow" },
  completed: { label: "Completed", color: "blue" },
  archived: { label: "Archived", color: "gray" },
};

export const ACTIVITY_KIND: Record<ActivityKind, Meta> = {
  call: { label: "Call", color: "green" },
  email: { label: "Email", color: "blue" },
  meeting: { label: "Meeting", color: "red" },
  note: { label: "Note", color: "yellow" },
  whatsapp: { label: "WhatsApp", color: "green" },
  follow_up: { label: "Follow-up", color: "orange" },
};

export const CYCLE_LABEL = { monthly: "Monthly", quarterly: "Quarterly", annual: "Yearly" } as const;

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Marketing ---

export const CAMPAIGN_CHANNEL: Record<CampaignChannel, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  meta_ads: "Meta Ads",
  google_search: "Google Search",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
  website: "Website",
  newsletter: "Newsletter",
  outbound_email: "Outbound Email",
  event: "Event",
  referral: "Referral",
  other: "Other",
};

export const POST_CHANNEL: Record<PostChannel, Meta> = {
  instagram: { label: "Instagram", color: "pink" },
  linkedin: { label: "LinkedIn", color: "blue" },
  x: { label: "X", color: "gray" },
  tiktok: { label: "TikTok", color: "indigo" },
  facebook: { label: "Facebook", color: "blue" },
  youtube: { label: "YouTube", color: "red" },
  website: { label: "Website / blog", color: "teal" },
  newsletter: { label: "Newsletter", color: "orange" },
  other: { label: "Other", color: "gray" },
};

export const POST_STATUS: Record<PostStatus, Meta> = {
  idea: { label: "Idea", color: "gray" },
  drafting: { label: "Drafting", color: "orange" },
  review: { label: "In review", color: "purple" },
  scheduled: { label: "Scheduled", color: "blue" },
  published: { label: "Published", color: "green" },
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, Meta> = {
  planned: { label: "Planned", color: "blue" },
  active: { label: "Active", color: "green" },
  paused: { label: "Paused", color: "orange" },
  completed: { label: "Completed", color: "gray" },
};
