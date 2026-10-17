import type { Session } from "next-auth";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { many } from "@/lib/data/sql";
import type { UserRole } from "@/lib/data/types";
import { centsToDisplay, majorToMinorUnits } from "@/lib/money";
import { formatDate } from "@/lib/time";
import {
  canAccessCompany,
  canAccessCrm,
  canAccessDocuments,
  canAccessFinance,
  canAccessKb,
  canAccessMarketing,
  canAccessSettings,
  canAccessWork,
  canRevealVaultSecrets,
  isPartnerAdmin,
} from "@/lib/rbac";
import { clientSchema, updateClientSchema } from "@/lib/validators/client";
import { addPartnershipSchema, certificationSchema, companyProfileSchema } from "@/lib/validators/company";
import { activityCompletedSchema, activitySchema, contactSchema, dealSchema, moveDealSchema, updateDealSchema } from "@/lib/validators/crm";
import { convertToInvoiceSchema, createDocumentSchema, transitionSchema, updateDocumentSchema } from "@/lib/validators/document";
import { fileMetaSchema } from "@/lib/validators/files";
import {
  addPaymentSchema,
  bankAccountSchema,
  createDeductionTypeSchema,
  createPartySchema,
  expenseSchema,
  invoiceSplitRuleSchema,
  payoutSchema,
  reconcileSchema,
  recurringExpenseSchema,
  reimburseExpenseSchema,
  updateDeductionTypeSchema,
  upsertProfitSplitRuleSchema,
  ventureSchema,
} from "@/lib/validators/finance";
import { collectHostingSchema, hostingSubscriptionSchema, linkHostingInvoiceSchema } from "@/lib/validators/hosting";
import { createPageSchema, spaceSchema, updatePageSchema } from "@/lib/validators/kb";
import { meetingSchema } from "@/lib/validators/meeting";
import { campaignNumbersSchema, campaignSchema, postSchema, postStatusSchema } from "@/lib/validators/marketing";
import { reminderSchema } from "@/lib/validators/notifications";
import { osChangeCommentSchema, osChangeRequestSchema } from "@/lib/validators/osChanges";
import { createPipelineItemSchema } from "@/lib/validators/pipeline";
import { projectSchema, updateProjectSchema } from "@/lib/validators/project";
import { commentSchema, createTaskSchema, subtaskSchema, updateSubtaskSchema, updateTaskSchema } from "@/lib/validators/task";
import { textToDoc } from "./wikiText";

/**
 * What Haman can change. He never changes anything himself: each action he
 * picks becomes a card in the chat ("Record a payment · INV-0042 …") with
 * Confirm and Cancel, and only Confirm sends the request, from the user's
 * browser, to the same /api route the app's own screens use. So every change
 * passes the route's role check, validation, business rules (no deleting an
 * invoice that was sent, no overpaying) and audit log, as if the person had
 * made it by hand.
 *
 * Here the input is only checked against the route's schema, so a mistake
 * comes back to Haman to fix instead of failing after the user confirms.
 *
 * Not offered: resetting passwords, setting up or unlocking the Vault, adding
 * Vault secrets (the value would pass through the model) and uploading files.
 * A revealed secret goes from the route to the card on screen and is never
 * sent back to the model.
 */

type Access = (session: Session) => boolean;

export type ActionKind = "change" | "delete" | "reveal";

type ActionDef = {
  name: string;
  /** The card's heading: "Create a task". */
  title: string;
  description: string;
  method: "POST" | "PATCH" | "DELETE";
  /** The route, with {placeholders} filled from the input (and removed from the body). */
  path: string;
  /** The route's own body schema. */
  schema?: ZodTypeAny;
  access: Access;
  kind?: ActionKind;
  /** Turns Haman's input into the route's body when they differ (wiki text → editor content). */
  toBody?: (input: Record<string, unknown>) => Record<string, unknown>;
  /** Overrides the input schema built from `schema`. */
  input?: Record<string, unknown>;
  /** Lines always on the card, after the input's own. */
  notes?: { label: string; value: string }[];
  /** Fields only partners may set: left out of the tool and the request for anyone else (the route ignores them too). */
  moneyFields?: string[];
};

const FULL = " Send every field, not only the ones that change: the record is replaced. Read it first with get_record.";

