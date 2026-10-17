/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image>, not an HTML img: PDFs have no alt text. */
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { OfficialPdfData } from "../officialTypes";
import { formatAmount } from "@/lib/money";

/**
 * The official NewMux design (PRD addendum 1.2, section 2 and Appendix B),
 * for every document type: the Letterhead layout for letters, the Project
 * Details layout for quotations, proposals, contracts, invoices and credit
 * notes. Built once here so a brand change updates them all.
 *
 * A4, 20 mm side margins, Poppins embedded. The header band (logo on Deep
 * Ink, WWW.NEWMUX.COM, Signal Blue rule) and the footer bar are the images
 * from the approved Word templates, never redrawn. Square corners, no
 * shadows or gradients. Amounts in the document's currency with its
 * decimals (BHD: 1,250.000); dates as 17 October 2026 in letters and
 * 17 Oct 2026 in tables.
 */

const C = {
  ink: "#001D21",
  blue: "#1768D4",
  muted: "#4A5F63",
  tint: "#EEF4FB",
  hairline: "#D5DEE0",
};

const PAGE_W = 595.28;
const MARGIN = 56.69; // 20 mm
const HEADER_H = (PAGE_W * 344) / 2481; // the band image's own proportions
const BAR_H = (PAGE_W * 31) / 2481;

let registeredFor: string | null = null;
/** Fonts and images load from the app itself (public/doc). */
export function registerOfficialFonts(origin: string) {
  if (registeredFor === origin) return;
  Font.register({
    family: "Poppins",
    fonts: [
      { src: `${origin}/doc/Poppins-Regular.ttf`, fontWeight: 400 },
      { src: `${origin}/doc/Poppins-SemiBold.ttf`, fontWeight: 600 },
      { src: `${origin}/doc/Poppins-Bold.ttf`, fontWeight: 700 },
      { src: `${origin}/doc/Poppins-ExtraBold.ttf`, fontWeight: 800 },
    ],
  });
  // Whole words only: no hyphenation in official documents.
  Font.registerHyphenationCallback((word) => [word]);
  registeredFor = origin;
}

