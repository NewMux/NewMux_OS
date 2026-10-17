/**
 * A short-lived, signed ticket between the two steps of issuing a document
 * (lib/data/officialDocs.ts): step one checks the signatory's password and
 * fixes the number; step two accepts the PDF only for that document, that
 * person, that number and that exact draft. HMAC-SHA256 with AUTH_SECRET,
 * WebCrypto only, so it runs on Workers.
 */

export type IssueTicket = {
  /** Document id. */
  d: string;
  /** Who started it. */
  u: string;
  /** The number it was given. */
  n: string;
  /** The draft's updated_at when it started: any edit since invalidates the ticket. */
  t: string;
  /** Signed (true) or issued unsigned. */
  s: boolean;
  /** Expiry, ms since epoch. */
  e: number;
};

export const ISSUE_TICKET_MINUTES = 20;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(`issue-ticket:${secret()}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
}

export async function signTicket(ticket: IssueTicket): Promise<string> {
  const body = b64url(new TextEncoder().encode(JSON.stringify(ticket)));
  return `${body}.${b64url(await hmac(body))}`;
}

/** The ticket, or null when it's forged, damaged or expired. */
export async function readTicket(token: string, now = Date.now()): Promise<IssueTicket | null> {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = await hmac(body);
  let given: Uint8Array;
  try {
    given = fromB64url(mac);
  } catch {
    return null;
  }
  if (given.length !== expected.length || !given.every((b, i) => b === expected[i])) return null;
  try {
    const ticket = JSON.parse(new TextDecoder().decode(fromB64url(body))) as IssueTicket;
    return ticket.e > now ? ticket : null;
  } catch {
    return null;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