const ACTIONS: ActionDef[] = [
  // --- Work ---
  { name: "create_task", title: "Create a task", description: "Add a task to a project.", method: "POST", path: "/api/tasks", schema: createTaskSchema, access: canAccessWork },
  { name: "update_task", title: "Change a task", description: "Edit a task: title, description, status (todo, in_progress, in_review, done), priority, assignee, due date or project. Send only what changes.", method: "PATCH", path: "/api/tasks/{id}", schema: updateTaskSchema, access: canAccessWork },
  { name: "delete_task", title: "Delete a task", description: "Delete a task.", method: "DELETE", path: "/api/tasks/{id}", access: canAccessWork, kind: "delete" },
  { name: "add_subtask", title: "Add a subtask", description: "Add a checklist item to a task (id = the task).", method: "POST", path: "/api/tasks/{id}/subtasks", schema: subtaskSchema, access: canAccessWork },
  { name: "update_subtask", title: "Change a subtask", description: "Rename a subtask or tick it off (done).", method: "PATCH", path: "/api/subtasks/{id}", schema: updateSubtaskSchema, access: canAccessWork },
  { name: "delete_subtask", title: "Delete a subtask", description: "Delete a subtask.", method: "DELETE", path: "/api/subtasks/{id}", access: canAccessWork, kind: "delete" },
  { name: "comment_on_task", title: "Comment on a task", description: "Add a comment to a task (id = the task), as the signed-in user.", method: "POST", path: "/api/tasks/{id}/comments", schema: commentSchema, access: canAccessWork },
  { name: "create_project", title: "Create a project", description: "Start a project.", method: "POST", path: "/api/projects", schema: projectSchema, access: canAccessWork },
  { name: "update_project", title: "Change a project", description: "Edit a project's details or status. Send only what changes.", method: "PATCH", path: "/api/projects/{id}", schema: updateProjectSchema, access: canAccessWork },
  { name: "delete_project", title: "Delete a project", description: "Delete a project. The app refuses while money is recorded against it.", method: "DELETE", path: "/api/projects/{id}", access: isPartnerAdmin, kind: "delete" },
  { name: "create_meeting", title: "Schedule a meeting", description: "Put a meeting in the calendar. startsAt is a local date and time like 2026-10-14T10:00:00+03:00.", method: "POST", path: "/api/meetings", schema: meetingSchema, access: canAccessWork },
  { name: "update_meeting", title: "Change a meeting", description: "Move or edit a meeting." + FULL, method: "PATCH", path: "/api/meetings/{id}", schema: meetingSchema, access: canAccessWork },
  { name: "delete_meeting", title: "Delete a meeting", description: "Remove a meeting from the calendar.", method: "DELETE", path: "/api/meetings/{id}", access: canAccessWork, kind: "delete" },
  { name: "create_meeting_notes", title: "Start meeting notes", description: "Create the wiki page of notes for a meeting (id = the meeting).", method: "POST", path: "/api/meetings/{id}/notes", access: canAccessWork },

  {
    name: "create_reminder",
    title: "Set a reminder",
    description:
      "Send a push notification at a set time: 'remind me to call Ox on Thursday at 10'. remindAt is a Bahrain date and time with its offset, like 2026-10-15T10:00:00+03:00; when the user gives a day but no time, use 09:00. href is a screen to open when it's tapped (an href from a lookup). userId is who gets it, from list_records kind team; leave it out for the user themselves (only partners can remind someone else). It reaches the devices where they've turned notifications on in Settings.",
    method: "POST",
    path: "/api/reminders",
    schema: reminderSchema,
    access: canAccessWork,
  },
  { name: "delete_reminder", title: "Cancel a reminder", description: "Cancel a reminder that hasn't gone yet (id from list_records kind reminders).", method: "DELETE", path: "/api/reminders/{id}", access: canAccessWork, kind: "delete" },

  // --- Marketing ---
  {
    name: "create_post",
    title: "Plan a post",
    description:
      "Add a post to the content calendar. channel: instagram, linkedin, x, tiktok, facebook, youtube, website, newsletter or other. status: idea, drafting, review, scheduled or published. publishAt is a Bahrain date and time like 2026-10-16T18:00:00+03:00, or leave it out for an idea with no date. Write the caption only if the user asked for it.",
    method: "POST",
    path: "/api/marketing/posts",
    schema: postSchema,
    access: canAccessMarketing,
  },
  { name: "update_post", title: "Change a post", description: "Edit a post on the content calendar." + FULL, method: "PATCH", path: "/api/marketing/posts/{id}", schema: postSchema, access: canAccessMarketing },
  { name: "move_post", title: "Move a post", description: "Change a post's status (idea, drafting, review, scheduled, published) without editing it.", method: "POST", path: "/api/marketing/posts/{id}/status", schema: postStatusSchema, access: canAccessMarketing },
  { name: "delete_post", title: "Delete a post", description: "Remove a post from the content calendar.", method: "DELETE", path: "/api/marketing/posts/{id}", access: canAccessMarketing, kind: "delete" },
  {
    name: "create_campaign",
    title: "Plan a campaign",
    description: "Add a marketing campaign: channel, status (planned, active, paused, completed), dates, goal, budget (major units, in its currency) and owner.",
    method: "POST",
    path: "/api/marketing/campaigns",
    schema: campaignSchema,
    access: canAccessMarketing,
  },
  { name: "update_campaign", title: "Change a campaign", description: "Edit a campaign." + FULL, method: "PATCH", path: "/api/marketing/campaigns/{id}", schema: campaignSchema, access: canAccessMarketing },
  {
    name: "log_campaign_numbers",
    title: "Log a campaign's numbers",
    description: "Record a day's spend (major units, in the campaign's currency), leads and conversions for a campaign; partners can add revenue. Logging the same day again replaces it.",
    method: "POST",
    path: "/api/marketing/campaigns/{id}/numbers",
    schema: campaignNumbersSchema,
    access: canAccessMarketing,
    moneyFields: ["revenue"],
  },
  { name: "delete_campaign", title: "Delete a campaign", description: "Delete a campaign and its logged numbers; its posts and deals stay, unlinked.", method: "DELETE", path: "/api/marketing/campaigns/{id}", access: canAccessMarketing, kind: "delete" },

  // --- Wiki ---
  { name: "create_wiki_space", title: "Create a wiki space", description: "Add a wiki space.", method: "POST", path: "/api/kb/spaces", schema: spaceSchema, access: canAccessKb },
  { name: "update_wiki_space", title: "Change a wiki space", description: "Rename or describe a wiki space." + FULL, method: "PATCH", path: "/api/kb/spaces/{id}", schema: spaceSchema, access: canAccessKb },
  { name: "delete_wiki_space", title: "Delete a wiki space", description: "Delete a wiki space and its pages.", method: "DELETE", path: "/api/kb/spaces/{id}", access: isPartnerAdmin, kind: "delete" },
  { name: "create_wiki_page", title: "Create a wiki page", description: "Add an empty wiki page to a space (optionally under a parent page, or linked to a client, project or deal). Write its text with write_wiki_page once the user has confirmed.", method: "POST", path: "/api/kb/pages", schema: createPageSchema, access: canAccessKb },
  {
    name: "write_wiki_page",
    title: "Write a wiki page",
    description:
      "Replace a wiki page's text. Plain text: '# ' starts a heading, '- ' a bullet, '1. ' a numbered item, '[ ] ' or '[x] ' a checklist item, a blank line a new paragraph. To add to a page, read it with read_wiki_page and send the whole new text.",
    method: "PATCH",
    path: "/api/kb/pages/{id}",
    schema: updatePageSchema,
    access: canAccessKb,
    input: { title: { type: "string", description: "A new title, if it changes." }, text: { type: "string", description: "The page's complete new text." } },
    toBody: ({ title, text }) => ({ ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}), content: textToDoc(String(text ?? "")) }),
  },
  { name: "update_wiki_page", title: "Change a wiki page", description: "Rename, move (space or parent page) or link a wiki page. Not for its text: use write_wiki_page.", method: "PATCH", path: "/api/kb/pages/{id}", schema: updatePageSchema.omit({ content: true }), access: canAccessKb },
  { name: "duplicate_wiki_page", title: "Duplicate a wiki page", description: "Copy a wiki page.", method: "POST", path: "/api/kb/pages/{id}/duplicate", access: canAccessKb },
  { name: "delete_wiki_page", title: "Delete a wiki page", description: "Delete a wiki page.", method: "DELETE", path: "/api/kb/pages/{id}", access: canAccessKb, kind: "delete" },

  // --- CRM ---
  { name: "create_client", title: "Add a client", description: "Add a client company.", method: "POST", path: "/api/clients", schema: clientSchema, access: canAccessCrm },
  { name: "update_client", title: "Change a client", description: "Edit a client's details. Send only what changes.", method: "PATCH", path: "/api/clients/{id}", schema: updateClientSchema, access: canAccessCrm },
  { name: "delete_client", title: "Delete a client", description: "Delete a client. The app refuses while it has projects, documents or money.", method: "DELETE", path: "/api/clients/{id}", access: canAccessCrm, kind: "delete" },
  { name: "create_contact", title: "Add a contact", description: "Add a person, usually at a client.", method: "POST", path: "/api/contacts", schema: contactSchema, access: canAccessCrm },
  { name: "update_contact", title: "Change a contact", description: "Edit a contact. Send only what changes.", method: "PATCH", path: "/api/contacts/{id}", schema: contactSchema.partial(), access: canAccessCrm },
  { name: "delete_contact", title: "Delete a contact", description: "Delete a contact.", method: "DELETE", path: "/api/contacts/{id}", access: canAccessCrm, kind: "delete" },
  {
    name: "create_deal",
    title: "Add a deal",
    description: "Add a deal to the pipeline. value is in major units (BHD 1,500 is 1500). source is where it came from (Website, Referral, Instagram…); campaignId links the marketing campaign that brought it.",
    method: "POST",
    path: "/api/deals",
    schema: dealSchema,
    access: canAccessCrm,
    moneyFields: ["value", "currency"],
  },
  {
    name: "update_deal",
    title: "Change a deal",
    description: "Edit a deal's details, including its source and campaign. Send only what changes. To change its stage use move_deal.",
    method: "PATCH",
    path: "/api/deals/{id}",
    schema: updateDealSchema.omit({ stage: true }),
    access: canAccessCrm,
    moneyFields: ["value", "currency"],
  },
  { name: "move_deal", title: "Move a deal", description: "Move a deal to another stage (won and lost included; lostReason when lost).", method: "POST", path: "/api/deals/{id}/stage", schema: moveDealSchema.omit({ orderedIds: true }), access: canAccessCrm },
  { name: "create_project_from_deal", title: "Create the project for a deal", description: "Start the project for a won deal (id = the deal).", method: "POST", path: "/api/deals/{id}/project", access: canAccessCrm },
  { name: "delete_deal", title: "Delete a deal", description: "Delete a deal.", method: "DELETE", path: "/api/deals/{id}", access: canAccessCrm, kind: "delete" },
  { name: "log_activity", title: "Log an activity", description: "Record a call, email, meeting, note or WhatsApp, or set a follow-up (kind follow_up with dueAt).", method: "POST", path: "/api/activities", schema: activitySchema, access: canAccessCrm },
  { name: "complete_follow_up", title: "Mark a follow-up", description: "Mark a follow-up done (completed true) or open again.", method: "PATCH", path: "/api/activities/{id}", schema: activityCompletedSchema, access: canAccessCrm },
  { name: "delete_activity", title: "Delete an activity", description: "Delete an activity or follow-up.", method: "DELETE", path: "/api/activities/{id}", access: canAccessCrm, kind: "delete" },

  // --- Documents ---
  {
    name: "create_document",
    title: "Create a document",
    description:
      "Create a draft quote, proposal, contract, invoice, credit note or official letter in the NewMux design. unitPriceCents is in minor units: BHD has 3 decimals (BHD 150 = 150000), USD 2 (USD 150 = 15000). taxRateBps: 10% VAT = 1000. title is the project name (a letter's subject). Quotes, proposals and contracts can have an overview, scope ([{deliverable, duration}]) and serverFee ({amountCents, cycle, clientChooses}: shown apart from the total, never in the accounts). Letters need recipient (one line each: name, position and company, address) and body (blank line between paragraphs, ending with the closing like 'Kind regards,'); a letter needs no client or line items. signatoryId: from list_records kind signatories (leave it out for the default). terms: {templateId, templateName, version, clauses: [{title, body}]} from list_records kind terms_templates and get_record, only if the user asks for terms. Drafts get their number when issued: quotes, proposals, contracts and letters are issued by the signatory drawing their signature on the document's screen, which you can't do; invoices and credit notes can be issued unsigned with change_document_status.",
    method: "POST",
    path: "/api/documents",
    schema: createDocumentSchema,
    access: canAccessDocuments,
  },
  { name: "update_document", title: "Change a document", description: "Edit a draft document (line items in minor units, as for create_document). Send only what changes.", method: "PATCH", path: "/api/documents/{id}", schema: updateDocumentSchema, access: canAccessDocuments },
  { name: "change_document_status", title: "Change a document's status", description: "Send, accept, decline, sign, archive or void a document (void needs a reason). Paid is set by payments, never by hand.", method: "POST", path: "/api/documents/{id}/transition", schema: transitionSchema, access: canAccessDocuments },
  { name: "convert_quote_to_invoice", title: "Invoice a quote", description: "Turn an accepted quote, or an issued contract, into an invoice: full, a deposit (depositPercent) or the balance still to invoice. A server fee on it becomes a hosting subscription.", method: "POST", path: "/api/documents/{id}/convert-to-invoice", schema: convertToInvoiceSchema, access: canAccessFinance },
  { name: "convert_to_contract", title: "Make a contract", description: "Turn an accepted quote or proposal into a draft contract with the same content (items, scope, terms, server fee). The server fee becomes a hosting subscription.", method: "POST", path: "/api/documents/{id}/convert-to-contract", access: canAccessDocuments },
  { name: "revise_document", title: "Revise a document", description: "Start a new version of an issued document as a draft, to change what it says. When it's signed and issued it replaces the original, which is voided. Not for invoices with payments (use a credit note).", method: "POST", path: "/api/documents/{id}/revise", access: canAccessDocuments },
  { name: "delete_document", title: "Delete a document", description: "Delete a draft. Anything sent is voided instead.", method: "DELETE", path: "/api/documents/{id}", access: canAccessDocuments, kind: "delete" },
  { name: "record_payment", title: "Record a payment", description: "Record money received against an invoice (id = the invoice). amount is in major units (BHD 500 = 500).", method: "POST", path: "/api/documents/{id}/payments", schema: addPaymentSchema, access: canAccessFinance },
  { name: "delete_payment", title: "Delete a payment", description: "Remove a recorded payment (id from get_record on the invoice).", method: "DELETE", path: "/api/payments/{id}", access: canAccessFinance, kind: "delete" },
  { name: "set_invoice_split_rule", title: "Change an invoice's split", description: "Make an invoice follow another profit-split rule, or null for its project's rule.", method: "POST", path: "/api/documents/{id}/split-rule", schema: invoiceSplitRuleSchema, access: canAccessFinance },

  // --- Finance ---
  { name: "create_expense", title: "Add an expense", description: "Record money spent. amount in major units; amountBhd is what was actually charged in BHD for a USD expense.", method: "POST", path: "/api/expenses", schema: expenseSchema, access: canAccessFinance },
  { name: "update_expense", title: "Change an expense", description: "Edit an expense." + FULL, method: "PATCH", path: "/api/expenses/{id}", schema: expenseSchema, access: canAccessFinance },
  { name: "delete_expense", title: "Delete an expense", description: "Delete an expense.", method: "DELETE", path: "/api/expenses/{id}", access: canAccessFinance, kind: "delete" },
  { name: "reimburse_expense", title: "Pay back an expense", description: "Pay a partner back for an expense they covered.", method: "POST", path: "/api/expenses/{id}/reimburse", schema: reimburseExpenseSchema, access: canAccessFinance },
  { name: "create_recurring_expense", title: "Add a recurring expense", description: "Add a subscription or other repeating cost. amount in major units.", method: "POST", path: "/api/finance/recurring-expenses", schema: recurringExpenseSchema, access: canAccessFinance },
  { name: "update_recurring_expense", title: "Change a recurring expense", description: "Edit a recurring expense." + FULL, method: "PATCH", path: "/api/finance/recurring-expenses/{id}", schema: recurringExpenseSchema, access: canAccessFinance },
  { name: "mark_recurring_expense_paid", title: "Mark a recurring expense paid", description: "Record this cycle's payment of a recurring expense and move it to the next due date.", method: "POST", path: "/api/finance/recurring-expenses/{id}/paid", access: canAccessFinance },
  { name: "pause_or_resume_recurring_expense", title: "Pause or resume a recurring expense", description: "Pause an active recurring expense, or resume a paused one.", method: "POST", path: "/api/finance/recurring-expenses/{id}/toggle", access: canAccessFinance },
  { name: "delete_recurring_expense", title: "Delete a recurring expense", description: "Delete a recurring expense.", method: "DELETE", path: "/api/finance/recurring-expenses/{id}", access: canAccessFinance, kind: "delete" },
  { name: "create_payout", title: "Record a payout", description: "Record money paid to a partner: a profit share, an advance, a withdrawal or a reimbursement. amount in major units.", method: "POST", path: "/api/finance/payouts", schema: payoutSchema, access: canAccessFinance },
  { name: "update_payout", title: "Change a payout", description: "Edit a payout." + FULL, method: "PATCH", path: "/api/finance/payouts/{id}", schema: payoutSchema, access: canAccessFinance },
  { name: "delete_payout", title: "Delete a payout", description: "Delete a payout.", method: "DELETE", path: "/api/finance/payouts/{id}", access: canAccessFinance, kind: "delete" },
  { name: "create_bank_account", title: "Add a bank account", description: "Add a bank account with its opening balance (major units) and date.", method: "POST", path: "/api/finance/accounts", schema: bankAccountSchema, access: canAccessFinance },
  { name: "update_bank_account", title: "Change a bank account", description: "Edit a bank account." + FULL, method: "PATCH", path: "/api/finance/accounts/{id}", schema: bankAccountSchema, access: canAccessFinance },
  { name: "reconcile_bank_account", title: "Reconcile a bank account", description: "Check the account against a statement balance (major units) on a date; adjust true records the difference.", method: "POST", path: "/api/finance/accounts/{id}/reconcile", schema: reconcileSchema, access: canAccessFinance },
  { name: "delete_bank_account", title: "Delete a bank account", description: "Delete a bank account with nothing recorded against it.", method: "DELETE", path: "/api/finance/accounts/{id}", access: canAccessFinance, kind: "delete" },

  // --- Hosting fees ---
  { name: "create_hosting_fee", title: "Add a hosting fee", description: "Add a server, domain or other fee billed to a client. amount and costPerYear in major units; leave amount out when it isn't decided.", method: "POST", path: "/api/hosting", schema: hostingSubscriptionSchema, access: canAccessFinance },
  { name: "update_hosting_fee", title: "Change a hosting fee", description: "Edit a hosting fee." + FULL, method: "PATCH", path: "/api/hosting/{id}", schema: hostingSubscriptionSchema, access: canAccessFinance },
  { name: "collect_hosting_fee", title: "Collect a hosting fee", description: "Record this cycle's hosting fee as collected (invoiceOnly true just raises the invoice).", method: "POST", path: "/api/hosting/{id}/collect", schema: collectHostingSchema, access: canAccessFinance },
  { name: "link_hosting_invoice", title: "Link an invoice to a hosting fee", description: "Link an existing invoice (documentId) to a hosting fee.", method: "POST", path: "/api/hosting/{id}/invoices", schema: linkHostingInvoiceSchema, access: canAccessFinance },
  {
    name: "unlink_hosting_invoice",
    title: "Unlink an invoice from a hosting fee",
    description: "Remove the link between a hosting fee (id) and an invoice (documentId).",
    method: "DELETE",
    path: "/api/hosting/{id}/invoices?documentId={documentId}",
    access: canAccessFinance,
    input: { documentId: { type: "string", description: "The invoice's id." } },
  },
  { name: "delete_hosting_fee", title: "Delete a hosting fee", description: "Delete a hosting fee.", method: "DELETE", path: "/api/hosting/{id}", access: canAccessFinance, kind: "delete" },

  // --- Company ---
  { name: "update_company_profile", title: "Change the company profile", description: "Edit NEWMUX's legal name, CR number and renewal, main domain and renewal, VAT number, address, phone or email. Send only what changes.", method: "PATCH", path: "/api/company", schema: companyProfileSchema, access: canAccessCompany },
  { name: "add_certification", title: "Add a certification", description: "Add a company certification.", method: "POST", path: "/api/company/certifications", schema: certificationSchema, access: canAccessCompany },
  { name: "update_certification", title: "Change a certification", description: "Edit a certification." + FULL, method: "PATCH", path: "/api/company/certifications/{id}", schema: certificationSchema, access: canAccessCompany },
  { name: "delete_certification", title: "Delete a certification", description: "Delete a certification.", method: "DELETE", path: "/api/company/certifications/{id}", access: canAccessCompany, kind: "delete" },
  { name: "add_partnership", title: "Add a partnership", description: "Add a company partnership.", method: "POST", path: "/api/company/partnerships", schema: addPartnershipSchema, access: canAccessCompany },
  { name: "delete_partnership", title: "Delete a partnership", description: "Delete a partnership.", method: "DELETE", path: "/api/company/partnerships/{id}", access: canAccessCompany, kind: "delete" },
  { name: "add_pipeline_item", title: "Add to the product pipeline", description: "Add an idea to the company's product pipeline.", method: "POST", path: "/api/pipeline", schema: createPipelineItemSchema, access: canAccessCompany },
  { name: "advance_pipeline_item", title: "Move a pipeline item", description: "Move a product-pipeline item to its next stage.", method: "POST", path: "/api/pipeline/{id}/toggle", access: canAccessCompany },
  { name: "delete_pipeline_item", title: "Delete a pipeline item", description: "Delete a product-pipeline item.", method: "DELETE", path: "/api/pipeline/{id}", access: canAccessCompany, kind: "delete" },
  { name: "create_venture", title: "Add a venture", description: "Add a venture (one of NEWMUX's own products).", method: "POST", path: "/api/ventures", schema: ventureSchema, access: canAccessCompany },
  { name: "update_venture", title: "Change a venture", description: "Edit a venture." + FULL, method: "PATCH", path: "/api/ventures/{id}", schema: ventureSchema, access: canAccessCompany },
  { name: "delete_venture", title: "Delete a venture", description: "Delete a venture.", method: "DELETE", path: "/api/ventures/{id}", access: canAccessCompany, kind: "delete" },
  { name: "update_file", title: "Change a file's details", description: "Edit a stored file's name, category, dates, reminder or links (not its contents)." + FULL, method: "PATCH", path: "/api/files/{id}", schema: fileMetaSchema, access: canAccessCompany },
  { name: "delete_file", title: "Delete a file", description: "Delete a stored file.", method: "DELETE", path: "/api/files/{id}", access: canAccessCompany, kind: "delete" },

  // --- Settings ---
  { name: "create_party", title: "Add a payout party", description: "Add a partner who shares profit, or a fund that collects deductions.", method: "POST", path: "/api/finance/parties", schema: createPartySchema, access: canAccessSettings },
  { name: "delete_party", title: "Remove a payout party", description: "Remove a partner or fund.", method: "DELETE", path: "/api/finance/parties/{id}", access: canAccessSettings, kind: "delete" },
  { name: "create_deduction_type", title: "Add a deduction type", description: "Add a deduction taken before profit is split: fixed or a percentage, optionally into a fund.", method: "POST", path: "/api/finance/deduction-types", schema: createDeductionTypeSchema, access: canAccessSettings },
  { name: "update_deduction_type", title: "Change a deduction type", description: "Rename a deduction type or change its fund.", method: "PATCH", path: "/api/finance/deduction-types/{id}", schema: updateDeductionTypeSchema, access: canAccessSettings },
  { name: "delete_deduction_type", title: "Delete a deduction type", description: "Delete a deduction type.", method: "DELETE", path: "/api/finance/deduction-types/{id}", access: canAccessSettings, kind: "delete" },
  {
    name: "set_profit_split_rule",
    title: "Set a profit-split rule",
    description:
      "Set how a project's, venture's or invoice's profit is split: each party's percentageBps (50% = 5000, all adding up to 10000) and the deductions taken first, in order (value is major units for a fixed deduction, percent for a percentage one). Replaces the scope's current rule.",
    method: "POST",
    path: "/api/finance/profit-split-rules",
    schema: upsertProfitSplitRuleSchema,
    access: canAccessSettings,
  },
  { name: "delete_profit_split_rule", title: "Delete a profit-split rule", description: "Delete a profit-split rule.", method: "DELETE", path: "/api/finance/profit-split-rules/{id}", access: canAccessSettings, kind: "delete" },

  // --- Vault ---
  {
    name: "reveal_vault_secret",
    title: "Show a Vault secret",
    description:
      "Show the user one secret from the credentials Vault (id from list_records kind vault_items). The value appears on the user's screen only; you never see it, so don't repeat or guess it. The Vault must be unlocked in this browser.",
    method: "POST",
    path: "/api/vault/{id}/reveal",
    access: canRevealVaultSecrets,
    kind: "reveal",
  },
  { name: "delete_vault_secret", title: "Delete a Vault secret", description: "Delete a secret from the credentials Vault.", method: "DELETE", path: "/api/vault/{id}", access: canRevealVaultSecrets, kind: "delete" },

  // --- NEWMUX OS itself (lib/osChanges.ts) ---
  {
    name: "request_os_change",
    title: "Request an OS update",
    description:
      "Ask for a change to NEWMUX OS itself: a new feature, a screen or wording to change, a bug to fix. Claude Code builds it on GitHub as a pull request; it goes live only when a partner merges it. title: a short name ('Add a VAT report'). details: what should change and why, in the user's words plus anything you know that helps (which screen, who uses it, what it should show). Check list_os_changes first so you don't ask for the same thing twice.",
    method: "POST",
    path: "/api/os-changes",
    schema: osChangeRequestSchema,
    access: canAccessWork,
    notes: [{ label: "Next", value: "Claude Code builds it on GitHub. A partner merges it before it goes live." }],
  },
  {
    name: "revise_os_change",
    title: "Ask for changes to an OS update",
    description: "Send Claude Code more instructions for an OS update it has built or tried (number from list_os_changes): what to change, add or fix. Not while it's still working.",
    method: "POST",
    path: "/api/os-changes/{number}/comments",
    schema: osChangeCommentSchema,
    access: canAccessWork,
  },
  {
    name: "merge_os_change",
    title: "Merge an OS update",
    description: "Merge an OS update that is ready to merge (status ready in list_os_changes). This puts it live in NEWMUX OS a few minutes later, for everyone.",
    method: "POST",
    path: "/api/os-changes/{number}/merge",
    access: isPartnerAdmin,
    notes: [{ label: "Goes live", value: "For everyone, a few minutes after you confirm." }],
  },
  { name: "close_os_change", title: "Withdraw an OS update", description: "Close an OS update request that isn't wanted any more (and its pull request). Only whoever asked, or a partner.", method: "DELETE", path: "/api/os-changes/{number}", access: canAccessWork, kind: "delete" },
];

