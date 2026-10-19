import { sql } from "drizzle-orm";
import { db, dbKind } from "@/server/db/client";
import { handle, ok } from "@/server/http";
import { aiConfigured, llmModel, llmProvider } from "@/server/ai/llm";
import { geminiChain, geminiConfigured, geminiCooling, geminiModels } from "@/server/ai/gemini";
import { googleProject } from "@/server/ai/google-transport";
import { geminiImagesReady } from "@/server/ai/gemini-image";
import { geminiVoiceReady, ttsChain } from "@/server/ai/gemini-tts";

/** GET /api/v1/health: the database is reachable and migrated; says whether AI planning is configured. */
export const GET = handle(async () => {
  const database = await db();
  const [row] = await database.execute<{ users: number }>(sql`select count(*)::int as users from users`).then((r) => r.rows);
  return ok({
    ok: true,
    database: dbKind(),
    users: row?.users ?? 0,
    ai: geminiConfigured() || aiConfigured(),
    provider: geminiConfigured() ? "google" : aiConfigured() ? llmProvider() : null,
    model: geminiConfigured() ? geminiModels("main")[0] : aiConfigured() ? llmModel() : null,
    adaptiveOnboarding: { enabled: true, decisionSource: "model", project: googleProject() ?? null, location: process.env.GOOGLE_CLOUD_LOCATION || "global" },
    // live generation (Discovery conversation): whether a Gemini key is set, and the Main chain it will try
    gemini: {
      configured: geminiConfigured(),
      main: geminiChain("main"),
      coolingDown: geminiCooling("main"),
      // Mission pictures: false while image models are paused (no quota until billing is on)
      images: { ready: geminiImagesReady(), chain: geminiChain("image"), paused: geminiCooling("image") },
      // Mission narration (Gemini's text-to-speech voices)
      voice: { ready: geminiVoiceReady(), chain: ttsChain() },
    },
  });
});
