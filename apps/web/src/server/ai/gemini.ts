import "server-only";
import { googleConfigured, googleGenerateContent } from "./google-transport";

/**
 * Google Gemini over its REST generateContent endpoint, for live features
 * (the Discovery conversation first). Server-only: the key never reaches the
 * browser. Without GEMINI_API_KEY every caller falls back to its built-in
 * behaviour.
 *
 * Models are grouped by job. Each group is a chain: the first model is tried
 * first, and a busy, failing or unknown model passes the request to the next.
 * When the whole Main chain is busy, the Fast chain stands in.
 *
 *   Group   Default chain                                                     Override (comma-separated)
 *   main    gemini-3.8-flash, 3.7-flash, 3.6-flash, 3.5-flash                 GEMINI_MODEL
 *   fast    gemini-3.1-flash-lite, 3.5-flash-lite                             GEMINI_FAST_MODEL
 *   strong  gemini-3.1-pro-preview, 3.6-flash  (reading papers and sheets)    GEMINI_STRONG_MODEL
 *   code    gemini-3.8-flash  (3D pages)                                      GEMINI_CODE_MODEL
 *   image   gemini-nano-banana-2.1, 3.1-flash-image, 3.1-flash-lite-image     GEMINI_IMAGE_MODEL
 *
 * Also: GEMINI_BASE_URL (default https://generativelanguage.googleapis.com/v1beta),
 * GEMINI_THINKING_LEVEL (minimal | low | medium | high) to override a caller's thinking level.
 * The image group draws Mission scenes (gemini-image.ts); it needs billing, as image models have no free quota.
 */

export type GeminiGroup = "main" | "fast" | "strong" | "code" | "image";

const DEFAULT_CHAINS: Record<GeminiGroup, string[]> = {
  main: ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"],
  fast: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"],
  strong: ["gemini-3.1-pro-preview", "gemini-3.6-flash"],
  code: ["gemini-3.8-flash"],
  image: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
};

const ENV_VAR: Record<GeminiGroup, string> = {
  main: "GEMINI_MODEL",
  fast: "GEMINI_FAST_MODEL",
  strong: "GEMINI_STRONG_MODEL",
  code: "GEMINI_CODE_MODEL",
  image: "GEMINI_IMAGE_MODEL",
};

export const geminiConfigured = googleConfigured;

/** A group's models in order: the env override (comma-separated) or the default chain. */
export function geminiModels(group: GeminiGroup): string[] {
  const override = process.env[ENV_VAR[group]]?.split(",").map((m) => m.trim()).filter(Boolean);
  return override?.length ? override : DEFAULT_CHAINS[group];
}

/** Every model a request in this group may reach, in order. Main falls through to Fast. */
export function geminiChain(group: GeminiGroup): string[] {
  const own = geminiModels(group);
  const chain = group === "main" ? [...own, ...geminiModels("fast")] : own;
  return [...new Set(chain)];
}


export class GeminiError extends Error {
  status: number | null;
  model: string | null;
  retryAfterMs: number | null;
  constructor(message: string, status: number | null = null, model: string | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.status = status;
    this.model = model;
    this.retryAfterMs = retryAfterMs;
  }
}

export type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

type JsonRequest = {
  system: string;
  contents: GeminiContent[];
  /** JSON Schema for the reply (Gemini's subset: type, properties, required, enum, items, min/maxItems, description) */
  schema: Record<string, unknown>;
  group?: Exclude<GeminiGroup, "image">;
  /** how long the model thinks before answering; "low" keeps live chat fast. Omit for the model's default. */
  thinking?: "minimal" | "low" | "medium" | "high";
  temperature?: number;
  maxOutputTokens?: number;
  /** longest wait for one model */
  timeoutMs?: number;
  /** total time for the whole chain; after it the caller uses its built-in fallback */
  deadlineMs?: number;
};

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; details?: { retryDelay?: string }[] };
};

/**
 * Models that just answered "quota exceeded" (429) or "high demand" (503) are
 * skipped until this time, so later requests don't wait on the same failure.
 * Google's own retryDelay is used when it gives one.
 */
// shared across route bundles (the dev server may load this module once per route)
const coolingUntil: Map<string, number> = ((globalThis as { __geminiCooling?: Map<string, number> }).__geminiCooling ??= new Map());
const cooling = (model: string) => (coolingUntil.get(model) ?? 0) > Date.now();
function coolDown(model: string, status: number | null, retryAfterMs: number | null) {
  if (status === 429) coolingUntil.set(model, Date.now() + Math.min(retryAfterMs ?? 60_000, 10 * 60_000));
  else if (status === 503) coolingUntil.set(model, Date.now() + Math.min(retryAfterMs ?? 20_000, 2 * 60_000));
  else if (status === null) coolingUntil.set(model, Date.now() + 30_000); // hung or unreachable
}
/** Models in a group's chain that are currently being skipped (for the health check). */
export const geminiCooling = (group: GeminiGroup) => geminiChain(group).filter(cooling);