// --- Offering the actions to the model ---

const asSession = (role: UserRole) => ({ user: { id: "", role } }) as unknown as Session;

function actionsFor(role: UserRole): ActionDef[] {
  return ACTIONS.filter((a) => a.access(asSession(role)));
}

const placeholders = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

function bodyProperties(schema: ZodTypeAny | undefined): { properties: Record<string, unknown>; required: string[] } {
  if (!schema) return { properties: {}, required: [] };
  // "input": what the route accepts before its own defaults and clean-up, which is what Haman sends.
  const json = zodToJsonSchema(schema, { $refStrategy: "none", effectStrategy: "input", pipeStrategy: "input" }) as { properties?: Record<string, unknown>; required?: string[] };
  return { properties: json.properties ?? {}, required: json.required ?? [] };
}

export type ActionTool = { name: string; description: string; input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] } };

/** The actions a role may propose, as Claude tool definitions. */
export function actionToolsFor(role: UserRole): ActionTool[] {
  return actionsFor(role).map((a) => {
    const params = placeholders(a.path);
    const own = a.input ? { properties: { ...a.input }, required: Object.keys(a.input).filter((k) => k !== "title") } : bodyProperties(a.schema);
    if (a.moneyFields && role !== "partner_admin") {
      for (const f of a.moneyFields) delete own.properties[f];
      own.required = own.required.filter((r) => !a.moneyFields!.includes(r));
    }
    const properties: Record<string, unknown> = {
      target: {
        type: "string",
        description: "What this is about, as the user would recognise it, shown on the confirmation card: the record's name or number and its client or project, e.g. 'INV-0042 · Ox Roastery'.",
      },
      ...(params.includes("id") ? { id: { type: "string", description: "The record's id, from a lookup. Never a name." } } : {}),
      ...(params.includes("number") ? { number: { type: "integer", description: "The OS update's number, from list_os_changes." } } : {}),
      ...own.properties,
    };
    return {
      name: a.name,
      description: `${a.description} The user sees a card and confirms it before anything changes.`,
      input_schema: { type: "object", properties, required: ["target", ...params.filter((p) => p in properties), ...own.required.filter((r) => !params.includes(r))] },
    };
  });
}

