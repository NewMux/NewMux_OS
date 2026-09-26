import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { DocumentRecord, DocumentLineItem, Client, DocumentType } from "@/lib/data/types";
import { centsToDisplay } from "@/lib/money";
import { formatDate } from "@/lib/time";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#020617" },
  docType: { fontSize: 14, fontWeight: 700, textTransform: "uppercase", textAlign: "right" },
  docNumber: { fontSize: 10, color: "#475569", textAlign: "right", marginTop: 2 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 2 },
  value: { fontSize: 10, marginBottom: 8 },
  table: { marginTop: 12, borderTop: "1px solid #e2e8f0" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #e2e8f0", paddingVertical: 6 },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 6, borderBottom: "1px solid #0f172a" },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  headerCell: { fontSize: 8, textTransform: "uppercase", color: "#64748b" },
  totalsBlock: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 4 },
  grandTotalRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    borderTop: "1px solid #0f172a",
    paddingTop: 4,
    marginTop: 4,
  },
  footer: { marginTop: 32, fontSize: 9, color: "#64748b" },
});

const TYPE_LABEL: Record<DocumentType, string> = {
  quote: "Quote",
  contract: "Contract",
  invoice: "Invoice",
  credit_note: "Credit Note",
};

export function DocumentPdf({
  document,
  lineItems,
  client,
  creditFor,
}: {
  document: DocumentRecord;
  lineItems: DocumentLineItem[];
  client: Client;
  /** Credit notes: the invoice number being credited. */
  creditFor?: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>NEWMUX</Text>
          <View>
            <Text style={styles.docType}>{TYPE_LABEL[document.type]}</Text>
            <Text style={styles.docNumber}>{document.documentNumber}</Text>
            {document.externalRef && <Text style={styles.docNumber}>Ref. {document.externalRef}</Text>}
            {document.issuedAt && <Text style={styles.docNumber}>Issued {formatDate(document.issuedAt)}</Text>}
            {document.dueAt && document.type !== "quote" && document.type !== "credit_note" && <Text style={styles.docNumber}>Due {formatDate(document.dueAt)}</Text>}
            {document.status === "void" && <Text style={[styles.docType, { color: "#dc2626" }]}>VOID</Text>}
          </View>
        </View>

        {creditFor && (
          <View style={styles.section}>
            <Text style={styles.label}>Credit for invoice</Text>
            <Text style={styles.value}>{creditFor}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={styles.value}>{client.name}</Text>
          {client.email && <Text style={styles.value}>{client.email}</Text>}
          {client.billingAddress && <Text style={styles.value}>{client.billingAddress}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDesc, styles.headerCell]}>Description</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Qty</Text>
            <Text style={[styles.colPrice, styles.headerCell]}>Unit Price</Text>
            <Text style={[styles.colTotal, styles.headerCell]}>Total</Text>
          </View>
          {lineItems.map((item) => (
            <View style={styles.tableRow} key={item.id}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{centsToDisplay(item.unitPriceCents, document.currency)}</Text>
              <Text style={styles.colTotal}>
                {centsToDisplay(item.quantity * item.unitPriceCents, document.currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Subtotal</Text>
            <Text>{centsToDisplay(document.subtotalCents, document.currency)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>Tax ({(document.taxRateBps / 100).toFixed(2)}%)</Text>
            <Text>{centsToDisplay(document.taxCents, document.currency)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={{ fontWeight: 700 }}>Total</Text>
            <Text style={{ fontWeight: 700 }}>{centsToDisplay(document.totalCents, document.currency)}</Text>
          </View>
        </View>

        {document.paymentTerms && (
          <View style={styles.footer}>
            <Text style={styles.label}>Payment Terms</Text>
            <Text>{document.paymentTerms}</Text>
          </View>
        )}
        {document.notes && (
          <View style={styles.footer}>
            <Text style={styles.label}>Notes</Text>
            <Text>{document.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
