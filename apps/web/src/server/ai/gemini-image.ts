import "server-only";
import { googleGenerateContent } from "./google-transport";
import { GeminiError, geminiChain, geminiConfigured } from "@/server/ai/gemini";

/**
 * Pictures from Gemini's image chain, for Mission scenes. Kept apart from
 * gemini.ts but sharing its cool-down list. Image models have no free quota
 * (Google answers 429 with "limit: 0" until billing is on), so that answer
 * pauses image requests for ten minutes instead of retrying on every scene.
 */

const coolingUntil: Map<string, number> = ((globalThis as { __geminiCooling?: Map<string, number> }).__geminiCooling ??= new Map());
const ready = (model: string) => (coolingUntil.get(model) ?? 0) <= Date.now();

/** True when image models may be tried (configured, and not paused after a "no quota" answer). */
export const geminiImagesReady = () => geminiConfigured() && geminiChain("image").some(ready);

type ImageResponse = {
  candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
  error?: { message?: string };
};

/** One picture; a reference picture keeps characters and look the same across scenes. */
export async function geminiImage(req: {
  prompt: string;
  reference?: { mimeType: string; data: string } | null;
  aspectRatio?: string;
  deadlineMs?: number;
}): Promise<{ data: Buffer; mimeType: string; model: string }> {
  if (!geminiConfigured()) throw new GeminiError("Google AI is not configured");
  const chain = geminiChain("image").filter(ready);
  if (!chain.length) throw new GeminiError("Image models are paused (no quota)", 429);
  const deadline = Date.now() + (req.deadlineMs ?? 40_000);
  let lastError: GeminiError | null = null;
  for (const model of chain) {
    const left = deadline - Date.now();
    if (left < 2000) break;
    try {
      const res = await googleGenerateContent(model, {
          contents: [{ role: "user", parts: [...(req.reference ? [{ inlineData: req.reference }] : []), { text: req.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: req.aspectRatio ?? "16:9" } },
        }, AbortSignal.timeout(left));
      const data = (await res.json().catch(() => ({}))) as ImageResponse;
      if (!res.ok) {
        const message = data.error?.message ?? `Gemini HTTP ${res.status}`;
        // no quota at all (billing off): pause 10 minutes, so turning billing on takes effect soon; busy: a minute
        if (res.status === 429) coolingUntil.set(model, Date.now() + (/limit: 0\b/.test(message) ? 10 : 1) * 60_000);
        else if (res.status >= 500) coolingUntil.set(model, Date.now() + 20_000);
        throw new GeminiError(message, res.status, model);
      }
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!part) throw new GeminiError("Gemini returned no image", null, model);
      return { data: Buffer.from(part.data, "base64"), mimeType: part.mimeType, model };
    } catch (e) {
      lastError = e instanceof GeminiError ? e : new GeminiError(e instanceof Error ? e.message : String(e), null, model);
      // a bad key or a refused prompt fails the same way on every model
      if (lastError.status !== null && lastError.status !== 404 && lastError.status !== 429 && lastError.status < 500) break;
    }
  }
  throw lastError ?? new GeminiError("No image model answered");
}
