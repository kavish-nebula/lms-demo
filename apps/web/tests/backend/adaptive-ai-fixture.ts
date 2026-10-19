type Request = { system: string; contents: { parts: { text: string }[] }[] };
export const responses: unknown[] = [];
export const requests: Request[] = [];
export const geminiConfigured = () => true;
export const geminiModels = () => ["test-evaluator"];
export const ttsChain = () => ["test-voice"];
export class GeminiError extends Error { status: number | null = null; }
export async function geminiJson<T>(request: Request) {
  requests.push(request);
  if (!responses.length) throw new Error("No model fixture response queued");
  return { data: responses.shift() as T, model: "test-evaluator" };
}
export const mediaCalls = { image: 0, audio: 0 };
export async function geminiImage() { mediaCalls.image++; return { data: Buffer.from("RIFFtestWEBP"), mimeType: "image/webp", model: "test-image" }; }
export async function geminiSpeech() { mediaCalls.audio++; return { data: Buffer.from("RIFFtestWAVE"), model: "test-voice" }; }