export function isActionName(name: string): boolean {
  return ACTIONS.some((a) => a.name === name);
}

// --- Turning a call into a proposal ---

export type ProposedAction = {
  id: string;
  name: string;
  title: string;
  target: string;
  kind: ActionKind;
  /** What the card lists, already readable: "Amount" → "BHD 500.000". */
  fields: { label: string; value: string }[];
  request: { method: "POST" | "PATCH" | "DELETE"; path: string; body?: Record<string, unknown> };
};

export class ActionInputError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks one of Haman's action calls and turns it into a card for the user.
 * The request is built here from the action's route; nothing the model
 * writes is used as a path. Throws ActionInputError for Haman to fix.
 */
export async function proposeAction(name: string, rawInput: unknown, role: UserRole): Promise<ProposedAction> {
  const action = actionsFor(role).find((a) => a.name === name);
  if (!action) throw new ActionInputError("That change isn't available to this user.");
  const input = { ...(rawInput && typeof rawInput === "object" ? (rawInput as Record<string, unknown>) : {}) };
  const target = typeof input.target === "string" && input.target.trim() ? input.target.trim().slice(0, 160) : null;
  if (!target) throw new ActionInputError('"target" is required: name the record so the user knows what they are confirming.');
  delete input.target;

  let path = action.path;
  for (const key of placeholders(action.path)) {
    const v = input[key];
    if (key === "number") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) throw new ActionInputError('"number" must be an OS update\'s number from list_os_changes.');
      path = path.replace("{number}", String(n));
      delete input[key];
      continue;
    }
    if (typeof v !== "string" || !UUID.test(v)) throw new ActionInputError(`"${key}" must be an id returned by a lookup, not a name. Use search_os or list_records to find it.`);
    path = path.replace(`{${key}}`, encodeURIComponent(v));
    delete input[key];
  }

  if (action.moneyFields && role !== "partner_admin") for (const f of action.moneyFields) delete input[f];
  const body = action.toBody ? action.toBody(input) : input;
  if (action.schema) {
    const parsed = action.schema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ActionInputError(`Not valid for ${action.name}: ${issue?.path.join(".") || "input"}: ${issue?.message ?? "invalid"}. Fix it and try again.`);
    }
  }

  return {
    id: crypto.randomUUID(),
    name: action.name,
    title: action.title,
    target,
    kind: action.kind ?? "change",
    fields: [...(action.name === "write_wiki_page" ? wikiFields(input) : await describe(body)), ...(action.notes ?? [])],
    request: { method: action.method, path, ...(action.method === "DELETE" ? {} : { body }) },
  };
}

