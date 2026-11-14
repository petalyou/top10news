import { z } from "zod";

/**
 * Minimal Gemini Developer API client (generateContent + JSON-schema structured output).
 * Plain fetch, so it runs the same in Node (GitHub Actions, scripts) and in Workers.
 * The key comes only from the GEMINI_API_KEY secret.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Free tier, as of Nov 2026: Flash-Lite allows ~15 requests/minute and ~500/day; Flash only ~20/day. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** zod -> JSON Schema without the "$schema" key, which the API doesn't accept. */
function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One structured call. Retries once on 429/5xx (after a short wait), then throws.
 * Every attempt counts as one request against the daily quota.
 */
export async function generateJson<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: T;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}): Promise<z.infer<T>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const doFetch = opts.fetchImpl ?? fetch;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchemaFor(opts.schema),
      maxOutputTokens: opts.maxOutputTokens ?? 32_000,
    },
  });

  for (let attempt = 1; ; attempt++) {
    const res = await doFetch(`${ENDPOINT}/${encodeURIComponent(opts.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await sleep(res.status === 429 ? 30_000 : 5_000);
        continue;
      }
      throw new GeminiError(`${opts.model} HTTP ${res.status}: ${detail}`, res.status);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) throw new GeminiError(`${opts.model} blocked: ${data.promptFeedback.blockReason}`);
    const cand = data.candidates?.[0];
    if (cand?.finishReason === "MAX_TOKENS") throw new GeminiError(`${opts.model} hit max output tokens`);
    const text = (cand?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    if (!text) throw new GeminiError(`${opts.model} returned no text (finishReason ${cand?.finishReason ?? "none"})`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new GeminiError(`${opts.model} returned invalid JSON`);
    }
    const checked = opts.schema.safeParse(parsed);
    if (!checked.success) throw new GeminiError(`${opts.model} output did not match the schema`);
    return checked.data;
  }
}
