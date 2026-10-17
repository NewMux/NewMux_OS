import type { OfficialPdfData } from "./officialTypes";

/**
 * Client-side PDF export. The API returns the data (app/api/documents/
 * generate-pdf, app/api/reports/pdf) and the browser renders the PDF with
 * @react-pdf, loaded on demand so it stays out of the page bundles.
 * Official documents use the approved NewMux design (templates/OfficialPdf).
 */

export type ReportPdfData = {
  kind: "report";
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

async function fetchData<T>(dataUrl: string): Promise<T> {
  const res = await fetch(dataUrl, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't prepare the PDF.");
  }
  return (await res.json()) as T;
}

/** An official document as a PDF blob, with the drawn signature if there is one. */
export async function renderOfficialPdf(data: OfficialPdfData, signature?: string | null): Promise<Blob> {
  const [{ pdf }, { OfficialPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./templates/OfficialPdf")]);
  return pdf(<OfficialPdf data={data} origin={window.location.origin} signature={signature} />).toBlob();
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadPdf(dataUrl: string): Promise<void> {
  const data = await fetchData<OfficialPdfData | ReportPdfData>(dataUrl);
  if (data.kind === "official") {
    saveBlob(await renderOfficialPdf(data), data.filename);
    return;
  }
  const [{ pdf }, { ReportPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./templates/ReportPdf")]);
  saveBlob(await pdf(<ReportPdf title={data.title} headers={data.headers} rows={data.rows} />).toBlob(), data.filename);
}

export async function officialData(documentId: string, opts: { statement?: boolean } = {}): Promise<OfficialPdfData> {
  return fetchData<OfficialPdfData>(`/api/documents/generate-pdf?id=${documentId}${opts.statement ? "&statement=1" : ""}`);
}

/** Base64 of a blob, for sending the issued PDF as JSON. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