// --- What the card shows ---

const LABELS: Record<string, string> = {
  dueAt: "Due",
  startsAt: "Starts",
  spentOn: "Spent on",
  paidOn: "Paid on",
  issuedAt: "Issued",
  expectedClose: "Expected close",
  taxRateBps: "Tax",
  percentageBps: "Share",
  amountBhd: "Charged in BHD",
  externalRef: "Original number",
  lineItems: "Line items",
  durationMinutes: "Minutes",
  isPrimary: "Primary contact",
  isDefault: "Default",
  isActive: "Active",
  creditForId: "Credits invoice",
  paidByPartyId: "Paid by",
  fundPartyId: "Goes to fund",
  scopeId: "For",
  remindAt: "When",
  userId: "For",
  href: "Opens",
};

function label(key: string): string {
  if (LABELS[key]) return LABELS[key]!;
  const words = key
    .replace(/^linked/, "")
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const MONEY_KEYS = new Set(["amount", "amountBhd", "value", "openingBalance", "statementBalance", "costPerYear"]);

function show(key: string, value: unknown, body: Record<string, unknown>, names: Map<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && UUID.test(value)) return names.get(value) ?? "A record that wasn't found";
  if (key === "taxRateBps" || key === "percentageBps") return `${Number(value) / 100}%`;
  if (MONEY_KEYS.has(key) && Number.isFinite(Number(value))) {
    const cur = key === "amountBhd" ? "BHD" : key === "costPerYear" ? String(body.costCurrency ?? "BHD") : String(body.currency ?? "BHD");
    return centsToDisplay(majorToMinorUnits(Number(value), cur), cur);
  }
  if ((key === "startsAt" || key === "remindAt") && typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Bahrain", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  if (Array.isArray(value)) {
    const cur = String(body.currency ?? "BHD");
    const rows = value.map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const o = item as Record<string, unknown>;
      if ("unitPriceCents" in o) return `${o.description} — ${o.quantity} × ${centsToDisplay(Number(o.unitPriceCents), cur)}`;
      if ("percentageBps" in o) return `${names.get(String(o.partyId)) ?? "?"} ${Number(o.percentageBps) / 100}%`;
      if ("deductionTypeId" in o) return `${names.get(String(o.deductionTypeId)) ?? "?"}: ${o.value}${o.base ? ` (of the ${o.base})` : ""}`;
      return JSON.stringify(o);
    });
    return rows.length ? rows.join("\n") : null;
  }
  if (typeof value === "object") return null;
  const s = String(value);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

