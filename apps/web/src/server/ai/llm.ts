import "server-only";

/**
 * The language-model client shared by the planner, Pip's help chat and the
 * profiling helpers. Callers build OpenAI-style chat requests and read
 * OpenAI-style responses; the adapter for the configured provider does the
 * rest, so switching models is a change to `.env.local` only:
 *
 *   LLM_PROVIDER        openai (default: any OpenAI-compatible API, e.g. OpenAI,
 *                       Google Gemini, DeepSeek, Groq, OpenRouter, Ollama, GLM) | anthropic (Claude)
 *   LLM_API_KEY         the key
 *   LLM_MODEL           the model id (defaults below)
 *   LLM_BASE_URL        the API's base URL, for OpenAI-compatible providers
 *   LLM_FALLBACK_MODEL  tried while the main model is overloaded; "none" for none
 *   LLM_REASONING       "enabled" turns on a model's reasoning where supported
 *
 * Without LLM_API_KEY the older GLM_* settings still apply (Z.ai, free flash
 * models), and without any key every caller falls back to its rules. Callers
 * turn an LlmError into words for the learner, so this file writes none.
 */

export type LlmProvider = "openai" | "anthropic";

export type LlmConfig = {
  provider: LlmProvider;
  key: string | null;
  baseUrl: string;
  model: string;
  fallback: string | null;
  reasoning: boolean;
  /** Z.ai / BigModel: accepts `thinking`, reports its own error codes */
  glm: boolean;
};

const env = (k: string) => process.env[k]?.trim() || undefined;

