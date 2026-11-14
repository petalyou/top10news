import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { generateJson } from "../lib/ingest/gemini";

const Schema = z.object({ stories: z.array(z.object({ id: z.string() })) });
const ok = (payload: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: "STOP" }] }), { status: 200 });

test("gemini: sends key header, JSON schema, and parses the reply", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return ok({ stories: [{ id: "c1" }] });
  }) as unknown as typeof fetch;
  const out = await generateJson({ model: "gemini-3.5-flash-lite", system: "S", prompt: "P", schema: Schema, fetchImpl });
  assert.deepEqual(out, { stories: [{ id: "c1" }] });
  assert.ok(seen);
  const s = seen as { url: string; init: RequestInit };
  assert.equal(s.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
  assert.equal((s.init.headers as Record<string, string>)["x-goog-api-key"], "test-key");
  const body = JSON.parse(String(s.init.body));
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.responseJsonSchema.$schema, undefined);
  assert.equal(body.systemInstruction.parts[0].text, "S");
});

test("gemini: rejects output that doesn't match the schema, and reports HTTP errors", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const bad = (async () => ok({ nope: true })) as unknown as typeof fetch;
  await assert.rejects(generateJson({ model: "m", system: "S", prompt: "P", schema: Schema, fetchImpl: bad }), /schema/);
  const denied = (async () => new Response("bad key", { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(generateJson({ model: "m", system: "S", prompt: "P", schema: Schema, fetchImpl: denied }), /HTTP 403/);
});
