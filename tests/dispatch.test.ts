import assert from "node:assert/strict";
import { test } from "node:test";
import { dispatchConfigured, dispatchIngest } from "../lib/github-dispatch";

test("GitHub dispatch: posts workflow_dispatch for hourly-ingest.yml on main", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  const r = await dispatchIngest({ GH_DISPATCH_TOKEN: " tok ", GH_REPO: "https://github.com/someone/top10news.git" }, fake);
  assert.equal(r.ok, true);
  assert.equal(seen!.url, "https://api.github.com/repos/someone/top10news/actions/workflows/hourly-ingest.yml/dispatches");
  assert.equal((seen!.init.headers as Record<string, string>).authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(String(seen!.init.body)), { ref: "main" });
});

test("GitHub dispatch: reports failures and missing config without throwing", async () => {
  const denied = (async () => new Response("Bad credentials", { status: 401 })) as unknown as typeof fetch;
  assert.deepEqual(await dispatchIngest({ GH_DISPATCH_TOKEN: "x", GH_REPO: "a/b" }, denied), { ok: false, status: 401, detail: "Bad credentials" });
  assert.equal((await dispatchIngest({ GH_REPO: "a/b" })).ok, false);
  assert.equal(dispatchConfigured({ GH_DISPATCH_TOKEN: "x" }), false);
});