/** Busy, overloaded, timed out, unknown or empty: worth trying the next model in the chain. */
const tryNext = (e: GeminiError) => e.status === null || e.status === 404 || e.status === 408 || e.status === 429 || e.status >= 500;

/**
 * One JSON reply from the first model in the group's chain that answers.
 * JSON is requested with responseMimeType + responseJsonSchema (the
 * responseFormat field shown in newer docs is rejected by these models as of
 * October 2026). If a model rejects the thinking setting (400), the same model
 * is asked again without it. Bad keys (401/403) and other 400s stop at once:
 * another model would fail the same way.
 */
export async function geminiJson<T>(req: JsonRequest): Promise<{ data: T; model: string }> {
  if (!geminiConfigured()) throw new GeminiError("Google AI is not configured");
  const level = (process.env.GEMINI_THINKING_LEVEL?.trim() as JsonRequest["thinking"]) || req.thinking;
  const configs: Record<string, unknown>[] = [
    { responseMimeType: "application/json", responseJsonSchema: req.schema, ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}) },
    ...(level ? [{ responseMimeType: "application/json", responseJsonSchema: req.schema }] : []),
  ];
  let lastError: GeminiError | null = null;
  const started = Date.now();
  const deadline = started + (req.deadlineMs ?? 25_000);
  const chain = geminiChain(req.group ?? "main");
  // skip models that are cooling down, unless every model is: then try them anyway
  const ready = chain.filter((m) => !cooling(m));
  for (const model of ready.length ? ready : chain) {
    const left = deadline - Date.now();
    if (left < 1500) {
      lastError = new GeminiError(`Gemini took longer than ${req.deadlineMs ?? 25_000} ms`, 408, model);
      break;
    }
    for (const config of configs) {
      try {
        const text = await call(model, { ...req, timeoutMs: Math.min(req.timeoutMs ?? 30_000, deadline - Date.now()) }, config);
        return { data: parseJson<T>(text, model), model };
      } catch (e) {
        lastError = e instanceof GeminiError ? e : new GeminiError(e instanceof Error ? e.message : String(e), null, model);
        if (lastError.status === 400) continue; // ask the same model again without the thinking setting
        break;
      }
    }
    if (!lastError || !tryNext(lastError)) break;
    coolDown(model, lastError.status, lastError.retryAfterMs);
    console.warn(`[gemini] ${model} unavailable (${lastError.status ?? "no status"}: ${lastError.message.slice(0, 120)}), trying the next model`);
  }
  throw lastError ?? new GeminiError("Gemini request failed");
}

async function call(model: string, req: JsonRequest, outputShape: Record<string, unknown>): Promise<string> {
  let res: Response;
  try {
    res = await googleGenerateContent(model, {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.contents,
        generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxOutputTokens ?? 4096, ...outputShape },
      }, AbortSignal.timeout(Math.max(1, req.timeoutMs ?? 30_000)));
  } catch (e) {
    throw new GeminiError(`Gemini network error: ${e instanceof Error ? e.message : String(e)}`, null, model);
  }
  const data = (await res.json().catch(() => ({}))) as GenerateResponse;
  if (!res.ok) {
    if (res.status === 400) console.warn("[gemini] invalid request", JSON.stringify(data.error));
    const delay = data.error?.details?.find((d) => d.retryDelay)?.retryDelay;
    const retryAfterMs = delay ? Math.round(parseFloat(delay) * 1000) || null : null;
    throw new GeminiError(data.error?.message ?? `Gemini HTTP ${res.status}`, res.status, model, retryAfterMs);
  }
  if (data.promptFeedback?.blockReason) throw new GeminiError(`Gemini blocked the prompt (${data.promptFeedback.blockReason})`, 400, model);
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new GeminiError(`Gemini returned no text (${candidate?.finishReason ?? "no candidate"})`, null, model);
  return text;
}

/** Tolerant JSON extraction: strips code fences and anything around the outer object. */
function parseJson<T>(text: string, model: string): T {
  const unfenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new GeminiError("Gemini reply was not JSON", null, model);
  try {
    return JSON.parse(unfenced.slice(start, end + 1)) as T;
  } catch {
    throw new GeminiError("Gemini reply was not valid JSON", null, model);
  }
}