export function llmConfig(): LlmConfig {
  const own = env("LLM_API_KEY");
  // no LLM_API_KEY: the GLM setup this project started with
  if (!own) {
    const baseUrl = (env("GLM_BASE_URL") ?? "https://api.z.ai/api/paas/v4").replace(/\/+$/, "");
    const fallback = env("GLM_FALLBACK_MODEL") ?? "glm-4.5-flash";
    return {
      provider: "openai",
      key: env("GLM_API_KEY") ?? null,
      baseUrl,
      model: env("GLM_MODEL") ?? "glm-4.7-flash",
      fallback: fallback.toLowerCase() === "none" ? null : fallback,
      reasoning: env("GLM_THINKING")?.toLowerCase() === "enabled",
      glm: true,
    };
  }
  const provider: LlmProvider = env("LLM_PROVIDER")?.toLowerCase() === "anthropic" ? "anthropic" : "openai";
  const baseUrl = (env("LLM_BASE_URL") ?? (provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1")).replace(/\/+$/, "");
  const fallback = env("LLM_FALLBACK_MODEL");
  return {
    provider,
    key: own,
    baseUrl,
    model: env("LLM_MODEL") ?? (provider === "anthropic" ? "claude-haiku-5-5" : "gpt-4o-mini"),
    fallback: fallback && fallback.toLowerCase() !== "none" ? fallback : null,
    reasoning: env("LLM_REASONING")?.toLowerCase() === "enabled",
    glm: /z\.ai|bigmodel\.cn/.test(baseUrl),
  };
}

export const aiConfigured = () => !!llmConfig().key;
export const llmModel = () => llmConfig().model;
export const llmProvider = () => llmConfig().provider;
/**
 * Models whose quota ran out (a 429 that says so, e.g. a free tier's daily
 * limit), with when to try again: skipped until then, so no call is wasted on
 * every turn. In memory, per server process.
 */
const exhausted = new Map<string, number>();
const RETRY_DEFAULT_MS = 60 * 60_000;

/** The models to try in order: the main one, then the fallback; any whose quota ran out go last. */
export function llmModels(): string[] {
  const c = llmConfig();
  const all = [...new Set([c.model, ...(c.fallback ? [c.fallback] : [])])];
  const now = Date.now();
  const ready = all.filter((m) => (exhausted.get(m) ?? 0) <= now);
  return ready.length ? ready : all;
}

/** For tests. */
export const resetExhaustedModels = () => exhausted.clear();
export const llmReasoning = (): "enabled" | "disabled" => (llmConfig().reasoning ? "enabled" : "disabled");

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatRequest = {
  model: string;
  messages: LlmMessage[];
  /** json_object asks for a JSON reply; providers without a JSON mode get the instruction from the prompt alone */
  response_format?: { type: "json_object" | "text" };
  thinking: { type: "enabled" | "disabled" };
  max_tokens: number;
  temperature: number;
};
export type ChatResponse = {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
};

/** One chat-completion call. The default goes over HTTP; tests pass a stand-in. */
export type LlmTransport = (req: ChatRequest) => Promise<ChatResponse>;

/** What went wrong, for the caller to word. `detail` is the operator's version, for the server log. */
export class LlmError extends Error {
  constructor(
    readonly kind: "unconfigured" | "rejected" | "balance" | "model" | "busy" | "failed",
    readonly detail: string,
  ) {
    super(detail);
  }
  get busy() {
    return this.kind === "busy";
  }
}

/* ---------------------------------------------------------------- adapters (pure, tested) */

/**
 * OpenAI-compatible request body. OpenAI's own reasoning models take
 * max_completion_tokens and no temperature; Gemini thinks by default, so it is
 * asked for low reasoning unless reasoning is switched on (thinking tokens
 * otherwise eat the reply budget and slow short JSON answers).
 */
export function openAiBody(req: ChatRequest, c: Pick<LlmConfig, "baseUrl" | "glm">): Record<string, unknown> {
  const official = /api\.openai\.com/.test(c.baseUrl);
  const gemini = /generativelanguage\.googleapis\.com/.test(c.baseUrl);
  const reasoningModel = official && /^(o\d|gpt-5)/.test(req.model);
  return {
    model: req.model,
    messages: req.messages,
    ...(official ? { max_completion_tokens: req.max_tokens } : { max_tokens: req.max_tokens }),
    ...(reasoningModel ? {} : { temperature: req.temperature }),
    ...(req.response_format ? { response_format: req.response_format } : {}),
    // only GLM knows this switch; others reject unknown fields
    ...(c.glm ? { thinking: req.thinking } : {}),
    ...(gemini ? { reasoning_effort: req.thinking.type === "enabled" ? "high" : "low" } : {}),
  };
}

/** Anthropic Messages API request body: system text apart, alternating user/assistant turns. */
export function anthropicBody(req: ChatRequest): Record<string, unknown> {
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of req.messages) {
    if (m.role === "system") continue;
    const last = turns.at(-1);
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else turns.push({ role: m.role, content: m.content });
  }
  if (turns[0]?.role !== "user") turns.unshift({ role: "user", content: "(start)" });
  const json = req.response_format?.type === "json_object" ? "\n\nReply with one JSON object only, no prose before or after it." : "";
  return { model: req.model, max_tokens: req.max_tokens, temperature: req.temperature, ...(system || json ? { system: system + json } : {}), messages: turns };
}

type AnthropicReply = {
  model?: string;
  content?: { type: string; text?: string }[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
};

/** An Anthropic reply in the OpenAI shape callers read. */
export function fromAnthropic(r: AnthropicReply): ChatResponse {
  const text = (r.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
  const finish = r.stop_reason === "max_tokens" ? "length" : r.stop_reason === "refusal" ? "sensitive" : "stop";
  const u = r.usage ?? {};
  return {
    model: r.model,
    choices: [{ finish_reason: finish, message: { content: text } }],
    usage: {
      prompt_tokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
      completion_tokens: u.output_tokens ?? 0,
      prompt_tokens_details: { cached_tokens: u.cache_read_input_tokens ?? 0 },
    },
  };
}

/* ---------------------------------------------------------------- HTTP */

/** How patient one call is: the planner waits minutes, chat and profiling seconds. */
export type LlmPatience = { timeoutMs: number; retries: number; backoffMs: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function llmHttp({ timeoutMs, retries, backoffMs }: LlmPatience): LlmTransport {
  return async (req) => {
    const c = llmConfig();
    if (!c.key) throw new LlmError("unconfigured", "No LLM_API_KEY (or GLM_API_KEY) is set.");
    const anthropic = c.provider === "anthropic";
    const name = c.glm ? "GLM" : anthropic ? "Anthropic" : "OpenAI-compatible";
    const url = anthropic ? `${c.baseUrl}/v1/messages` : `${c.baseUrl}/chat/completions`;
    const headers: Record<string, string> = anthropic
      ? { "content-type": "application/json", "x-api-key": c.key, "anthropic-version": "2023-06-01" }
      : { "content-type": "application/json", authorization: `Bearer ${c.key}` };
    const body = JSON.stringify(anthropic ? anthropicBody(req) : openAiBody(req, c));
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        if (attempt < retries) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw new LlmError("busy", `Couldn't reach the ${name} API: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (res.ok) {
        const json = await res.json();
        return anthropic ? fromAnthropic(json as AnthropicReply) : (json as ChatResponse);
      }
      // Gemini wraps its error in a list
      const raw = (await res.json().catch(() => ({}))) as unknown;
      const err = (Array.isArray(raw) ? raw[0] : raw) as { error?: { code?: string | number; message?: string; status?: string } };
      const code = String(err.error?.code ?? "");
      const detail = `${name} API error ${res.status} (${req.model}): ${err.error?.message ?? res.statusText}`;
      if (res.status === 401 || res.status === 403) throw new LlmError("rejected", `The ${name} API key was rejected.`);
      if (res.status === 402 || code === "1113" || code === "insufficient_quota") throw new LlmError("balance", `The account has no balance for ${req.model}.`);
      if (res.status === 404 || code === "1211" || code === "model_not_found") throw new LlmError("model", `The provider doesn't know the model "${req.model}". Check LLM_MODEL.`);
      // out of quota: no use retrying this model for a while
      if (res.status === 429 && /quota|RESOURCE_EXHAUSTED|billing/i.test(`${err.error?.message ?? ""} ${err.error?.status ?? ""}`)) {
        const wait = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(err.error?.message ?? "");
        const ms = wait ? ((+(wait[1] ?? 0) * 60 + +(wait[2] ?? 0)) * 60 + +(wait[3] ?? 0)) * 1000 : RETRY_DEFAULT_MS;
        exhausted.set(req.model, Date.now() + (ms || RETRY_DEFAULT_MS));
        throw new LlmError("busy", `${name}: quota used up for ${req.model}; skipping it for ${Math.round((ms || RETRY_DEFAULT_MS) / 60_000)} min.`);
      }
      // overloaded (429, 5xx, Anthropic's 529): wait, then the caller may try the fallback model
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(backoffMs * 2 ** attempt);
          continue;
        }
        throw new LlmError("busy", detail);
      }
      throw new LlmError("failed", detail);
    }
  };
}
