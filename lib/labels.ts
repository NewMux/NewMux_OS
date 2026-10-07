import type { SysColor } from "./colors";
import type { ActivityKind, DealStage, DocumentStatus, DocumentType, PaymentMethod, ProjectStatus, TaskPriority, TaskStatus } from "./data/types";

type Meta = { label: string; color: SysColor };

export const DOC_TYPE: Record<DocumentType, string> = { quote: "Quote", contract: "Contract", invoice: "Invoice", credit_note: "Credit Note" };

export const DOC_STATUS: Record<DocumentStatus, Meta> = {
  draft: { label: "Draft", color: "gray" },
  sent: { label: "Sent", color: "blue" },
  accepted: { label: "Accepted", color: "indigo" },
  signed: { label: "Signed", color: "purple" },
  paid: { label: "Paid", color: "green" },
  archived: { label: "Archived", color: "gray" },
  declined: { label: "Declined", color: "red" },
  void: { label: "Void", color: "gray" },
};

/** Status label for a document, with credit-note wording ("Issued" rather than "Sent"). */
export function docStatusLabel(type: DocumentType, status: DocumentStatus): string {
  if (type === "credit_note" && status === "sent") return "Issued";
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
