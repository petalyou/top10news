/**
 * Backup trigger for the hourly ingest. GitHub's own `schedule` is best-effort and often skips
 * hours, so the site Worker's free Cron Trigger (worker.ts, minute 40) asks GitHub to start the
 * "Hourly ingest" workflow too. It is a single HTTPS request, well inside the free 10 ms CPU limit.
 *
 * Two runs in the same hour are harmless: the workflow's concurrency group runs them one after
 * the other, and the second finds the hour already published and skips.
 */
export interface DispatchEnv {
  /** Fine-grained GitHub token with Actions: Read and write on the repo. Worker secret. */
  GH_DISPATCH_TOKEN?: string;
  /** "owner/repo". Worker secret (kept out of wrangler.toml so a deploy never wipes it). */
  GH_REPO?: string;
  /** Optional overrides. */
  GH_WORKFLOW?: string;
  GH_REF?: string;
}

export function dispatchConfigured(env: DispatchEnv): boolean {
  return Boolean(env.GH_DISPATCH_TOKEN && env.GH_REPO);
}

export async function dispatchIngest(env: DispatchEnv, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; status: number; detail: string }> {
  const repo = (env.GH_REPO ?? "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
  if (!env.GH_DISPATCH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return { ok: false, status: 0, detail: "GH_DISPATCH_TOKEN or GH_REPO missing or malformed" };
  const workflow = env.GH_WORKFLOW || "hourly-ingest.yml";
  const res = await fetchFn(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GH_DISPATCH_TOKEN.trim()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "top10-hourly-cron",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref: env.GH_REF || "main" }),
  });
  // 204 No Content on success.
  return { ok: res.status === 204, status: res.status, detail: res.status === 204 ? "dispatched" : (await res.text()).slice(0, 300) };
}