function collectIds(value: unknown, into: Set<string>) {
  if (typeof value === "string" && UUID.test(value)) into.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectIds(v, into));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectIds(v, into));
}

/** Names for the ids a change refers to, so the card says "Ox Roastery", not a uuid. */
async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await many<{ id: string; name: string }>(
    `select id::text, name from (
       select id, full_name as name from users
       union all select id, name from clients
       union all select id, full_name from contacts
       union all select id, name from projects
       union all select id, title from tasks
       union all select id, name from parties
       union all select id, name from deduction_types
       union all select id, name from ventures
       union all select id, coalesce(document_number, 'Draft ' || type) from documents
       union all select id, title from deals
       union all select id, name from bank_accounts
       union all select id, name from kb_spaces
       union all select id, coalesce(nullif(title, ''), 'Untitled') from kb_pages
       union all select id, name from recurring_expenses
       union all select id, name from files
       union all select id, name from products
     ) n where id::text = any(string_to_array($1, ','))`,
    // A comma list, not an array parameter: Workers can't send arrays (lib/db.ts).
    [ids.join(",")],
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function describe(body: Record<string, unknown>): Promise<{ label: string; value: string }[]> {
  const ids = new Set<string>();
  collectIds(body, ids);
  const names = await namesFor([...ids]);
  return Object.entries(body)
    .map(([key, value]) => ({ label: label(key), value: show(key, value, body, names) }))
    .filter((f): f is { label: string; value: string } => f.value !== null);
}

function wikiFields(input: Record<string, unknown>) {
  const text = String(input.text ?? "");
  return [
    ...(typeof input.title === "string" && input.title.trim() ? [{ label: "Title", value: input.title.trim() }] : []),
    { label: "New text", value: text.length > 600 ? `${text.slice(0, 600)}…` : text },
  ];
}

/** For the tests. */
export const ALL_ACTIONS = ACTIONS;