const s = StyleSheet.create({
  page: { fontFamily: "Poppins", fontSize: 10, color: C.ink, paddingTop: HEADER_H + 26, paddingBottom: 92, paddingHorizontal: MARGIN, lineHeight: 1.5 },
  header: { position: "absolute", top: 0, left: 0, width: PAGE_W, height: HEADER_H },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0 },
  footerCols: { flexDirection: "row", marginHorizontal: MARGIN, borderTopWidth: 0.75, borderTopColor: C.hairline, paddingTop: 9, paddingBottom: 12 },
  footerText: { fontSize: 7, color: C.muted, lineHeight: 1.45 },
  footerStrong: { fontSize: 7, fontWeight: 700, color: C.ink, letterSpacing: 0.6, lineHeight: 1.45 },
  bar: { width: PAGE_W, height: BAR_H },
  eyebrow: { fontSize: 7.5, fontWeight: 600, color: C.blue, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 800, textTransform: "uppercase", lineHeight: 1.15, marginBottom: 11 },
  meta: { flexDirection: "row", backgroundColor: C.tint, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 16 },
  metaCell: { flex: 1, paddingRight: 8 },
  label: { fontSize: 7.5, fontWeight: 600, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  metaValue: { fontSize: 10, marginTop: 1 },
  section: { marginBottom: 14 },
  heading: { flexDirection: "row", marginBottom: 6 },
  headingNo: { fontSize: 11.5, fontWeight: 700, color: C.blue, marginRight: 9 },
  headingText: { fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" },
  body: { fontSize: 10, lineHeight: 1.5 },
  para: { fontSize: 10, lineHeight: 1.55, marginBottom: 7 },
  th: { flexDirection: "row", backgroundColor: C.tint, paddingVertical: 7, paddingHorizontal: 8 },
  tr: { flexDirection: "row", paddingVertical: 5.5, paddingHorizontal: 8, borderBottomWidth: 0.75, borderBottomColor: C.hairline },
  trTotal: { flexDirection: "row", backgroundColor: C.tint, paddingVertical: 5.5, paddingHorizontal: 8, borderBottomWidth: 1.5, borderBottomColor: C.blue },
  thText: { fontSize: 7.5, fontWeight: 600, color: C.muted, letterSpacing: 1.2, textTransform: "uppercase" },
  td: { fontSize: 10 },
  tdBold: { fontSize: 10, fontWeight: 700 },
  right: { textAlign: "right" },
  clause: { flexDirection: "row", marginBottom: 3 },
  clauseNo: { fontSize: 10, fontWeight: 700, color: C.blue, width: 24 },
  clauseTitle: { fontWeight: 600 },
  signBlock: { marginTop: 2, width: 172 },
  signArea: { height: 40, justifyContent: "flex-end" },
  signImage: { height: 38, objectFit: "contain", objectPosition: "left bottom" },
  signLine: { borderBottomWidth: 0.9, borderBottomColor: C.ink, marginBottom: 7 },
  signName: { fontSize: 10.5, fontWeight: 700 },
  signPosition: { fontSize: 9, color: C.muted },
});

// --- Small formatting helpers ---

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** 17 October 2026 */
export const longDate = (ymd: string | null) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
};
/** 17 Oct 2026 */
export const shortDate = (ymd: string | null) => {
  if (!ymd) return "";
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m! - 1]!.slice(0, 3)} ${y}`;
};
const CYCLE = { monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" } as const;
const qty = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3))));

/** Paragraphs on blank lines; "- " lines are bullets; **bold** inline. */
function RichText({ text, style }: { text: string; style?: Style }) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <View key={i} style={{ marginBottom: 8 }}>
              {lines.map((l, j) => (
                <View key={j} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={[s.body, { width: 12 }]}>•</Text>
                  <Text style={[s.body, { flex: 1 }]}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={[s.para, style ?? {}]}>
            {inline(lines.join("\n"))}
          </Text>
        );
      })}
    </>
  );
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <Text key={i} style={{ fontWeight: 700 }}>
        {p.slice(2, -2)}
      </Text>
    ) : (
      p
    ),
  );
}

// --- Building blocks ---

function Frame({ data, origin, children }: { data: OfficialPdfData; origin: string; children: React.ReactNode }) {
  const c = data.company;
  return (
    <Page size="A4" style={s.page}>
      <Image fixed src={`${origin}/doc/header.png`} style={s.header} />
      <View fixed style={s.footer}>
        <View style={s.footerCols}>
          <View style={{ width: 188 }}>
            <Text style={s.footerStrong}>{c.tradeName.toUpperCase()}</Text>
            <Text style={s.footerText}>{c.tagline}</Text>
            <Text style={s.footerText}>
              CR No. {c.crNumber} · {c.country}
            </Text>
          </View>
          <View style={{ width: 152 }}>
            <Text style={s.footerText}>{c.email}</Text>
            <Text style={s.footerText}>WhatsApp {c.whatsapp}</Text>
            <Text style={s.footerText}>{c.website}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.footerText}>Bank IBAN</Text>
            <Text style={s.footerText}>{c.iban}</Text>
          </View>
        </View>
        <Image src={`${origin}/doc/footer-bar.png`} style={s.bar} />
      </View>
      {children}
    </Page>
  );
}

function Heading({ no, children }: { no: number; children: string }) {
  return (
    <View style={s.heading} wrap={false}>
      <Text style={s.headingNo}>{String(no).padStart(2, "0")}</Text>
      <Text style={s.headingText}>{children}</Text>
    </View>
  );
}

type Col = { label: string; flex?: number; width?: number; right?: boolean };

/** `lead` (the section heading) stays on the same page as the table's header and first row. */
function Table({ cols, rows, total, lead }: { cols: Col[]; rows: string[][]; total?: string[][]; lead?: React.ReactNode }) {
  const cell = (c: Col) => ({ ...(c.width ? { width: c.width } : { flex: c.flex ?? 1 }), ...(c.right ? s.right : {}) });
  const row = (r: string[], i: number) => (
    <View key={i} style={s.tr} wrap={false}>
      {r.map((v, j) => (
        <Text key={j} style={[s.td, cell(cols[j]!)]}>
          {v}
        </Text>
      ))}
    </View>
  );
  return (
    <View>
      <View wrap={false}>
        {lead}
        <View style={s.th}>
          {cols.map((c, i) => (
            <Text key={i} style={[s.thText, cell(c)]}>
              {c.label}
            </Text>
          ))}
        </View>
        {rows[0] && row(rows[0], 0)}
      </View>
      {rows.slice(1).map((r, i) => row(r, i + 1))}
      {total?.map((r, i) => (
        <View key={`t${i}`} style={i === total.length - 1 ? s.trTotal : s.tr} wrap={false}>
          {r.map((v, j) => (
            <Text key={j} style={[i === total.length - 1 ? s.tdBold : s.td, cell(cols[j]!)]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function Signature({ name, position, company, image, label, blank }: { name: string; position: string; company: string; image?: string | null; label?: string; blank?: boolean }) {
  return (
    <View style={s.signBlock} wrap={false}>
      {label && <Text style={[s.label, { marginBottom: 4 }]}>{label}</Text>}
      <View style={s.signArea}>{image && !blank ? <Image src={image} style={s.signImage} /> : null}</View>
      <View style={s.signLine} />
      <Text style={s.signName}>{name}</Text>
      {position ? <Text style={s.signPosition}>{company ? `${position}, ${company}` : position}</Text> : null}
    </View>
  );
}

// --- The layouts ---

const EYEBROW: Record<OfficialPdfData["type"], string> = {
  quote: "Quotation",
  proposal: "Project proposal",
  contract: "Contract",
  invoice: "Invoice",
  credit_note: "Credit note",
  letter: "Letter",
};

/** Letterhead: reference, date, recipient, subject, body, signatory. */
function Letter({ data, origin, signature }: { data: OfficialPdfData; origin: string; signature?: string | null }) {
  const recipient = (data.recipient ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <Frame data={data} origin={origin}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 26 }}>
        <View>
          <Text style={s.label}>Ref</Text>
          <Text style={[s.metaValue, { fontSize: 10.5 }]}>{data.number ?? "Draft"}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={s.label}>Date</Text>
          <Text style={[s.metaValue, { fontSize: 10.5 }]}>{longDate(data.date)}</Text>
        </View>
      </View>
      {recipient.length > 0 && (
        <View style={{ marginBottom: 20 }}>
          <Text style={[s.label, { marginBottom: 4 }]}>To</Text>
          {recipient.map((l, i) => (
            <Text key={i} style={i === 0 ? { fontSize: 10.5, fontWeight: 700 } : { fontSize: 10.5 }}>
              {l}
            </Text>
          ))}
        </View>
      )}
      {data.title && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 0.75, borderBottomColor: C.hairline, marginBottom: 14 }}>
          <Text style={[s.label, { marginRight: 14 }]}>Subject</Text>
          <Text style={{ fontSize: 10.5, fontWeight: 700, flex: 1 }}>{data.title}</Text>
        </View>
      )}
      <RichText text={data.body ?? ""} />
      {data.signatory && (
        <View style={{ marginTop: 18 }} wrap={false}>
          <Signature name={data.signatory.name} position={data.signatory.position} company={data.company.tradeName} image={signature} />
        </View>
      )}
      {data.terms && (
        <View style={{ marginTop: 26 }}>
          <Text style={[s.label, { marginBottom: 8 }]}>Attached: Terms &amp; Conditions{data.terms.templateName ? ` (${data.terms.templateName})` : ""}</Text>
          {data.terms.clauses.map((c, i) => (
            <View key={i} style={s.clause} wrap={false}>
              <Text style={s.clauseNo}>{i + 1}.</Text>
              <Text style={[s.body, { flex: 1 }]}>
                {c.title ? <Text style={s.clauseTitle}>{c.title}. </Text> : null}
                {c.body}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Frame>
  );
}

/** Project Details: eyebrow, title, meta panel, numbered sections. */
function ProjectDetails({ data, origin, signature }: { data: OfficialPdfData; origin: string; signature?: string | null }) {
  const cur = data.currency;
  const money = (n: number) => formatAmount(n, cur);
  const isInvoice = data.type === "invoice" || data.type === "credit_note";
  const offer = data.type === "quote" || data.type === "proposal";
  let no = 0;
  const next = () => ++no;

  const meta: { label: string; value: string }[] = [
    { label: "Client", value: data.client?.name ?? "" },
    { label: "Reference", value: data.number ?? "Draft" },
    { label: "Date", value: shortDate(data.date) },
  ];
  if (offer && data.validUntil) meta.push({ label: "Valid until", value: shortDate(data.validUntil) });
  if (data.type === "invoice" && data.dueAt) meta.push({ label: "Due date", value: shortDate(data.dueAt) });
  if (data.type === "credit_note" && data.creditFor) meta.push({ label: "Credit for", value: data.creditFor });
  if (data.type === "contract" && data.client?.contactName) meta.push({ label: "Attention", value: data.client.contactName });

  const detailed = data.lineItems.some((li) => li.quantity !== 1) || isInvoice;
  const itemRows = data.lineItems.map((li) => {
    const amount = Math.round(li.quantity * li.unitPriceCents);
    return detailed ? [li.description, qty(li.quantity), money(li.unitPriceCents), money(amount)] : [li.description, money(amount)];
  });
  const cols: Col[] = detailed
    ? [{ label: "Item", flex: 1 }, { label: "Qty", width: 40, right: true }, { label: "Unit price", width: 80, right: true }, { label: `Amount (${cur})`, width: 92, right: true }]
    : [{ label: "Item", flex: 1 }, { label: `Amount (${cur})`, width: 110, right: true }];
  const pad = (label: string, value: string) => (detailed ? [label, "", "", value] : [label, value]);
  const totalLabel = data.type === "quote" ? "Project total" : data.type === "credit_note" ? "Total credit" : isInvoice ? "Total due" : "Total";
  const totals = [
    ...(data.taxCents ? [pad("Subtotal", money(data.subtotalCents)), pad(`VAT ${data.taxRateBps / 100}%`, money(data.taxCents))] : []),
    pad(totalLabel, money(data.totalCents)),
  ];

  return (
    <Frame data={data} origin={origin}>
      <Text style={s.eyebrow}>{EYEBROW[data.type]}</Text>
      <Text style={s.title}>{data.title || (isInvoice ? EYEBROW[data.type] : data.client?.name ?? "")}</Text>
      <View style={s.meta} wrap={false}>
        {meta.map((m) => (
          <View key={m.label} style={s.metaCell}>
            <Text style={s.label}>{m.label}</Text>
            <Text style={s.metaValue}>{m.value}</Text>
          </View>
        ))}
      </View>

      {data.type === "contract" && (
        <View style={s.section}>
          <Heading no={next()}>Parties</Heading>
          <Text style={s.body}>
            This contract is between {data.company.tradeName}, {data.company.tagline}, CR No. {data.company.crNumber}, {data.company.country}, and {data.client?.name ?? "the client"}
            {data.client?.address ? `, ${data.client.address.replace(/\n/g, ", ")}` : ""}.
          </Text>
        </View>
      )}

      {data.overview && (
        <View style={s.section}>
          <Heading no={next()}>Overview</Heading>
          <RichText text={data.overview} />
        </View>
      )}

      {data.scope.length > 0 && (
        <View style={s.section}>
          <Table
            lead={<Heading no={next()}>Scope &amp; timeline</Heading>}
            cols={[{ label: "#", width: 34 }, { label: "Deliverable", flex: 1 }, { label: "Duration", width: 110 }]}
            rows={data.scope.map((it, i) => [String(i + 1), it.deliverable, it.duration])}
          />
        </View>
      )}

      {data.lineItems.length > 0 && (
        <View style={s.section}>
          <Table lead={<Heading no={next()}>{isInvoice ? "Items" : data.type === "contract" ? "Fees" : "Investment"}</Heading>} cols={cols} rows={itemRows} total={totals} />
        </View>
      )}

      {data.serverFee && (
        <View style={s.section}>
          <Table
            lead={<Heading no={next()}>Server fee (optional)</Heading>}
            cols={[{ label: "Item", flex: 1 }, { label: "Billing cycle", width: 84 }, { label: `Amount (${cur})`, width: 84, right: true }]}
            rows={[
              [
                data.serverFee.label ?? "Server and hosting, billed separately from the project total",
                data.serverFee.clientChooses ? `${CYCLE[data.serverFee.cycle]}, or as the client chooses` : CYCLE[data.serverFee.cycle],
                money(data.serverFee.amountCents),
              ],
            ]}
          />
        </View>
      )}

      {data.payments && (
        <View style={s.section}>
          <Table
            lead={<Heading no={next()}>Payments received</Heading>}
            cols={[{ label: "Date", flex: 1 }, { label: `Amount (${cur})`, width: 110, right: true }]}
            rows={data.payments.length ? data.payments.map((p) => [shortDate(p.paidOn), money(p.amountCents)]) : [["No payments yet", ""]]}
            total={[
              ...(data.creditedCents ? [["Credit notes", money(data.creditedCents)]] : []),
              ["Balance due", money(Math.max(data.totalCents - data.creditedCents - data.paidCents, 0))],
            ]}
          />
        </View>
      )}

      {data.paymentTerms && (
        <View style={s.section} wrap={false}>
          <Heading no={next()}>Payment terms</Heading>
          <RichText text={data.paymentTerms} />
        </View>
      )}

      {data.terms && (
        <View style={s.section}>
          {(() => {
            const n = next();
            return (
              <>
                {data.terms.clauses.map((c, i) => {
                  const clause = (
                    <View key={i} style={s.clause} wrap={false}>
                      <Text style={[s.clauseNo, { width: 26 }]}>
                        {n}.{i + 1}
                      </Text>
                      <Text style={[s.body, { flex: 1 }]}>
                        {c.title ? <Text style={s.clauseTitle}>{c.title}. </Text> : null}
                        {c.body}
                      </Text>
                    </View>
                  );
                  return i === 0 ? (
                    <View key={i} wrap={false}>
                      <Heading no={n}>Terms &amp; conditions</Heading>
                      {clause}
                    </View>
                  ) : (
                    clause
                  );
                })}
              </>
            );
          })()}
        </View>
      )}

      {data.notes && (
        <View style={s.section} wrap={false}>
          <Heading no={next()}>Notes</Heading>
          <RichText text={data.notes} />
        </View>
      )}

      {data.type === "proposal" && (
        <View style={s.section} wrap={false}>
          <Heading no={next()}>Acceptance</Heading>
          <Text style={s.body}>
            To go ahead, sign below or confirm in writing{data.validUntil ? ` by ${longDate(data.validUntil)}` : ""}.
          </Text>
        </View>
      )}

      {data.signatory && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }} wrap={false}>
          <Signature
            label={`Signed for ${data.company.tradeName}`}
            name={data.signatory.name}
            position={data.signatory.position}
            company={data.company.tradeName}
            image={signature}
          />
          {(data.type === "contract" || data.type === "proposal") && (
            <Signature label={`Accepted for ${data.client?.name ?? "the client"}`} name="Name" position="Position and date" company="" blank />
          )}
        </View>
      )}
    </Frame>
  );
}

/**
 * The document. `signature` is the image drawn at issue (a PNG data URL); it
 * is placed on this PDF only and never stored anywhere else.
 */
export function OfficialPdf({ data, origin, signature }: { data: OfficialPdfData; origin: string; signature?: string | null }) {
  registerOfficialFonts(origin);
  return (
    <Document title={`${EYEBROW[data.type]} ${data.number ?? "draft"}`} author={data.company.tradeName} creator="NEWMUX OS" producer="NEWMUX OS" language="en">
      {data.type === "letter" ? <Letter data={data} origin={origin} signature={signature} /> : <ProjectDetails data={data} origin={origin} signature={signature} />}
    </Document>
  );
}
