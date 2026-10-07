import type { Client, DocumentLineItem, DocumentRecord } from "@/lib/data/types";

/**
 * Client-side PDF export. The API returns the data (app/api/documents/
 * generate-pdf, app/api/reports/pdf) and the browser renders the PDF with
 * @react-pdf, loaded on demand so it stays out of the page bundles.
 */

export type DocumentPdfData = {
  kind: "document";
  filename: string;
  document: DocumentRecord;
  lineItems: DocumentLineItem[];
  client: Client;
  creditFor: string | null;
};

export type ReportPdfData = {
  kind: "report";
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

export async function downloadPdf(dataUrl: string): Promise<void> {
  const res = await fetch(dataUrl);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't prepare the PDF.");
  }
  const data = (await res.json()) as DocumentPdfData | ReportPdfData;

  const [{ pdf }, { DocumentPdf }, { ReportPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./templates/DocumentPdf"),
    import("./templates/ReportPdf"),
  ]);
  const element =
    data.kind === "document" ? (
      <DocumentPdf document={data.document} lineItems={data.lineItems} client={data.client} creditFor={data.creditFor} />
    ) : (
      <ReportPdf title={data.title} headers={data.headers} rows={data.rows} />
    );
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
