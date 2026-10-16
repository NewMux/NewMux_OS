/**
 * The GitHub REST API, for OS updates (lib/osChanges.ts). One token, set as
 * GITHUB_TOKEN: a fine-grained personal access token for the NEWMUX OS
 * repository with Issues, Pull requests and Contents (read and write) and
 * Checks (read). GITHUB_REPO names the repository (owner/name).
 *
 * Plain fetch, so it runs the same on Cloudflare Workers and in Node.
 */

export const DEFAULT_REPO = "NewMux/NewMux_OS";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export function githubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

export function githubRepo(): string {
  return process.env.GITHUB_REPO?.trim() || DEFAULT_REPO;
}

export async function gh<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GitHubError(503, "GitHub isn't connected. Add GITHUB_TOKEN to the server's settings.");
  // GITHUB_API_URL: GitHub Enterprise, or a stand-in for tests.
  const api = process.env.GITHUB_API_URL?.replace(/\/$/, "") || "https://api.github.com";
  const url = `${api}${path.replace("{repo}", githubRepo())}`;
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "newmux-os",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { message?: string; errors?: { message?: string }[] };
  if (!res.ok) {
    const detail = json.errors?.map((e) => e.message).filter(Boolean).join("; ");
    throw new GitHubError(res.status, [json.message, detail].filter(Boolean).join(": ") || `GitHub answered ${res.status}`);
  }
  return json as T;
}
